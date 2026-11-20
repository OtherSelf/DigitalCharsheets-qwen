import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
  sheetPath,
  waitForScrollSettled,
} from './helpers';

/**
 * ─── LANDMARK: HOST TABLET BASELINES ──────────────────────────────────────
 * Планшетные эталоны **хоста** (1024x768): дашборд и настройки. Сценарии
 * листов переехали в свои игры — `src/games/<id>/tests/visual/*.visual.spec.ts`
 * с тегом `@tablet` (проект `tablet-games`), потому что раскладка и тема
 * листа принадлежат редакции.
 *
 * Проект `tablet` ограничен этим файлом (`testMatch` в playwright.config.ts),
 * поэтому остальные host-спеки не порождают третий набор PNG.
 */
test.describe('планшет 1024x768', () => {
  test('dashboard — en', { tag: '@fast' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');
    await expect(
      page.getByRole('button', { name: 'Open menu' }),
    ).not.toBeVisible();
    await screenshotPage(page, 'dashboard-en.png');
  });

  test('dashboard — ru', { tag: '@fast' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/');
    await screenshotPage(page, 'dashboard-ru.png');
  });

  test('settings — en', { tag: '@fast' }, async ({ page, context }) => {
    // Логин виден на странице — снимаем под canonical-аккаунтом.
    await prepare(context, { account: 'canonical' });
    await openApp(page, '/settings');
    await expect(
      page.getByRole('heading', { name: 'Profile Settings' }),
    ).toBeVisible();
    await screenshotPage(page, 'settings-en.png');
  });
});
