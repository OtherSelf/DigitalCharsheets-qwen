#!/usr/bin/env node
// ============================================================================
//  scripts/perf-web.mjs — @perf-проверки в браузере на одноразовом сервере
//
//  Поднимает `next start` с временным DCS_DATA_DIR (как predeploy/smoke),
//  запускает Playwright с playwright.perf.config.ts и гасит сервер. Скрипт:
//  web-vitals (LCP/CLS/first-input) и бюджет JS-чанков на /demo и /login.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { freePort, startPerfServer } from './lib/perf-http.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-perf-web-'));
const port = await freePort();
const server = await startPerfServer({
  appDir: process.cwd(),
  dataDir,
  port,
  loopDelayFile: path.join(dataDir, 'loop.json'),
});

const playwright = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  'playwright',
);
const child = spawn(playwright, ['test', '-c', 'playwright.perf.config.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    DCS_PERF_BASE_URL: server.baseUrl,
    ...(fs.existsSync(path.join(process.cwd(), '.playwright-browsers'))
      ? {
          PLAYWRIGHT_BROWSERS_PATH: path.join(
            process.cwd(),
            '.playwright-browsers',
          ),
        }
      : {}),
  },
});

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});

await server.stop();
fs.rmSync(dataDir, { recursive: true, force: true });
process.exitCode = exitCode;
