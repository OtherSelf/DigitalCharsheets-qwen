// ============================================================================
//  scripts/lib/perf-http.mjs — общий каркас нагрузочных и race-прогонов
//
//  Поднимает одноразовый production-сервер на свободном порту с временным
//  DCS_DATA_DIR (как scripts/predeploy.sh), сидит аккаунты и листы по HTTP и
//  даёт маленький клиент без зависимостей. Замеры идут против реального
//  HTTP-сервера, а не против функций в процессе: только так видно event loop,
//  локи и сериализацию запросов.
// ============================================================================

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const PERF_PASSWORD = 'Perf-Passw0rd-123';
export const PERF_RECOVERY = 'correct horse battery staple';

const HEALTH_TIMEOUT_MS = 120_000;

export function randomId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Один HTTP-запрос. Ошибки сети пробрасываются: нагрузочный сценарий должен
 * считать их, а не молча превращать в «нет ответа».
 */
export async function httpRequest(
  baseUrl,
  pathname,
  { method = 'GET', cookie, body, headers = {}, timeoutMs = 30_000 } = {},
) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML/пустой ответ — для страниц это нормально.
  }

  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  let session = null;
  for (const value of setCookies) {
    const match = /^dcs_session=([^;]+)/.exec(value);
    if (match) {
      session = match[1];
      break;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
    session,
  };
}

export function cookieOf(session) {
  return `dcs_session=${session}`;
}

function mtimeMs(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

async function waitForMtime(file, before, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (mtimeMs(file) > before) return;
    await delay(50);
  }
}

export function tailFile(file, lines = 40) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .trimEnd()
      .split('\n')
      .slice(-lines)
      .join('\n');
  } catch {
    return '';
  }
}

async function waitForHttp(baseUrl, pathname, child, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(
        `Сервер завершился раньше старта (exit ${child.exitCode}).`,
      );
    }
    try {
      const response = await fetch(new URL(pathname, baseUrl), {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `Сервер не ответил за ${timeoutMs} мс: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Поднять `next start` из готовой сборки. `appDir` может быть копией на ext4:
 * тогда и код, и .next, и данные лежат на быстрой ФС (замеры на 9p не
 * показательны).
 */
export async function startPerfServer({
  appDir,
  dataDir,
  port,
  loopDelayFile,
  env = {},
}) {
  const nextBin = path.join(appDir, 'node_modules', '.bin', 'next');
  if (!fs.existsSync(nextBin)) {
    throw new Error(`Нет ${nextBin}: сначала npm ci в ${appDir}.`);
  }
  if (!fs.existsSync(path.join(appDir, '.next', 'BUILD_ID'))) {
    throw new Error(`Нет ${appDir}/.next/BUILD_ID: сначала npm run build.`);
  }

  const probe = path.join(appDir, 'scripts', 'lib', 'event-loop-probe.cjs');
  const logFile = path.join(
    os.tmpdir(),
    `dcs-perf-server-${process.pid}-${Date.now()}.log`,
  );
  const logFd = fs.openSync(logFile, 'a');
  const nodeOptions = [process.env.NODE_OPTIONS ?? '', `--require ${probe}`]
    .filter(Boolean)
    .join(' ');

  const child = spawn(
    nextBin,
    ['start', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: appDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        DCS_DATA_DIR: dataDir,
        DCS_COOKIE_INSECURE: '1',
        DCS_LOOP_DELAY_FILE: loopDelayFile,
        NODE_OPTIONS: nodeOptions,
        ...env,
      },
      stdio: ['ignore', logFd, logFd],
    },
  );

  const baseUrl = `http://127.0.0.1:${port}`;
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null) {
      // Сначала снять гистограмму, потом гасить сервер.
      try {
        child.kill('SIGUSR2');
      } catch {
        /* процесс уже умер */
      }
      await delay(250);
      child.kill('SIGTERM');
      const deadline = Date.now() + 15_000;
      while (child.exitCode === null && Date.now() < deadline) {
        await delay(100);
      }
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    try {
      fs.closeSync(logFd);
    } catch {
      /* уже закрыт */
    }
  };

  try {
    await waitForHttp(baseUrl, '/login', child, HEALTH_TIMEOUT_MS);
  } catch (error) {
    await stop();
    const log = tailFile(logFile, 60);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n--- лог сервера ---\n${log}`,
    );
  }

  return {
    appDir,
    baseUrl,
    child,
    dataDir,
    logFile,
    loopDelayFile,
    async resetLoopDelay() {
      const before = mtimeMs(loopDelayFile);
      try {
        child.kill('SIGUSR1');
      } catch {
        /* сервер уже остановлен */
      }
      await waitForMtime(loopDelayFile, before, 5_000);
    },
    async readLoopDelay() {
      const before = mtimeMs(loopDelayFile);
      try {
        child.kill('SIGUSR2');
      } catch {
        /* сервер уже остановлен */
      }
      await waitForMtime(loopDelayFile, before, 5_000);
      try {
        return JSON.parse(fs.readFileSync(loopDelayFile, 'utf8'));
      } catch {
        return null;
      }
    },
    stop,
  };
}

/** Зарегистрировать пользователя; если логин занят — войти. */
export async function registerOrLogin(
  baseUrl,
  username,
  displayName = username,
) {
  const registration = await httpRequest(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      username,
      password: PERF_PASSWORD,
      displayName,
      recoveryPhrase: PERF_RECOVERY,
    },
  });
  if (registration.status === 200 && registration.session) {
    return {
      uid: registration.json?.user?.uid ?? null,
      cookie: cookieOf(registration.session),
    };
  }
  if (registration.status === 429) {
    throw new Error(`Регистрация ${username}: 429 (лимит), прогон невозможен.`);
  }

  const login = await httpRequest(baseUrl, '/api/auth', {
    method: 'POST',
    body: { username, password: PERF_PASSWORD },
  });
  if (login.status === 200 && login.session) {
    return {
      uid: login.json?.user?.uid ?? null,
      cookie: cookieOf(login.session),
    };
  }
  throw new Error(
    `Не удалось создать/войти ${username}: register ${registration.status}, login ${login.status}.`,
  );
}

export async function createSheet(baseUrl, cookie, name) {
  const response = await httpRequest(baseUrl, '/api/characters', {
    method: 'POST',
    cookie,
    body: { systemId: 'dnd5e', name },
  });
  if (response.status !== 201 || !response.json?.id) {
    throw new Error(
      `Создание листа «${name}»: ${response.status} ${response.text.slice(0, 300)}`,
    );
  }
  return response.json.id;
}

export async function createShare(baseUrl, cookie, characterId) {
  const response = await httpRequest(
    baseUrl,
    `/api/characters/${encodeURIComponent(characterId)}/share`,
    { method: 'POST', cookie, body: { expiresInDays: null } },
  );
  if (response.status !== 201 || !response.json?.token) {
    throw new Error(
      `Share для ${characterId}: ${response.status} ${response.text.slice(0, 300)}`,
    );
  }
  return response.json.token;
}

/**
 * Сидинг: `count` пользователей по `sheets` листов. Сидим по HTTP, потому что
 * тест-кит (@tests/support) — TypeScript с alias `@/` и из .mjs не импортируется.
 */
export async function seedUsers({
  baseUrl,
  count,
  sheets,
  prefix,
  withShares = false,
  onProgress = () => {},
}) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const username = `${prefix}-${index}@example.test`;
    const auth = await registerOrLogin(baseUrl, username, `${prefix} ${index}`);
    const characterIds = [];
    for (let sheet = 0; sheet < sheets; sheet += 1) {
      characterIds.push(
        await createSheet(baseUrl, auth.cookie, `${prefix} ${index}/${sheet}`),
      );
    }
    const shares = [];
    if (withShares && characterIds.length > 0) {
      // Для сценария гостевой страницы хватает одной ссылки на пользователя:
      // массовая выдача ссылок только удлиняет сидинг.
      shares.push(await createShare(baseUrl, auth.cookie, characterIds[0]));
    }
    users.push({
      index,
      username,
      uid: auth.uid,
      cookie: auth.cookie,
      sheets: characterIds,
      shares,
    });
    if (index % 5 === 4 || index === count - 1) {
      onProgress(`сидинг: ${index + 1}/${count} пользователей`);
    }
  }
  return users;
}
