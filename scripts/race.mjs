#!/usr/bin/env node
// ============================================================================
//  scripts/race.mjs — гонки корректности на HTTP-уровне
//
//  Пока storage синхронный, `Promise.all` внутри процесса не перемежает
//  операции; настоящие гонки видны только через HTTP: несколько соединений,
//  реальные route handlers, реальные локи. Сценарии проверяют инварианты,
//  которые легко потерять при async-рефакторинге.
//
//  По умолчанию — report-only: сценарий печатает FAIL и детали, но код выхода
//  0 (на этапе 1 текущие баги фиксируются как факт). `--assert` включает
//  строгий режим для этапа 7 и CI-подобных прогонов.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createShare,
  createSheet,
  delay,
  freePort,
  httpRequest,
  PERF_PASSWORD,
  PERF_RECOVERY,
  randomId,
  registerOrLogin,
  startPerfServer,
} from './lib/perf-http.mjs';

function parseArgs(argv) {
  const options = { assert: false, keepData: false };
  for (const arg of argv) {
    if (arg === '--assert') options.assert = true;
    else if (arg === '--keep-data') options.keepData = true;
    else if (arg === '-h' || arg === '--help') {
      console.log(
        'Использование: node scripts/race.mjs [--assert] [--keep-data]',
      );
      process.exit(0);
    } else {
      throw new Error(`Неизвестный флаг: ${arg}`);
    }
  }
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function historyLines(dataDir, uid, characterId) {
  const file = path.join(
    dataDir,
    'users',
    uid,
    'history',
    `${characterId}.jsonl`,
  );
  if (!fs.existsSync(file)) return { file, lines: [] };
  return {
    file,
    lines: fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

async function runScenario(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    return { name, ok: true, details, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-race-'));
  const port = await freePort();
  const loopDelayFile = path.join(dataDir, 'loop-delay.json');
  const server = await startPerfServer({
    appDir: process.cwd(),
    dataDir,
    port,
    loopDelayFile,
  });
  const baseUrl = server.baseUrl;
  const runId = randomId('race')
    .replace(/[^a-z0-9-]/gi, '')
    .toLowerCase();
  const results = [];

  try {
    results.push(
      await runScenario('parallel-register-one-login', async () => {
        const username = `${runId}-reg@example.test`;
        const attempts = 8;
        const responses = await Promise.all(
          Array.from({ length: attempts }, () =>
            httpRequest(baseUrl, '/api/auth/register', {
              method: 'POST',
              body: {
                username,
                password: PERF_PASSWORD,
                displayName: username,
                recoveryPhrase: PERF_RECOVERY,
              },
            }),
          ),
        );
        const success = responses.filter((item) => item.status === 200);
        const conflicts = responses.filter((item) => item.status === 409);
        const unexpected = responses.filter(
          (item) => item.status !== 200 && item.status !== 409,
        );
        const indexFile = path.join(dataDir, 'index', 'logins.json');
        const index = readJson(indexFile);
        const entries = Object.entries(index.logins ?? {}).filter(
          ([login]) => login === username,
        );
        assert(
          unexpected.length === 0,
          `неожиданные статусы: ${unexpected.map((item) => item.status).join(', ')}`,
        );
        assert(success.length === 1, `успешных регистраций: ${success.length}`);
        assert(conflicts.length === attempts - 1, `409: ${conflicts.length}`);
        assert(entries.length === 1, `записей в индексе: ${entries.length}`);
        return {
          attempts,
          success: success.length,
          conflicts: conflicts.length,
        };
      }),
    );

    results.push(
      await runScenario('parallel-put-one-sheet', async () => {
        const username = `${runId}-put@example.test`;
        const auth = await registerOrLogin(baseUrl, username);
        const characterId = await createSheet(baseUrl, auth.cookie, 'race put');
        const writes = 20;
        const responses = await Promise.all(
          Array.from({ length: writes }, (_, index) =>
            httpRequest(
              baseUrl,
              `/api/characters/${encodeURIComponent(characterId)}`,
              {
                method: 'PUT',
                cookie: auth.cookie,
                body: {
                  __page: 'race',
                  __seq: index + 1,
                  name: `race-${index + 1}`,
                },
              },
            ),
          ),
        );
        const statuses = responses.map((item) => item.status);
        const file = path.join(
          dataDir,
          'users',
          auth.uid,
          'characters',
          `${characterId}.json`,
        );
        const stored = readJson(file);
        const history = historyLines(dataDir, auth.uid, characterId);
        const parsed = history.lines.map((line) => JSON.parse(line));
        assert(
          statuses.every((status) => status === 200),
          `статусы: ${statuses.join(', ')}`,
        );
        assert(
          stored.name === `race-${writes}`,
          `последняя запись: ${stored.name}, ожидалась race-${writes}`,
        );
        assert(parsed.length > 0, 'история пуста');
        return {
          writes,
          finalName: stored.name,
          historyRevisions: parsed.length,
        };
      }),
    );

    results.push(
      await runScenario('logout-during-writes', async () => {
        const username = `${runId}-logout@example.test`;
        const auth = await registerOrLogin(baseUrl, username);
        const characterId = await createSheet(
          baseUrl,
          auth.cookie,
          'race logout',
        );
        const writes = 20;
        const pending = Array.from({ length: writes }, (_, index) =>
          httpRequest(
            baseUrl,
            `/api/characters/${encodeURIComponent(characterId)}`,
            {
              method: 'PUT',
              cookie: auth.cookie,
              body: {
                __page: 'race-logout',
                __seq: index + 1,
                notes: `logout ${index + 1}`,
              },
            },
          ),
        );
        await delay(10);
        const logout = await httpRequest(baseUrl, '/api/auth/logout', {
          method: 'POST',
          cookie: auth.cookie,
        });
        await Promise.allSettled(pending);
        const after = await httpRequest(baseUrl, '/api/characters', {
          cookie: auth.cookie,
        });
        assert(logout.status === 200, `logout: ${logout.status}`);
        assert(after.status === 401, `после logout: ${after.status}`);
        return { logout: logout.status, afterLogout: after.status };
      }),
    );

    results.push(
      await runScenario('delete-sheet-during-writes', async () => {
        const username = `${runId}-delete@example.test`;
        const auth = await registerOrLogin(baseUrl, username);
        const characterId = await createSheet(
          baseUrl,
          auth.cookie,
          'race delete',
        );
        await createShare(baseUrl, auth.cookie, characterId);
        const writes = 20;
        const pending = Array.from({ length: writes }, (_, index) =>
          httpRequest(
            baseUrl,
            `/api/characters/${encodeURIComponent(characterId)}`,
            {
              method: 'PUT',
              cookie: auth.cookie,
              body: {
                __page: 'race-delete',
                __seq: index + 1,
                notes: `delete ${index + 1}`,
              },
            },
          ),
        );
        await delay(10);
        const deletion = await httpRequest(
          baseUrl,
          `/api/characters/${encodeURIComponent(characterId)}`,
          { method: 'DELETE', cookie: auth.cookie },
        );
        await Promise.allSettled(pending);

        const characterFile = path.join(
          dataDir,
          'users',
          auth.uid,
          'characters',
          `${characterId}.json`,
        );
        const history = historyLines(dataDir, auth.uid, characterId);
        const sharesFile = path.join(dataDir, 'shares.json');
        let shareEntries = [];
        if (fs.existsSync(sharesFile)) {
          const shares = readJson(sharesFile);
          shareEntries = Object.values(shares.shares ?? {}).filter(
            (entry) => entry.characterId === characterId,
          );
        }
        const health = await httpRequest(baseUrl, '/api/health');
        assert(
          deletion.status === 200 || deletion.status === 404,
          `DELETE: ${deletion.status}`,
        );
        assert(
          !fs.existsSync(characterFile),
          'файл листа остался после DELETE',
        );
        assert(history.lines.length === 0, 'журнал остался после DELETE');
        assert(shareEntries.length === 0, 'share-запись осталась после DELETE');
        assert(health.status === 200, `health: ${health.status}`);
        return {
          deleteStatus: deletion.status,
          characterFileExists: fs.existsSync(characterFile),
          historyLines: history.lines.length,
          shareEntries: shareEntries.length,
          health: health.status,
        };
      }),
    );
  } finally {
    await server.stop();
    if (options.keepData) {
      process.stdout.write(`[race] data-dir сохранён: ${dataDir}\n`);
    } else {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  const report = {
    meta: {
      at: new Date().toISOString(),
      node: process.version,
      appDir: process.cwd(),
      dataDir,
    },
    results,
  };
  const outDir = path.join(process.cwd(), '.perf-results');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFile = path.join(outDir, `race-${stamp}.json`);
  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = ['# Race-сценарии', ''];
  for (const item of results) {
    lines.push(
      `- ${item.ok ? 'PASS' : 'FAIL'} — ${item.name} (${item.durationMs} мс)`,
    );
    if (!item.ok) lines.push(`  - ${item.error}`);
    else lines.push(`  - ${JSON.stringify(item.details)}`);
  }
  const mdFile = path.join(outDir, `race-${stamp}.md`);
  fs.writeFileSync(mdFile, `${lines.join('\n')}\n`, 'utf8');

  for (const item of results) {
    process.stdout.write(
      `[race] ${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.ok ? '' : `: ${item.error}`}\n`,
    );
  }
  process.stdout.write(`[race] отчёт: ${jsonFile}\n[race] сводка: ${mdFile}\n`);

  if (options.assert && results.some((item) => !item.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `[race] прогон не удался: ${error instanceof Error ? error.stack : String(error)}`,
  );
  process.exit(1);
});
