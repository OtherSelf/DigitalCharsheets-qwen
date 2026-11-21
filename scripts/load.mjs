#!/usr/bin/env node
// ============================================================================
//  scripts/load.mjs — HTTP-нагрузка на production-сборку DigitalCharsheets
//
//  Поднимает одноразовый `next start` с временным DCS_DATA_DIR, сидит
//  пользователей и листы по HTTP и гоняет сценарии autocannon. Пишет JSON и
//  markdown-сводку в .perf-results/, чтобы цифры до/после сравнивались, а не
//  вспоминались.
//
//  По умолчанию — report-only: ошибки и non-2xx попадают в отчёт, но прогон не
//  падает. Пороги включаются отдельно (--assert) после калибровки.
//
//  Замеры на 9p (рабочая копия на D:) не показательны: для этого есть
//  --app-dir с полной копией репозитория на ext4.
// ============================================================================
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import autocannon from 'autocannon';

import {
  delay,
  freePort,
  PERF_PASSWORD,
  randomId,
  seedUsers,
  startPerfServer,
} from './lib/perf-http.mjs';

const ALL_SCENARIOS = [
  'read-list',
  'save-own',
  'save-parallel',
  'mixed',
  'login-storm',
  'share-page',
];

const DEFAULTS = {
  appDir: process.cwd(),
  dataDir: '',
  outDir: '',
  port: 0,
  vus: 50,
  sheets: 10,
  duration: 10,
  scenarios: ALL_SCENARIOS,
  keepData: false,
};

function usage() {
  return `Использование: node scripts/load.mjs [флаги]

  --app-dir DIR     каталог собранного приложения (по умолчанию cwd);
                    для честных замеров — полная копия на ext4
  --data-dir DIR    временный data-dir (по умолчанию mkdtemp в os.tmpdir)
  --out DIR         каталог отчётов (по умолчанию .perf-results/<время>)
  --port PORT       порт сервера (по умолчанию свободный)
  --vus N           параллельных клиентов (по умолчанию 50)
  --sheets N        листов на пользователя (по умолчанию 10)
  --duration SEC    длительность сценария (по умолчанию 10)
  --scenarios LIST  через запятую: ${ALL_SCENARIOS.join(', ')}
  --keep-data       не удалять временный data-dir
  -h, --help        эта справка`;
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Флаг ${arg} требует значение.`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--app-dir':
        options.appDir = path.resolve(next());
        break;
      case '--data-dir':
        options.dataDir = path.resolve(next());
        break;
      case '--out':
        options.outDir = path.resolve(next());
        break;
      case '--port':
        options.port = Number(next());
        break;
      case '--vus':
        options.vus = Number(next());
        break;
      case '--sheets':
        options.sheets = Number(next());
        break;
      case '--duration':
        options.duration = Number(next());
        break;
      case '--scenarios':
        options.scenarios = next()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case '--keep-data':
        options.keepData = true;
        break;
      case '-h':
      case '--help':
        console.log(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Неизвестный флаг: ${arg}\n\n${usage()}`);
    }
  }
  for (const key of ['vus', 'sheets', 'duration']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) {
      throw new Error(`--${key} должен быть положительным целым.`);
    }
  }
  const unknown = options.scenarios.filter(
    (name) => !ALL_SCENARIOS.includes(name),
  );
  if (unknown.length > 0) {
    throw new Error(`Неизвестные сценарии: ${unknown.join(', ')}`);
  }
  return options;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function runAutocannon(options, label) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (error, result) => {
      if (error) reject(new Error(`${label}: ${error.message}`));
      else resolve(result);
    });
    instance.on('reqError', (error) => {
      process.stderr.write(
        `[perf] ${label}: ошибка запроса ${error.message}\n`,
      );
    });
  });
}

function clientAssigner() {
  let index = 0;
  return () => {
    const current = index;
    index += 1;
    return current;
  };
}

/**
 * Номер виртуального пользователя из заголовка, который ставит setupClient.
 * На первом построении запроса заголовка ещё нет: setupRequest вызывается
 * раньше setupClient, поэтому нужен безопасный ноль, иначе падает весь прогон.
 */
function summarize(result) {
  const statuses = {};
  for (const [code, stats] of Object.entries(result.statusCodeStats ?? {})) {
    statuses[code] = stats?.count ?? 0;
  }
  return {
    requests: result.requests?.total ?? 0,
    rps: round(result.requests?.average ?? 0),
    bytes: result.throughput?.total ?? 0,
    errors: result.errors ?? 0,
    non2xx: result.non2xx ?? 0,
    timeouts: result.timeouts ?? 0,
    statuses,
    latencyMs: {
      p50: round(result.latency?.p50 ?? 0, 3),
      // autocannon не считает ровно p95: p97_5 — консервативная замена.
      p95: round(result.latency?.p97_5 ?? 0, 3),
      p99: round(result.latency?.p99 ?? 0, 3),
      max: round(result.latency?.max ?? 0, 3),
    },
  };
}

function scenario(name, run) {
  return { name, run };
}

function buildScenarios({ users, vus, duration, baseUrl }) {
  const list = [];

  list.push(
    scenario('read-list', async () => {
      const next = clientAssigner();
      return runAutocannon(
        {
          url: baseUrl,
          connections: vus,
          duration,
          timeout: 30,
          setupClient(client) {
            const index = next();
            const user = users[index % users.length];
            client.setRequests([
              {
                method: 'GET',
                path: '/api/characters',
                headers: { cookie: user.cookie },
              },
            ]);
          },
        },
        'read-list',
      );
    }),
  );

  const saveScenario = (name, sheetIndexFor) => {
    const next = clientAssigner();
    return scenario(name, () =>
      runAutocannon(
        {
          url: baseUrl,
          connections: vus,
          duration,
          timeout: 30,
          setupClient(client) {
            const index = next();
            const user = users[index % users.length];
            const sheet = user.sheets[sheetIndexFor(index, user)];
            let seq = 0;
            client.setRequests([
              {
                method: 'PUT',
                path: `/api/characters/${sheet}`,
                headers: {
                  cookie: user.cookie,
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  __page: name,
                  __seq: 1,
                  notes: `${name} 1`,
                }),
                setupRequest(request) {
                  seq += 1;
                  request.body = JSON.stringify({
                    __page: name,
                    __seq: seq,
                    notes: `${name} ${seq}`,
                  });
                  return request;
                },
              },
            ]);
          },
        },
        name,
      ),
    );
  };

  list.push(saveScenario('save-own', () => 0));
  list.push(
    saveScenario('save-parallel', (index, user) => {
      // Каждое соединение пишет свой лист: глобальный лок всё равно сериализует
      // записи, и сценарий показывает именно это.
      return index % user.sheets.length;
    }),
  );

  list.push(
    scenario('mixed', async () => {
      const next = clientAssigner();
      return runAutocannon(
        {
          url: baseUrl,
          connections: vus,
          duration,
          timeout: 30,
          setupClient(client) {
            const index = next();
            const user = users[index % users.length];
            const read = {
              method: 'GET',
              path: '/api/characters',
              headers: { cookie: user.cookie },
            };
            let seq = 0;
            const write = {
              method: 'PUT',
              path: `/api/characters/${user.sheets[0]}`,
              headers: {
                cookie: user.cookie,
                'content-type': 'application/json',
              },
              setupRequest(request) {
                seq += 1;
                request.body = JSON.stringify({
                  __page: 'mixed',
                  __seq: seq,
                  notes: `mixed ${seq}`,
                });
                return request;
              },
            };
            client.setRequests([
              read,
              { ...read },
              { ...read },
              { ...read },
              write,
            ]);
          },
        },
        'mixed',
      );
    }),
  );

  list.push(
    scenario('login-storm', async () => {
      const next = clientAssigner();
      return runAutocannon(
        {
          url: baseUrl,
          connections: vus,
          duration,
          timeout: 30,
          setupClient(client) {
            const index = next();
            const user = users[index % users.length];
            client.setRequests([
              {
                method: 'POST',
                path: '/api/auth',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  username: user.username,
                  password: PERF_PASSWORD,
                }),
              },
            ]);
          },
        },
        'login-storm',
      );
    }),
  );

  list.push(
    scenario('share-page', async () => {
      const next = clientAssigner();
      const tokens = users.map((user) => user.shares[0]).filter(Boolean);
      if (tokens.length === 0)
        throw new Error('Нет share-токенов для сценария.');
      return runAutocannon(
        {
          url: baseUrl,
          connections: vus,
          duration,
          timeout: 30,
          setupClient(client) {
            const index = next();
            client.setRequests([
              {
                method: 'GET',
                path: `/share/${tokens[index % tokens.length]}`,
              },
            ]);
          },
        },
        'share-page',
      );
    }),
  );

  return list;
}

function commitOf(appDir) {
  for (const dir of [process.cwd(), appDir]) {
    try {
      return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
    } catch {
      // Копия на ext4 может быть без .git — это нормально.
    }
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir =
    options.outDir || path.join(process.cwd(), '.perf-results', stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const dataDir =
    options.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-load-'));
  fs.mkdirSync(dataDir, { recursive: true });
  const loopDelayFile = path.join(outDir, 'loop-delay.json');
  const port = options.port || (await freePort());

  const server = await startPerfServer({
    appDir: options.appDir,
    dataDir,
    port,
    loopDelayFile,
  });

  const startedAt = new Date();
  const startedMs = Date.now();
  const users = await seedUsers({
    baseUrl: server.baseUrl,
    count: options.vus,
    sheets: options.sheets,
    prefix: `load-${randomId()}`,
    withShares: options.scenarios.includes('share-page'),
    onProgress: (message) => process.stdout.write(`[perf] ${message}\n`),
  });

  const scenarios = buildScenarios({
    users,
    vus: options.vus,
    duration: options.duration,
    baseUrl: server.baseUrl,
  }).filter((entry) => options.scenarios.includes(entry.name));

  const results = [];
  for (const entry of scenarios) {
    process.stdout.write(`[perf] сценарий ${entry.name}...\n`);
    await server.resetLoopDelay();
    const raw = await entry.run();
    const loopDelay = await server.readLoopDelay();
    results.push({
      name: entry.name,
      summary: summarize(raw),
      loopDelay,
    });
    const summary = results[results.length - 1].summary;
    process.stdout.write(
      `[perf] ${entry.name}: ${summary.rps} req/s, p95 ${summary.latencyMs.p95} мс, ` +
        `errors ${summary.errors}, non2xx ${summary.non2xx}, statuses ${JSON.stringify(summary.statuses)}, ` +
        `loop p99 ${loopDelay?.p99Ms ?? '?'} мс\n`,
    );
    await delay(500);
  }

  const report = {
    meta: {
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedMs,
      appDir: options.appDir,
      dataDir,
      node: process.version,
      commit: commitOf(options.appDir),
      profile: {
        vus: options.vus,
        sheetsPerUser: options.sheets,
        durationSec: options.duration,
        scenarios: scenarios.map((entry) => entry.name),
      },
      note:
        options.appDir === process.cwd()
          ? 'приложение запущено из рабочей копии (проверьте ФС: 9p искажает цифры)'
          : 'приложение запущено из указанного --app-dir',
    },
    results,
  };

  const jsonFile = path.join(outDir, 'load.json');
  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Нагрузочный прогон',
    '',
    `- Когда: ${report.meta.startedAt}`,
    `- Приложение: \`${report.meta.appDir}\``,
    `- Данные: \`${report.meta.dataDir}\``,
    `- Node: ${report.meta.node}`,
    `- Коммит: ${report.meta.commit ?? 'нет .git'}`,
    `- Профиль: ${options.vus} VU × ${options.sheets} листов, ${options.duration} с на сценарий`,
    '',
    '| Сценарий | RPS | p50, мс | p95 (p97.5), мс | p99, мс | errors | non2xx | статусы | loop p99, мс |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const item of results) {
    const { summary } = item;
    lines.push(
      `| ${item.name} | ${summary.rps} | ${summary.latencyMs.p50} | ${summary.latencyMs.p95} | ${summary.latencyMs.p99} | ${summary.errors} | ${summary.non2xx} | ${JSON.stringify(summary.statuses)} | ${item.loopDelay?.p99Ms ?? '—'} |`,
    );
  }
  lines.push(
    '',
    'Ошибки и non-2xx — факт прогона, а не приговор: до этапа 7 это report-only.',
    '',
  );
  const mdFile = path.join(outDir, 'load.md');
  fs.writeFileSync(mdFile, lines.join('\n'), 'utf8');

  await server.stop();
  if (!options.keepData && !options.dataDir) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } else if (options.keepData) {
    process.stdout.write(`[perf] data-dir сохранён: ${dataDir}\n`);
  }

  process.stdout.write(`[perf] отчёт: ${jsonFile}\n[perf] сводка: ${mdFile}\n`);
}

main().catch((error) => {
  console.error(
    `[perf] прогон не удался: ${error instanceof Error ? error.stack : String(error)}`,
  );
  process.exit(1);
});
