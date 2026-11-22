import { expect, test } from '@playwright/test';

import { openApp, prepare } from '../../../../../tests/visual/helpers';

/** Создание D&D: характеристики 1–30, опыт и хиты не отрицательные. */
test.describe('D&D 5e: форма создания', { tag: '@plugin:dnd5e' }, () => {
  test('ввод ограничен до запроса', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new?game=dnd&edition=dnd5e');

    await expect(page.locator('[name="name"]')).toHaveAttribute(
      'maxlength',
      '200',
    );
    await expect(page.locator('[name="strength"]')).toHaveAttribute('min', '1');
    await expect(page.locator('[name="strength"]')).toHaveAttribute(
      'max',
      '30',
    );
    await expect(page.locator('[name="experiencePoints"]')).toHaveAttribute(
      'min',
      '0',
    );
    await expect(page.locator('[name="max"]')).toHaveAttribute('min', '0');
  });
});
