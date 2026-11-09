import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
} from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Модальные окна — отдельный класс регрессий: они позиционируются поверх
 * страницы и легко «уезжают» на мобильном.
 *
 * Покрыты все диалоги обеих систем: журнал заданий, домашние правила,
 * заметки и уникальный для D&D диалог добавления божественного дара.
 */

test.describe('диалоги — журнал заданий', () => {
  test('D&D — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-quest-journal-en.png');
  });

  test('Dark Heresy — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(
      dialog.getByText('The Reliquary of Saint Veren'),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-quest-journal-en.png');
  });

  test('D&D — ru', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: русская локаль диалогов');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'Журнал заданий', false);
    await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-quest-journal-ru.png');
  });

  test('Dark Heresy — ru', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: русская локаль диалогов');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'Журнал заданий', false);
    await expect(
      dialog.getByText('The Reliquary of Saint Veren'),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-quest-journal-ru.png');
  });
});

test.describe('диалоги — домашние правила', () => {
  test('D&D — en (desktop)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'House Rules', false);
    await expect(
      dialog.getByRole('heading', { name: 'House Rules' }),
    ).toBeVisible();
    await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-house-rules-en.png');
  });

  test('Dark Heresy — en (desktop)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'House Rules', false);
    await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

    await screenshotPage(page, 'dialog-dh-house-rules-en.png');
  });

  test('D&D — en (mobile)', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'House Rules', true);
    await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-mobile-house-rules-en.png');
  });

  test('Dark Heresy — en (mobile)', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'House Rules', true);
    await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

    await screenshotPage(page, 'dialog-dh-mobile-house-rules-en.png');
  });

  test('D&D — ru', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: русская локаль диалогов');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'Домашние правила', false);
    await dialog.getByRole('tab', { name: 'Собственные правила' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-house-rules-ru.png');
  });
});

test.describe('диалоги — заметки', () => {
  test('D&D — en (desktop)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'Notes', false);
    await expect(
      dialog.getByRole('heading', { name: 'Character Notes' }),
    ).toBeVisible();
    await expect(dialog.locator('textarea')).toHaveValue(
      /Owes a favour to the Lantern Guild/,
    );

    await screenshotPage(page, 'dialog-dnd-notes-en.png');
  });

  test('Dark Heresy — en (desktop)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'Notes', false);
    await expect(dialog.locator('textarea')).toHaveValue(
      /Keep the sealed dossier/,
    );

    await screenshotPage(page, 'dialog-dh-notes-en.png');
  });

  test('D&D — en (mobile)', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const dialog = await openDialog(page, 'Notes', true);
    await expect(dialog.locator('textarea')).toHaveValue(
      /Owes a favour to the Lantern Guild/,
    );

    await screenshotPage(page, 'dialog-dnd-mobile-notes-en.png');
  });

  test('Dark Heresy — en (mobile)', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'Notes', true);
    await expect(dialog.locator('textarea')).toHaveValue(
      /Keep the sealed dossier/,
    );

    await screenshotPage(page, 'dialog-dh-mobile-notes-en.png');
  });

  test('Dark Heresy — ru', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: русская локаль диалогов');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    const dialog = await openDialog(page, 'Заметки', false);
    await expect(
      dialog.getByRole('heading', { name: 'Заметки персонажа' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-notes-ru.png');
  });
});

test.describe('диалоги — божественные дары (только D&D)', () => {
  test('desktop — en', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Add Divine Boon' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-divine-boons-en.png');
  });

  test('mobile — en', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Add Divine Boon' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-mobile-divine-boons-en.png');
  });

  test('desktop — ru', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: русская локаль диалогов');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Добавить божественный дар' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-divine-boons-ru.png');
  });
});
