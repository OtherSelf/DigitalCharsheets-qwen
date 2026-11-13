import { expect, test } from '@playwright/test';

import {
  expectNoRawI18nKeys,
  getState,
  openApp,
  prepare,
  sheetPath,
} from './helpers';

/**
 * ─── LANDMARK: RAW I18N KEYS GUARD ────────────────────────────────────────
 * Визуальный дифф прощает мелкие изменения текста (порог по пикселям),
 * поэтому «сырой ключ» вроде `dh.rankScholar` мог спокойно пройти скриншот-
 * тесты. Здесь мы проверяем именно текст ключевых страниц: если в видимом
 * DOM остался ключ словаря, тест падает с его списком.
 */

const PAGES: [string, string][] = [
  ['/', 'dashboard'],
  ['/stats-editor', 'stats-editor'],
  ['/new?game=darkHeresy&edition=dh1', 'wizard dh1'],
  ['/new?game=darkHeresy&edition=dh2', 'wizard dh2'],
  ['/new?game=dnd&edition=dnd5e', 'wizard dnd5e'],
];

test.describe('нет сырых i18n-ключей', () => {
  for (const [lang, suffix] of [
    ['en', '(en)'],
    ['ru', '(ru)'],
  ] as const) {
    test(`ключевые страницы ${suffix}`, async ({ page, context }) => {
      await prepare(context, { language: lang });
      for (const [url, label] of PAGES) {
        await openApp(page, url);
        await expectNoRawI18nKeys(page, `${label} ${suffix}`);
      }
    });

    test(`листы персонажей ${suffix}`, async ({ page, context }) => {
      await prepare(context, { language: lang });
      const state = getState();
      for (const [id, label, name] of [
        [state.dndId, 'лист D&D', 'Seraphina Vael'],
        [state.dhId, 'лист DH', 'Lucius Varn'],
      ] as const) {
        await openApp(page, sheetPath(id));
        await expect(page.getByRole('heading', { name })).toBeVisible();
        await expectNoRawI18nKeys(page, `${label} ${suffix}`);
      }
    });
  }

  test('админка не показывает сырых ключей', async ({ page, context }) => {
    await prepare(context, { language: 'ru', account: 'admin' });
    await openApp(page, '/admin');
    await expectNoRawI18nKeys(page, 'admin (ru)');
  });
});
