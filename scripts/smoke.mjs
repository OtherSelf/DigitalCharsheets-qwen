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
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
      console.log(
        fs
          .readFileSync(new URL(import.meta.url), 'utf8')
          .split('\n')
          .slice(1, 30)
          .join('\n'),
      );
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
  ? {
      reset: '\x1b[0m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      bold: '\x1b[1m',
    }
  : { reset: '', dim: '', red: '', green: '', yellow: '', cyan: '', bold: '' };

// ── мини-фреймворк ──────────────────────────────────────────────────────────
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true });
    console.log(
      `  ${c.green}✓${c.reset} ${name}${detail ? ` ${c.dim}(${detail}, ${ms} мс)${c.reset}` : ''}`,
    );
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ${c.red}✗${c.reset} ${name}`);
    console.log(
      `      ${c.red}${String(error?.message || error).replace(/\n/g, '\n      ')}${c.reset}`,
    );
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
  assert(
    res.json !== null && typeof res.json === 'object',
    `${context}: ответ не JSON (${truncate(res.text)})`,
  );
  return res.json;
}

// ── HTTP-хелперы ────────────────────────────────────────────────────────────
// Сессия — httpOnly-cookie: fetch в Node не хранит cookie jar, поэтому
// запоминаем её из ответа /api/auth и передаём вручную.
let sessionCookie = '';

async function request(
  pathname,
  { method = 'GET', body, redirect = 'manual', auth = true } = {},
) {
  const url = `${opts.baseUrl}${pathname}`;
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && sessionCookie) headers.cookie = sessionCookie;

  const response = await fetch(url, {
    method,
    redirect,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout),
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) sessionCookie = setCookie.split(';')[0];

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return {
    status: response.status,
    text,
    json: parsed,
    headers: response.headers,
  };
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
  stats: {
    strength: 16,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 11,
    charisma: 9,
  },
  hitPoints: { current: 24, max: 28 },
  armorClass: 17,
  skills: [],
  equipment: [],
  inventory: [],
  spells: [],
  questLog: [],
  customHouseRules: [],
};

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

let userId = null;
let characterId = null;

// ── прогон ──────────────────────────────────────────────────────────────────
console.log(
  `${c.bold}DigitalCharsheets smoke test${c.reset} → ${c.cyan}${opts.baseUrl}${c.reset}`,
);
if (opts.dataDir)
  console.log(`${c.dim}каталог данных: ${opts.dataDir}${c.reset}`);
console.log('');

// 1. Страницы отдаются
await check('GET /login → 200 (HTML)', async () => {
  const res = await request('/login');
  assertStatus(res, 200, 'GET /login');
  assert(
    /text\/html/i.test(res.headers.get('content-type') || ''),
    'GET /login: content-type не text/html',
  );
  assert(
    res.text.includes('<!DOCTYPE html>') || res.text.includes('<html'),
    'GET /login: тело не похоже на HTML',
  );
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

await check('GET /admin → 200 (страница админки существует)', async () => {
  const res = await request('/admin');
  assertStatus(res, 200, 'GET /admin');
  assert(
    /text\/html/i.test(res.headers.get('content-type') || ''),
    'GET /admin: content-type не text/html',
  );
});

await check('GET /api/openapi.json → 200 (OpenAPI 3.x)', async () => {
  const res = await request('/api/openapi.json', { auth: false });
  assertStatus(res, 200, 'GET /api/openapi.json');
  const body = assertJson(res, 'GET /api/openapi.json');
  assert(
    typeof body.openapi === 'string' && body.openapi.startsWith('3.'),
    `GET /api/openapi.json: openapi = ${body.openapi}`,
  );
  assert(
    body.paths && body.paths['/api/auth'] && body.paths['/api/auth'].post,
    'GET /api/openapi.json: нет POST /api/auth',
  );
  assert(
    body.paths['/api/admin/users'] && body.paths['/api/admin/users'].get,
    'GET /api/openapi.json: нет GET /api/admin/users',
  );
  return body.openapi;
});

await check('GET /api/docs → 200 (Scalar HTML со своим бандлом)', async () => {
  const res = await request('/api/docs', { auth: false });
  assertStatus(res, 200, 'GET /api/docs');
  assert(
    /text\/html/i.test(res.headers.get('content-type') || ''),
    'GET /api/docs: content-type не text/html',
  );
  assert(
    res.text.replace(/\\\//g, '/').includes('/api/openapi.json'),
    'GET /api/docs: HTML не ссылается на /api/openapi.json',
  );

  // CSP приложения — `script-src 'self'`: бандл с чужого хоста браузер не
  // загрузит, и страница молча останется пустой. Поэтому проверяем и то, что
  // src относительный, и то, что файл действительно отдаётся нашим сервером.
  const src =
    (res.text.replace(/\\\//g, '/').match(/<script[^>]+src="([^"]+)"/) ||
      [])[1] || '';
  assert(
    src.startsWith('/'),
    `GET /api/docs: бандл Scalar не со своего origin (${truncate(src)})`,
  );
  const bundle = await fetch(`${opts.baseUrl}${src}`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(opts.timeout),
  });
  assertStatus(
    { status: bundle.status, text: '' },
    200,
    `HEAD ${src} (бандл Scalar)`,
  );
  return src;
});

await check('GET /api/health → 200 (JSON, без сессии)', async () => {
  const res = await request('/api/health', { auth: false });
  assertStatus(res, 200, 'GET /api/health');
  assert(
    /application\/json/i.test(res.headers.get('content-type') || ''),
    'GET /api/health: content-type не application/json',
  );
  const body = assertJson(res, 'GET /api/health');
  assert(body.status === 'ok', `GET /api/health: status = ${body.status}`);
  assert(
    body.checks?.dataDir === 'ok',
    `GET /api/health: dataDir = ${body.checks?.dataDir}`,
  );
  assert(typeof body.version === 'string', 'GET /api/health: нет version');
  assert(
    /no-store/i.test(res.headers.get('cache-control') || ''),
    'GET /api/health: cache-control без no-store',
  );
  return `version ${body.version}`;
});

await check('GET /api/version → 200 (JSON, без сессии)', async () => {
  const res = await request('/api/version', { auth: false });
  assertStatus(res, 200, 'GET /api/version');
  const body = assertJson(res, 'GET /api/version');
  assert(body.name === 'Digital Character Sheets', 'GET /api/version: name');
  assert(typeof body.version === 'string', 'GET /api/version: нет version');
  // commitShort — либо строка (commit задан), либо null (переменных нет).
  assert(
    body.commitShort === null || typeof body.commitShort === 'string',
    'GET /api/version: commitShort не строка и не null',
  );
  assert(
    body.commitShort === null ||
      (body.commitShort.length === 7 &&
        body.commitShort === body.commitShort.toLowerCase()),
    'GET /api/version: commitShort не 7 символов в нижнем регистре',
  );
  assert(
    body.runtime && typeof body.runtime.node === 'string',
    'GET /api/version: нет runtime.node',
  );
  return `${body.name} ${body.version}`;
});

// 1.1 Браузерные границы (SEC-11)
await check('GET /login → заголовки безопасности', async () => {
  const res = await request('/login', { auth: false });
  assertStatus(res, 200, 'GET /login (заголовки)');

  const csp = res.headers.get('content-security-policy') || '';
  assert(
    /frame-ancestors 'none'/.test(csp),
    `CSP без frame-ancestors: ${truncate(csp)}`,
  );
  assert(/object-src 'none'/.test(csp), `CSP без object-src: ${truncate(csp)}`);
  assert(
    res.headers.get('x-frame-options') === 'DENY',
    `X-Frame-Options = ${res.headers.get('x-frame-options')}`,
  );
  assert(
    res.headers.get('x-content-type-options') === 'nosniff',
    `X-Content-Type-Options = ${res.headers.get('x-content-type-options')}`,
  );
  assert(
    res.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
    `Referrer-Policy = ${res.headers.get('referrer-policy')}`,
  );
  assert(!!res.headers.get('permissions-policy'), 'нет Permissions-Policy');
  assert(
    !res.headers.get('x-powered-by'),
    `X-Powered-By присутствует: ${res.headers.get('x-powered-by')}`,
  );
});

await check(
  'GET /_next/image → выключен (нет открытого оптимизатора)',
  async () => {
    const res = await request(
      '/_next/image?url=https%3A%2F%2Fplacehold.co%2F10x10.png&w=64&q=75',
      { auth: false },
    );
    assert(
      res.status === 404 || res.status === 400,
      `GET /_next/image: ${res.status}, ожидали 404/400 (оптимизатор выключен)`,
    );
  },
);

// 2. Аутентификация
await check('POST /api/auth/exists → свободный логин', async () => {
  const res = await api('/auth/exists', {
    method: 'POST',
    body: { username },
    auth: false,
  });
  assertStatus(res, 200, 'POST /api/auth/exists');
  const body = assertJson(res, 'POST /api/auth/exists');
  assert(body.success === true, 'POST /api/auth/exists: success !== true');
  assert(
    body.exists === false,
    'POST /api/auth/exists: свободный логин считался занятым',
  );
});

await check(
  'POST /api/auth → 401 для несуществующего аккаунта (не регистрирует)',
  async () => {
    const res = await api('/auth', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    assertStatus(res, 401, 'вход в несуществующий аккаунт');
    const body = assertJson(res, 'вход в несуществующий аккаунт');
    assert(body.success === false, 'несуществующий аккаунт: success !== false');
    // Ответ не должен отличать «нет аккаунта» от «неверный пароль» (SEC-9).
    assert(
      body.reason === 'invalid_credentials',
      `несуществующий аккаунт: reason = ${body.reason}`,
    );
    assert(
      !sessionCookie,
      'несуществующий аккаунт: сервер не должен выдавать сессию',
    );
  },
);

await check(
  'POST /api/auth/register → регистрация нового аккаунта',
  async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: {
        username,
        password,
        displayName: 'Smoke Tester',
        recoveryPhrase: 'amber cobalt lantern',
      },
      auth: false,
    });
    assertStatus(res, 200, 'POST /api/auth/register');
    const body = assertJson(res, 'POST /api/auth/register');
    assert(
      body.success === true,
      `POST /api/auth/register: success !== true (${truncate(res.text)})`,
    );
    assert(
      body.isNewUser === true,
      'POST /api/auth/register: ожидали isNewUser === true',
    );
    assert(
      typeof body.user?.uid === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          body.user.uid,
        ),
      'POST /api/auth/register: uid должен быть UUID (а не хеш логина)',
    );
    assert(
      body.user.hasRecoveryPhrase === true,
      'POST /api/auth/register: фраза должна быть установлена сразу',
    );
    assert(
      sessionCookie.startsWith('dcs_session='),
      'POST /api/auth/register: не выдал сессионную cookie',
    );
    userId = body.user.uid;
    return userId;
  },
);

await check(
  'GET /api/admin/users обычным пользователем → 403 (роль проверяется сервером)',
  async () => {
    const res = await api('/admin/users');
    assertStatus(res, 403, 'GET /api/admin/users (обычный пользователь)');
  },
);

await check('GET /api/auth/session → актуальный снимок профиля', async () => {
  const res = await api('/auth/session');
  assertStatus(res, 200, 'GET /api/auth/session');
  const body = assertJson(res, 'GET /api/auth/session');
  assert(
    body.user?.uid === userId,
    'GET /api/auth/session: uid не совпадает с зарегистрированным',
  );
  assert(
    body.user?.role === 'user',
    `GET /api/auth/session: role = ${body.user?.role}`,
  );
});

await check('POST /api/auth/register → 409 на занятый логин', async () => {
  const res = await api('/auth/register', {
    method: 'POST',
    body: {
      username,
      password: 'another-pass',
      displayName: 'Duplicate',
      recoveryPhrase: 'zulu yankee',
    },
    auth: false,
  });
  assertStatus(res, 409, 'повторная регистрация');
  const body = assertJson(res, 'повторная регистрация');
  assert(
    body.reason === 'exists',
    `повторная регистрация: reason = ${body.reason}`,
  );
});

await check('POST /api/auth/exists → логин теперь существует', async () => {
  const res = await api('/auth/exists', {
    method: 'POST',
    body: { username: username.toUpperCase() },
    auth: false,
  });
  assertStatus(res, 200, 'POST /api/auth/exists (занятый)');
  const body = assertJson(res, 'POST /api/auth/exists (занятый)');
  assert(
    body.exists === true,
    'POST /api/auth/exists: существующий логин не найден',
  );
});

await check(
  'POST /api/auth → повторный вход (isNewUser=false, тот же uid)',
  async () => {
    const res = await api('/auth', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    assertStatus(res, 200, 'повторный POST /api/auth');
    const body = assertJson(res, 'повторный POST /api/auth');
    assert(
      body.isNewUser === false,
      'повторный вход: ожидали isNewUser === false',
    );
    assert(
      body.user?.uid === userId,
      `повторный вход: uid изменился (${body.user?.uid} ≠ ${userId})`,
    );
  },
);

await check('POST /api/auth → 401 на неверный пароль', async () => {
  const res = await api('/auth', {
    method: 'POST',
    body: { username, password: 'wrong-password' },
  });
  assertStatus(res, 401, 'неверный пароль');
  const body = assertJson(res, 'неверный пароль');
  assert(body.success === false, 'неверный пароль: success !== false');
});

await check('POST /api/auth → 400 без пароля', async () => {
  const res = await api('/auth', { method: 'POST', body: { username } });
  assertStatus(res, 400, 'без пароля');
});

await check('POST /api/auth/register → 400 на пароль короче 12', async () => {
  const res = await api('/auth/register', {
    method: 'POST',
    body: {
      username: `${username}-short`,
      password: '123',
      displayName: 'Short',
      recoveryPhrase: 'amber cobalt lantern',
    },
    auth: false,
  });
  assertStatus(res, 400, 'короткий пароль при регистрации');
  const body = assertJson(res, 'короткий пароль при регистрации');
  assert(
    /at least 12/i.test(body.error || ''),
    `регистрация: error = ${body.error}, ожидали «at least 12»`,
  );
});

// 2.1 Сессии (SEC-6): logout гасит cookie на сервере, а не только в браузере
await check('после logout старая cookie не работает', async () => {
  const oldCookie = sessionCookie;
  const res = await api('/auth/logout', { method: 'POST' });
  assertStatus(res, 200, 'POST /api/auth/logout');
  assert(
    /dcs_session=;/.test(res.headers.get('set-cookie') || ''),
    'logout: cookie не стёрта в ответе',
  );

  // Отправляем именно погашенную cookie: сервер обязан ответить 401.
  sessionCookie = oldCookie;
  const stale = await api('/characters');
  assertStatus(stale, 401, 'GET /api/characters со старой cookie после logout');

  const relogin = await api('/auth', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  assertStatus(relogin, 200, 'повторный вход после logout');
  assert(
    sessionCookie && sessionCookie !== oldCookie,
    'повторный вход должен выдать новую cookie',
  );
});

if (opts.dataDir) {
  await check('сессионная cookie в production помечена Secure', async () => {
    // --data-dir передаёт predeploy: сервер поднят в production-режиме.
    const res = await api('/auth', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    assertStatus(res, 200, 'вход для проверки флагов cookie');
    const setCookie = res.headers.get('set-cookie') || '';
    assert(
      /;\s*Secure/i.test(setCookie),
      `Set-Cookie без Secure: ${truncate(setCookie)}`,
    );
    assert(
      /HttpOnly/i.test(setCookie),
      `Set-Cookie без HttpOnly: ${truncate(setCookie)}`,
    );
  });
}

// 3. Лист персонажа: создание/чтение/правка/удаление
await check(
  'GET /api/characters → пустой список у нового аккаунта',
  async () => {
    const res = await api('/characters');
    assertStatus(res, 200, 'GET /api/characters');
    const body = assertJson(res, 'GET /api/characters');
    assert(Array.isArray(body), 'GET /api/characters: ожидали массив');
    assert(
      body.length === 0,
      `GET /api/characters: у нового аккаунта уже ${body.length} листов`,
    );
  },
);

await check('GET /api/characters без сессии → 401', async () => {
  const res = await api('/characters', { auth: false });
  assertStatus(res, 401, 'GET /api/characters без сессии');
});

await check('GET /api/admin/users без сессии → 401', async () => {
  const res = await api('/admin/users', { auth: false });
  assertStatus(res, 401, 'GET /api/admin/users без сессии');
});

await check('POST /api/characters → 201 и id персонажа', async () => {
  const res = await api('/characters', { method: 'POST', body: dndCharacter });
  assertStatus(res, 201, 'POST /api/characters');
  const body = assertJson(res, 'POST /api/characters');
  assert(
    typeof body.id === 'string' && body.id.length > 0,
    'POST /api/characters: нет id',
  );
  assert(body.userId === userId, 'POST /api/characters: userId не сохранён');
  characterId = body.id;
  return `id=${characterId}`;
});

await check('GET /api/characters → созданный лист в списке', async () => {
  const res = await api('/characters');
  assertStatus(res, 200, 'GET /api/characters');
  const body = assertJson(res, 'GET /api/characters');
  const found = body.find((item) => item.id === characterId);
  assert(found, `GET /api/characters: лист ${characterId} не найден в списке`);
  assert(
    found.name === dndCharacter.name,
    'GET /api/characters: имя персонажа не совпадает',
  );
});

await check('GET /character/<id> → 200 (страница листа)', async () => {
  const res = await request(`/character/${encodeURIComponent(characterId)}`);
  assertStatus(res, 200, `GET /character/${characterId}`);
});

// Старый корневой маршрут листа удалён осознанно (без редиректа):
// `/character/...` — единственный адрес листа, прочие пути дают 404.
await check(
  'GET /<id> → 404 (старый корневой маршрут листа удалён)',
  async () => {
    const res = await request(`/${encodeURIComponent(characterId)}`);
    assertStatus(res, 404, `GET /${characterId} (legacy)`);
  },
);

await check('GET /api/export?characterId → JSON персонажа', async () => {
  const res = await api(
    `/export?characterId=${encodeURIComponent(characterId)}`,
  );
  assertStatus(res, 200, 'GET /api/export (один)');
  const body = assertJson(res, 'GET /api/export (один)');
  assert(body.id === characterId, 'GET /api/export: вернулся другой персонаж');
  assert(
    body.gameSystem === dndCharacter.gameSystem,
    'GET /api/export: gameSystem потерялся',
  );
});

await check('GET /api/export?characterId=<нет такого> → 404', async () => {
  const res = await api('/export?characterId=missing-id');
  assertStatus(res, 404, 'GET /api/export (404)');
});

// SEC-8: публичный импорт убран из рантайма — путь не существует.
await check('GET /api/import → 404 (маршрут удалён)', async () => {
  const res = await api('/import', { auth: false });
  assertStatus(res, 404, 'GET /api/import');
});

// Гостевая ссылка: владелец выдаёт её под cookie, а страница открывается
// полностью без сессии. Токен на диске не хранится в открытом виде.
let shareToken = '';
let shareUrl = '';
await check('POST /api/characters/<id>/share → 201 и токен', async () => {
  const res = await api(
    `/characters/${encodeURIComponent(characterId)}/share`,
    {
      method: 'POST',
      body: { expiresInDays: 30 },
    },
  );
  assertStatus(res, 201, 'POST share');
  const body = assertJson(res, 'POST share');
  assert(body.success === true, 'POST share: success !== true');
  assert(typeof body.token === 'string', 'POST share: нет token');
  assert(
    /^[A-Za-z0-9_-]{43}$/.test(body.token),
    'POST share: token неверной формы',
  );
  assert(
    body.path === `/share/${body.token}`,
    'POST share: path не совпадает с токеном',
  );
  shareToken = body.token;
  shareUrl = body.path;
  return `token=${shareToken.slice(0, 6)}…`;
});

await check('GET /api/characters/<id>/share → статус без токена', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}/share`);
  assertStatus(res, 200, 'GET share');
  const body = assertJson(res, 'GET share');
  assert(body.active === true, 'GET share: ссылка не активна');
  assert(body.token === undefined, 'GET share: токен не должен возвращаться');
});

await check('GET /share/<token> без cookie → 200, лист и баннер', async () => {
  const res = await request(shareUrl, { auth: false });
  assertStatus(res, 200, 'GET /share/<token>');
  assert(
    res.text.includes(dndCharacter.name),
    'GET /share: в HTML нет имени персонажа',
  );
  assert(!res.text.includes(userId), 'GET /share: в HTML утёк userId');
  assert(!res.text.includes(username), 'GET /share: в HTML утёк логин');
  assert(
    (res.headers.get('x-robots-tag') || '').includes('noindex'),
    'GET /share: нет X-Robots-Tag noindex',
  );
  assert(
    res.headers.get('cache-control') === 'no-store',
    'GET /share: нет Cache-Control: no-store',
  );
  assert(
    res.headers.get('referrer-policy') === 'no-referrer',
    'GET /share: нет Referrer-Policy: no-referrer',
  );
});

await check('shares.json хранит хэш, а не токен', async () => {
  if (!opts.dataDir) return 'без --data-dir пропущено';
  const sharesFile = path.join(opts.dataDir, 'shares.json');
  assert(fs.existsSync(sharesFile), 'нет файла shares.json');
  const raw = fs.readFileSync(sharesFile, 'utf8');
  assert(!raw.includes(shareToken), 'shares.json: открытый токен на диске');
});

await check(
  'DELETE /api/characters/<id>/share → 200 и заглушка у ссылки',
  async () => {
    const res = await api(
      `/characters/${encodeURIComponent(characterId)}/share`,
      {
        method: 'DELETE',
      },
    );
    assertStatus(res, 200, 'DELETE share');
    const page = await request(shareUrl, { auth: false });
    assertStatus(page, 200, 'GET /share после отзыва');
    assert(
      page.text.includes('shared-link-unavailable'),
      'GET /share после отзыва: нет экрана недействительной ссылки',
    );
    assert(
      !page.text.includes(dndCharacter.name),
      'GET /share после отзыва: имя персонажа всё ещё в HTML',
    );
  },
);

// SEC-10: тело листа проверяется схемой редакции и ограничено по размеру.
await check('PUT /api/characters/<id> с `stats` строкой → 400', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'PUT',
    body: { stats: 'строка вместо блока' },
  });
  assertStatus(res, 400, 'PUT /api/characters/<id> (неверная структура)');
  const body = assertJson(res, 'PUT /api/characters/<id> (неверная структура)');
  assert(
    body.reason === 'invalid_payload',
    `PUT: reason = ${body.reason}, ожидали invalid_payload`,
  );
});

await check(
  'PUT /api/characters/<id> с лишним полем → 200, поле не сохранено',
  async () => {
    const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
      method: 'PUT',
      body: { evil: 'pwned', userId: 'someone-else' },
    });
    assertStatus(res, 200, 'PUT /api/characters/<id> (лишнее поле)');
    const body = assertJson(res, 'PUT /api/characters/<id> (лишнее поле)');
    assert(body.evil === undefined, 'PUT: лишнее поле попало в лист');
    assert(body.userId === userId, `PUT: userId = ${body.userId}`);
  },
);

await check('PUT /api/characters/<id> с телом > 1 МБ → 413', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'PUT',
    body: { backstory: 'x'.repeat(1_100_000) },
  });
  assertStatus(res, 413, 'PUT /api/characters/<id> (тело > 1 МБ)');
  const body = assertJson(res, 'PUT /api/characters/<id> (тело > 1 МБ)');
  assert(
    body.reason === 'payload_too_large',
    `PUT: reason = ${body.reason}, ожидали payload_too_large`,
  );
});

await check('PUT /api/characters/<id> → правка сохраняется', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'PUT',
    body: { name: 'Smoke Tester Renamed', level: 4 },
  });
  assertStatus(res, 200, 'PUT /api/characters/<id>');
  const body = assertJson(res, 'PUT /api/characters/<id>');
  assert(body.name === 'Smoke Tester Renamed', 'PUT: имя не обновилось');

  const list = await api('/characters');
  const saved = assertJson(list, 'GET после PUT').find(
    (item) => item.id === characterId,
  );
  assert(
    saved?.name === 'Smoke Tester Renamed',
    'PUT: изменение не сохранилось в файле',
  );
});

await check('PUT /api/characters/<нет такого> → 404', async () => {
  const res = await api('/characters/missing-id', {
    method: 'PUT',
    body: { name: 'X' },
  });
  assertStatus(res, 404, 'PUT несуществующего');
});

// 4. Файлы на диске (только если знаем --data-dir)
if (opts.dataDir) {
  const userDir = path.join(opts.dataDir, 'users', userId);
  const characterFile = path.join(userDir, 'characters', `${characterId}.json`);

  await check(
    'на диске есть data/users/<uid>/user.json со scrypt-хешем пароля',
    async () => {
      const userFile = path.join(userDir, 'user.json');
      assert(fs.existsSync(userFile), `нет файла ${userFile}`);

      const raw = fs.readFileSync(userFile, 'utf8');
      const parsed = JSON.parse(raw);
      assert(parsed.uid === userId, `user.json: uid = ${parsed.uid}`);
      assert(
        parsed.schemaVersion === 4,
        `user.json: schemaVersion = ${parsed.schemaVersion}`,
      );
      assert(parsed.role === 'user', `user.json: role = ${parsed.role}`);
      assert(
        parsed.isBlocked === false,
        `user.json: isBlocked = ${parsed.isBlocked}`,
      );
      assert(
        parsed.username === username.toLowerCase(),
        `user.json: username = ${parsed.username}`,
      );
      assert(
        typeof parsed.passwordHash === 'string' &&
          parsed.passwordHash.startsWith('scrypt$'),
        `user.json: passwordHash = ${String(parsed.passwordHash).slice(0, 24)}…, ожидали scrypt$…`,
      );
      assert(
        parsed.passwordHash !== sha256(password),
        'user.json: passwordHash всё ещё несолёный sha256',
      );
      assert(
        !raw.includes(password),
        'user.json: пароль лежит в открытом виде!',
      );
    },
  );

  await check(
    'реестр сессий data/sessions.json хранит только живые jti',
    async () => {
      const sessionsFile = path.join(opts.dataDir, 'sessions.json');
      assert(fs.existsSync(sessionsFile), `нет файла ${sessionsFile}`);
      const parsed = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      assert(
        parsed.version === 1,
        `sessions.json: version = ${parsed.version}`,
      );

      const records = Object.entries(parsed.sessions || {});
      assert(records.length > 0, 'sessions.json: нет ни одной живой сессии');
      const cookieValue = (sessionCookie || '').split('=')[1] || '';
      const jti = cookieValue.split('.')[2];
      assert(
        jti && records.some(([key]) => key === jti),
        'sessions.json: jti текущей сессии не найден',
      );
      for (const [key, record] of records) {
        assert(
          record.uid === userId,
          `sessions.json: ${key} принадлежит ${record.uid}, ожидали ${userId}`,
        );
        assert(!record.revokedAt, `sessions.json: ${key} помечена отозванной`);
      }
      assert(
        !JSON.stringify(parsed).includes(cookieValue),
        'sessions.json: значение cookie лежит в файле',
      );
    },
  );

  await check('индекс data/index/logins.json знает логин → uid', async () => {
    const indexFile = path.join(opts.dataDir, 'index', 'logins.json');
    assert(fs.existsSync(indexFile), `нет файла ${indexFile}`);
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    assert(
      index.logins?.[username.toLowerCase()] === userId,
      'index: логин не указывает на uid',
    );
  });

  await check(
    'на диске есть data/users/<uid>/characters/<id>.json',
    async () => {
      assert(fs.existsSync(characterFile), `нет файла ${characterFile}`);
      const parsed = JSON.parse(fs.readFileSync(characterFile, 'utf8'));
      assert(parsed.id === characterId, 'character.json: id не совпадает');
      assert(
        parsed.name === 'Smoke Tester Renamed',
        'character.json: правка не попала на диск',
      );
    },
  );
}

await check('DELETE /api/characters/<id> → 200', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'DELETE',
  });
  assertStatus(res, 200, 'DELETE персонажа');
});

await check('DELETE повторно → 404 (файл действительно удалён)', async () => {
  const res = await api(`/characters/${encodeURIComponent(characterId)}`, {
    method: 'DELETE',
  });
  assertStatus(res, 404, 'повторный DELETE');
});

// 5. Восстановление доступа
await check('POST /api/auth/phrase → фраза сохраняется', async () => {
  const res = await api('/auth/phrase', {
    method: 'POST',
    body: { phrase: recoveryPhrase },
  });
  assertStatus(res, 200, 'POST /api/auth/phrase');
  assert(
    assertJson(res, 'POST /api/auth/phrase').success === true,
    'phrase: success !== true',
  );
});

await check('POST /api/auth/phrase без фразы → 400', async () => {
  const res = await api('/auth/phrase', { method: 'POST', body: {} });
  assertStatus(res, 400, 'phrase без фразы');
});

await check('POST /api/auth/recover/verify без полей → 400', async () => {
  const res = await api('/auth/recover/verify', {
    method: 'POST',
    body: { username },
  });
  assertStatus(res, 400, 'recover/verify без полей');
});

await check(
  'POST /api/auth/recover/verify с неверной фразой → 400',
  async () => {
    const res = await api('/auth/recover/verify', {
      method: 'POST',
      body: { username, recoveryPhrase: 'wrong words here' },
      auth: false,
    });
    assertStatus(res, 400, 'recover/verify неверная фраза');
    const body = assertJson(res, 'recover/verify неверная фраза');
    assert(
      body.reason === 'recovery_failed',
      `recover/verify: reason = ${body.reason}, ожидали recovery_failed`,
    );
  },
);

await check('POST /api/auth/recover/update без токена → 401', async () => {
  const res = await api('/auth/recover/update', {
    method: 'POST',
    body: {
      // Логин в теле ничего не доказывает — раньше этого хватало для захвата.
      username,
      newPassword: 'pwned-pass-123',
      newRecoveryPhrase: 'x y z',
    },
    auth: false,
  });
  assertStatus(res, 401, 'recover/update без токена');
  const body = assertJson(res, 'recover/update без токена');
  assert(
    body.reason === 'invalid_token',
    `recover/update без токена: reason = ${body.reason}`,
  );
});

let recoveryToken = '';
let staleCookieBeforeReset = '';

await check(
  'POST /api/auth/recover/verify → 200, одноразовый токен без cookie',
  async () => {
    const res = await api('/auth/recover/verify', {
      method: 'POST',
      body: { username, recoveryPhrase },
      auth: false,
    });
    assertStatus(res, 200, 'recover/verify');
    const body = assertJson(res, 'recover/verify');
    assert(
      typeof body.token === 'string' && body.token.length > 20,
      'recover/verify: токен не выдан',
    );
    assert(
      !res.headers.get('set-cookie'),
      'recover/verify: выдал сессионную cookie — должен только токен',
    );
    recoveryToken = body.token;
  },
);

await check(
  'POST /api/auth/recover/update по токену → 200, токен гаснет',
  async () => {
    // Запоминаем живую сессию до сброса: после смены пароля она обязана умереть.
    staleCookieBeforeReset = sessionCookie;
    const res = await api('/auth/recover/update', {
      method: 'POST',
      body: {
        token: recoveryToken,
        newPassword: password,
        newRecoveryPhrase: 'delta echo foxtrot',
      },
      auth: false,
    });
    assertStatus(res, 200, 'recover/update по токену');
    assert(
      assertJson(res, 'recover/update по токену').success === true,
      'recover/update: success !== true',
    );

    // Повторный обмен того же токена невозможен: он уже погашен.
    const again = await api('/auth/recover/update', {
      method: 'POST',
      body: { token: recoveryToken, newPassword: 'second-pass-123' },
      auth: false,
    });
    assertStatus(again, 401, 'повторный recover/update');
  },
);

await check(
  'после восстановления доступа старая сессия не работает',
  async () => {
    // Cookie, полученная до сброса пароля, должна быть погашена.
    if (staleCookieBeforeReset) {
      const saved = sessionCookie;
      sessionCookie = staleCookieBeforeReset;
      const res = await api('/characters');
      assertStatus(
        res,
        401,
        'GET /api/characters со старой cookie после сброса',
      );
      sessionCookie = saved;
    }
  },
);

await check('вход с паролем после восстановления → 200', async () => {
  const res = await api('/auth', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  assertStatus(res, 200, 'вход после восстановления');
  assert(
    assertJson(res, 'вход после восстановления').success === true,
    'вход после восстановления: success !== true',
  );
});

// 6. Удаление аккаунта (danger zone на /settings)
await check('DELETE /api/auth/profile без сессии → 401', async () => {
  const res = await api('/auth/profile', {
    method: 'DELETE',
    body: { password },
    auth: false,
  });
  assertStatus(res, 401, 'DELETE /api/auth/profile без сессии');
});

await check('DELETE /api/auth/profile с неверным паролем → 403', async () => {
  const res = await api('/auth/profile', {
    method: 'DELETE',
    body: { password: 'definitely-wrong' },
  });
  assertStatus(res, 403, 'DELETE /api/auth/profile (неверный пароль)');
  const body = assertJson(res, 'DELETE /api/auth/profile (неверный пароль)');
  assert(
    body.reason === 'invalid_password',
    `DELETE: reason = ${body.reason}, ожидали invalid_password`,
  );
});

await check('DELETE /api/auth/profile → 200 и cookie стёрта', async () => {
  const res = await api('/auth/profile', {
    method: 'DELETE',
    body: { password },
  });
  assertStatus(res, 200, 'DELETE /api/auth/profile');
  const body = assertJson(res, 'DELETE /api/auth/profile');
  assert(body.success === true, 'DELETE /api/auth/profile: success !== true');
  assert(
    /dcs_session=;/.test(res.headers.get('set-cookie') || ''),
    'DELETE /api/auth/profile: cookie не стёрта',
  );
});

await check('после удаления вход старым паролем → 401', async () => {
  const res = await api('/auth', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  assertStatus(res, 401, 'вход после удаления аккаунта');
});

if (opts.dataDir) {
  await check(
    'после удаления каталога аккаунта и записи в индексе нет',
    async () => {
      const userDir = path.join(opts.dataDir, 'users', userId);
      assert(
        !fs.existsSync(userDir),
        `DELETE /api/auth/profile: каталог остался (${userDir})`,
      );
      const indexFile = path.join(opts.dataDir, 'index', 'logins.json');
      if (fs.existsSync(indexFile)) {
        const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
        assert(
          index.logins?.[username.toLowerCase()] === undefined,
          'DELETE /api/auth/profile: запись в индексе осталась',
        );
      }
    },
  );
}

// 6.1 Лимит попыток входа (SEC-7)
await check('11-я неудачная попытка входа → 429 с Retry-After', async () => {
  const probe = `brute-${stamp}-${Math.random().toString(36).slice(2, 7)}`;
  const statuses = [];
  let retryAfter = null;

  for (let attempt = 1; attempt <= 11; attempt += 1) {
    const res = await api('/auth', {
      method: 'POST',
      body: { username: probe, password: 'wrong-pass-1234' },
      auth: false,
    });
    statuses.push(res.status);
    if (attempt === 11) retryAfter = res.headers.get('retry-after');
  }

  assert(
    statuses.slice(0, 10).every((status) => status === 401),
    `первые 10 попыток: ${statuses.join(', ')}, ожидали 401`,
  );
  assert(statuses[10] === 429, `11-я попытка: ${statuses[10]}, ожидали 429`);
  assert(Number(retryAfter) > 0, `Retry-After = ${retryAfter}`);
});

// 7. Уборка
if (opts.dataDir && userId) {
  const userDir = path.join(opts.dataDir, 'users', userId);
  if (opts.keepUser) {
    console.log(`\n${c.yellow}Тестовый аккаунт оставлен: ${userDir}${c.reset}`);
  } else if (fs.existsSync(userDir)) {
    fs.rmSync(userDir, { recursive: true, force: true });

    // Не оставляем фантомную запись в индексе логинов.
    const indexFile = path.join(opts.dataDir, 'index', 'logins.json');
    try {
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      if (index?.logins) {
        delete index.logins[username.toLowerCase()];
        fs.writeFileSync(
          indexFile,
          JSON.stringify(index, null, 2) + '\n',
          'utf8',
        );
      }
    } catch {
      // индекса нет/битый — приложение пересоберёт его само
    }

    console.log(`\n${c.dim}Тестовый аккаунт удалён: ${userDir}${c.reset}`);
  }
}

// ── итог ────────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log('');
if (failed === 0) {
  console.log(
    `${c.green}${c.bold}Итого: ${passed}/${results.length} проверок пройдено.${c.reset}`,
  );
  process.exit(0);
}

console.log(
  `${c.red}${c.bold}Итого: пройдено ${passed}/${results.length}, провалено ${failed}.${c.reset}`,
);
for (const result of results.filter((r) => !r.ok)) {
  console.log(`${c.red}  ✗ ${result.name}${c.reset}`);
  if (opts.verbose) console.log(`      ${result.error?.stack || result.error}`);
}
process.exit(1);
