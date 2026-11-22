import { expect, test } from '@playwright/test';

import { openApp, prepare } from '../../../../../tests/visual/helpers';

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
