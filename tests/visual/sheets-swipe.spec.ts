import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  openDialog,
  openMobileSection,
  prepare,
  sheetPath,
  swipeSheet,
} from './helpers';

/**
 * ─── LANDMARK: SHEET SWIPE CLOSE ──────────────────────────────────────────
 * Правые шторки (заметки, журнал, нарратив, журнал опыта) закрываются
 * свайпом вправо. Жест живёт в одном `SheetContent`, поэтому проверяем его
 * на всех четырёх потребителях, а не в каждой шторке отдельно.
 *
 * Короткий свайп панель не закрывает — иначе любое случайное касание
 * выкидывало бы из редактора.
 */
test.describe('правые шторки — свайп', { tag: '@mobile' }, () => {
  test('заметки: короткий свайп не закрывает, длинный закрывает', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Notes', true);

    await swipeSheet(page, { distance: 40, steps: 4 });
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('журнал заданий закрывается свайпом', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Quest Journal', true);

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('журнал опыта закрывается свайпом', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    await openMobileSection(page, 'Progression', 'progression-section');

    await page.getByRole('button', { name: 'XP log' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('нарратив (Backstory) закрывается свайпом', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    await openMobileSection(page, 'Info', 'info-section');

    const backstory = page.getByRole('button', { name: 'Backstory' }).first();
    await backstory.scrollIntoViewIfNeeded();
    await backstory.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });
});
