import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  gameCharacterId,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * Диалоги листа D&D 5e — собственные эталоны игры.
 *
 * Раньше все диалоги обеих систем снимались из host-спека `dialogs.spec.ts`
 * и лежали в общей папке. Экран принадлежит игре: её фикстура задаёт данные,
 * её слот — содержимое, поэтому и эталон живёт рядом с игрой.
 */
// В плагинных проектах имена `desktop-games`/`mobile-games`, поэтому
// проверяем префикс, а не точное имя host-проекта.
const isMobile = () => test.info().project.name.includes('mobile');

test.describe('диалоги D&D — журнал заданий', { tag: '@plugin:dnd5e' }, () => {
  test('журнал заданий — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(gameCharacterId('dnd')));

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-quest-journal-en.png');
  });

  test(
    'журнал заданий — ru',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const dialog = await openDialog(page, 'Журнал заданий', false);
      await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

      await screenshotPage(page, 'dialog-dnd-quest-journal-ru.png');
    },
  );
});

test.describe(
  'диалоги D&D — домашние правила',
  { tag: '@plugin:dnd5e' },
  () => {
    test(
      'домашние правила — en (desktop)',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dnd')));

        const dialog = await openDialog(page, 'House Rules', false);
        await expect(
          dialog.getByRole('heading', { name: 'House Rules' }),
        ).toBeVisible();
        await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
        await expect(
          dialog.getByText('Feat at level 1', { exact: true }),
        ).toBeVisible();

        await screenshotPage(page, 'dialog-dnd-house-rules-en.png');
      },
    );

    test(
      'домашние правила — en (mobile)',
      { tag: '@mobile' },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dnd')));

        const dialog = await openDialog(page, 'House Rules', true);
        await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
        await expect(
          dialog.getByText('Feat at level 1', { exact: true }),
        ).toBeVisible();

        await screenshotPage(page, 'dialog-dnd-mobile-house-rules-en.png');
      },
    );

    test(
      'домашние правила — ru',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await prepare(context, { language: 'ru' });
        await openApp(page, sheetPath(gameCharacterId('dnd')));

        const dialog = await openDialog(page, 'Домашние правила', false);
        await dialog.getByRole('tab', { name: 'Собственные правила' }).click();
        await expect(
          dialog.getByText('Feat at level 1', { exact: true }),
        ).toBeVisible();

        await screenshotPage(page, 'dialog-dnd-house-rules-ru.png');
      },
    );
  },
);

test.describe('диалоги D&D — заметки', { tag: '@plugin:dnd5e' }, () => {
  test(
    'заметки — en (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const dialog = await openDialog(page, 'Notes', false);
      await expect(
        dialog.getByRole('heading', { name: 'Character Notes' }),
      ).toBeVisible();
      // Непустые заметки открываются в просмотре markdown: textarea
      // появляется только после «Редактировать».
      await expect(
        dialog.getByText(/Owes a favour to the Lantern Guild/),
      ).toBeVisible();
      await expect(dialog.locator('textarea')).toHaveCount(0);

      await screenshotPage(page, 'dialog-dnd-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Owes a favour to the Lantern Guild/,
      );
    },
  );

  test(
    'заметки — en (mobile)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const dialog = await openDialog(page, 'Notes', true);
      await expect(
        dialog.getByText(/Owes a favour to the Lantern Guild/),
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
      await screenshotPage(page, 'dialog-dnd-mobile-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Owes a favour to the Lantern Guild/,
      );
    },
  );
});

test.describe(
  'диалоги D&D — божественные дары',
  { tag: '@plugin:dnd5e' },
  () => {
    test(
      'дар — en (desktop)',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dnd')));

        await page.getByTestId('add-boon-button').click();
        const dialog = page.getByRole('dialog');
        await expect(
          dialog.getByRole('heading', { name: 'Add Divine Boon' }),
        ).toBeVisible();

        await screenshotPage(page, 'dialog-dnd-divine-boons-en.png');
      },
    );

    test('дар — en (mobile)', { tag: '@mobile' }, async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await page.getByTestId('add-boon-button').click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByRole('heading', { name: 'Add Divine Boon' }),
      ).toBeVisible();

      await screenshotPage(page, 'dialog-dnd-mobile-divine-boons-en.png');
    });

    test(
      'дар — ru (desktop)',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await prepare(context, { language: 'ru' });
        await openApp(page, sheetPath(gameCharacterId('dnd')));

        await page.getByTestId('add-boon-button').click();
        const dialog = page.getByRole('dialog');
        await expect(
          dialog.getByRole('heading', { name: 'Добавить божественный дар' }),
        ).toBeVisible();

        await screenshotPage(page, 'dialog-dnd-divine-boons-ru.png');
      },
    );
  },
);
