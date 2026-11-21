import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { withDataLock, withSheetLock } from '@/lib/data-lock';

import { removeDir, useTempDataDir } from '@tests/support';

/**
 * Per-key vs глобальный лок. Инварианты:
 *   • разные листы пишутся параллельно;
 *   • один лист — строго по очереди;
 *   • глобальная операция ждёт активные листы и блокирует новые;
 *   • лист ждёт глобальную операцию.
 */

let dataDir = '';

beforeEach(async () => {
  dataDir = useTempDataDir();
});

afterEach(async () => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function waitFor(predicate: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (predicate()) resolve();
      else setTimeout(tick, 5);
    };
    tick();
  });
}

describe('per-key локи', () => {
  it('разные листы входят параллельно', async () => {
    const first = deferred();
    const second = deferred();
    const entered = { first: false, second: false };

    const firstDone = withSheetLock('sheet:a', async () => {
      entered.first = true;
      await first.promise;
    });
    const secondDone = withSheetLock('sheet:b', async () => {
      entered.second = true;
      await second.promise;
    });

    await waitFor(() => entered.first && entered.second);
    expect(entered).toEqual({ first: true, second: true });

    first.resolve();
    second.resolve();
    await Promise.all([firstDone, secondDone]);
  });

  it('один лист сериализуется', async () => {
    const release = deferred();
    const order: string[] = [];

    const first = withSheetLock('sheet:a', async () => {
      order.push('first');
      await release.promise;
      order.push('first-done');
    });
    const second = withSheetLock('sheet:a', async () => {
      order.push('second');
    });

    await waitFor(() => order.includes('first'));
    expect(order).toEqual(['first']);
    release.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'first-done', 'second']);
  });

  it('глобальный лок ждёт ключевой и блокирует новый ключ', async () => {
    const keyGate = deferred();
    let keyActive = false;
    let globalEntered = false;

    const keyDone = withSheetLock('sheet:a', async () => {
      keyActive = true;
      await keyGate.promise;
      keyActive = false;
    });
    await waitFor(() => keyActive);

    const globalDone = withDataLock(() => {
      globalEntered = true;
      return Promise.resolve();
    });
    const laterKey = deferred();
    let laterEntered = false;
    const laterDone = withSheetLock('sheet:b', async () => {
      laterEntered = true;
      await laterKey.promise;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(globalEntered).toBe(false);
    expect(laterEntered).toBe(false);

    keyGate.resolve();
    await keyDone;
    await globalDone;
    expect(globalEntered).toBe(true);

    await waitFor(() => laterEntered);
    laterKey.resolve();
    await laterDone;
  });

  it('ключевой лок ждёт глобальный', async () => {
    const globalGate = deferred();
    let keyEntered = false;

    const globalDone = withDataLock(async () => {
      await globalGate.promise;
    });
    const keyDone = withSheetLock('sheet:a', () => {
      keyEntered = true;
      return Promise.resolve();
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(keyEntered).toBe(false);

    globalGate.resolve();
    await globalDone;
    await keyDone;
    expect(keyEntered).toBe(true);
  });
});
