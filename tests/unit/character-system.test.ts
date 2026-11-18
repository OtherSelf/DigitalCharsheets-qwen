import { describe, expect, it } from 'vitest';

import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveLegacySystemId,
  resolveSheetReadOnly,
  type CharacterSystemSource,
} from '@/games/character-system';
import { listGameModules, listGamePlugins } from '@/games/registry';

/**
 * ─── LANDMARK: CHARACTER SYSTEM RESOLUTION TESTS ──────────────────────────
 * Ядро не хардкодит имена игр: legacy `gameSystem`/`edition` разрешаются по
 * `plugin.json#aliases` обнаруженных плагинов, самое специфичное правило
 * выигрывает.
 *
 * Общие инварианты проверяются для каждого обнаруженного модуля; точные
 * legacy-значения редакции — в её собственном тесте
 * (`src/games/<id>/tests/unit/legacy.test.ts`), чтобы добавление или удаление
 * плагина не ломало хост.
 */

describe('разрешение systemId', () => {
  it('явный systemId выигрывает у legacy-полей', () => {
    for (const gameModule of listGameModules()) {
      expect(
        resolveCharacterSystemId({
          systemId: gameModule.id,
          gameSystem: 'Unknown',
        }),
      ).toBe(gameModule.id);
      expect(
        resolveCharacterSystemId({
          systemId: gameModule.id,
          edition: 'Unknown',
        }),
      ).toBe(gameModule.id);
    }
  });

  it('неизвестный systemId не подменяется legacy-именами', () => {
    // Плагина `missing-plugin` нет: явный id авторитетен, угадывать по
    // legacy-полям нельзя.
    expect(
      resolveCharacterSystemId({
        systemId: 'missing-plugin',
        gameSystem: 'Unknown',
      }),
    ).toBeUndefined();
    for (const plugin of listGamePlugins()) {
      for (const alias of plugin.manifest.aliases ?? []) {
        expect(
          resolveCharacterSystemId({ systemId: 'missing-plugin', ...alias }),
          `${plugin.manifest.id}: ${JSON.stringify(alias)}`,
        ).toBeUndefined();
      }
    }
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
    // Каждое legacy-правило, объявленное в plugin.json, ведёт в
    // зарегистрированный модуль; точное значение проверяет тест редакции.
    const registered = new Set(listGameModules().map((m) => m.id));
    for (const plugin of listGamePlugins()) {
      for (const alias of plugin.manifest.aliases ?? []) {
        const resolved = resolveLegacySystemId(alias);
        expect(
          resolved,
          `${plugin.manifest.id}: ${JSON.stringify(alias)}`,
        ).toBeDefined();
        expect(
          registered.has(resolved!),
          `${plugin.manifest.id}: ${String(resolved)}`,
        ).toBe(true);
      }
    }
  });

  it('getCharacterModule отдаёт модуль разрешённой редакции', () => {
    for (const gameModule of listGameModules()) {
      expect(getCharacterModule({ systemId: gameModule.id })).toBe(gameModule);
    }
    expect(getCharacterModule({ gameSystem: 'Unknown' })).toBeUndefined();
    expect(getCharacterModule({})).toBeUndefined();
  });
});

describe('режим листа «только чтение» (D9)', () => {
  it('обычный лист — редактируемый', () => {
    for (const gameModule of listGameModules()) {
      expect(resolveSheetReadOnly({ systemId: gameModule.id }, [])).toEqual({
        readOnly: false,
        reason: null,
      });
    }
  });

  it('отключённый админом плагин — read-only c причиной disabled', () => {
    const detected = listGameModules();
    for (const gameModule of detected) {
      expect(
        resolveSheetReadOnly({ systemId: gameModule.id }, [gameModule.id]),
      ).toEqual({ readOnly: true, reason: 'disabled' });
    }
    // Выключение одной редакции не задевает другую.
    for (const disabled of detected) {
      for (const other of detected) {
        if (other.id === disabled.id) continue;
        expect(
          resolveSheetReadOnly({ systemId: other.id }, [disabled.id]).readOnly,
          `${disabled.id} → ${other.id}`,
        ).toBe(false);
      }
    }
  });

  it('плагин не установлен — read-only c причиной plugin_missing', () => {
    expect(resolveSheetReadOnly({ systemId: 'missing-plugin' }, [])).toEqual({
      readOnly: true,
      reason: 'plugin_missing',
    });
    expect(resolveSheetReadOnly({}, [])).toEqual({
      readOnly: true,
      reason: 'plugin_missing',
    });
  });
});
