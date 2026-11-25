import { expect, test, type Locator } from '@playwright/test';

import {
  discardUnsavedChanges,
  gameCharacterId,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * Русская локаль — не полное зеркало EN, а выборка по матрице.
 *
 * EN-покрытие остаётся полным в sheets/editing. Здесь — только то, где
 * длинные русские строки реально ломают плотные сетки: верх листа, основные
 * секции чтения, несколько edit-секций и мобильные экраны. Остальные секции
 * остаются под функциональными проверками и EN-эталонами.
 */

async function startEditing(scope: Locator): Promise<void> {
  await scope.locator('[data-testid="edit-button"]:visible').first().click();
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

async function startEditingAll(scope: Locator): Promise<void> {
  const buttons = scope.locator('[data-testid="edit-button"]:visible');
  for (let guard = 0; guard < 24; guard += 1) {
    if ((await buttons.count()) === 0) break;
    await buttons.first().click();
  }
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

async function expectInputValue(scope: Locator, value: string): Promise<void> {
  await expect
    .poll(() =>
      scope
        .locator('input')
        .evaluateAll(
          (inputs, expected) =>
            inputs.some(
              (input) => (input as HTMLInputElement).value === expected,
            ),
          value,
        ),
    )
    .toBe(true);
}

test.describe('Dark Heresy — русская локаль', { tag: '@plugin:dh1' }, () => {
  test(
    'desktop: чтение ключевых секций',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByText('Снаряжение', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText('Характеристики', { exact: true }).first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-top-ru.png');

      for (const [name, selector] of [
        ['sheet-dh-info-ru.png', '#info-section'],
        ['sheet-dh-characteristics-ru.png', '#characteristics-card'],
        ['sheet-dh-skills-ru.png', '#skills-talents-panel'],
        ['sheet-dh-equipment-ru.png', '#equipment-section'],
        ['sheet-dh-inventory-ru.png', '#inventory-section'],
      ] as const) {
        await screenshotElement(
          page.locator(selector + ':visible').first(),
          name,
        );
      }
    },
  );

  test(
    'desktop: редактирование ключевых секций',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const characteristics = page
        .locator('#characteristics-card:visible')
        .first();
      await startEditing(characteristics);
      await expect(
        characteristics.locator('input[type="number"]').nth(5),
      ).toHaveValue('46');
      await screenshotElement(
        characteristics,
        'sheet-dh-edit-characteristics-ru.png',
      );

      const skills = page.locator('#skills-talents-panel:visible').first();
      await startEditing(skills);
      await expectInputValue(skills, 'Awareness');
      await screenshotElement(skills, 'sheet-dh-edit-skills-ru.png');

      const equipment = page.locator('#equipment-section:visible').first();
      await equipment
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await expect(
        equipment.locator('input[type="number"]').first(),
      ).toHaveValue('4');
      await screenshotElement(equipment, 'sheet-dh-edit-equipment-ru.png');
    },
  );

  test(
    'mobile: чтение ключевых секций',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByText('Характеристики', { exact: true }).first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-mobile-info-ru.png');

      await openMobileSection(page, 'Навыки', 'skills-section');
      await screenshotPage(page, 'sheet-dh-mobile-skills-ru.png');

      await openMobileSection(page, 'Снаряжение', 'equipment-section');
      await discardUnsavedChanges(page);
      await screenshotPage(page, 'sheet-dh-mobile-equipment-ru.png');

      await openMobileSection(page, 'Инвентарь', 'inventory-section');
      await discardUnsavedChanges(page);
      await screenshotPage(page, 'sheet-dh-mobile-inventory-ru.png');
    },
  );

  test(
    'mobile: редактирование характеристик и навыков',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const characteristics = page.getByTestId('characteristics-compact');
      await startEditing(characteristics);
      await expect(
        characteristics.locator('input[type="number"]').nth(0),
      ).toHaveValue('34');
      await screenshotPage(page, 'sheet-dh-mobile-edit-characteristics-ru.png');

      await openMobileSection(page, 'Навыки', 'skills-section');
      const skills = page.locator('#skills-talents-content:visible').first();
      await startEditing(skills);
      await screenshotPage(page, 'sheet-dh-mobile-edit-skills-ru.png');
    },
  );
});
