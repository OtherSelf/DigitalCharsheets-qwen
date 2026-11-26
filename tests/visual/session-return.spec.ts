import { expect, test } from '@playwright/test';

import { getState, openApp, prepare, sheetPath } from './helpers';

/**
 * ─── LANDMARK: SESSION RETURN ───────────────────────────────────────────────
 * Гость открывает прямую ссылку на лист, сессии нет — его уводит на вход.
 * После входа он обязан вернуться на этот лист, а не на главную: ссылку он
 * открывал осознанно (из закладки, из чата, из письма).
 *
 * Проверяем и сам `?next=` в адресе входа, и возврат после него.
 */
test.describe('возврат после входа по прямой ссылке', () => {
  test('гость с ссылкой на лист возвращается на лист', async ({
    page,
    context,
  }) => {
    const state = getState();
    const characterId = state.characters.dnd;
    expect(characterId, 'нужен посеянный лист D&D').toBeTruthy();

    await prepare(context, { authenticated: false });
    await openApp(page, sheetPath(characterId));

    // Сначала — на форму входа, и в адресе остаётся цель возврата.
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toBe(sheetPath(characterId));

    await page.getByLabel('Username or Email').fill(state.username);
    await page.getByLabel('Password', { exact: true }).fill(state.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Лист открылся: заголовок с именем и адрес — ровно тот, что в ссылке.
    await expect(page).toHaveURL(new RegExp(`/character/`), {
      timeout: 15_000,
    });
    await expect(page.locator('main')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(sheetPath(characterId));
  });

  test('вход без next ведёт на главную, как раньше', async ({
    page,
    context,
  }) => {
    const state = getState();

    await prepare(context, { authenticated: false });
    await openApp(page, '/login');

    await page.getByLabel('Username or Email').fill(state.username);
    await page.getByLabel('Password', { exact: true }).fill(state.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  });
});
