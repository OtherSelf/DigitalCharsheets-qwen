import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
  waitForScrollSettled,
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

  test('лист Dark Heresy — компактный вид (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    // Компактный вид на планшете включается переключателем в шапке:
    // появляется левое меню, лист получает `is-compact`, видна одна секция.
    await page
      .getByTestId('app-header')
      .getByRole('button', { name: 'Switch to Compact View', exact: true })
      .click();
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(1);
    await expect(
      page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Default View', exact: true }),
    ).toBeVisible();

    // Фиксируем детерминированную секцию, чтобы эталон не зависел от
    // предыдущего состояния скролла.
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Inventory', exact: true })
      .click();
    await waitForScrollSettled(page);
    await expect(page.locator('#inventory-section:visible')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await screenshotPage(page, 'sheet-dh-compact-en.png');
  });

  test('лист D&D — компактный вид (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    await page
      .getByTestId('app-header')
      .getByRole('button', { name: 'Switch to Compact View', exact: true })
      .click();
    await expect(page.locator('.dnd-sheet.is-compact')).toHaveCount(1);
    // У D&D в меню больше пунктов, чем у DH — проверяем, что сайдбар
    // не обрезан ни по высоте, ни по ширине.
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
    const navBox = (await nav.boundingBox())!;
    expect(
      Math.round(navBox.y + navBox.height),
      'сайдбар не выходит за нижний край',
    ).toBeLessThanOrEqual(768 + 1);
    const navOverflow = await nav.evaluate((el) => ({
      x: el.scrollWidth - el.clientWidth,
      y: el.scrollHeight - el.clientHeight,
    }));
    expect(navOverflow.x, 'сайдбар не вылезает вбок').toBeLessThanOrEqual(1);
    expect(navOverflow.y, 'пункты меню влезают по высоте').toBeLessThanOrEqual(
      1,
    );

    // В меню D&D пункт называется иначе, чем у DH: «Inventory & Attunement».
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Inventory & Attunement', exact: true })
      .click();
    await waitForScrollSettled(page);
    // У D&D нет якоря `#inventory-section` (он есть только у DH) — проверяем
    // саму карточку инвентаря; у компаньона она теперь `companion-inventory-box`.
    await expect(page.locator('#inventory-box:visible')).toHaveCount(1);
    // Подводим карточку инвентаря к верху, чтобы эталон показывал именно её,
    // а не случайное положение скролла. Скроллим только <main>.
    await page.evaluate(() => {
      const main = document.querySelector('main');
      const card = document.getElementById('inventory-box');
      if (!main || !card) return;
      const top =
        card.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop;
      main.scrollTo({ top });
    });
    await waitForScrollSettled(page);
    await expectNoHorizontalOverflow(page);
    await screenshotPage(page, 'sheet-dnd-compact-en.png');
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
