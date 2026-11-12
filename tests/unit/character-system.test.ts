import { describe, expect, it } from 'vitest';

import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveLegacySystemId,
  type CharacterSystemSource,
} from '@/games/character-system';

import { makeDhCharacter, makeDndCharacter } from './helpers';

/**
 * ─── LANDMARK: CHARACTER SYSTEM RESOLUTION TESTS ──────────────────────────
 * С этапа 2 ядро не хардкодит имена игр: legacy `gameSystem`/`edition`
 * разрешаются по `plugin.json#aliases`, самое специфичное правило выигрывает.
 */

describe('разрешение systemId', () => {
  it('явный systemId выигрывает у legacy-полей', () => {
    expect(
      resolveCharacterSystemId({
        systemId: 'dnd5e',
        gameSystem: 'Dark Heresy',
      }),
    ).toBe('dnd5e');
    expect(resolveCharacterSystemId({ systemId: 'dh1', edition: '2nd' })).toBe(
      'dh1',
    );
  });

  it('неизвестный systemId не подменяется legacy-именами', () => {
    // Плагина `dh9` нет: явный id авторитетен, угадывать по gameSystem нельзя.
    expect(
      resolveCharacterSystemId({ systemId: 'dh9', gameSystem: 'Dark Heresy' }),
    ).toBeUndefined();
  });

  it('D&D 5e по legacy gameSystem', () => {
    expect(resolveCharacterSystemId({ gameSystem: 'Dungeons & Dragons' })).toBe(
      'dnd5e',
    );
  });

  it.each([
    ['2nd', 'dh2'],
    ['1st', 'dh1'],
    ['hybrid', 'dh1'],
    [undefined, 'dh1'],
  ])('Dark Heresy с edition=%s → %s', (edition, expected) => {
    expect(
      resolveCharacterSystemId({ gameSystem: 'Dark Heresy', edition }),
    ).toBe(expected);
  });

  it('неизвестная игра не разрешается', () => {
    expect(resolveCharacterSystemId({ gameSystem: 'Unknown' })).toBeUndefined();
    expect(resolveCharacterSystemId({})).toBeUndefined();
    // Лист без systemId/gameSystem (сырые данные) — тоже не разрешается.
    expect(
      resolveCharacterSystemId({
        id: 'x',
        name: 'X',
      } as unknown as CharacterSystemSource),
    ).toBeUndefined();
  });

  it('алиасы берутся из манифестов, а не из кода ядра', () => {
    // Ровно те legacy-значения, что объявлены в plugin.json.
    expect(resolveLegacySystemId({ gameSystem: 'Dungeons & Dragons' })).toBe(
      'dnd5e',
    );
    expect(
      resolveLegacySystemId({ gameSystem: 'Dark Heresy', edition: '2nd' }),
    ).toBe('dh2');
    expect(resolveLegacySystemId({ gameSystem: 'Dark Heresy' })).toBe('dh1');
  });

  it('getCharacterModule отдаёт модуль разрешённой редакции', () => {
    expect(getCharacterModule({ systemId: 'dh2' })?.id).toBe('dh2');
    expect(getCharacterModule({ gameSystem: 'Dungeons & Dragons' })?.id).toBe(
      'dnd5e',
    );
    expect(getCharacterModule({ gameSystem: 'Unknown' })).toBeUndefined();
  });
});

describe('нормализация листа через реестр', () => {
  it('legacy-листы D&D и DH нормализуются плагинами', () => {
    const dnd = makeDndCharacter();
    const dh = makeDhCharacter({ edition: '2nd' });
    expect(resolveCharacterSystemId(dnd)).toBe('dnd5e');
    expect(resolveCharacterSystemId(dh)).toBe('dh2');
  });
});
