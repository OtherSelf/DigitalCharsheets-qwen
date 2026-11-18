import { expect, test } from '@playwright/test';

import {
  discardUnsavedChanges,
  expectInputValue,
  gameCharacterId,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  startEditing,
  startEditingAll,
} from '../../../../../tests/visual/helpers';

/**
 * Режим редактирования D&D 5e: проверяем не только то, что кнопка Edit
 * существует, но и то, что поля открываются ЗАПОЛНЕННЫМИ данными персонажа.
 *
 * Клик по Edit меняет только локальный state — в API ничего не уходит,
 * поэтому тесты не портят фикстуру.
 */

test.describe('редактирование D&D', { tag: '@plugin:dnd5e' }, () => {
  test(
    'desktop: прогрессия, инфо, статы, спасброски, навыки (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      // Высокий вьюпорт, чтобы элементные скриншоты длинных карточек
      // (статы, навыки, характеристики DH) снимались целиком.
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

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
      await expect(saves.locator('input[type="number"]').first()).toHaveValue(
        '',
      );
      await screenshotElement(saves, 'sheet-dnd-edit-saves-en.png');

      // Навыки: поля ручных модификаторов (у Arcana +2, у History +1).
      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue(
        '2',
      );
      await expect(skills.locator('input[type="number"]').nth(5)).toHaveValue(
        '1',
      );
      await screenshotElement(skills, 'sheet-dnd-edit-skills-en.png');
    },
  );

  test(
    'desktop: бой, атаки, инвентарь, настройка (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      const combat = page.locator('#hit-points-card:visible').first();
      await startEditing(combat);
      await expect(combat.locator('input[type="number"]').first()).toHaveValue(
        '45',
      );
      await screenshotElement(combat, 'sheet-dnd-edit-combat-en.png');

      const attacks = page
        .locator('#attacks-and-spellcasting-box:visible')
        .first();
      await startEditing(attacks);
      await expectInputValue(attacks, 'Fire Bolt');
      await screenshotElement(attacks, 'sheet-dnd-edit-attacks-en.png');

      // Инвентарь: деньги и предметы (Spellbook и т.д.).
      const inventory = page.locator('#inventory-box:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // деньги
      await expect(inventory.locator('input[type="number"]')).toHaveCount(5);
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // предметы
      await expectInputValue(inventory, 'Spellbook');
      await expect(
        inventory.locator('input[type="number"]').nth(3),
      ).toHaveValue('245');
      await screenshotElement(inventory, 'sheet-dnd-edit-inventory-en.png');

      const attunement = page.locator('#attunement-card:visible').first();
      await startEditing(attunement);
      await expectInputValue(attunement, 'Cloak of Protection');
      await screenshotElement(attunement, 'sheet-dnd-edit-attunement-en.png');
    },
  );

  test(
    'desktop: заклинания, спутники, нарратив (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

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
    },
  );

  test(
    'mobile: статы, навыки, инвентарь (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      // Компактная плашка статов: карандаш в правом верхнем углу.
      const statsBar = page.getByTestId('compact-stats-bar');
      await statsBar.getByTestId('compact-stats-edit-button').click();
      await expect(statsBar.locator('input[type="number"]')).toHaveCount(6);
      await screenshotPage(page, 'sheet-dnd-mobile-edit-stats-en.png');

      await openMobileSection(page, 'Ability Scores');
      await discardUnsavedChanges(page);
      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue(
        '2',
      );
      await screenshotPage(page, 'sheet-dnd-mobile-edit-skills-en.png');

      await openMobileSection(page, 'Inventory & Attunement');
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
      await expectInputValue(inventory, 'Spellbook');
      await screenshotPage(page, 'sheet-dnd-mobile-edit-inventory-en.png');
    },
  );
});
