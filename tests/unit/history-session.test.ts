import { describe, expect, it } from 'vitest';

import {
  collapseSessionChanges,
  groupHistorySessions,
} from '@/lib/history-session';
import type {
  HistoryChange,
  HistoryRevision,
  HistorySource,
} from '@/lib/history-types';

function revision(
  id: string,
  at: string,
  changes: HistoryChange[],
  source: HistorySource = 'save',
): HistoryRevision {
  return {
    v: 1,
    id,
    at,
    source,
    changes,
    summary: { changed: 0, added: 0, removed: 0, bulk: 0 },
  };
}

function changed(
  path: string,
  before: unknown,
  after: unknown,
  extra: Partial<HistoryChange> = {},
): HistoryChange {
  return {
    kind: 'changed',
    path,
    before: { value: before },
    after: { value: after },
    ...extra,
  };
}

describe('groupHistorySessions', () => {
  it('склеивает ревизии в пределах 30 минут и начинает новую после паузы', () => {
    const sessions = groupHistorySessions([
      revision('r1', '2026-05-12T10:00:00.000Z', [
        changed('stats.strength', 10, 11),
      ]),
      revision('r2', '2026-05-12T10:20:00.000Z', [
        changed('stats.strength', 11, 12),
      ]),
      revision('r3', '2026-05-12T11:00:00.000Z', [changed('name', 'A', 'B')]),
    ]);

    expect(sessions).toHaveLength(2);
    // Новые сверху.
    expect(sessions[0].id).toBe('r3');
    expect(sessions[0].revisionCount).toBe(1);
    expect(sessions[1].id).toBe('r1');
    expect(sessions[1].revisionCount).toBe(2);
    expect(sessions[1].changes).toEqual([changed('stats.strength', 10, 12)]);
  });

  it('ровно 30 минут — ещё та же сессия', () => {
    const sessions = groupHistorySessions([
      revision('r1', '2026-05-12T10:00:00.000Z', []),
      revision('r2', '2026-05-12T10:30:00.000Z', []),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].revisionCount).toBe(2);
  });

  it('возвращает пустой список для пустого журнала', () => {
    expect(groupHistorySessions([])).toEqual([]);
  });

  it('выносит create/migration в маркеры сессии', () => {
    const sessions = groupHistorySessions([
      revision('r1', '2026-05-12T10:00:00.000Z', [], 'create'),
      revision('r2', '2026-05-12T10:05:00.000Z', [changed('name', 'A', 'B')]),
      revision('r3', '2026-05-12T10:06:00.000Z', [], 'migration'),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].markers).toEqual([
      { source: 'create', at: '2026-05-12T10:00:00.000Z' },
      { source: 'migration', at: '2026-05-12T10:06:00.000Z' },
    ]);
    expect(sessions[0].changes).toEqual([changed('name', 'A', 'B')]);
  });
});

describe('collapseSessionChanges', () => {
  it('оставляет первое «было» и последнее «стало»', () => {
    const result = collapseSessionChanges([
      changed('stats.strength', 10, 11),
      changed('stats.strength', 11, 12),
      changed('stats.strength', 12, 13),
    ]);

    expect(result).toEqual([changed('stats.strength', 10, 13)]);
  });

  it('убирает добавленный и удалённый в одной сессии элемент', () => {
    const result = collapseSessionChanges([
      {
        kind: 'added',
        path: 'inventory',
        key: 'i1',
        label: 'Sword',
        after: { value: { id: 'i1', name: 'Sword' } },
      },
      {
        kind: 'removed',
        path: 'inventory',
        key: 'i1',
        label: 'Sword',
        before: { value: { id: 'i1', name: 'Sword' } },
      },
    ]);

    expect(result).toEqual([]);
  });

  it('убирает удалённый и возвращённый в том же виде элемент', () => {
    const result = collapseSessionChanges([
      {
        kind: 'removed',
        path: 'inventory',
        key: 'i1',
        before: { value: { id: 'i1', name: 'Sword' } },
      },
      {
        kind: 'added',
        path: 'inventory',
        key: 'i1',
        after: { value: { id: 'i1', name: 'Sword' } },
      },
    ]);

    expect(result).toEqual([]);
  });

  it('превращает удаление и возврат с другим значением в changed', () => {
    const result = collapseSessionChanges([
      {
        kind: 'removed',
        path: 'inventory',
        key: 'i1',
        before: { value: { id: 'i1', name: 'Sword' } },
      },
      {
        kind: 'added',
        path: 'inventory',
        key: 'i1',
        after: { value: { id: 'i1', name: 'Sword +1' } },
      },
    ]);

    expect(result).toEqual([
      {
        kind: 'changed',
        path: 'inventory',
        key: 'i1',
        before: { value: { id: 'i1', name: 'Sword' } },
        after: { value: { id: 'i1', name: 'Sword +1' } },
      },
    ]);
  });

  it('накапливает array-add и array-remove', () => {
    const result = collapseSessionChanges([
      { kind: 'array-add', path: 'divineBoons', values: [{ value: 'a' }] },
      { kind: 'array-add', path: 'divineBoons', values: [{ value: 'b' }] },
      {
        kind: 'array-remove',
        path: 'divineBoons',
        values: [{ value: 'c' }],
      },
      {
        kind: 'array-remove',
        path: 'divineBoons',
        values: [{ value: 'd' }],
      },
    ]);

    expect(result).toEqual([
      {
        kind: 'array-add',
        path: 'divineBoons',
        values: [{ value: 'a' }, { value: 'b' }],
      },
      {
        kind: 'array-remove',
        path: 'divineBoons',
        values: [{ value: 'c' }, { value: 'd' }],
      },
    ]);
  });

  it('оставляет последний bulk для одного пути', () => {
    const result = collapseSessionChanges([
      { kind: 'bulk', path: 'items', count: 1 },
      { kind: 'bulk', path: 'items', count: 2 },
    ]);

    expect(result).toEqual([{ kind: 'bulk', path: 'items', count: 2 }]);
  });
});
