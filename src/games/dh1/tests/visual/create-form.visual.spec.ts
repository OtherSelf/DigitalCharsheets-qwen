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
 * Адепта Сороритас: опциональная карьера с ограничениями книги — только
 * женщины, четыре родных мира, нулевые Порча/Безумие и обязательное
 * разрешение Мастера (в лист не пишется).
 */
test.describe(
  'DH1: Адепта Сороритас в создании',
  { tag: '@plugin:dh1' },
  () => {
    test('ограничения карьеры и создание с галочкой Мастера (en)', async ({
      page,
      context,
    }) => {
      await prepare(context, { authenticated: false, theme: 'light' });
      const account = await registerAccount(
        page,
        'form-sororitas',
        'Sororitas',
      );
      await signInViaUI(page, account);
      await openApp(page, '/new?game=darkHeresy&edition=dh1');

      await page.locator('[name="name"]').fill('Sister Verena');
      await page.getByRole('combobox', { name: 'Career Path' }).click();
      await page.getByRole('option', { name: 'Adepta Sororitas' }).click();

      // Пол фиксирован книгой и заблокирован.
      const gender = page.getByRole('combobox', { name: 'Gender' });
      await expect(gender).toContainText('Female');
      await expect(gender).toBeDisabled();

      // Родные миры — только четыре разрешённых.
      await page.getByRole('combobox', { name: 'Home World' }).click();
      for (const world of [
        'Feral World',
        'Imperial World',
        'Schola Progenium',
        'Noble Born',
      ]) {
        await expect(
          page.getByRole('option', { name: world, exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole('option', { name: 'Hive World', exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole('option', { name: 'Schola Progenium', exact: true })
        .click();

      // Безумие и Порча на старте нулевые.
      await expect(page.locator('[name="insanity"]')).toBeDisabled();
      await expect(page.locator('[name="corruption"]')).toBeDisabled();

      // Без разрешения Мастера лист не создаётся.
      await page.getByRole('button', { name: /Create Character/i }).click();
      await expect(page).toHaveURL(/\/new/);

      await page.locator('form').first().scrollIntoViewIfNeeded();
      await screenshotPage(page, 'create-form-dh1-sororitas-en.png');

      await page
        .getByRole('checkbox', { name: 'The GM approved this character' })
        .check();
      await page.getByRole('button', { name: /Create Character/i }).click();
      await page.waitForURL(/\/character\/[^/]+$/, { timeout: 30_000 });
      const header = page.getByTestId('app-header');
      await expect(header).toContainText('Novice');
      await expect(header).toContainText('Adepta Sororitas');
    });
  },
);

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
