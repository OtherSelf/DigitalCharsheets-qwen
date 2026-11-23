import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  registerAccount,
  screenshotPage,
  signInViaUI,
} from '../../../../../tests/visual/helpers';

/**
 * Создание DH1: ограничения видны до запроса. Значения вне диапазона не
 * должны уходить на сервер и не должны давать «немой» submit — форма
 * подсвечивает поле и показывает тост через общий handleInvalid.
 */
test.describe('DH1: форма создания', { tag: '@plugin:dh1' }, () => {
  test('ввод ограничен: имя 200, характеристики 0–100, деньги >= 0', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/new?game=darkHeresy&edition=dh1');

    await expect(page.locator('[name="name"]')).toHaveAttribute(
      'maxlength',
      '200',
    );
    await expect(page.locator('[name="weaponSkill"]')).toHaveAttribute(
      'min',
      '0',
    );
    await expect(page.locator('[name="weaponSkill"]')).toHaveAttribute(
      'max',
      '100',
    );
    await expect(page.locator('[name="wounds"]')).toHaveAttribute('min', '0');
    await expect(page.locator('[name="throneGelt"]')).toHaveAttribute(
      'min',
      '0',
    );
  });

  test('характеристика 101 блокирует создание', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new?game=darkHeresy&edition=dh1');

    await page.locator('[name="name"]').fill('Out Of Range');
    await page.locator('[name="weaponSkill"]').fill('101');
    await page.getByRole('button', { name: /Create Character/i }).click();

    await expect(page).toHaveURL(/\/new/);
    await expect(page.locator('[name="weaponSkill"]')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test('отрицательный капитал блокирует создание', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/new?game=darkHeresy&edition=dh1');

    await page.locator('[name="name"]').fill('Negative Money');
    await page.locator('[name="throneGelt"]').fill('-1');
    await page.getByRole('button', { name: /Create Character/i }).click();

    await expect(page).toHaveURL(/\/new/);
    await expect(page.locator('[name="throneGelt"]')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});

/**
 * Форма DH1 на host-странице `/new`: снимается после выбора игры и редакции.
 * Сценарий принадлежит плагину, потому что форма — его файл.
 */
test.describe('DH1: форма на странице создания', { tag: '@plugin:dh1' }, () => {
  test('new — форма Dark Heresy (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new');

    await page.getByTestId('create-game-darkHeresy').click();
    await page.getByTestId('create-edition-dh1').click();
    await expect(page.getByText('Home World').first()).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dh-form-en.png');
  });

  test('new — форма Dark Heresy (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/new');

    await page.getByTestId('create-game-darkHeresy').click();
    await page.getByTestId('create-edition-dh1').click();
    await expect(page.locator('form').first()).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dh-form-ru.png');
  });
});

/**
 * DH1: обязательно только имя. Мир и карьера выбираются позже на листе,
 * поэтому форма с одним именем создаёт персонажа без ошибок.
 */
test.describe('DH1: валидация формы', { tag: '@plugin:dh1' }, () => {
  test(
    'пустые мир и карьера не блокируют создание, выбор доступен на листе (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      // Свой аккаунт: созданный лист не должен попадать на дашборд
      // воркерского аккаунта и менять его счётчик редакций.
      await prepare(context, { authenticated: false, theme: 'light' });
      const account = await registerAccount(page, 'form-check', 'Form Check');
      await signInViaUI(page, account);
      await openApp(page, '/new?game=darkHeresy&edition=dh1');

      await page.locator('[name="name"]').fill('Name Only');
      await page.getByRole('button', { name: /Create Character/i }).click();

      await page.waitForURL(
        (url) => /^\/character\/[^/]+$/.test(url.pathname),
        {
          timeout: 30_000,
        },
      );
      await expect(page.getByText('Fill in the required fields')).toHaveCount(
        0,
      );

      const id = new URL(page.url()).pathname.split('/').pop()!;
      // Пустой мир не запирает creation-поле: его можно выбрать после создания.
      await openApp(page, `/character/${id}`);
      const info = page.locator('#info-section:visible').first();
      await info.locator('[data-testid="edit-button"]:visible').first().click();
      const world = info.getByRole('combobox', {
        name: 'Home World',
        exact: true,
      });
      await expect(world).toBeVisible();
      await world.click();
      await page.getByRole('option', { name: 'Feral World' }).click();
      await expect(
        info.getByText('Feral World', { exact: true }),
      ).toBeVisible();
    },
  );
});
