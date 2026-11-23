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

test.describe('D&D — русская локаль', { tag: '@plugin:dnd5e' }, () => {
  test(
    'desktop: чтение ключевых секций',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page.getByText('Характеристики', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText('Навыки', { exact: true }).first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-top-ru.png');

      for (const [name, selector] of [
        ['sheet-dnd-info-ru.png', '#character-info-card'],
        ['sheet-dnd-stats-ru.png', '#stats-card'],
        ['sheet-dnd-saves-ru.png', '#saving-throws-card'],
        ['sheet-dnd-skills-ru.png', '#skills-card'],
        ['sheet-dnd-combat-ru.png', '#hit-points-card'],
        ['sheet-dnd-attacks-ru.png', '#attacks-and-spellcasting-box'],
        ['sheet-dnd-inventory-ru.png', '#inventory-box'],
        ['sheet-dnd-spells-ru.png', '#spells-section'],
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
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const stats = page.locator('#stats-card:visible').first();
      await startEditing(stats);
      await expect(stats.locator('input[type="number"]').nth(3)).toHaveValue(
        '18',
      );
      await screenshotElement(stats, 'sheet-dnd-edit-stats-ru.png');

      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await screenshotElement(skills, 'sheet-dnd-edit-skills-ru.png');

      const inventory = page.locator('#inventory-box:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await expectInputValue(inventory, 'Spellbook');
      await screenshotElement(inventory, 'sheet-dnd-edit-inventory-ru.png');

      const spells = page.locator('#spells-section:visible').first();
      await startEditingAll(spells);
      await screenshotElement(spells, 'sheet-dnd-edit-spells-ru.png');
    },
  );

  test(
    'mobile: чтение ключевых секций',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page
          .getByRole('navigation')
          .getByRole('button', { name: 'Информация', exact: true }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-info-ru.png');

      await openMobileSection(page, 'Характеристики', 'stats-section');
      await screenshotPage(page, 'sheet-dnd-mobile-stats-ru.png');

      await openMobileSection(page, 'Боевые параметры', 'combat-section');
      await screenshotPage(page, 'sheet-dnd-mobile-combat-ru.png');

      await openMobileSection(
        page,
        'Инвентарь и настройка',
        'inventory-section',
      );
      await screenshotPage(page, 'sheet-dnd-mobile-inventory-ru.png');

      await openMobileSection(page, 'Заклинания', 'spells-section');
      await screenshotPage(page, 'sheet-dnd-mobile-spells-ru.png');
    },
  );

  test(
    'mobile: редактирование ключевых секций',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const statsBar = page.getByTestId('compact-stats-bar');
      await statsBar.getByTestId('compact-stats-edit-button').click();
      await screenshotPage(page, 'sheet-dnd-mobile-edit-stats-ru.png');

      await openMobileSection(page, 'Характеристики', 'stats-section');
      await discardUnsavedChanges(page);
      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await screenshotPage(page, 'sheet-dnd-mobile-edit-skills-ru.png');

      await openMobileSection(
        page,
        'Инвентарь и настройка',
        'inventory-section',
      );
      await discardUnsavedChanges(page);
      const inventory = page.locator('#inventory-box:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await screenshotPage(page, 'sheet-dnd-mobile-edit-inventory-ru.png');
    },
  );
});
