import { expect, test, type Locator } from '@playwright/test';
import {
  discardUnsavedChanges,
  getState,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
} from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Русская локаль — полное зеркало английских проверок листов.
 *
 * Русские строки длиннее английских, поэтому именно здесь чаще ломаются
 * сетки, обрезаются подписи и «уезжают» кнопки. Покрываем и режим чтения,
 * и режим редактирования на desktop и mobile.
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
            inputs.some((input) => (input as HTMLInputElement).value === expected),
          value,
        ),
    )
    .toBe(true);
}

test.describe('D&D — русская локаль', () => {
  test('desktop: чтение всех уникальных секций', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    await expect(page.getByText('Характеристики', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Навыки', { exact: true }).first()).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-top-ru.png');

    for (const [name, selector] of [
      ['sheet-dnd-info-ru.png', '#character-info-card'],
      ['sheet-dnd-stats-ru.png', '#stats-card'],
      ['sheet-dnd-saves-ru.png', '#saving-throws-card'],
      ['sheet-dnd-skills-ru.png', '#skills-card'],
      ['sheet-dnd-combat-ru.png', '#hit-points-card'],
      ['sheet-dnd-attacks-ru.png', '#attacks-and-spellcasting-box'],
      ['sheet-dnd-inventory-ru.png', '#inventory-box'],
      ['sheet-dnd-attunement-ru.png', '#attunement-card'],
      ['sheet-dnd-spells-ru.png', '#spells-section'],
      ['sheet-dnd-companions-ru.png', '#companions-section'],
      ['sheet-dnd-narrative-ru.png', '#narrative-section'],
      ['sheet-dnd-divine-boons-ru.png', '#divine-boons-section'],
    ] as const) {
      await screenshotElement(page.locator(selector + ':visible').first(), name);
    }
  });

  test('desktop: редактирование уникальных секций', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    const stats = page.locator('#stats-card:visible').first();
    await startEditing(stats);
    await expect(stats.locator('input[type="number"]').nth(3)).toHaveValue('18');
    await screenshotElement(stats, 'sheet-dnd-edit-stats-ru.png');

    const skills = page.locator('#skills-card:visible').first();
    await startEditing(skills);
    await screenshotElement(skills, 'sheet-dnd-edit-skills-ru.png');

    const inventory = page.locator('#inventory-box:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await expectInputValue(inventory, 'Spellbook');
    await screenshotElement(inventory, 'sheet-dnd-edit-inventory-ru.png');

    const combat = page.locator('#hit-points-card:visible').first();
    await startEditing(combat);
    await screenshotElement(combat, 'sheet-dnd-edit-combat-ru.png');

    const spells = page.locator('#spells-section:visible').first();
    await startEditingAll(spells);
    await screenshotElement(spells, 'sheet-dnd-edit-spells-ru.png');

    const companions = page.locator('#companions-section:visible').first();
    await startEditing(companions);
    await screenshotElement(companions, 'sheet-dnd-edit-companions-ru.png');

    const narrative = page.locator('#narrative-section:visible').first();
    await startEditing(narrative);
    await screenshotElement(narrative, 'sheet-dnd-edit-narrative-ru.png');

    const progression = page.locator('#progression-section:visible').first();
    await startEditing(progression);
    await screenshotElement(progression, 'sheet-dnd-edit-progression-ru.png');

    const info = page.locator('#character-info-card:visible').first();
    await startEditing(info);
    await screenshotElement(info, 'sheet-dnd-edit-info-ru.png');

    const saves = page.locator('#saving-throws-card:visible').first();
    await startEditing(saves);
    await screenshotElement(saves, 'sheet-dnd-edit-saves-ru.png');

    const attacks = page.locator('#attacks-and-spellcasting-box:visible').first();
    await startEditing(attacks);
    await screenshotElement(attacks, 'sheet-dnd-edit-attacks-ru.png');

    const attunement = page.locator('#attunement-card:visible').first();
    await startEditing(attunement);
    await screenshotElement(attunement, 'sheet-dnd-edit-attunement-ru.png');
  });

  test('mobile: чтение секций', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    await expect(
      page.getByRole('navigation').getByRole('button', { name: 'Инфо', exact: true }),
    ).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-mobile-info-ru.png');

    await openMobileSection(page, 'Характеристики');
    await screenshotPage(page, 'sheet-dnd-mobile-stats-ru.png');

    await openMobileSection(page, 'Боевые статы');
    await screenshotPage(page, 'sheet-dnd-mobile-combat-ru.png');

    await openMobileSection(page, 'Инвентарь и Настройка');
    await screenshotPage(page, 'sheet-dnd-mobile-inventory-ru.png');

    await openMobileSection(page, 'Заклинания', 'spells-section');
    await screenshotPage(page, 'sheet-dnd-mobile-spells-ru.png');

    await openMobileSection(page, 'Спутники', 'companions-section');
    await screenshotPage(page, 'sheet-dnd-mobile-companions-ru.png');
  });

  test('mobile: редактирование секций D&D', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    const statsBar = page.getByTestId('compact-stats-bar');
    await statsBar.getByTestId('compact-stats-edit-button').click();
    await screenshotPage(page, 'sheet-dnd-mobile-edit-stats-ru.png');

    await openMobileSection(page, 'Характеристики');
    await discardUnsavedChanges(page);
    const skills = page.locator('#skills-card:visible').first();
    await startEditing(skills);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-skills-ru.png');

    await openMobileSection(page, 'Инвентарь и Настройка');
    await discardUnsavedChanges(page);
    const inventory = page.locator('#inventory-box:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await screenshotPage(page, 'sheet-dnd-mobile-edit-inventory-ru.png');

    await openMobileSection(page, 'Боевые статы');
    await discardUnsavedChanges(page);
    const combat = page.locator('#hit-points-card:visible').first();
    await startEditing(combat);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-combat-ru.png');

    await openMobileSection(page, 'Заклинания', 'spells-section');
    await discardUnsavedChanges(page);
    const spells = page.locator('#spells-section:visible').first();
    await startEditingAll(spells);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-spells-ru.png');

    await openMobileSection(page, 'Спутники', 'companions-section');
    await discardUnsavedChanges(page);
    const companions = page.locator('#companions-section:visible').first();
    await startEditing(companions);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-companions-ru.png');
  });
});

test.describe('Dark Heresy — русская локаль', () => {
  test('desktop: чтение всех уникальных секций', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    await expect(page.getByText('Снаряжение', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Характеристики', { exact: true }).first()).toBeVisible();
    await screenshotPage(page, 'sheet-dh-top-ru.png');

    for (const [name, selector] of [
      ['sheet-dh-info-ru.png', '#info-section'],
      ['sheet-dh-progression-ru.png', '#progression-section'],
      ['sheet-dh-characteristics-ru.png', '#characteristics-card'],
      ['sheet-dh-skills-ru.png', '#skills-talents-panel'],
      ['sheet-dh-talents-ru.png', '#skills-talents-content'],
      ['sheet-dh-equipment-ru.png', '#equipment-section'],
      ['sheet-dh-inventory-ru.png', '#inventory-section'],
    ] as const) {
      await screenshotElement(page.locator(selector + ':visible').first(), name);
    }
  });

  test('desktop: редактирование уникальных секций', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    const info = page.locator('#info-section:visible').first();
    await startEditing(info);
    await screenshotElement(info, 'sheet-dh-edit-info-ru.png');

    const progression = page.locator('#progression-section:visible').first();
    await startEditing(progression);
    await screenshotElement(progression, 'sheet-dh-edit-progression-ru.png');

    const characteristics = page.locator('#characteristics-card:visible').first();
    await startEditing(characteristics);
    await expect(
      characteristics.locator('input[type="number"]').nth(5),
    ).toHaveValue('46');
    await screenshotElement(characteristics, 'sheet-dh-edit-characteristics-ru.png');

    const skills = page.locator('#skills-talents-panel:visible').first();
    await startEditing(skills);
    await expectInputValue(skills, 'Awareness (Per)');
    await screenshotElement(skills, 'sheet-dh-edit-skills-ru.png');

    const equipment = page.locator('#equipment-section:visible').first();
    await equipment.locator('[data-testid="edit-button"]:visible').first().click();
    await expect(equipment.locator('input[type="number"]').first()).toHaveValue('4');
    await screenshotElement(equipment, 'sheet-dh-edit-equipment-ru.png');

    const inventory = page.locator('#inventory-section:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // богатство
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // предметы
    await expectInputValue(inventory, 'Data-slate');
    await screenshotElement(inventory, 'sheet-dh-edit-inventory-ru.png');
  });

  test('mobile: чтение секций', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    await expect(page.getByText('Характеристики', { exact: true }).first()).toBeVisible();
    await screenshotPage(page, 'sheet-dh-mobile-info-ru.png');

    await openMobileSection(page, 'Прогрессия');
    await screenshotPage(page, 'sheet-dh-mobile-progression-ru.png');

    await openMobileSection(page, 'Навыки');
    await screenshotPage(page, 'sheet-dh-mobile-skills-ru.png');

    await openMobileSection(page, 'Таланты и Черты');
    await screenshotPage(page, 'sheet-dh-mobile-talents-ru.png');

    await openMobileSection(page, 'Снаряжение', 'equipment-section');
    await discardUnsavedChanges(page);
    await screenshotPage(page, 'sheet-dh-mobile-equipment-ru.png');

    await openMobileSection(page, 'Инвентарь', 'inventory-section');
    await discardUnsavedChanges(page);
    await screenshotPage(page, 'sheet-dh-mobile-inventory-ru.png');
  });

  test('mobile: редактирование характеристик и навыков', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    const characteristics = page.getByTestId('characteristics-compact');
    await startEditing(characteristics);
    await expect(characteristics.locator('input[type="number"]').nth(0)).toHaveValue('34');
    await screenshotPage(page, 'sheet-dh-mobile-edit-characteristics-ru.png');

    await openMobileSection(page, 'Навыки');
    const skills = page.locator('#skills-talents-content:visible').first();
    await startEditing(skills);
    await screenshotPage(page, 'sheet-dh-mobile-edit-skills-ru.png');

    await openMobileSection(page, 'Снаряжение', 'equipment-section');
    await discardUnsavedChanges(page);
    const equipment = page.locator('#equipment-section:visible').first();
    await equipment.locator('[data-testid="edit-button"]:visible').first().click();
    await screenshotPage(page, 'sheet-dh-mobile-edit-equipment-ru.png');

    await openMobileSection(page, 'Инвентарь', 'inventory-section');
    await discardUnsavedChanges(page);
    const inventory = page.locator('#inventory-section:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await screenshotPage(page, 'sheet-dh-mobile-edit-inventory-ru.png');
  });
});
