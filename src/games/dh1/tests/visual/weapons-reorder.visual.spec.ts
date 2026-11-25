import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  prepare,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * ─── LANDMARK: WEAPON ORDER ────────────────────────────────────────────────
 * Оружие переставляется перетаскиванием. Снаряжённые и «Не экипировано» —
 * один видимый список: бросок на элемент другой группы переносит оружие туда
 * и меняет флаг «Снаряжено» (решение владельца). Кнопка «Добавить оружие»
 * в правке стоит над списком, а не под ним.
 *
 * Порядок и флаги возвращаются как были: лист общий с другими снимками.
 */

test.describe('оружие dh1', { tag: '@plugin:dh1' }, () => {
  test(
    'перенос через границу групп и кнопка добавления сверху',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const listResponse = await page.request.get('/api/characters');
      const all = (await listResponse.json()) as Array<{
        id: string;
        equipment?: {
          weapons?: {
            melee?: Array<{ id: string; equipped?: boolean }>;
            ranged?: Array<{ id: string; equipped?: boolean }>;
          };
        };
      }>;
      const original = all.find((entry) => entry.id === id)?.equipment;
      const originalRanged = original?.weapons?.ranged ?? [];

      await openApp(page, sheetPath(id));

      const ranged = page.locator('[data-testid="ranged-weapons"]');
      await page.getByTestId('unequipped-ranged-trigger').click();

      const cards = ranged.locator('[data-sortable-id]');
      await expect(cards).toHaveCount(originalRanged.length);
      const rifleCard = cards.filter({ hasText: 'Hunting rifle' });

      await rifleCard.getByTestId('reorder-handle').focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(150);
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      await page.keyboard.press('Space');
      await saved;

      // Оружие переехало в снаряжённые: флаг в листе и чекбокс в карточке.
      const after = await page.request.get('/api/characters');
      const updated = (await after.json()) as Array<{
        id: string;
        equipment?: {
          weapons?: { ranged?: Array<{ name: string; equipped?: boolean }> };
        };
      }>;
      const rifle = updated
        .find((entry) => entry.id === id)
        ?.equipment?.weapons?.ranged?.find(
          (weapon) => weapon.name === 'Hunting rifle',
        );
      expect(rifle?.equipped, 'перенос через границу групп').toBe(true);
      await expect(
        rifleCard.getByRole('checkbox'),
        'чекбокс «Снаряжено» отражает флаг',
      ).toBeChecked();

      // Кнопка добавления в правке — над списком, а не в конце.
      const add = ranged.getByTestId('add-ranged-weapon');
      await ranged.locator('[data-testid="edit-button"]').first().click();
      await expect(add).toBeVisible();
      const addBox = await add.boundingBox();
      const firstCardBox = await ranged
        .locator('[data-sortable-id]')
        .first()
        .boundingBox();
      expect(addBox, 'кнопка добавления видна').not.toBeNull();
      expect(firstCardBox, 'первая карточка видна').not.toBeNull();
      expect(addBox!.y, 'кнопка «Добавить» выше первой карточки').toBeLessThan(
        firstCardBox!.y,
      );

      // Возвращаем оружие и флаги как было.
      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { equipment: original },
      });
      expect(restored.status(), 'возврат снаряжения').toBe(200);
    },
  );
});
