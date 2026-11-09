import { describe, expect, it } from 'vitest';

import { createSaveQueue, type PendingSave } from '@/lib/save-queue';

interface Sheet {
  name?: string;
  level?: number;
  experiencePoints?: number;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Дождаться выполнения условия (без фейковых таймеров). */
async function until(
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('until(): timeout');
    await wait(5);
  }
}

describe('createSaveQueue', () => {
  it('склеивает несколько быстрых правок в один PUT', async () => {
    const sent: PendingSave<Sheet>[] = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 10,
      send: async (id, data) => {
        sent.push({ id, data });
        return 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' });
    queue.enqueue('sheet-1', { level: 2 });
    queue.enqueue('sheet-1', { name: 'B' });

    await queue.idle();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ id: 'sheet-1', data: { name: 'B', level: 2 } });
  });

  it('не отправляет два PUT на один лист одновременно', async () => {
    let active = 0;
    let maxActive = 0;
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      send: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await wait(10);
        active -= 1;
        return 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' });
    await until(() => active === 1);
    queue.enqueue('sheet-1', { name: 'B' });
    queue.enqueue('sheet-1', { name: 'C' });

    await queue.idle();

    expect(maxActive).toBe(1);
  });

  it('сохраняет порядок: последняя правка уходит последней', async () => {
    const sent: Partial<Sheet>[] = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      send: async (_id, data) => {
        await wait(5);
        sent.push(data);
        return 200;
      },
    });

    queue.enqueue('sheet-1', { experiencePoints: 3000 });
    await until(() => sent.length === 1);
    queue.enqueue('sheet-1', { experiencePoints: 2500 });

    await queue.idle();

    expect(sent).toEqual([
      { experiencePoints: 3000 },
      { experiencePoints: 2500 },
    ]);
  });

  it('ретраит 5xx, затем сообщает об ошибке и держит данные в очереди', async () => {
    let attempts = 0;
    const errors: PendingSave<Sheet>[] = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      maxAttempts: 2,
      retryDelayMs: 60_000,
      send: async () => {
        attempts += 1;
        return 500;
      },
      onError: (id, data) => errors.push({ id, data }),
    });

    queue.enqueue('sheet-1', { name: 'A' });

    await queue.idle();

    expect(attempts).toBe(2);
    expect(errors).toHaveLength(1);
    // Правка не потеряна — её можно дослать.
    expect(queue.hasPending()).toBe(true);
    expect(queue.snapshotAll()).toEqual([
      { id: 'sheet-1', data: { name: 'A' } },
    ]);
  });

  it('после ошибки следующая правка досылает и накопленное, и новое', async () => {
    let fail = true;
    const sent: Partial<Sheet>[] = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      maxAttempts: 1,
      retryDelayMs: 60_000,
      send: async (_id, data) => {
        sent.push(data);
        return fail ? 500 : 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' });
    await queue.idle();
    expect(sent).toHaveLength(1);

    fail = false;
    queue.enqueue('sheet-1', { level: 3 });
    await queue.idle();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ name: 'A', level: 3 });
    expect(queue.hasPending()).toBe(false);
  });

  it('сетевую ошибку (null) считает retryable, а 404 — нет', async () => {
    let calls = 0;
    const networkQueue = createSaveQueue<Sheet>({
      settleMs: 0,
      maxAttempts: 3,
      retryDelayMs: 60_000,
      send: async () => {
        calls += 1;
        return null;
      },
    });
    networkQueue.enqueue('sheet-1', { name: 'A' });
    await networkQueue.idle();
    expect(calls).toBe(3);

    calls = 0;
    const notFoundQueue = createSaveQueue<Sheet>({
      settleMs: 0,
      maxAttempts: 3,
      retryDelayMs: 60_000,
      send: async () => {
        calls += 1;
        return 404;
      },
    });
    notFoundQueue.enqueue('sheet-2', { name: 'A' });
    await notFoundQueue.idle();
    expect(calls).toBe(1);
  });

  it('snapshotAll отдаёт и то, что в полёте, и то, что ждёт (для keepalive)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = false;

    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      send: async () => {
        started = true;
        await gate;
        return 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' });
    await until(() => started);
    queue.enqueue('sheet-1', { level: 5 });

    expect(queue.snapshotAll()).toEqual([
      { id: 'sheet-1', data: { name: 'A', level: 5 } },
    ]);

    release();
    await queue.idle();
    expect(queue.snapshotAll()).toEqual([]);
  });

  it('разные листы сохраняются независимо', async () => {
    const sent: string[] = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      send: async (id) => {
        await wait(5);
        sent.push(id);
        return 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' });
    queue.enqueue('sheet-2', { name: 'B' });

    await queue.idle();

    expect(sent.sort()).toEqual(['sheet-1', 'sheet-2']);
  });

  // ─── порядковые метки (__page/__seq) ─────────────────────────────────────
  // Сервер по ним отбрасывает запоздавшие записи. Очередь обязана отправлять
  // метку ВМЕСТЕ с данными батча и отдавать самую свежую в snapshotAll().
  it('передаёт метку правки в send вместе с батчем', async () => {
    const sent: Array<{ data: Partial<Sheet>; meta?: any }> = [];
    const queue = createSaveQueue<Sheet>({
      settleMs: 10,
      send: async (_id, data, meta) => {
        sent.push({ data, meta });
        return 200;
      },
    });

    queue.enqueue('sheet-1', { experiencePoints: 100 }, { page: 'p', seq: 1 });
    queue.enqueue('sheet-1', { experiencePoints: 500 }, { page: 'p', seq: 2 });

    await queue.idle();

    expect(sent).toHaveLength(1);
    // Один PUT, внутри — последнее значение и последняя метка.
    expect(sent[0].data).toEqual({ experiencePoints: 500 });
    expect(sent[0].meta).toEqual({ page: 'p', seq: 2 });
  });

  it('snapshotAll отдаёт метку отправляемого батча (для keepalive-досылки)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = false;

    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      send: async () => {
        started = true;
        await gate;
        return 200;
      },
    });

    queue.enqueue('sheet-1', { name: 'A' }, { page: 'p', seq: 1 });
    await until(() => started);
    queue.enqueue('sheet-1', { level: 5 }, { page: 'p', seq: 2 });

    expect(queue.snapshotAll()).toEqual([
      {
        id: 'sheet-1',
        data: { name: 'A', level: 5 },
        meta: { page: 'p', seq: 2 },
      },
    ]);

    release();
    await queue.idle();
  });

  it('после ошибки метка не теряется и не откатывается назад', async () => {
    const sent: Array<{ data: Partial<Sheet>; meta?: any }> = [];
    let fail = true;
    const queue = createSaveQueue<Sheet>({
      settleMs: 0,
      maxAttempts: 1,
      retryDelayMs: 60_000,
      send: async (_id, data, meta) => {
        sent.push({ data, meta });
        return fail ? 500 : 200;
      },
    });

    queue.enqueue('sheet-1', { experiencePoints: 100 }, { page: 'p', seq: 1 });
    await queue.idle();
    expect(fail).toBe(true);

    fail = false;
    queue.enqueue('sheet-1', { experiencePoints: 900 }, { page: 'p', seq: 2 });
    await queue.idle();

    expect(sent).toHaveLength(2);
    expect(sent[1].meta).toEqual({ page: 'p', seq: 2 });
    expect(sent[1].data).toMatchObject({ experiencePoints: 900 });
  });
});
