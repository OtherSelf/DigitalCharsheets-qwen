#!/usr/bin/env node
/**
 * Dev-proxy smoke: `next dev` за реверс-прокси.
 *
 * Регрессия Next 16: без `allowedDevOrigins` запросы браузера к dev-ресурсам
 * (/_next/hmr и т.п.) с «чужим» Origin получают 403. Клиент тогда не
 * гидратируется, и CSR-страницы (например, `/`) навсегда остаются в лоадере.
 *
 * Тест воспроизводит прод-схему: Chromium резолвит реальные домены стендов в
 * 127.0.0.1 (`--host-resolver-rules`), поэтому Host/Origin — это домен, как
 * за nginx. Проверяем, что известные хосты гидратируются, а неизвестный — нет
 * (значит, защита Next от cross-origin всё ещё включена).
 *
 * Запуск: npm run test:dev
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const NEXT_BIN = path.join(
  APP_DIR,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

/** Домены, с которых открываются стенды (см. next.config.ts). */
const EXPECTED_HOSTS = ['dcs-dev.thfree.space', 'dcs.thfree.space'];
const BLOCKED_HOST = 'not-allowed.dev-smoke.example';
const READY_TIMEOUT_MS = 120_000;
const HYDRATE_TIMEOUT_MS = 20_000;

// Локальные браузеры и библиотеки Chromium — как в scripts/visual.sh.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const localBrowsers = path.join(APP_DIR, '.playwright-browsers');
  if (fs.existsSync(localBrowsers)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
  }
}
const chromiumLibs = [
  path.join(APP_DIR, '.chromium-deps/root/usr/lib/x86_64-linux-gnu'),
  path.join(APP_DIR, '.chromium-deps/root/lib/x86_64-linux-gnu'),
].filter((dir) => fs.existsSync(dir));
if (chromiumLibs.length > 0) {
  process.env.LD_LIBRARY_PATH = [...chromiumLibs, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(':');
}

const log = (...args) => console.log('[dev-smoke]', ...args);
const fail = (message) => {
  console.error('[dev-smoke] ✗', message);
  process.exitCode = 1;
};

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`dev-сервер не ответил за ${timeoutMs} мс: ${lastError}`);
}

async function waitForHydration(page, timeoutMs) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('*')].some((element) =>
        Object.keys(element).some((key) => key.startsWith('__reactFiber$')),
      ),
    null,
    { timeout: timeoutMs },
  );
}

async function probeHost(browserType, host, port) {
  const browser = await browserType.launch({
    args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(`http://${host}:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    let hydrated = true;
    try {
      await waitForHydration(page, HYDRATE_TIMEOUT_MS);
    } catch {
      hydrated = false;
    }

    const text = await page
      .evaluate(() => document.body.innerText.slice(0, 120))
      .catch(() => '');
    return { hydrated, text, consoleErrors };
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!fs.existsSync(NEXT_BIN)) {
    fail(`не найден next: ${NEXT_BIN}. Сначала npm ci.`);
    return;
  }

  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-dev-smoke-'));
  const server = spawn(NEXT_BIN, ['dev', '-p', String(port)], {
    cwd: APP_DIR,
    env: { ...process.env, DCS_DATA_DIR: dataDir, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let serverLog = '';
  const collect = (chunk) => {
    serverLog += chunk.toString();
  };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);

  const stopServer = () => {
    if (server.pid && !server.killed) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        // уже остановлен
      }
      setTimeout(() => {
        try {
          process.kill(-server.pid, 'SIGKILL');
        } catch {
          // уже остановлен
        }
      }, 3000).unref();
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  process.on('exit', stopServer);

  try {
    log(`порт ${port}, данные ${dataDir}`);
    await waitForServer(`http://127.0.0.1:${port}/login`, READY_TIMEOUT_MS);
    log('dev-сервер поднялся');

    const { chromium } = await import('@playwright/test');

    for (const host of EXPECTED_HOSTS) {
      const result = await probeHost(chromium, host, port);
      if (result.hydrated) {
        log(`✓ ${host}: клиент гидратировался`);
      } else {
        fail(
          `${host}: клиент НЕ гидратировался. Похоже, хост не разрешён в ` +
            `next.config.ts → allowedDevOrigins, либо dev-ресурсы блокируются. ` +
            `Ответ: ${JSON.stringify(result.text).slice(0, 80)}`,
        );
      }
    }

    const blocked = await probeHost(chromium, BLOCKED_HOST, port);
    if (!blocked.hydrated) {
      log(`✓ ${BLOCKED_HOST}: заблокирован (cross-origin защита работает)`);
    } else {
      fail(
        `${BLOCKED_HOST}: неожиданно гидратировался — защита cross-origin ` +
          `не сработала, тест перестал что-либо проверять`,
      );
    }
  } catch (error) {
    const tail = serverLog.split('\n').slice(-15).join('\n');
    fail(error instanceof Error ? error.message : String(error));
    if (tail)
      console.error('[dev-smoke] последние строки dev-сервера:\n' + tail);
  } finally {
    stopServer();
  }

  if (process.exitCode) {
    console.error('[dev-smoke] провал');
  } else {
    console.log('[dev-smoke] всё зелёное');
  }
}

await main();
