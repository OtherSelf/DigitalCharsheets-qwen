import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createRateLimiter,
  createSnapshotRateLimitStore,
  type SnapshotRateLimitStore,
} from '@/lib/security/rate-limit';

import { removeDir, useTempDataDir } from '@tests/support';

describe('снапшот лимитера', () => {
  let dataDir: string;
  let file: string;
  let nowMs: number;

  beforeEach(() => {
    dataDir = useTempDataDir();
    file = path.join(dataDir, '.state', 'rate-limit.json');
    nowMs = Date.parse('2026-11-23T12:00:00Z');
  });

  afterEach(() => {
    removeDir(dataDir);
  });

  const rule = { limit: 2, windowMs: 60_000 };

  it('переживает пересоздание store и лимитера', async () => {
    const store = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    const limiter = createRateLimiter({ store, now: () => nowMs });

    expect(limiter.check('login:203.0.113.7:hero', rule).allowed).toBe(true);
    expect(limiter.check('login:203.0.113.7:hero', rule).allowed).toBe(true);
    expect(limiter.check('login:203.0.113.7:hero', rule).allowed).toBe(false);
    await store.flushNow();

    const reloaded = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    const afterRestart = createRateLimiter({
      store: reloaded,
      now: () => nowMs,
    });
    expect(afterRestart.check('login:203.0.113.7:hero', rule).allowed).toBe(
      false,
    );
    // Другой ключ не затронут.
    expect(afterRestart.check('login:203.0.113.8:hero', rule).allowed).toBe(
      true,
    );
  });

  it('окно истекает и после рестарта', async () => {
    const store = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    const limiter = createRateLimiter({ store, now: () => nowMs });
    limiter.check('k', rule);
    limiter.check('k', rule);
    await store.flushNow();

    nowMs += rule.windowMs + 1;
    const reloaded = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    const afterRestart = createRateLimiter({
      store: reloaded,
      now: () => nowMs,
    });
    expect(afterRestart.check('k', rule).allowed).toBe(true);
  });

  it('при переполнении не вытесняет активный бакет, новые идут в overflow', () => {
    const store: SnapshotRateLimitStore = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      maxKeys: 1,
      now: () => nowMs,
    });
    const limiter = createRateLimiter({ store, now: () => nowMs });

    expect(limiter.check('victim', rule).allowed).toBe(true);
    // Первый «посторонний» занимает единственное свободное место, остальные
    // делят overflow. Порог 2: третий посторонний упирается в общий лимит.
    expect(limiter.check('flood-1', rule).allowed).toBe(true);
    expect(limiter.check('flood-2', rule).allowed).toBe(true);
    expect(limiter.check('flood-3', rule).allowed).toBe(false);

    // Бакет victim не вытеснен: его вторая попытка ещё разрешена.
    expect(limiter.check('victim', rule).allowed).toBe(true);
  });

  it('clear очищает память и снапшот', async () => {
    const store = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    store.write('k', [nowMs]);
    await store.flushNow();
    store.clear();
    await store.flushNow();

    const reloaded = createSnapshotRateLimitStore(file, {
      flushDelayMs: 0,
      now: () => nowMs,
    });
    expect(reloaded.read('k')).toEqual([]);
  });
});
