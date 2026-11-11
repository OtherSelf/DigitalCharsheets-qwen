import { describe, expect, it } from 'vitest';

import { dh1Module } from '@/games/dh1';
import { dh2Module } from '@/games/dh2';
import { dnd5eModule } from '@/games/dnd5e';
import { getGameDefinition, listGameDefinitions } from '@/games/games';
import {
  createGameRegistry,
  gameRegistry,
  getGameModule,
  listGameModules,
  listGameModulesForGame,
} from '@/games/registry';
import type { GameModule } from '@/games/types';

/**
 * ─── LANDMARK: GAME REGISTRY TESTS ─────────────────────────────────────────
 * Контракт реестра и модулей:
 *   • id уникальны, порядок стабилен;
 *   • дефолты каждого модуля проходят его же zod-схему;
 *   • редакционные поля не протекают между dh1/dh2;
 *   • фиктивная редакция добавляется в реестр без правок ядра
 *     (приёмочный критерий «dh3-заглушка»).
 */

function withId(gameModule: GameModule<any>, id = 'test-character') {
  return { ...gameModule.createDefaults(), id };
}

describe('реестр игр и редакций', () => {
  it('содержит три встроенных модуля в стабильном порядке', () => {
    expect(listGameModules().map((gameModule) => gameModule.id)).toEqual([
      'dnd5e',
      'dh1',
      'dh2',
    ]);
  });

  it('находит модуль по systemId и возвращает undefined для чужого', () => {
    expect(getGameModule('dh2')?.id).toBe('dh2');
    expect(getGameModule('dh9')).toBeUndefined();
    expect(() => gameRegistry.require('dh9')).toThrow(/Неизвестный модуль/);
  });

  it('группирует редакции по игре', () => {
    expect(listGameModulesForGame('darkHeresy').map((m) => m.id)).toEqual([
      'dh1',
      'dh2',
    ]);
    expect(listGameModulesForGame('dnd').map((m) => m.id)).toEqual(['dnd5e']);
    expect(listGameModulesForGame('nope')).toEqual([]);
  });

  it('игры имеют уникальные id и ссылаются на i18n-ключи', () => {
    const games = listGameDefinitions();
    expect(games.map((game) => game.id)).toEqual(['dnd', 'darkHeresy']);
    expect(getGameDefinition('dnd')?.nameKey).toBe('common.dungeonsAndDragons');
    expect(new Set(games.map((game) => game.id)).size).toBe(games.length);
  });

  it('падает на дублирующемся id модуля', () => {
    expect(() => createGameRegistry([dnd5eModule, dnd5eModule])).toThrow(
      /Дублирующийся id/,
    );
  });
});

describe('модули: дефолты и схемы', () => {
  it('дефолты каждого модуля проходят его zod-схему', () => {
    for (const gameModule of listGameModules()) {
      const parsed = gameModule.schema.safeParse(withId(gameModule));
      expect(
        parsed.success,
        `${gameModule.id}: ${parsed.success ? '' : parsed.error.message}`,
      ).toBe(true);
    }
  });

  it('дефолты помечены своей редакцией и текущей версией схемы', () => {
    for (const gameModule of listGameModules()) {
      const draft = gameModule.createDefaults() as Record<string, unknown>;
      expect(draft.systemId).toBe(gameModule.id);
      expect(draft.schemaVersion).toBe(gameModule.schemaVersion);
      expect('edition' in draft).toBe(false);
    }
  });

  it('dh1 не содержит 2e-полей, dh2 — 1e-полей', () => {
    const dh1 = dh1Module.createDefaults() as unknown as Record<
      string,
      unknown
    >;
    const dh2 = dh2Module.createDefaults() as unknown as Record<
      string,
      unknown
    >;

    expect(dh1.fatigue1st).toBeDefined();
    expect('fatigue2nd' in dh1).toBe(false);
    expect('influence' in (dh1.stats as Record<string, unknown>)).toBe(false);

    expect(dh2.fatigue2nd).toBeDefined();
    expect('fatigue1st' in dh2).toBe(false);
    expect((dh2.stats as Record<string, number>).influence).toBe(30);
  });

  it('дефолты dnd5e не содержат полей Dark Heresy', () => {
    const draft = dnd5eModule.createDefaults() as unknown as Record<
      string,
      unknown
    >;
    expect(draft.gameSystem).toBe('Dungeons & Dragons');
    expect('fatigue1st' in draft).toBe(false);
    expect('homeWorld' in draft).toBe(false);
  });

  it('схема отвергает битый лист', () => {
    const { id: _id, ...draft } = withId(dnd5eModule) as Record<
      string,
      unknown
    >;
    const result = dnd5eModule.schema.safeParse({
      ...draft,
      stats: { strength: 10 },
      level: 'не число',
    });
    expect(result.success).toBe(false);
  });

  it('адаптер экспорта убирает непереносимые поля', () => {
    const portable = dnd5eModule.export.toPortableJson({
      ...dnd5eModule.createDefaults(),
      id: 'c1',
      userId: 'u1',
      migratedFrom: 'firebase',
      __seq: 3,
    } as never);
    expect(portable.userId).toBeUndefined();
    expect(portable.migratedFrom).toBeUndefined();
    expect(portable.__seq).toBeUndefined();
    expect(portable.id).toBe('c1');
  });
});

describe('расширяемость: новая редакция без правок ядра', () => {
  it('фиктивный модуль dh3 (test) добавляется в реестр и виден по статусу', () => {
    const dh3Module: GameModule<any> = {
      ...(dh1Module as GameModule<any>),
      id: 'dh3-test',
      gameId: 'darkHeresy',
      order: 25,
      defaultStatus: 'test',
      nameKey: 'games.dh3.name',
      descriptionKey: 'games.dh3.description',
      i18n: { en: {}, ru: {} },
    };

    const registry = createGameRegistry([
      dnd5eModule,
      dh1Module,
      dh2Module,
      dh3Module,
    ]);

    expect(registry.get('dh3-test')?.defaultStatus).toBe('test');
    expect(registry.list().map((gameModule) => gameModule.id)).toEqual([
      'dnd5e',
      'dh1',
      'dh3-test',
      'dh2',
    ]);
    expect(
      registry
        .list()
        .filter((gameModule) => gameModule.defaultStatus === 'published')
        .map((gameModule) => gameModule.id),
    ).toEqual(['dnd5e', 'dh1', 'dh2']);
  });
});
