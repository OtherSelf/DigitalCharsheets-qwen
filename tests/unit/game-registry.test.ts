import { describe, expect, it } from 'vitest';

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
 * Контракт реестра и модулей проверяется на обнаруженном наборе плагинов:
 * добавили или удалили папку в `src/games` — этот файл не меняется.
 *   • id уникальны, порядок стабилен;
 *   • дефолты каждого модуля проходят его же zod-схему;
 *   • каждый модуль группируется по своей игре, игры ссылаются на
 *     сгенерированные i18n-ключи;
 *   • фиктивная редакция добавляется в реестр без правок ядра
 *     (приёмочный критерий «dh3-заглушка»).
 *
 * Редакционные поля (fatigue1st/fatigue2nd/influence), схема и адаптер
 * экспорта, точный shortCode — проверяет тест самой редакции:
 * `src/games/<id>/tests/unit/module.test.ts`.
 */

function withId(gameModule: GameModule<any>, id = 'test-character') {
  return { ...gameModule.createDefaults(), id };
}

describe('реестр игр и редакций', () => {
  it('содержит все обнаруженные модули в стабильном порядке', () => {
    const detected = listGameModules();
    expect(detected.length).toBeGreaterThan(0);

    const ids = detected.map((gameModule) => gameModule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      [...detected]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((gameModule) => gameModule.id),
    );

    // Боевой реестр — тот же обнаруженный список, без ручных id.
    expect(gameRegistry.modules.map((gameModule) => gameModule.id)).toEqual(
      ids,
    );
    expect(listGameModules().map((gameModule) => gameModule.id)).toEqual(ids);
  });

  it('находит каждый модуль по systemId и возвращает undefined для чужого', () => {
    for (const gameModule of listGameModules()) {
      expect(getGameModule(gameModule.id)).toBe(gameModule);
    }

    expect(getGameModule('missing-plugin')).toBeUndefined();
    expect(() => gameRegistry.require('missing-plugin')).toThrow(
      /Неизвестный модуль/,
    );
  });

  it('за каждой редакцией закреплён уникальный короткий код игры', () => {
    const codes = listGameModules().map((gameModule) => gameModule.shortCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('группирует редакции по игре', () => {
    const detected = listGameModules();
    const gameIds = [
      ...new Set(detected.map((gameModule) => gameModule.gameId)),
    ];
    expect(gameIds.length).toBeGreaterThan(0);

    for (const gameId of gameIds) {
      // Порядок и набор — ровно те модули, что заявили эту игру.
      expect(listGameModulesForGame(gameId).map((m) => m.id)).toEqual(
        detected
          .filter((gameModule) => gameModule.gameId === gameId)
          .map((gameModule) => gameModule.id),
      );
    }
    expect(listGameModulesForGame('missing-game')).toEqual([]);
  });

  it('игры имеют уникальные id и ссылаются на i18n-ключи', () => {
    const games = listGameDefinitions();
    const detected = listGameModules();
    expect(games.length).toBeGreaterThan(0);
    expect(new Set(games.map((game) => game.id)).size).toBe(games.length);

    // Каждая обнаруженная игра описана определением, и наоборот.
    expect(games.map((game) => game.id).sort()).toEqual(
      [...new Set(detected.map((gameModule) => gameModule.gameId))].sort(),
    );
    expect(games.map((game) => game.id)).toEqual(
      [...games]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((game) => game.id),
    );

    for (const game of games) {
      expect(getGameDefinition(game.id)).toBe(game);
      expect(game.nameKey).toBe(`games.generated.${game.id}.name`);
      expect(game.descriptionKey).toBe(
        `games.generated.${game.id}.description`,
      );
    }
  });

  it('падает на дублирующемся id модуля', () => {
    const [first] = listGameModules();
    expect(first).toBeDefined();
    expect(() => createGameRegistry([first, first])).toThrow(
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

  it('названия редакций есть в словарях всех объявленных локалей', () => {
    for (const gameModule of listGameModules()) {
      expect(gameModule.nameKey.length, gameModule.id).toBeGreaterThan(0);
      expect(gameModule.descriptionKey.length, gameModule.id).toBeGreaterThan(
        0,
      );
      for (const [locale, dictionary] of Object.entries(gameModule.i18n)) {
        expect(
          dictionary?.[gameModule.nameKey],
          `${gameModule.id}: ${locale} ${gameModule.nameKey}`,
        ).toBeTruthy();
        expect(
          dictionary?.[gameModule.descriptionKey],
          `${gameModule.id}: ${locale} ${gameModule.descriptionKey}`,
        ).toBeTruthy();
      }
    }
  });
});

describe('расширяемость: новая редакция без правок ядра', () => {
  it('фиктивный модуль dh3 (test) добавляется в реестр и виден по статусу', () => {
    const detected = listGameModules();
    const base = detected[0];
    expect(base).toBeDefined();

    const fakeModule: GameModule<any> = {
      ...(base as GameModule<any>),
      id: 'dh3-test',
      order: Math.max(...detected.map((gameModule) => gameModule.order)) + 10,
      defaultStatus: 'test',
      nameKey: 'games.dh3.name',
      descriptionKey: 'games.dh3.description',
      i18n: { en: {}, ru: {} },
    };

    const registry = createGameRegistry([...detected, fakeModule]);

    expect(registry.get('dh3-test')?.defaultStatus).toBe('test');
    // Порядок — тот же компаратор реестра: order, затем id.
    expect(registry.list().map((gameModule) => gameModule.id)).toEqual(
      [...detected, fakeModule]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((gameModule) => gameModule.id),
    );
    expect(registry.list()).toHaveLength(detected.length + 1);
    expect(
      registry
        .list()
        .filter((gameModule) => gameModule.defaultStatus === 'published')
        .map((gameModule) => gameModule.id),
    ).toEqual(
      detected
        .filter((gameModule) => gameModule.defaultStatus === 'published')
        .map((gameModule) => gameModule.id),
    );
  });
});
