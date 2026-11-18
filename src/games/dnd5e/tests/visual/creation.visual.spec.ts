import { expect, test } from '@playwright/test';

import {
  fetchCharacters,
  openCreationForm,
  prepare,
  registerAccount,
  signInViaUI,
  waitForSheetRedirect,
} from '../../../../../tests/visual/helpers';

/**
 * Создание персонажа D&D 5e: реальный путь пользователя (дашборд → форма →
 * игра → редакция), данные и системные поля сохраняются, лист открывается.
 *
 * Каждый тест работает со СВОИМ аккаунтом (регистрируется через API, имя
 * уникально на прогон), поэтому seeded-аккаунт «visual-tests» не трогается.
 */

test.describe('создание персонажа — D&D 5e', { tag: '@plugin:dnd5e' }, () => {
  test('форма создаёт лист, данные и системные поля сохраняются', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dnd-e2e', 'D&D E2E');
    await signInViaUI(page, account);

    await openCreationForm(page, 'dnd', 'dnd5e');

    const name = 'E2E Wizard';
    await page.getByLabel('Character Name', { exact: true }).fill(name);
    await page.getByLabel('Class', { exact: true }).click();
    await page.getByRole('option', { name: 'Wizard', exact: true }).click();
    await page.getByRole('button', { name: 'Create Character' }).click();

    const id = await waitForSheetRedirect(page);

    const characters = await fetchCharacters(page);
    expect(characters, 'ровно один лист у нового аккаунта').toHaveLength(1);

    const created = characters[0];
    expect(created).toMatchObject({
      id,
      name,
      gameSystem: 'Dungeons & Dragons',
      characterClass: 'Wizard',
      // Дефолты формы для 1 уровня.
      level: 1,
      proficiencyBonus: 2,
      armorClass: 10,
      speed: 30,
      hitPoints: { current: 8, max: 8 },
    });
    expect(created.stats).toEqual({
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    expect(created.spells).toEqual([]);
    expect(created.savingThrows).toHaveLength(6);

    // Персонаж виден в дашборде (карточка листа).
    await page.goto('/');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  test('без имени форма не отправляется и лист не создаётся', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dnd-invalid', 'D&D Invalid');
    await signInViaUI(page, account);

    await openCreationForm(page, 'dnd', 'dnd5e');
    await page.getByRole('button', { name: 'Create Character' }).click();

    await expect(
      page
        .getByTestId('create-step-form')
        .getByText('Name must be at least 2 characters.'),
    ).toBeVisible();
    expect(new URL(page.url()).pathname, 'остаёмся в форме').toBe('/new');
    expect(await fetchCharacters(page), 'лист не создан').toEqual([]);
  });
});
