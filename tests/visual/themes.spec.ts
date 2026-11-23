import { expect, test } from '@playwright/test';

import { openApp, prepare, screenshotPage } from './helpers';

/**
 * Host-темы: dashboard и переключатель. Темы листов конкретных редакций
 * снимаются в их плагинах (`tests/visual/themes.visual.spec.ts`), потому что
 * палитра и вёрстка листа — знание игры, а не хоста.
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
});
