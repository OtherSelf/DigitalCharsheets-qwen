import { describe, expect, it } from 'vitest';

import { diffCharacterRecords } from '@/lib/history-diff';
import type { HistoryChange } from '@/lib/history-types';

function makeBase(): Record<string, unknown> {
  return {
    id: 'char-1',
    userId: 'user-1',
    systemId: 'dnd5e',
    schemaVersion: 2,
    gameSystem: 'Dungeons & Dragons',
    name: 'Seraphina',
    notes: 'hello',
    stats: { strength: 10, dexterity: 12 },
    inventory: [{ id: 'i1', name: 'Sword', status: 'default', notes: '' }],
    divineBoons: ['a', 'b'],
    questLog: [
      {
        id: 'q1',
        title: 'Quest',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function paths(changes: HistoryChange[]): string[] {
  return changes.map((change) => change.path);
}

describe('diffCharacterRecords', () => {
  it('возвращает null, если содержательных изменений нет', () => {
    const before = makeBase();
    const after = clone(before);

    expect(diffCharacterRecords(before, after)).toBeNull();
  });

  it('игнорирует служебные поля и даты на любом уровне', () => {
    const before = makeBase();
    const after = clone(before);
    after.userId = 'other-user';
    after.schemaVersion = 99;
    after.gameSystem = 'Other';
    after.systemId = 'other';
    const quest = (after.questLog as Record<string, unknown>[])[0];
    quest.createdAt = '2026-01-01T00:00:00.000Z';
    quest.updatedAt = '2026-01-01T00:00:00.000Z';

    expect(diffCharacterRecords(before, after)).toBeNull();
  });

  it('находит изменение вложенного поля с путём', () => {
    const before = makeBase();
    const after = clone(before);
    (after.stats as Record<string, unknown>).strength = 18;

    const diff = diffCharacterRecords(before, after);

    expect(diff).not.toBeNull();
    expect(diff?.changes).toEqual([
      {
        kind: 'changed',
        path: 'stats.strength',
        before: { value: 10 },
        after: { value: 18 },
      },
    ]);
    expect(diff?.summary).toEqual({
      changed: 1,
      added: 0,
      removed: 0,
      bulk: 0,
    });
    expect(diff?.truncated).toBe(false);
  });

  it('помечает добавленные и удалённые поля', () => {
    const before = makeBase();
    const after = clone(before);
    delete after.notes;
    after.level = 5;

    const diff = diffCharacterRecords(before, after);

    expect(diff?.changes).toEqual([
      {
        kind: 'added',
        path: 'level',
        after: { value: 5 },
      },
      {
        kind: 'removed',
        path: 'notes',
        before: { value: 'hello' },
      },
    ]);
  });

  it('сравнивает keyed-массивы по id и даёт подпись элемента', () => {
    const before = makeBase();
    const after = clone(before);
    after.inventory = [
      { id: 'i1', name: 'Sword', status: 'default', notes: 'sharp' },
      { id: 'i2', name: 'Potion', status: 'default', notes: '' },
    ];

    const diff = diffCharacterRecords(before, after);

    expect(diff?.changes).toEqual([
      {
        kind: 'changed',
        path: 'inventory',
        key: 'i1',
        label: 'Sword',
        field: 'notes',
        before: { value: '' },
        after: { value: 'sharp' },
      },
      {
        kind: 'added',
        path: 'inventory',
        key: 'i2',
        label: 'Potion',
        after: {
          value: { id: 'i2', name: 'Potion', status: 'default', notes: '' },
        },
      },
    ]);
    expect(diff?.summary).toEqual({
      changed: 1,
      added: 1,
      removed: 0,
      bulk: 0,
    });
  });

  it('не считает перестановку keyed-массива изменением', () => {
    const before = makeBase();
    before.inventory = [
      { id: 'i1', name: 'Sword', status: 'default', notes: '' },
      { id: 'i2', name: 'Potion', status: 'default', notes: '' },
    ];
    const after = clone(before);
    after.inventory = [
      { id: 'i2', name: 'Potion', status: 'default', notes: '' },
      { id: 'i1', name: 'Sword', status: 'default', notes: '' },
    ];

    expect(diffCharacterRecords(before, after)).toBeNull();
  });

  it('удаляет элемент keyed-массива целиком', () => {
    const before = makeBase();
    const after = clone(before);
    after.inventory = [];

    const diff = diffCharacterRecords(before, after);

    expect(diff?.changes).toEqual([
      {
        kind: 'removed',
        path: 'inventory',
        key: 'i1',
        label: 'Sword',
        before: {
          value: {
            id: 'i1',
            name: 'Sword',
            status: 'default',
            notes: '',
          },
        },
      },
    ]);
  });

  it('даёт array-add/array-remove для массивов примитивов', () => {
    const before = makeBase();
    const after = clone(before);
    after.divineBoons = ['b', 'c'];

    const diff = diffCharacterRecords(before, after);

    expect(diff?.changes).toEqual([
      {
        kind: 'array-add',
        path: 'divineBoons',
        values: [{ value: 'c' }],
      },
      {
        kind: 'array-remove',
        path: 'divineBoons',
        values: [{ value: 'a' }],
      },
    ]);
    expect(diff?.summary).toEqual({
      changed: 0,
      added: 1,
      removed: 1,
      bulk: 0,
    });
  });

  it('перестановку массива примитивов показывает как bulk', () => {
    const before = makeBase();
    const after = clone(before);
    after.divineBoons = ['b', 'a'];

    const diff = diffCharacterRecords(before, after);

    expect(diff?.changes).toEqual([
      {
        kind: 'bulk',
        path: 'divineBoons',
        beforeCount: 2,
        afterCount: 2,
        count: 2,
      },
    ]);
    expect(diff?.summary.bulk).toBe(1);
  });

  it('обрезает длинные значения и сохраняет длину', () => {
    const before = makeBase();
    const after = clone(before);
    before.notes = 'a'.repeat(40);
    after.notes = 'b'.repeat(50);

    const diff = diffCharacterRecords(before, after, {
      maxValueChars: 10,
    });

    expect(diff?.changes).toEqual([
      {
        kind: 'changed',
        path: 'notes',
        before: { truncated: true, preview: 'a'.repeat(10), length: 40 },
        after: { truncated: true, preview: 'b'.repeat(10), length: 50 },
      },
    ]);
  });

  it('сворачивает слишком длинный список изменений в bulk', () => {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (let index = 0; index < 10; index += 1) {
      before[`field${index}`] = index;
      after[`field${index}`] = index + 1;
    }

    const diff = diffCharacterRecords(before, after, { maxChanges: 4 });

    expect(diff?.truncated).toBe(true);
    expect(diff?.changes).toHaveLength(4);
    expect(diff?.changes[3]).toEqual({
      kind: 'bulk',
      path: '',
      count: 10,
    });
    expect(diff?.summary.changed).toBe(10);
    expect(diff?.summary.bulk).toBe(1);
  });

  it('сортирует изменения по пути детерминированно', () => {
    const before = makeBase();
    const after = clone(before);
    (after.stats as Record<string, unknown>).strength = 18;
    after.name = 'Seraphina Vael';

    const diff = diffCharacterRecords(before, after);

    expect(paths(diff?.changes ?? [])).toEqual(['name', 'stats.strength']);
  });

  it('не мутирует входные объекты', () => {
    const before = makeBase();
    const after = clone(before);
    (after.stats as Record<string, unknown>).strength = 18;
    const beforeSnapshot = JSON.stringify(before);
    const afterSnapshot = JSON.stringify(after);

    diffCharacterRecords(before, after);

    expect(JSON.stringify(before)).toBe(beforeSnapshot);
    expect(JSON.stringify(after)).toBe(afterSnapshot);
  });
});
