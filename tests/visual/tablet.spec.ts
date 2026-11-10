import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
} from './helpers';

/**
 * ─── LANDMARK: TABLET_BASELINES ────────────────────────────────────────────
 * Планшетные эталоны (1024x768): полоса 768..1299px раньше не имела
 * пиксельного покрытия, хотя оба последних вёрстко-бага были именно там —
 * двухрядная шапка листа и «уезжание» шапки/левого меню при масштабе UI.
 *
 * Проект `tablet` ограничен этим файлом (`testMatch` в playwright.config.ts),
 * поэтому остальные спеки не порождают третий набор PNG.
 */
test.describe('планшет 1024x768', () => {
  test('dashboard — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');
    await expect(
      page.getByRole('button', { name: 'Open menu' }),
    ).not.toBeVisible();
    await screenshotPage(page, 'dashboard-en.png');
  });

  test('dashboard — ru', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/');
    await screenshotPage(page, 'dashboard-ru.png');
  });

  test('лист D&D — верх (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);
    await expect(
      page.getByRole('heading', { name: 'Seraphina Vael' }),
    ).toBeVisible();
    // На 1024px шапка листа обязана быть одной строкой (73..93px).
    const header = page.locator('header.app-header');
    expect(
      Math.round((await header.boundingBox())!.height),
      'шапка листа на планшете — одна строка',
    ).toBeLessThan(100);
    await expectNoHorizontalOverflow(page);
    await screenshotPage(page, 'sheet-dnd-top-en.png');
  });

  test('лист Dark Heresy — верх (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);
    await expect(
      page.getByRole('heading', { name: 'Lucius Varn' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await screenshotPage(page, 'sheet-dh-top-en.png');
  });

  test('диалог заметок Dark Heresy — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);
    const dialog = await openDialog(page, 'Notes', false);
    await expect(
      dialog.getByRole('heading', { name: 'Character Notes' }),
    ).toBeVisible();
    await screenshotPage(page, 'dialog-dh-notes-en.png');
  });

  test('settings — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/settings');
    await expect(
      page.getByRole('heading', { name: 'Profile Settings' }),
    ).toBeVisible();
    await screenshotPage(page, 'settings-en.png');
  });
});
