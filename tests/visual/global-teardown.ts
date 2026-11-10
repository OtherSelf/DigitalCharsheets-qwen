import fs from 'node:fs';

import type { FullConfig } from '@playwright/test';

import { readAllAccounts, STATE_FILE } from './state';

/**
 * После прогона удаляем только тестовые листы. Аккаунты (canonical и
 * воркерские) оставляем — они переиспользуются, а в локальном прогоне
 * временный DCS_DATA_DIR и так удаляется вместе с ними.
 */
export default async function globalTeardown(
  config: FullConfig,
): Promise<void> {
  if (!fs.existsSync(STATE_FILE)) return;

  try {
    const accounts = readAllAccounts();
    const baseURL =
      process.env.DCS_VISUAL_BASE_URL ||
      config.projects[0]?.use?.baseURL ||
      JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).baseURL;

    for (const account of accounts) {
      // Сырой fetch не хранит cookie jar — входим и берём сессию вручную.
      const auth = await fetch(`${baseURL}/api/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: account.username,
          password: account.password,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const sessionCookie = (auth.headers.get('set-cookie') || '').split(
        ';',
      )[0];

      for (const id of [account.dndId, account.dhId]) {
        if (!id) continue;
        await fetch(`${baseURL}/api/characters/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: sessionCookie ? { cookie: sessionCookie } : undefined,
          signal: AbortSignal.timeout(10_000),
        }).catch(() => undefined);
      }
    }
  } catch (error) {
    console.warn(
      '[visual] cleanup не удался:',
      error instanceof Error ? error.message : error,
    );
  } finally {
    fs.rmSync(STATE_FILE, { force: true });
  }
}
