import { describe, expect, it, vi } from 'vitest';

import { SheetBoundary } from '@/components/sheets/sheet-error-boundary';
import { PLUGIN_UI_SLOTS } from '@/games/plugin-api';
import { gamePlugins, listGameModules } from '@/games/registry';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: PLUGIN UI SLOTS TESTS ──────────────────────────────────────
 * Контракт UI-слотов этапа 3:
 *   • лист и форма каждого плагина действительно грузятся через реестр;
 *   • манифест перечисляет ровно те слоты, которые модуль реализовал;
 *   • слоты-функции (`HeaderSubtitle`, `CompactNav`, `CardSummary`) дают
 *     непустые подписи и валидные ключи из словарей;
 *   • граница ошибок листа переводит рендер плагина в безопасный fallback.
 */

const t = (key: string) => translations.en[key] ?? key;

function plugin(id: string) {
  const entry = gamePlugins.find((item) => item.manifest.id === id);
  if (!entry) throw new Error(`нет плагина ${id}`);
  return entry;
}

describe('загрузка листа и формы через реестр', () => {
  it('каждый модуль отдаёт загружаемые компоненты', async () => {
    const modules = listGameModules();
    expect(modules.length).toBeGreaterThan(0);
    for (const gameModule of modules) {
      const [sheet, form] = await Promise.all([
        gameModule.components.loadSheet(),
        gameModule.components.loadCreateForm(),
      ]);
      // forwardRef-компоненты — объекты, обычные функции — функции.
      expect(sheet.default, gameModule.id).toBeTruthy();
      expect(form.default, gameModule.id).toBeTruthy();
    }
  });
});

describe('слоты: манифест ↔ модуль', () => {
  it('перечисленные слоты реализованы, лишних нет', () => {
    for (const entry of gamePlugins) {
      const declared = [...(entry.manifest.ui?.slots ?? [])].sort();
      const implemented = Object.entries(entry.module.ui ?? {})
        .filter(
          ([name, value]) =>
            value !== undefined &&
            (PLUGIN_UI_SLOTS as readonly string[]).includes(name),
        )
        .map(([name]) => name)
        .sort();
      expect(implemented, entry.manifest.id).toEqual(declared);
    }
  });
});

describe('слоты-функции плагинов', () => {
  it('dnd5e: подпись шапки и карточки содержат уровень', () => {
    const entry = plugin('dnd5e');
    const character = {
      ...entry.module.createDefaults(),
      id: 'fixture',
      level: 3,
    } as never;

    expect(entry.module.ui?.HeaderSubtitle?.(character, t)).toContain('Lvl');
    const summary = entry.module.ui?.CardSummary?.(character, t);
    expect(summary?.text).toContain('Lvl');
    expect(summary?.badgeVariant).toBe('default');
  });

  it.each([['dh1'], ['dh2']])('%s: подпись шапки и карточки непустые', (id) => {
    const entry = plugin(id);
    const character = {
      ...entry.module.createDefaults(),
      id: 'fixture',
    } as never;

    const headerSubtitle = entry.module.ui?.HeaderSubtitle?.(character, t);
    expect(headerSubtitle).toBeTruthy();
    expect(headerSubtitle).toContain(t('common.gameSystemDarkHeresy'));

    const summary = entry.module.ui?.CardSummary?.(character, t);
    expect(summary?.text).toBeTruthy();
    expect(summary?.badgeVariant).toBe('secondary');
  });

  it('CompactNav отдаёт пункты с полными i18n-ключами', () => {
    for (const entry of gamePlugins) {
      const character = {
        ...entry.module.createDefaults(),
        id: 'fixture',
      } as never;
      const items = entry.module.ui?.CompactNav?.(character) ?? [];
      expect(items.length, entry.manifest.id).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.labelKey, `${entry.manifest.id}: ${item.id}`).toContain(
          '.',
        );
        expect(
          translations.en[item.labelKey],
          `${entry.manifest.id}: ${item.labelKey}`,
        ).toBeDefined();
        expect(item.icon).toBeDefined();
      }
    }
  });

  it('dnd5e показывает эпические дары только на 20 уровне', () => {
    const entry = plugin('dnd5e');
    const base = entry.module.createDefaults() as Record<string, unknown>;
    const navAt1 = entry.module.ui?.CompactNav?.({ ...base, id: 'x' } as never);
    const navAt20 = entry.module.ui?.CompactNav?.({
      ...base,
      id: 'x',
      level: 20,
    } as never);
    expect(navAt1?.some((item) => item.id === 'boons-section')).toBe(false);
    expect(navAt20?.some((item) => item.id === 'boons-section')).toBe(true);
  });

  it('у каждой игры своя иконка вкладки', () => {
    expect(plugin('dnd5e').module.ui?.favicon).toBe('/favicon-dnd.png');
    expect(plugin('dh1').module.ui?.favicon).toBe('/favicon-dh.png');
    expect(plugin('dh2').module.ui?.favicon).toBe('/favicon-dh.png');
  });
});

describe('переводы без suffix-fallback', () => {
  it('bare-ключи больше не резолвятся: нужен полный namespace', () => {
    // Раньше t('weaponSkill') находил единственный *.weaponSkill. Фолбэк
    // удалён на этапе 3, поэтому такие ключи обязаны быть явными.
    for (const bare of ['weaponSkill', 'classFighter', 'armorTypeCarapace']) {
      expect(translations.en[bare]).toBeUndefined();
      expect(translations.ru[bare]).toBeUndefined();
    }
    expect(translations.en['dnd.classFighter']).toBeDefined();
    expect(translations.en['common.armorTypeCarapace']).toBeDefined();
  });
});

describe('граница ошибок листа', () => {
  it('переводит ошибку рендера в состояние fallback', () => {
    // Ошибку ловит React; проверяем, что контракт состояния корректен.
    const state = SheetBoundary.getDerivedStateFromError(
      new Error('plugin crashed'),
    );
    expect(state).toEqual({ hasError: true });
  });

  it('логирует сбой плагина, а не глотает его', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Метод не использует `this`, поэтому вызываем на прототипе.
    (SheetBoundary.prototype.componentDidCatch as (error: Error) => void)(
      new Error('boom'),
    );
    expect(spy).toHaveBeenCalledWith(
      '[sheet] plugin render failed:',
      expect.any(Error),
    );
    spy.mockRestore();
  });
});
