import { expect, test } from '@playwright/test';

import { openApp, prepare } from '../../../../../tests/visual/helpers';

/** Создание DH2: характеристики и влияние используют одну шкалу d100. */
test.describe('DH2: форма создания', { tag: '@plugin:dh2' }, () => {
  test('имя и влияние ограничены', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new?game=darkHeresy&edition=dh2');

    await expect(page.locator('[name="name"]')).toHaveAttribute(
      'maxlength',
      '200',
    );
    await expect(page.locator('[name="influence"]')).toHaveAttribute(
      'max',
      '100',
    );
  });
});
