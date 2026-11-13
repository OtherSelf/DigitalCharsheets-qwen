import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  prepare,
  screenshotPage,
  sheetPath,
} from './helpers';

/**
 * Темы проверяются по представителю, а не по полной матрице
 * «тема × язык × лист × viewport»:
 *   • dark — dashboard (en/ru) и верх обоих листов на desktop;
 *   • warm — только мобильный верх D&D.
 *
 * Контраст и палитра общие для компонентов, поэтому остальные комбинации
 * дают мало нового сигнала, но удваивают эталоны.
 */
test.describe('темы', () => {
  test('dashboard — тёмная тема (en)', async ({ page, context }) => {
    await prepare(context, { theme: 'dark' });
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    await screenshotPage(page, 'dashboard-dark-en.png');
  });

  test('dashboard — тёмная тема (ru)', async ({ page, context }) => {
    await prepare(context, { theme: 'dark', language: 'ru' });
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Существующие персонажи' }),
    ).toBeVisible();
    await screenshotPage(page, 'dashboard-dark-ru.png');
  });

  test(
    'dashboard — тёплая тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, '/');

      await expect(
        page.getByRole('heading', { name: 'Existing Characters' }),
      ).toBeVisible();
      await screenshotPage(page, 'dashboard-warm-en.png');
    },
  );

  test(
    'переключатель темы — все варианты (en)',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/');

      await page.getByRole('button', { name: /toggle theme/i }).click();
      const menu = page.getByRole('menu');
      await expect(
        menu.getByRole('menuitem', { name: 'Light', exact: true }),
      ).toBeVisible();
      await expect(
        menu.getByRole('menuitem', { name: 'Dark', exact: true }),
      ).toBeVisible();
      await expect(
        menu.getByRole('menuitem', { name: 'Light (Warm)', exact: true }),
      ).toBeVisible();

      await screenshotPage(page, 'theme-switcher-en.png');
    },
  );

  test(
    'лист D&D — тёмная тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(getState().dndId));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-dark-en.png');
    },
  );

  test(
    'лист D&D — тёплая тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(getState().dndId));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-warm-en.png');
    },
  );

  test(
    'лист DH — тёмная тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(getState().dhId));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-dark-en.png');
    },
  );

  test(
    'лист DH — тёплая тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(getState().dhId));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-warm-en.png');
    },
  );

  test(
    'лист D&D — тёмная тема на мобильном (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(getState().dndId));

      await screenshotPage(page, 'sheet-dnd-mobile-dark-en.png');
    },
  );

  test(
    'лист D&D — тёплая тема на мобильном (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(getState().dndId));

      await screenshotPage(page, 'sheet-dnd-mobile-warm-en.png');
    },
  );
});
