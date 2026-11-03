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
 * Режим редактирования: проверяем не только то, что кнопка Edit существует,
 * но и то, что поля открываются ЗАПОЛНЕННЫМИ данными персонажа.
 *
 * Клик по Edit меняет только локальный state — в API ничего не уходит,
 * поэтому тесты не портят фикстуры. Сохранение (Save) не нажимаем.
 */

async function startEditing(scope: Locator): Promise<void> {
  await scope.locator('[data-testid="edit-button"]:visible').first().click();
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/**
 * Включает редактирование сразу во всех карточках секции (например, у
 * заклинаний Edit есть у каждого уровня). Иначе поля Fireball/Shield
 * остались бы в режиме чтения.
 */
async function startEditingAll(scope: Locator): Promise<void> {
  const buttons = scope.locator('[data-testid="edit-button"]:visible');
  for (let guard = 0; guard < 24; guard += 1) {
    if ((await buttons.count()) === 0) break;
    await buttons.first().click();
  }
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/** Проверяет, что среди input-полей секции есть поле с указанным значением. */
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

test.describe('редактирование D&D', () => {
  test('desktop: прогрессия, инфо, статы, спасброски, навыки (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    // Высокий вьюпорт, чтобы элементные скриншоты длинных карточек
    // (статы, навыки, характеристики DH) снимались целиком.
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const progression = page.locator('#progression-section:visible').first();
    await startEditing(progression);
    await screenshotElement(progression, 'sheet-dnd-edit-progression-en.png');

    const info = page.locator('#character-info-card:visible').first();
    await startEditing(info);
    await screenshotElement(info, 'sheet-dnd-edit-info-en.png');

    // Характеристики: 6 числовых полей с примерными значениями.
    const stats = page.locator('#stats-card:visible').first();
    await startEditing(stats);
    const statInputs = stats.locator('input[type="number"]');
    await expect(statInputs).toHaveCount(6);
    await expect(statInputs.nth(0)).toHaveValue('8');
    await expect(statInputs.nth(3)).toHaveValue('18');
    await screenshotElement(stats, 'sheet-dnd-edit-stats-en.png');

    const saves = page.locator('#saving-throws-card:visible').first();
    await startEditing(saves);
    await expect(saves.locator('input[type="number"]')).toHaveCount(6);
    await expect(saves.locator('input[type="number"]').first()).toHaveValue('');
    await screenshotElement(saves, 'sheet-dnd-edit-saves-en.png');

    // Навыки: поля ручных модификаторов (у Arcana +2, у History +1).
    const skills = page.locator('#skills-card:visible').first();
    await startEditing(skills);
    await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue('2');
    await expect(skills.locator('input[type="number"]').nth(5)).toHaveValue('1');
    await screenshotElement(skills, 'sheet-dnd-edit-skills-en.png');
  });

  test('desktop: бой, атаки, инвентарь, настройка (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const combat = page.locator('#hit-points-card:visible').first();
    await startEditing(combat);
    await expect(combat.locator('input[type="number"]').first()).toHaveValue('45');
    await screenshotElement(combat, 'sheet-dnd-edit-combat-en.png');

    const attacks = page.locator('#attacks-and-spellcasting-box:visible').first();
    await startEditing(attacks);
    await expectInputValue(attacks, 'Fire Bolt');
    await screenshotElement(attacks, 'sheet-dnd-edit-attacks-en.png');

    // Инвентарь: деньги и предметы (Spellbook и т.д.).
    const inventory = page.locator('#inventory-box:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // деньги
    await expect(inventory.locator('input[type="number"]')).toHaveCount(5);
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // предметы
    await expectInputValue(inventory, 'Spellbook');
    await expect(inventory.locator('input[type="number"]').nth(3)).toHaveValue('245');
    await screenshotElement(inventory, 'sheet-dnd-edit-inventory-en.png');

    const attunement = page.locator('#attunement-card:visible').first();
    await startEditing(attunement);
    await expectInputValue(attunement, 'Cloak of Protection');
    await screenshotElement(attunement, 'sheet-dnd-edit-attunement-en.png');
  });

  test('desktop: заклинания, спутники, нарратив (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const spells = page.locator('#spells-section:visible').first();
    await startEditingAll(spells);
    await expectInputValue(spells, 'Shield');
    await screenshotElement(spells, 'sheet-dnd-edit-spells-en.png');

    const companions = page.locator('#companions-section:visible').first();
    await startEditing(companions);
    await expectInputValue(companions, 'Ember');
    await screenshotElement(companions, 'sheet-dnd-edit-companions-en.png');

    const narrative = page.locator('#narrative-section:visible').first();
    await startEditing(narrative);
    await expectInputValue(
      narrative,
      'I quote obscure texts at every opportunity.',
    );
    await screenshotElement(narrative, 'sheet-dnd-edit-narrative-en.png');
  });

  test('mobile: статы, навыки, инвентарь, бой, заклинания (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    // Компактная плашка статов: карандаш в правом верхнем углу.
    const statsBar = page.getByTestId('compact-stats-bar');
    await statsBar.getByTestId('compact-stats-edit-button').click();
    await expect(statsBar.locator('input[type="number"]')).toHaveCount(6);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-stats-en.png');

    await openMobileSection(page, 'Ability Scores');
    await discardUnsavedChanges(page);
    const skills = page.locator('#skills-card:visible').first();
    await startEditing(skills);
    await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue('2');
    await screenshotPage(page, 'sheet-dnd-mobile-edit-skills-en.png');

    await openMobileSection(page, 'Inventory & Attunement');
    await discardUnsavedChanges(page);
    const inventory = page.locator('#inventory-box:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await expectInputValue(inventory, 'Spellbook');
    await screenshotPage(page, 'sheet-dnd-mobile-edit-inventory-en.png');

    await openMobileSection(page, 'Combat Stats');
    await discardUnsavedChanges(page);
    const combat = page.locator('#hit-points-card:visible').first();
    await startEditing(combat);
    await expect(combat.locator('input[type="number"]').first()).toHaveValue('45');
    await screenshotPage(page, 'sheet-dnd-mobile-edit-combat-en.png');

    await openMobileSection(page, 'Spells', 'spells-section');
    await discardUnsavedChanges(page);
    const spells = page.locator('#spells-section:visible').first();
    await startEditingAll(spells);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-spells-en.png');

    await openMobileSection(page, 'Companions', 'companions-section');
    await discardUnsavedChanges(page);
    const companions = page.locator('#companions-section:visible').first();
    await startEditing(companions);
    await screenshotPage(page, 'sheet-dnd-mobile-edit-companions-en.png');
  });
});

test.describe('редактирование Dark Heresy', () => {
  test('desktop: инфо, прогрессия, характеристики (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const info = page.locator('#info-section:visible').first();
    await startEditing(info);
    await expectInputValue(info, 'Lucius Varn');
    await screenshotElement(info, 'sheet-dh-edit-info-en.png');

    const progression = page.locator('#progression-section:visible').first();
    await startEditing(progression);
    await screenshotElement(progression, 'sheet-dh-edit-progression-en.png');

    // 10 характеристик с примерными значениями (WS 34, BS 41, ...).
    const characteristics = page.locator('#characteristics-card:visible').first();
    await startEditing(characteristics);
    const statInputs = characteristics.locator('input[type="number"]');
    await expect(statInputs).toHaveCount(10);
    await expect(statInputs.nth(0)).toHaveValue('34');
    await expect(statInputs.nth(5)).toHaveValue('46');
    await screenshotElement(characteristics, 'sheet-dh-edit-characteristics-en.png');
  });

  test('desktop: навыки, снаряжение, инвентарь (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await page.setViewportSize({ width: 1920, height: 1600 });
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    // Навыки: имена и тренировки открываются в виде полей ввода.
    const skills = page.locator('#skills-talents-panel:visible').first();
    await startEditing(skills);
    await expectInputValue(skills, 'Awareness (Per)');
    await expectInputValue(skills, 'Scholastic Lore (Int)');
    await screenshotElement(skills, 'sheet-dh-edit-skills-en.png');

    // Снаряжение: броня и оружие с заполненными полями.
    const equipment = page.locator('#equipment-section:visible').first();
    await equipment.locator('[data-testid="edit-button"]:visible').first().click(); // броня
    await expect(equipment.locator('input[type="number"]').first()).toHaveValue('4');
    await screenshotElement(equipment, 'sheet-dh-edit-equipment-en.png');
    await equipment.locator('[data-testid="edit-button"]:visible').first().click(); // ближний бой (броня уже Save)
    await expectInputValue(equipment, 'Mono-sword');
    await screenshotElement(equipment, 'sheet-dh-edit-equipment-weapons-en.png');

    // Инвентарь: богатство и предметы.
    const inventory = page.locator('#inventory-section:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // богатство
    await expect(inventory.locator('input[type="number"]').first()).toHaveValue('240');
    await screenshotElement(inventory, 'sheet-dh-edit-inventory-en.png');
    await inventory.locator('[data-testid="edit-button"]:visible').first().click(); // предметы
    await expectInputValue(inventory, 'Data-slate');
    await screenshotElement(inventory, 'sheet-dh-edit-inventory-items-en.png');
  });

  test('mobile: характеристики, навыки, снаряжение, инвентарь (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const characteristics = page.getByTestId('characteristics-compact');
    await startEditing(characteristics);
    await expect(characteristics.locator('input[type="number"]').nth(0)).toHaveValue('34');
    await screenshotPage(page, 'sheet-dh-mobile-edit-characteristics-en.png');

    await openMobileSection(page, 'Skills');
    const skills = page.locator('#skills-talents-content:visible').first();
    await startEditing(skills);
    await expectInputValue(skills, 'Awareness (Per)');
    await screenshotPage(page, 'sheet-dh-mobile-edit-skills-en.png');

    await openMobileSection(page, 'Equipment', 'equipment-section');
    await discardUnsavedChanges(page);
    const equipment = page.locator('#equipment-section:visible').first();
    await equipment.locator('[data-testid="edit-button"]:visible').first().click();
    await screenshotPage(page, 'sheet-dh-mobile-edit-equipment-en.png');

    await openMobileSection(page, 'Inventory', 'inventory-section');
    await discardUnsavedChanges(page);
    const inventory = page.locator('#inventory-section:visible').first();
    await inventory.locator('[data-testid="edit-button"]:visible').first().click();
    await screenshotPage(page, 'sheet-dh-mobile-edit-inventory-en.png');
  });
});
