import { describe, expect, it } from 'vitest';

import {
  parsePendingCharacter,
  parsePendingUpdate,
  resolvePendingUpdate,
} from '@/lib/pending-draft';

/**
 * Разбор гостевых следов из sessionStorage (src/lib/pending-draft.ts).
 *
 * Покрыто: чтение черновика персонажа, чтение правки демо-листа и решение
 *          «можно ли применять правку к этому списку листов».
 * Почему так: раньше разбор был инлайном в CharacterProvider, и ошибка в нём
 *             (применить `pending_update` по демо-id) давала PUT в 404, а при
 *             совпадении id — молча перетирала реальный персонаж. Здесь
 *             правило зафиксировано: применяем только к существующему листу.
 */

const draft = {
  name: 'Guest Hero',
  gameSystem: 'Dungeons & Dragons',
  level: 1,
};

describe('parsePendingCharacter', () => {
  it('читает черновик формы', () => {
    expect(parsePendingCharacter(JSON.stringify(draft))).toEqual(draft);
  });

  it('пустая запись — это отсутствие черновика', () => {
    expect(parsePendingCharacter(null)).toBeNull();
    expect(parsePendingCharacter('')).toBeNull();
  });

  it('битый JSON и не-объект не роняют разбор', () => {
    expect(parsePendingCharacter('{oops')).toBeNull();
    expect(parsePendingCharacter('42')).toBeNull();
    expect(parsePendingCharacter('"text"')).toBeNull();
    expect(parsePendingCharacter('null')).toBeNull();
    expect(parsePendingCharacter('[]')).toBeNull();
  });
});

describe('parsePendingUpdate', () => {
  it('читает id и патч', () => {
    expect(
      parsePendingUpdate(
        JSON.stringify({ id: 'demo-dnd-1', data: { name: 'Thorin' } }),
      ),
    ).toEqual({ id: 'demo-dnd-1', data: { name: 'Thorin' } });
  });

  it('без непустого id правка отбрасывается', () => {
    expect(parsePendingUpdate(null)).toBeNull();
    expect(parsePendingUpdate('{oops')).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ data: { name: 'X' } })),
    ).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ id: '', data: { name: 'X' } })),
    ).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ id: 7, data: { name: 'X' } })),
    ).toBeNull();
  });

  it('без объекта данных правка отбрасывается', () => {
    expect(parsePendingUpdate(JSON.stringify({ id: 'abc' }))).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ id: 'abc', data: 'name' })),
    ).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ id: 'abc', data: null })),
    ).toBeNull();
    expect(
      parsePendingUpdate(JSON.stringify({ id: 'abc', data: [] })),
    ).toBeNull();
  });
});

describe('resolvePendingUpdate', () => {
  const raw = JSON.stringify({ id: 'real-sheet', data: { notes: 'edited' } });
  const load = [{ id: 'real-sheet' }, { id: 'other-sheet' }];

  it('применяет правку к листу, который вернул сервер', () => {
    expect(resolvePendingUpdate(raw, load)).toEqual({
      id: 'real-sheet',
      data: { notes: 'edited' },
    });
  });

  it('демо-лист отбрасывается: в аккаунте его нет', () => {
    const demo = JSON.stringify({
      id: 'demo-dnd-1',
      data: { name: 'Thorin Ironforge' },
    });
    expect(resolvePendingUpdate(demo, load)).toBeNull();
    expect(resolvePendingUpdate(demo, [])).toBeNull();
  });

  it('устаревший id (лист удалён) отбрасывается', () => {
    const stale = JSON.stringify({ id: 'deleted-sheet', data: { level: 5 } });
    expect(resolvePendingUpdate(stale, load)).toBeNull();
  });

  it('битая правка не применяется, даже если список непустой', () => {
    expect(resolvePendingUpdate('{oops', load)).toBeNull();
    expect(resolvePendingUpdate(null, load)).toBeNull();
  });
});
