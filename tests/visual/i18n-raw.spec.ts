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
      // Сегменты и id — из состояния global-setup, а не списком редакций.
      for (const [segment, id] of Object.entries(getState().characters)) {
        if (!id) continue;
        await openApp(page, sheetPath(id));
        await expectNoRawI18nKeys(page, `лист ${segment} ${suffix}`);
      }
    });
  }

  test('админка не показывает сырых ключей', async ({ page, context }) => {
    await prepare(context, { language: 'ru', account: 'admin' });
    await openApp(page, '/admin');
    await expectNoRawI18nKeys(page, 'admin (ru)');
  });
});
