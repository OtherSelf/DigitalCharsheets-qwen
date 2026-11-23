import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

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

/**
 * Форма D&D на host-странице `/new`: снимается после выбора игры и редакции.
 * Сценарий принадлежит плагину, потому что форма — его файл.
 */
test.describe(
  'D&D 5e: форма на странице создания',
  { tag: '@plugin:dnd5e' },
  () => {
    test('new — форма D&D (en)', async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/new');

      await page.getByTestId('create-game-dnd').click();
      await page.getByTestId('create-edition-dnd5e').click();
      await expect(
        page.getByRole('button', { name: 'Create Character' }),
      ).toBeVisible();
      await page.locator('form').first().scrollIntoViewIfNeeded();

      await screenshotPage(page, 'new-dnd-form-en.png');
    });

    test('new — форма D&D (ru)', async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, '/new');

      await page.getByTestId('create-game-dnd').click();
      await page.getByTestId('create-edition-dnd5e').click();
      await expect(page.locator('form').first()).toBeVisible();
      await page.locator('form').first().scrollIntoViewIfNeeded();

      await screenshotPage(page, 'new-dnd-form-ru.png');
    });
  },
);

/**
 * Невалидный submit D&D: тост и фокус на первом незаполненном поле, а не
 * «немой» отказ. Сценарий формы принадлежит плагину.
 */
test.describe('D&D 5e: валидация формы', { tag: '@plugin:dnd5e' }, () => {
  test('D&D: тост + фокус на первом незаполненном поле (en)', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/new?game=dnd&edition=dnd5e');

    await page.locator('[name="name"]').fill('Test Hero');
    await page.getByRole('button', { name: /Create Character/i }).click();

    await expect(
      page.getByText('Fill in the required fields').first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.activeElement?.getAttribute('aria-invalid'),
        ),
      )
      .toBe('true');
  });
});
