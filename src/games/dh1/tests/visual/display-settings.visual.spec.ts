import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  prepare,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * ─── LANDMARK: DISPLAY SETTINGS ────────────────────────────────────────────
 * «Скрыть заметки» и «Скрыть кнопки редактирования» — общие настройки листа,
 * значит действовать должны на всех секциях и на обоих раскладках
 * (desktop и компактный рейл). Раньше часть кнопок правки жила вне проверки:
 * характеристики в средней панели и в компактной полосе.
 *
 * Заметки и правки возвращаются в конце, чтобы не влиять на другие снимки.
 */

test.describe('настройки показа листа dh1', { tag: '@plugin:dh1' }, () => {
  test(
    'desktop: скрытие заметок и кнопок правки убирает их из всех секций',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await page.getByRole('button', { name: 'Hide Notes' }).click();
      await expect(
        page.getByRole('button', { name: /Notes for/ }),
        'заметки скрыты во всех секциях',
      ).toHaveCount(0);

      await page.getByRole('button', { name: 'Edit Buttons' }).click();
      await expect(
        page.locator('[data-testid="edit-button"]:visible'),
        'кнопки правки скрыты во всех секциях',
      ).toHaveCount(0);

      // Возвращаем настройки как были.
      await page.getByRole('button', { name: 'Show Notes' }).click();
      await page.getByRole('button', { name: 'Edit Buttons' }).click();
    },
  );

  test(
    'mobile: в каждой секции скрыты заметки и кнопки правки',
    { tag: ['@fast', '@mobile'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await page.getByRole('button', { name: 'Hide Notes' }).click();
      await page.getByRole('button', { name: 'Edit Buttons' }).click();

      const sections = await page
        .locator('nav button[data-section-id]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('data-section-id') ?? ''),
        );
      expect(sections.length, 'в компактном рейле есть пункты').toBeGreaterThan(
        0,
      );

      for (const sectionId of sections) {
        await page
          .locator(`nav button[data-section-id="${sectionId}"]`)
          .click();
        await expect(
          page.locator('[data-testid="edit-button"]:visible'),
          `${sectionId}: кнопки правки скрыты`,
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: /Notes for/ }),
          `${sectionId}: заметки скрыты`,
        ).toHaveCount(0);
      }

      await page.getByRole('button', { name: 'Show Notes' }).click();
      await page.getByRole('button', { name: 'Edit Buttons' }).click();
    },
  );
});
