#!/usr/bin/env node
/**
 * Управление теневыми копиями удалённых аккаунтов.
 *
 * Это операторский инструмент, а не пользовательский API: он работает
 * напрямую с data-dir, не требует сессии и предназначен для восстановления
 * аккаунта в течение срока хранения (14 дней).
 *
 *   node scripts/trash.mjs list
 *   node scripts/trash.mjs restore-account <uid|каталог>
 *   node scripts/trash.mjs purge [--all] [--yes]
 *
 * `restore-account` возвращает каталог в `users/<uid>`, убирает служебный
 * `meta.json` и удаляет производный индекс логинов: он пересоберётся при
 * первом входе. Пароль, TOTP и листы восстанавливаются вместе с каталогом.
 */
import fs from 'node:fs';
import path from 'node:path';

const RETENTION_DAYS = 14;

function dataDir() {
  const fromEnv = process.env.DCS_DATA_DIR;
  return path.resolve(
    fromEnv && fromEnv.trim() !== ''
      ? fromEnv.trim()
      : path.join(process.cwd(), 'data'),
  );
}

function accountTrashDir() {
  return path.join(dataDir(), '.trash', 'users');
}

/**
 * Перемещение с фолбэком на EXDEV: data-dir может лежать на 9p/overlayfs,
 * где rename между каталогами запрещён. Копируем и удаляем источник.
 */
function movePath(source, destination) {
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.cpSync(source, destination, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listAccounts() {
  const root = accountTrashDir();
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const meta = readJson(path.join(dir, 'meta.json'));
    const expiresAt = meta?.expiresAt ? Date.parse(meta.expiresAt) : NaN;
    items.push({
      dir,
      name: entry.name,
      uid: typeof meta?.uid === 'string' ? meta.uid : null,
      deletedAt: typeof meta?.deletedAt === 'string' ? meta.deletedAt : null,
      expiresAt: Number.isFinite(expiresAt)
        ? new Date(expiresAt).toISOString()
        : null,
      expired: Number.isFinite(expiresAt) ? expiresAt <= Date.now() : false,
    });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function usage() {
  console.log(`Использование:
  node scripts/trash.mjs list
  node scripts/trash.mjs restore-account <uid|каталог>
  node scripts/trash.mjs purge [--all] [--yes]

DCS_DATA_DIR — каталог данных (по умолчанию ./data).
Срок хранения теневой копии — ${RETENTION_DAYS} дней; purge без --all удаляет
только просроченные записи.`);
}

function cmdList() {
  const items = listAccounts();
  if (items.length === 0) {
    console.log('Теневых копий аккаунтов нет.');
    return;
  }
  for (const item of items) {
    console.log(
      `${item.expired ? ' expired ' : ' active  '} ${item.name}` +
        `  uid=${item.uid ?? '?'}  expiresAt=${item.expiresAt ?? '?'}`,
    );
  }
}

function cmdRestore(target) {
  if (!target) {
    console.error('restore-account: нужен uid или каталог теневой копии.');
    process.exitCode = 2;
    return;
  }

  const items = listAccounts();
  const item = items.find(
    (candidate) =>
      candidate.name === target ||
      candidate.dir === path.resolve(target) ||
      candidate.uid === target,
  );
  if (!item) {
    console.error(`restore-account: копия не найдена: ${target}`);
    process.exitCode = 1;
    return;
  }

  const meta = readJson(path.join(item.dir, 'meta.json'));
  const uid = typeof meta?.uid === 'string' ? meta.uid : item.uid;
  if (!uid) {
    console.error('restore-account: в meta.json нет uid.');
    process.exitCode = 1;
    return;
  }

  const destination = path.join(dataDir(), 'users', uid);
  if (fs.existsSync(destination)) {
    console.error(
      `restore-account: users/${uid} уже существует, не перезаписываю.`,
    );
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  movePath(item.dir, destination);
  try {
    fs.unlinkSync(path.join(destination, 'meta.json'));
  } catch {
    // Служебный файл мог не записаться — не мешает восстановлению.
  }
  try {
    fs.unlinkSync(path.join(dataDir(), 'index', 'logins.json'));
  } catch {
    // Индекс производный и так пересоберётся.
  }
  console.log(`Восстановлен аккаунт ${uid} → users/${uid}.`);
}

function cmdPurge(all, yes) {
  const items = listAccounts().filter((item) => all || item.expired);
  if (items.length === 0) {
    console.log('Нечего очищать.');
    return;
  }
  if (!yes) {
    console.error(
      `Будет удалено записей: ${items.length}. Повторите с --yes, чтобы подтвердить.`,
    );
    process.exitCode = 2;
    return;
  }
  for (const item of items) {
    fs.rmSync(item.dir, { recursive: true, force: true });
    console.log(`Удалено: ${item.name}`);
  }
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'list':
    cmdList();
    break;
  case 'restore-account':
    cmdRestore(args.find((arg) => !arg.startsWith('--')));
    break;
  case 'purge':
    cmdPurge(args.includes('--all'), args.includes('--yes'));
    break;
  case undefined:
  case '-h':
  case '--help':
    usage();
    break;
  default:
    console.error(`Неизвестная команда: ${command}`);
    usage();
    process.exitCode = 2;
}
