import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  openDialog,
  prepare,
  sheetPath,
} from '../../../../../tests/visual/helpers';

test.describe('DH1: предпросмотр заметок', { tag: '@plugin:dh1' }, () => {
  test(
    'mobile: кнопки Save/Cancel остаются в кадре',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 412, height: 500 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));
      const dialog = await openDialog(page, 'Notes', true);

      await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
      const textarea = dialog.locator('textarea');
      await textarea.fill(
        Array.from(
          { length: 40 },
          (_, index) =>
            `Строка ${index + 1}: проверка длинного предпросмотра заметок.`,
        ).join('\n\n'),
      );
      await dialog
        .getByRole('button', { name: 'Preview', exact: true })
        .click();

      const save = dialog.getByRole('button', { name: 'Save', exact: true });
      const cancel = dialog.getByRole('button', {
        name: 'Cancel',
        exact: true,
      });
      await expect(save).toBeVisible();
      await expect(cancel).toBeVisible();
      const viewport = page.viewportSize()!;
      for (const button of [save, cancel]) {
        const box = await button.boundingBox();
        expect(box, 'у кнопки есть геометрия').not.toBeNull();
        expect(
          box!.y + box!.height,
          'кнопка не должна уезжать ниже экрана',
        ).toBeLessThanOrEqual(viewport.height);
      }
    },
  );
});
