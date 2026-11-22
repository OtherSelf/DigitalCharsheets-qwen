#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/dcs-dev.mjs — дев-сервер Digital Character Sheets на Windows
 * ============================================================================
 *
 *  Логика вынесена из batch в Node: cmd.exe разбирает многострочный .bat с
 *  LF-переводами строк со сдвигом и выполняет обрывки строк (в репозитории
 *  файлы хранятся с LF, а ZIP-архив с GitHub атрибуты .gitattributes не
 *  применяет), поэтому scripts/dcs-dev.bat — одна строка, которая запускает
 *  этот файл. Node всё равно нужен проекту, а сообщения в консоль он выводит
 *  в UTF-8 через Unicode API Windows, так что русский текст не ломается.
 *
 *  Команды:
 *    start    — npm ci при отсутствии node_modules, npm run dev в фоне,
 *               ожидание 200 от /api/health;
 *    stop     — погасить дерево процессов сервера и дождаться свободного порта;
 *    restart  — stop + удаление .next + start;
 *    status   — порт, процесс, health, ветка и коммит, аккаунты, хвост лога;
 *    logs [N] — хвост лога и слежение за ним, Ctrl-C — выйти;
 *    open     — открыть http://HOST:PORT/login в браузере.
 *
 *  Флаги: -p/--port (3000), -H/--host (127.0.0.1), --timeout (120),
 *  -f/--force-install, --skip-install, --fresh.
 *  Окружение: DCS_PORT, DCS_HOST, DCS_READY_TIMEOUT, DCS_LOG_DIR, DCS_DATA_DIR.
 *
 *  Использование:
 *    scripts\dcs-dev.bat            # start
 *    scripts\dcs-dev.bat status
 *    scripts\dcs-dev.bat -p 3002
 *    node scripts/dcs-dev.mjs stop
 * ============================================================================
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const MIN_NODE = [22, 12];
const LOG_ROTATE_BYTES = 10 * 1024 * 1024;

const ARGS = process.argv.slice(2);

let command = 'start';
let port = Number(process.env.DCS_PORT ?? 3000);
let host = process.env.DCS_HOST ?? '127.0.0.1';
let timeout = Number(process.env.DCS_READY_TIMEOUT ?? 120);
let logLines = 200;
let forceInstall = false;
let skipInstall = false;
let fresh = false;

const DATA_DIR = process.env.DCS_DATA_DIR || join(ROOT, 'data');

// Пути и URL зависят от -p/--port, а его разбирает parseArgs, поэтому
// считаем их функциями: константа на уровне модуля осталась бы со старым
// портом и health опрашивался бы не там, где поднят сервер.
function logDir() {
  return (
    process.env.DCS_LOG_DIR ||
    (IS_WIN
      ? join(
          process.env.LOCALAPPDATA || process.env.TEMP || os.tmpdir(),
          'dcs-dev',
          'logs',
        )
      : join(os.tmpdir(), 'dcs-dev', 'logs'))
  );
}

function logFile() {
  return join(logDir(), `dcs-dev-${port}.log`);
}

function pidFile() {
  return join(logDir(), `dcs-dev-${port}.pid`);
}

// На 0.0.0.0 и :: проверять здоровье бессмысленно: это адрес биндинга,
// а не адрес назначения, поэтому стучимся на loopback.
function checkHost() {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}

function healthUrl() {
  return `http://${checkHost()}:${port}/api/health`;
}

function loginUrl() {
  return `http://${checkHost()}:${port}/login`;
}

// ── вывод ───────────────────────────────────────────────────────────────────
const dim = (text) => console.log(`\x1b[2m${text}\x1b[0m`);
const step = (text) => console.log(`\x1b[36m▶\x1b[0m ${text}`);
const ok = (text) => console.log(`\x1b[32m✓\x1b[0m ${text}`);
const warn = (text) => console.error(`\x1b[33m!\x1b[0m ${text}`);

function fail(message) {
  console.error(`\x1b[31m✗\x1b[0m ${message}`);
  process.exit(1);
}

// ── аргументы ───────────────────────────────────────────────────────────────
function usage() {
  console.log(`dcs-dev.bat / node scripts/dcs-dev.mjs — дев-сервер Digital Character Sheets

Использование:
  scripts\\dcs-dev.bat start [флаги]   поднять сервер (по умолчанию)
  scripts\\dcs-dev.bat stop            остановить и освободить порт
  scripts\\dcs-dev.bat restart [флаги] stop + start, кеш .next стирается
  scripts\\dcs-dev.bat status          порт, процесс, health, ветка и коммит
  scripts\\dcs-dev.bat logs [N]        последние N строк лога и слежение
  scripts\\dcs-dev.bat open            открыть /login в браузере
  scripts\\dcs-dev.bat help            эта справка

Флаги:
  -p, --port PORT      порт дев-сервера, по умолчанию 3000
  -H, --host ADDR      адрес прослушивания, по умолчанию 127.0.0.1
      --timeout SEC    сколько ждать ответа сервера, по умолчанию 120
  -f, --force-install  выполнить npm ci, даже если зависимости на месте
      --skip-install   не проверять и не ставить зависимости
      --fresh          удалить .next перед запуском
  -h, --help           эта справка

Окружение: DCS_PORT, DCS_HOST, DCS_READY_TIMEOUT, DCS_LOG_DIR, DCS_DATA_DIR
Лог: ${logFile()}`);
}

function parseArgs() {
  for (let i = 0; i < ARGS.length; i += 1) {
    const arg = ARGS[i];
    switch (arg) {
      case 'start':
      case 'stop':
      case 'restart':
      case 'status':
      case 'logs':
      case 'open':
      case 'help':
        command = arg;
        break;
      case '-p':
      case '--port':
        port = Number(ARGS[i + 1]);
        i += 1;
        break;
      case '-H':
      case '--host':
        host = ARGS[i + 1] ?? '';
        i += 1;
        break;
      case '--timeout':
        timeout = Number(ARGS[i + 1]);
        i += 1;
        break;
      case '-f':
      case '--force-install':
        forceInstall = true;
        break;
      case '--skip-install':
        skipInstall = true;
        break;
      case '--fresh':
        fresh = true;
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      default:
        if (/^\d+$/.test(arg)) {
          logLines = Number(arg);
        } else {
          fail(`неизвестный аргумент: ${arg} (список команд: --help)`);
        }
    }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail('порт должен быть числом 1..65535, например: -p 3001');
  }
  if (!Number.isInteger(timeout) || timeout < 1)
    fail('--timeout должен быть числом секунд');
  if (!host) fail('-H требует значение, например: -H 0.0.0.0');
  if (command === 'help') {
    usage();
    process.exit(0);
  }
}

// ── платформенные мелочи ────────────────────────────────────────────────────
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

function nodeVersionOk() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}

function checkNode() {
  if (!nodeVersionOk()) {
    fail(
      `нужен Node.js ${MIN_NODE.join('.')} или новее, сейчас v${process.versions.node} ` +
        '(версия закреплена в package.json)',
    );
  }
  ok(`Node.js v${process.versions.node}`);
}

/** Запуск процесса без окна; на Windows .cmd требует cmd.exe, поэтому shell. */
function spawnNpm(args, options = {}) {
  return spawn(NPM, args, { shell: IS_WIN, windowsHide: true, ...options });
}

function runNpm(args) {
  const result = spawnSync(NPM, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: IS_WIN,
    windowsHide: true,
  });
  return result.status ?? 1;
}

function portBusy() {
  return new Promise((done) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      done(value);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function httpOk(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processName(pid) {
  if (IS_WIN) {
    const out = spawnSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { encoding: 'utf8' },
    ).stdout;
    const match = /^"([^"]+)"/.exec((out ?? '').trim());
    return match ? match[1].toLowerCase() : '';
  }
  try {
    return readFileSync(`/proc/${pid}/comm`, 'utf8').trim().toLowerCase();
  } catch {
    return '';
  }
}

const isNodeProcess = (name) => /^node(\.exe)?$/.test(name);

function readPid() {
  try {
    const pid = Number(readFileSync(pidFile(), 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function writePid(pid) {
  mkdirSync(logDir(), { recursive: true });
  writeFileSync(pidFile(), `${pid}\n`);
}

function clearPid() {
  rmSync(pidFile(), { force: true });
}

/**
 * PID по порту — запасной путь, если pid-файла нет (сервер подняли вручную).
 * Состояния netstat локализованы, поэтому строку состояния не разбираем:
 * смотрим только локальный адрес и последнее поле — PID.
 */
function findPidByPort() {
  if (IS_WIN) {
    const out =
      spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' })
        .stdout ?? '';
    for (const line of out.split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 5) continue;
      if (!fields[1].endsWith(`:${port}`)) continue;
      if (!/^\d+$/.test(fields[4])) continue;
      return Number(fields[4]);
    }
    return null;
  }
  const ss =
    spawnSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' })
      .stdout ?? '';
  const match = /pid=(\d+)/.exec(ss);
  if (match) return Number(match[1]);
  const lsof =
    spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    }).stdout ?? '';
  const pid = lsof.trim().split('\n')[0];
  return /^\d+$/.test(pid) ? Number(pid) : null;
}

function killTree(pid, { group = false, signal = 'SIGTERM' } = {}) {
  if (IS_WIN) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }
  try {
    if (group) process.kill(-pid, signal);
    else process.kill(pid, signal);
  } catch {
    // Процесс уже умер — это и есть цель.
  }
}

async function waitPortFree(seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (!(await portBusy())) return true;
    await sleep(500);
  }
  return !(await portBusy());
}

// ── лог ─────────────────────────────────────────────────────────────────────
function rotateLog() {
  try {
    if (statSync(logFile()).size > LOG_ROTATE_BYTES) {
      renameSync(logFile(), `${logFile()}.1`);
      dim(`лог был больше 10 МБ, старый сохранён как ${logFile()}.1`);
    }
  } catch {
    // Лога ещё нет — ротировать нечего.
  }
}

function appendLog(line) {
  mkdirSync(logDir(), { recursive: true });
  writeFileSync(logFile(), `${line}\n`, { flag: 'a' });
}

function readTail(count) {
  try {
    const size = statSync(logFile()).size;
    const start = Math.max(0, size - 262144);
    const buffer = Buffer.alloc(size - start);
    const fd = openSync(logFile(), 'r');
    readSync(fd, buffer, 0, buffer.length, start);
    closeSync(fd);
    const lines = buffer.toString('utf8').split(/\r?\n/);
    return lines
      .slice(-count - 1)
      .join('\n')
      .trim();
  } catch {
    return '';
  }
}

function printTail(count) {
  const tail = readTail(count);
  if (!tail) return;
  console.log('');
  dim('  -- последние строки лога --');
  console.log(tail);
}

async function followLog(count) {
  if (!existsSync(logFile())) fail(`лога ещё нет: ${logFile()}`);
  const head = readTail(count);
  if (head) console.log(head);
  let offset = statSync(logFile()).size;
  for (;;) {
    await sleep(500);
    let size;
    try {
      size = statSync(logFile()).size;
    } catch {
      continue;
    }
    if (size < offset) offset = 0;
    if (size <= offset) continue;
    const buffer = Buffer.alloc(size - offset);
    const fd = openSync(logFile(), 'r');
    readSync(fd, buffer, 0, buffer.length, offset);
    closeSync(fd);
    process.stdout.write(buffer);
    offset = size;
  }
}

// ── зависимости и кеш ───────────────────────────────────────────────────────
function ensureDeps() {
  if (skipInstall) {
    dim('--skip-install: зависимости не проверяю');
    return;
  }
  const installed =
    existsSync(join(ROOT, 'node_modules', '.package-lock.json')) &&
    existsSync(join(ROOT, 'node_modules', 'next', 'package.json'));
  if (installed && !forceInstall) {
    ok('зависимости на месте, npm ci пропускаю (форсировать: -f)');
    return;
  }
  step('npm ci: зависимостей нет или они неполные, это может занять минуты');
  if (runNpm(['ci', '--no-audit', '--no-fund']) !== 0) {
    fail('npm ci упал, вывод выше. Исправьте причину и повторите.');
  }
  ok('зависимости установлены');
}

/**
 * Кеш Turbopack принадлежит конкретному процессу dev-сервера: вкладка,
 * открытая до рестарта, применяет патчи к графу прошлого процесса и падает с
 * "module factory is not available". data/ при этом не трогаем.
 */
function wipeNext() {
  const nextDir = join(ROOT, '.next');
  if (!existsSync(nextDir)) {
    dim('.next нет, чистить кеш нечего');
    return;
  }
  step('удаляю .next: кеш dev-сервера прошлого процесса');
  try {
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    warn(
      `не удалось удалить .next: ${error.message} — возможно, его держит старый сервер`,
    );
    return;
  }
  ok('кеш .next сброшен');
}

// ── запуск и остановка ─────────────────────────────────────────────────────
async function start() {
  checkNode();
  ensureDeps();

  if (await portBusy()) {
    if (await httpOk(healthUrl())) {
      warn(`сервер уже отвечает на ${loginUrl()} — остановить: stop`);
      return;
    }
    const pid = findPidByPort();
    fail(
      `порт ${port} занят процессом ${pid ? `PID ${pid}` : ''}, это не наш сервер. ` +
        `Закройте его или выберите другой порт: -p 3001`,
    );
  }

  if (fresh) wipeNext();
  rotateLog();
  appendLog(
    `===== ${new Date().toISOString()} | start port ${port} | ${ROOT} =====`,
  );

  step(`запускаю npm run dev на ${host}:${port}`);
  const out = openSync(logFile(), 'a');
  const child = spawnNpm(['run', 'dev', '--', '-p', String(port), '-H', host], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: process.env,
  });
  closeSync(out);
  child.unref();
  child.on('error', (error) =>
    warn(`не удалось запустить npm: ${error.message}`),
  );

  if (!child.pid) fail('npm run dev не запустился (нет PID)');
  writePid(child.pid);

  const ready = await waitReady(child.pid);
  if (!ready) {
    // Неудачный старт не должен оставлять за собой полуживой сервер:
    // иначе следующий запуск упрётся в занятый порт.
    killTree(child.pid, { group: !IS_WIN });
    clearPid();
    printTail(40);
    fail(
      `сервер не ответил на ${healthUrl()} за ${timeout} с (лог: ${logFile()})`,
    );
  }
  printSummary();
}

async function waitReady(pid) {
  step(`жду 200 от ${healthUrl()}, до ${timeout} с`);
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    if (await httpOk(healthUrl())) {
      ok('сервер отвечает');
      return true;
    }
    if (!processAlive(pid)) {
      warn('npm run dev завершился до первого ответа');
      return false;
    }
    await sleep(2000);
  }
  return false;
}

async function stop() {
  let pid = readPid();
  let fromPidFile = Boolean(pid && processAlive(pid));
  if (!fromPidFile) {
    clearPid();
    pid = null;
    const byPort = findPidByPort();
    if (byPort) {
      const name = processName(byPort);
      if (!isNodeProcess(name)) {
        fail(
          `порт ${port} держит ${name || 'неизвестный процесс'} PID ${byPort}, это не Node.js, не трогаю`,
        );
      }
      pid = byPort;
    }
  }
  if (!pid) {
    console.log(`[i] на порту ${port} никто не слушает, останавливать нечего`);
    return;
  }

  step(`останавливаю PID ${pid} на порту ${port}`);
  killTree(pid, { group: fromPidFile });
  if (!(await waitPortFree(20))) {
    warn('мягкая остановка не сработала, снимаю принудительно');
    killTree(pid, { group: fromPidFile, signal: 'SIGKILL' });
    if (!(await waitPortFree(10))) {
      fail(
        `не удалось освободить порт ${port}; проверьте вручную: netstat -ano | findstr :${port}`,
      );
    }
  }
  clearPid();
  ok(`сервер остановлен, порт ${port} свободен`);
}

async function restart() {
  await stop();
  wipeNext();
  await start();
}

// ── состояние ───────────────────────────────────────────────────────────────
function gitInfo() {
  const branch = spawnSync(
    'git',
    ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'],
    {
      encoding: 'utf8',
    },
  );
  if (branch.status !== 0) return null;
  const commit = spawnSync('git', ['-C', ROOT, 'log', '-1', '--format=%h'], {
    encoding: 'utf8',
  });
  return {
    branch: (branch.stdout ?? '').trim(),
    commit: (commit.stdout ?? '').trim(),
  };
}

async function status() {
  console.log('');
  console.log('== DCS dev ==');
  console.log(`  Каталог : ${ROOT}`);
  console.log(`  Хост    : ${host}`);
  console.log(`  Порт    : ${port}`);

  const pid = readPid();
  if (pid && processAlive(pid)) {
    console.log(`  Процесс : ${processName(pid) || 'unknown'} PID ${pid}`);
  } else {
    console.log('  Процесс : не запущен');
  }

  if (await httpOk(healthUrl())) {
    console.log(`  Health  : 200 ${healthUrl()}`);
  } else {
    console.log(`  Health  : нет ответа на ${healthUrl()}`);
  }

  const git = gitInfo();
  if (git?.commit) console.log(`  Код     : ${git.branch} ${git.commit}`);

  if (existsSync(DATA_DIR)) {
    let accounts = 0;
    try {
      accounts = readdirSync(join(DATA_DIR, 'users'), {
        withFileTypes: true,
      }).filter((entry) => entry.isDirectory()).length;
    } catch {
      accounts = 0;
    }
    console.log(`  Данные  : ${DATA_DIR}, аккаунтов: ${accounts}`);
  }

  console.log(`  Лог     : ${logFile()}`);
  printTail(12);
}

function open() {
  const child = IS_WIN
    ? spawn('cmd', ['/c', 'start', '', loginUrl()], {
        windowsHide: true,
        stdio: 'ignore',
        detached: true,
      })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [loginUrl()], {
        stdio: 'ignore',
        detached: true,
      });
  child.on('error', () => {
    // Нет браузера/обработчика URL — это не повод падать вслед за сервером.
  });
  child.unref();
}

function printSummary() {
  console.log('');
  console.log('== Готово ==');
  console.log(`  URL     : ${loginUrl()}`);
  console.log(`  Каталог : ${ROOT}`);
  console.log(`  Лог     : ${logFile()}`);
  console.log(`  Данные  : ${DATA_DIR}`);
  console.log('');
  console.log('  scripts\\dcs-dev.bat status   — состояние сервера');
  console.log('  scripts\\dcs-dev.bat logs     — следить за логом');
  console.log('  scripts\\dcs-dev.bat stop     — остановить');
  console.log('  scripts\\dcs-dev.bat restart  — перезапуск со свежим .next');
}

// ── точка входа ─────────────────────────────────────────────────────────────
parseArgs();

switch (command) {
  case 'start':
    await start();
    break;
  case 'stop':
    await stop();
    break;
  case 'restart':
    await restart();
    break;
  case 'status':
    await status();
    break;
  case 'logs':
    await followLog(logLines);
    break;
  case 'open':
    open();
    break;
  default:
    fail(`неизвестная команда: ${command}`);
}
