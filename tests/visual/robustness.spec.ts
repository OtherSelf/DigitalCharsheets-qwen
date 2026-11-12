import { expect, test } from '@playwright/test';

import { expectNoRawI18nKeys, getState, openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: RESILIENCE UI ──────────────────────────────────────────────
 * Сбой загрузки не должен превращаться в вечный спиннер `app/loading.tsx`
 * (именно так выглядел упавший прокси: HTML есть, данные 200, а клиент
 * завис). Проверяем два состояния:
 *   • неизвестный/удалённый id → «Персонаж не найден» + выход на главную;
 *   • GET /api/characters упал → экран ошибки с «Повторить», после повтора
 *     данные появляются.
 */

test.describe('устойчивость загрузки', () => {
  test('неизвестный id листа — экран «не найден», а не спиннер (ru)', async ({
    page,
    context,
  }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/this-character-does-not-exist');

    const state = page.getByTestId('sheet-not-found');
    await expect(state).toBeVisible();
    await expect(
      state.getByText('Персонаж не найден', { exact: true }),
    ).toBeVisible();
    await expect(state.getByRole('link', { name: /Назад/ })).toBeVisible();
    await expectNoRawI18nKeys(page, 'sheet-not-found (ru)');
  });

  test('ошибка списка персонажей — «Повторить» возвращает данные (en)', async ({
    page,
    context,
  }) => {
    await prepare(context);
    // Рвём ВСЕ загрузки списка, пока не нажали «Повторить»: иначе фоновое
    // освежение (фокус/возврат на страницу) успеет загрузить данные и
    // экран ошибки схлопнется раньше проверки.
    let allowLoad = false;
    await page.route('**/api/characters', async (route) => {
      if (!allowLoad) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await openApp(page, '/');
    const errorState = page.getByTestId('characters-load-error');
    await expect(errorState).toBeVisible();
    await expect(
      errorState.getByText('Could not load characters', { exact: true }),
    ).toBeVisible();
    await expectNoRawI18nKeys(page, 'characters-load-error (en)');

    allowLoad = true;
    await errorState.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('Seraphina Vael')).toBeVisible();
    await expect(errorState).toHaveCount(0);
  });

  test('ошибка на листе — «Повторить» открывает лист (en)', async ({
    page,
    context,
  }) => {
    await prepare(context);
    let allowLoad = false;
    await page.route('**/api/characters', async (route) => {
      if (!allowLoad) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await openApp(page, `/${getState().dndId}`);
    const errorState = page.getByTestId('sheet-load-error');
    await expect(errorState).toBeVisible();
    await expect(
      errorState.getByRole('button', { name: 'Retry' }),
    ).toBeVisible();

    allowLoad = true;
    await errorState.getByRole('button', { name: 'Retry' }).click();
    await expect(
      page.getByRole('heading', { name: 'Seraphina Vael' }),
    ).toBeVisible();
  });
});
