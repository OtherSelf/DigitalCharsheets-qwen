import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
  seedTempAccountSheet,
  sheetPath,
} from './helpers';

/**
 * `NarrativeSheet` — общий компонент заметок и предыстории для всех редакций.
 * Длинный markdown в предпросмотре не должен выталкивать Save/Cancel за
 * вьюпорт: проверяем геометрию на каждом посеянном листе, без списка игр.
 */
const LONG_TEXT = Array.from(
  { length: 40 },
  (_, index) => `Строка ${index + 1}: проверка длинного предпросмотра заметок.`,
).join('\n\n');

test.describe('предпросмотр заметок: действия в кадре', () => {
  test(
    'mobile: все посеянные редакции',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 412, height: 500 });
      await prepare(context);
      const viewport = page.viewportSize()!;

      for (const [segment, id] of Object.entries(getState().characters)) {
        if (!id) continue;
        await openApp(page, sheetPath(id));
        const dialog = await openDialog(page, 'Notes', true);

        await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
        await dialog.locator('textarea').fill(LONG_TEXT);
        await dialog
          .getByRole('button', { name: 'Preview', exact: true })
          .click();

        for (const name of ['Save', 'Cancel'] as const) {
          const button = dialog.getByRole('button', { name, exact: true });
          await expect(button, `${segment}: ${name}`).toBeVisible();
          const box = await button.boundingBox();
          expect(box, `${segment}: у ${name} есть геометрия`).not.toBeNull();
          expect(
            box!.y + box!.height,
            `${segment}: ${name} не должен уезжать ниже экрана`,
          ).toBeLessThanOrEqual(viewport.height);
        }

        await dialog
          .getByRole('button', { name: 'Cancel', exact: true })
          .click();
      }
    },
  );
});

/**
 * Дополнительные вкладки заметок: добавляем вкладку, пишем текст и сохраняем.
 * Временный аккаунт не трогает seeded-листы других сценариев.
 */
test.describe('вкладки заметок', () => {
  test(
    'desktop: добавить вкладку и сохранить (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context, { authenticated: false });
      const id = await seedTempAccountSheet(page, 'dnd5e');
      await openApp(page, sheetPath(id));

      const dialog = await openDialog(page, 'Notes', false);
      await dialog.getByTestId('notes-tab-add').click();
      await dialog.getByTestId('notes-tab-title-input').fill('Faction');
      await dialog.getByTestId('notes-tab-title-input').press('Enter');

      await expect(dialog.getByRole('tab', { name: 'Faction' })).toBeVisible();
      await dialog.getByTestId('notes-textarea').fill('Faction notes');
      await dialog.getByTestId('notes-save').click();
      // После сохранения Sheet возвращается в режим просмотра: Save исчезает,
      // а текст вкладки виден в markdown.
      await expect(dialog.getByTestId('notes-edit')).toBeVisible();
      await expect(dialog.getByText('Faction notes')).toBeVisible();

      await screenshotPage(page, 'notes-tabs-desktop-en.png');
    },
  );
});
