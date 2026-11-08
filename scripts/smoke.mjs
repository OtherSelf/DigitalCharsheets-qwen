#!/usr/bin/env node
// ============================================================================
//  scripts/smoke.mjs — дымовой тест РАБОТАЮЩЕГО сервера DigitalCharsheets
//
//  Проверяет по HTTP то, что юнит-тесты проверить не могут: сборку, роутинг,
//  сериализацию ответов, запись в каталог data/. Ничего не устанавливает,
//  зависимостей нет — только node + встроенный fetch (Node 18+).
//
//  Использование:
//    node scripts/smoke.mjs                              # http://localhost:3000
//    node scripts/smoke.mjs -u http://127.0.0.1:3001      # дев-стенд dcs-dev.sh
//    node scripts/smoke.mjs -u http://host:3000 --data-dir /opt/dcs-dev/data
//
//  Флаги:
//    -u, --base-url URL   адрес сервера            (env: BASE_URL, по умолчанию http://localhost:3000)
//        --data-dir DIR   каталог data/ сервера: включает проверки файлов на диске
//                         и удаление тестового аккаунта после прогона
//        --timeout MS     таймаут одного запроса   (по умолчанию 15000)
//        --keep-user      не удалять тестовый аккаунт из --data-dir
//        --verbose        печатать тела ответов при падениях (и так печатаются)
//
//  Код возврата: 0 — все проверки прошли, 1 — были падения, 2 — ошибка в аргументах.
//  Связано: scripts/predeploy.sh (шаг 5/5), dcs-dev.sh test, _RUN_INSTRUCTIONS.md §2.5.
//
//  Скрипт создаёт «мусорный» аккаунт `smoke-<timestamp>-<rand>` и одного
//  персонажа; с --data-dir всё это удаляется в конце (аккаунт + лист).
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── разбор аргументов ───────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  dataDir: '',
  timeout: 15_000,
  keepUser: false,
  verbose: false,
};

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  const next = () => {
    const value = argv[++i];
    if (value === undefined) {
      console.error(`Флаг ${arg} требует значение`);
      process.exit(2);
    }
    return value;
  };

  switch (arg) {
    case '-u':
    case '--base-url':
      opts.baseUrl = next();
      break;
    case '--data-dir':
      opts.dataDir = path.resolve(next());
      break;
    case '--timeout':
      opts.timeout = Number(next());
      break;
    case '--keep-user':
      opts.keepUser = true;
      break;
    case '--verbose':
    case '-v':
      opts.verbose = true;
      break;
    case '-h':
    case '--help':
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 30).join('\n'));
      process.exit(0);
      break;
    default:
      console.error(`Неизвестный флаг: ${arg}`);
      process.exit(2);
  }
}

opts.baseUrl = opts.baseUrl.replace(/\/+$/, '');

// ── цвета/вывод ─────────────────────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = useColor
  ? { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' }
  : { reset: '', dim: '', red: '', green: '', yellow: '', cyan: '', bold: '' };

// ── мини-фреймворк ──────────────────────────────────────────────────────────
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true });
    console.log(`  ${c.green}✓${c.reset} ${name}${detail ? ` ${c.dim}(${detail}, ${ms} мс)${c.reset}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ${c.red}✗${c.reset} ${name}`);
    console.log(`      ${c.red}${String(error?.message || error).replace(/\n/g, '\n      ')}${c.reset}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(res, expected, context) {
  assert(
    res.status === expected,
    `${context}: ожидали HTTP ${expected}, получили ${res.status}. Тело: ${truncate(res.text)}`,
  );
}

function truncate(text, limit = 400) {
  if (typeof text !== 'string') return String(text);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function assertJson(res, context) {
  assert(res.json !== null && typeof res.json === 'object', `${context}: ответ не JSON (${truncate(res.text)})`);
  return res.json;
}

// ── HTTP-хелперы ────────────────────────────────────────────────────────────
async function request(pathname, { method = 'GET', body, redirect = 'manual' } = {}) {
  const url = `${opts.baseUrl}${pathname}`;
  const response = await fetch(url, {
    method,
    redirect,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return { status: response.status, text, json: parsed, headers: response.headers };
}

const api = (pathname, options) => request(`/api${pathname}`, options);

// ── тестовые данные ─────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const username = `smoke-${stamp}-${Math.random().toString(36).slice(2, 7)}`;
const password = 'smoke-pass-1234';
const recoveryPhrase = 'alpha bravo charlie';

const dndCharacter = {
  gameSystem: 'Dungeons & Dragons',
  name: 'Smoke Tester',
  characterClass: 'Fighter',
  race: 'Human',
  background: 'Soldier',
  alignment: 'Lawful Good',
  level: 3,
  stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 9 },
  hitPoints: { current: 24, max: 28 },
  armorClass: 17,
  skills: [],
  equipment: [],
  inventory: [],
  spells: [],
  questLog: [],
  customHouseRules: [],
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

let userId = null;
let characterId = null;

// ── прогон ──────────────────────────────────────────────────────────────────
console.log(`${c.bold}DigitalCharsheets smoke test${c.reset} → ${c.cyan}${opts.baseUrl}${c.reset}`);
if (opts.dataDir) console.log(`${c.dim}каталог данных: ${opts.dataDir}${c.reset}`);
console.log('');

// 1. Страницы отдаются
await check('GET /login → 200 (HTML)', async () => {
  const res = await request('/login');
  assertStatus(res, 200, 'GET /login');
  assert(/text\/html/i.test(res.headers.get('content-type') || ''), 'GET /login: content-type не text/html');
  assert(res.text.includes('<!DOCTYPE html>') || res.text.includes('<html'), 'GET /login: тело не похоже на HTML');
  return `${Math.round(res.text.length / 1024)} КБ`;
});

await check('GET / → 200', async () => {
  const res = await request('/');
  assertStatus(res, 200, 'GET /');
  return `${Math.round(res.text.length / 1024)} КБ`;
});

await check('GET /new → 200', async () => {
  const res = await request('/new');
  assertStatus(res, 200, 'GET /new');
});

await check('GET /new/manual → 200', async () => {
  const res = await request('/new/manual');
  assertStatus(res, 200, 'GET /new/manual');
});

await check('GET /stats-editor → 200', async () => {
  const res = await request('/stats-editor');
  assertStatus(res, 200, 'GET /stats-editor');
});

// 2. Аутентификация
await check('POST /api/auth → регистрация нового аккаунта', async () => {
  const res = await api('/auth', {
    method: 'POST',
    body: { username, password, displayName: 'Smoke Tester' },
  });
  assertStatus(res, 200, 'POST /api/auth');
  const body = assertJson(res, 'POST /api/auth');
  assert(body.success === true, `POST /api/auth: success !== true (${truncate(res.text)})`);
  assert(body.isNewUser === true, 'POST /api/auth: ожидали isNewUser === true при первом входе');
  assert(typeof body.user?.uid === 'string' && body.user.uid.startsWith('user-'), 'POST /api/auth: нет uid вида user-<hash>');
  userId = body.user.uid;
  return userId;
});

await check('POST /api/auth → повторный вход (isNewUser=false, тот же uid)', async () => {
  const res = await api('/auth', { method: 'POST', body: { username, password } });
  assertStatus(res, 200, 'повторный POST /api/auth');
  const body = assertJson(res, 'повторный POST /api/auth');
  assert(body.isNewUser === false, 'повторный вход: ожидали isNewUser === false');
  assert(body.user?.uid === userId, `повторный вход: uid изменился (${body.user?.uid} ≠ ${userId})`);
});

await check('POST /api/auth → 401 на неверный пароль', async () => {
  const res = await api('/auth', { method: 'POST', body: { username, password: 'wrong-password' } });
  assertStatus(res, 401, 'неверный пароль');
  const body = assertJson(res, 'неверный пароль');
  assert(body.success === false, 'неверный пароль: success !== false');
});

await check('POST /api/auth → 400 без пароля', async () => {
  const res = await api('/auth', { method: 'POST', body: { username } });
  assertStatus(res, 400, 'без пароля');
});

await check('POST /api/auth → 400 на пароль короче 4 символов', async () => {
  const res = await api('/auth', { method: 'POST', body: { username: `${username}2`, password: '123' } });
  assertStatus(res, 400, 'короткий пароль');
});

// 3. Лист персонажа: создание/чтение/правка/удаление
await check('GET /api/characters → пустой список у нового аккаунта', async () => {
  const res = await api(`/characters?userId=${encodeURIComponent(userId)}`);
  assertStatus(res, 200, 'GET /api/characters');
  const body = assertJson(res, 'GET /api/characters');
  assert(Array.isArray(body), 'GET /api/characters: ожидали массив');
  assert(body.length === 0, `GET /api/characters: у нового аккаунта уже ${body.length} листов`);
});

await check('GET /api/characters без userId → 400', async () => {
  const res = await api('/characters');
  assertStatus(res, 400, 'GET /api/characters без userId');
});

await check('POST /api/characters → 201 и id персонажа', async () => {
  const res = await api('/characters', { method: 'POST', body: { ...dndCharacter, userId } });
  assertStatus(res, 201, 'POST /api/characters');
  const body = assertJson(res, 'POST /api/characters');
  assert(typeof body.id === 'string' && body.id.length > 0, 'POST /api/characters: нет id');
  assert(body.userId === userId, 'POST /api/characters: userId не сохранён');
  characterId = body.id;
  return `id=${characterId}`;
});

await check('GET /api/characters → созданный лист в списке', async () => {
  const res = await api(`/characters?userId=${encodeURIComponent(userId)}`);
  assertStatus(res, 200, 'GET /api/characters');
  const body = assertJson(res, 'GET /api/characters');
  const found = body.find((item) => item.id === characterId);
  assert(found, `GET /api/characters: лист ${characterId} не найден в списке`);
  assert(found.name === dndCharacter.name, 'GET /api/characters: имя персонажа не совпадает');
});

await check('GET /<id> → 200 (страница листа)', async () => {
  const res = await request(`/${encodeURIComponent(characterId)}`);
  assertStatus(res, 200, `GET /${characterId}`);
});

await check('GET /api/export?characterId → JSON персонажа', async () => {
  const res = await api(`/export?userId=${encodeURIComponent(userId)}&characterId=${encodeURIComponent(characterId)}`);
  assertStatus(res, 200, 'GET /api/export (один)');
  const body = assertJson(res, 'GET /api/export (один)');
  assert(body.id === characterId, 'GET /api/export: вернулся другой персонаж');
  assert(body.gameSystem === dndCharacter.gameSystem, 'GET /api/export: gameSystem потерялся');
});

await check('GET /api/export?characterId=<нет такого> → 404', async () => {
  const res = await api(`/export?userId=${encodeURIComponent(userId)}&characterId=missing-id`);
  assertStatus(res, 404, 'GET /api/export (404)');
});

await check('PUT /api/characters/<id> → правка сохраняется', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'PUT',
    body: { userId, name: 'Smoke Tester Renamed', level: 4 },
  });
  assertStatus(res, 200, 'PUT /api/characters/<id>');
  const body = assertJson(res, 'PUT /api/characters/<id>');
  assert(body.name === 'Smoke Tester Renamed', 'PUT: имя не обновилось');

  const list = await api(`/characters?userId=${encodeURIComponent(userId)}`);
  const saved = assertJson(list, 'GET после PUT').find((item) => item.id === characterId);
  assert(saved?.name === 'Smoke Tester Renamed', 'PUT: изменение не сохранилось в файле');
});

await check('PUT /api/characters/<нет такого> → 404', async () => {
  const res = await api('/characters/missing-id', { method: 'PUT', body: { userId, name: 'X' } });
  assertStatus(res, 404, 'PUT несуществующего');
});

// 4. Файлы на диске (только если знаем --data-dir)
if (opts.dataDir) {
  const userDir = path.join(opts.dataDir, userId);
  const characterFile = path.join(userDir, 'characters', `${characterId}.json`);

  await check('на диске есть data/<uid>/user.json с sha256-хешем пароля', async () => {
    const userFile = path.join(userDir, 'user.json');
    assert(fs.existsSync(userFile), `нет файла ${userFile}`);

    const raw = fs.readFileSync(userFile, 'utf8');
    const parsed = JSON.parse(raw);
    assert(parsed.username === username.toLowerCase(), `user.json: username = ${parsed.username}`);
    assert(parsed.passwordHash === sha256(password), 'user.json: passwordHash не соответствует sha256(password)');
    assert(!raw.includes(password), 'user.json: пароль лежит в открытом виде!');
  });

  await check('на диске есть data/<uid>/characters/<id>.json', async () => {
    assert(fs.existsSync(characterFile), `нет файла ${characterFile}`);
    const parsed = JSON.parse(fs.readFileSync(characterFile, 'utf8'));
    assert(parsed.id === characterId, 'character.json: id не совпадает');
    assert(parsed.name === 'Smoke Tester Renamed', 'character.json: правка не попала на диск');
  });
}

await check('DELETE /api/characters/<id> → 200', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  assertStatus(res, 200, 'DELETE персонажа');
});

await check('DELETE повторно → 404 (файл действительно удалён)', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  assertStatus(res, 404, 'повторный DELETE');
});

// 5. Восстановление доступа
await check('POST /api/auth/phrase → фраза сохраняется', async () => {
  const res = await api('/auth/phrase', { method: 'POST', body: { username, phrase: recoveryPhrase } });
  assertStatus(res, 200, 'POST /api/auth/phrase');
  assert(assertJson(res, 'POST /api/auth/phrase').success === true, 'phrase: success !== true');
});

await check('POST /api/auth/phrase без фразы → 400', async () => {
  const res = await api('/auth/phrase', { method: 'POST', body: { username } });
  assertStatus(res, 400, 'phrase без фразы');
});

await check('POST /api/auth/recover/verify без полей → 400', async () => {
  const res = await api('/auth/recover/verify', { method: 'POST', body: { username } });
  assertStatus(res, 400, 'recover/verify без полей');
});

await check('POST /api/auth/recover/update → 400 на короткую фразу', async () => {
  const res = await api('/auth/recover/update', {
    method: 'POST',
    body: { username, newPassword: 'newpass123', newRecoveryPhrase: 'ab' },
  });
  assertStatus(res, 400, 'recover/update короткая фраза');
});

// 6. Уборка
if (opts.dataDir && userId) {
  const userDir = path.join(opts.dataDir, userId);
  if (opts.keepUser) {
    console.log(`\n${c.yellow}Тестовый аккаунт оставлен: ${userDir}${c.reset}`);
  } else if (fs.existsSync(userDir)) {
    fs.rmSync(userDir, { recursive: true, force: true });
    console.log(`\n${c.dim}Тестовый аккаунт удалён: ${userDir}${c.reset}`);
  }
}

// ── итог ────────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log('');
if (failed === 0) {
  console.log(`${c.green}${c.bold}Итого: ${passed}/${results.length} проверок пройдено.${c.reset}`);
  process.exit(0);
}

console.log(`${c.red}${c.bold}Итого: пройдено ${passed}/${results.length}, провалено ${failed}.${c.reset}`);
for (const result of results.filter((r) => !r.ok)) {
  console.log(`${c.red}  ✗ ${result.name}${c.reset}`);
  if (opts.verbose) console.log(`      ${result.error?.stack || result.error}`);
}
process.exit(1);
