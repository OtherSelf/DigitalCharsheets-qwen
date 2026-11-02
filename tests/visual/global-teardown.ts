import fs from 'node:fs';
import type { FullConfig } from '@playwright/test';
import { readState, STATE_FILE } from './state';

/**
 * После прогона удаляем только тестовые листы. Аккаунт `visual-tests`
 * оставляем — он переиспользуется и не мешает (в локальном прогоне
 * временный DCS_DATA_DIR и так удаляется вместе с ним).
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  if (!fs.existsSync(STATE_FILE)) return;

  try {
    const state = readState();
    const baseURL =
      process.env.DCS_VISUAL_BASE_URL ||
      config.projects[0]?.use?.baseURL ||
      state.baseURL;

    for (const id of [state.dndId, state.dhId]) {
      if (!id) continue;
      await fetch(
        `${baseURL}/api/characters/${encodeURIComponent(id)}?userId=${encodeURIComponent(state.user.uid)}`,
        { method: 'DELETE', signal: AbortSignal.timeout(10_000) },
      ).catch(() => undefined);
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
