import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: CREATE FORM VALIDATION UX ──────────────────────────────────
 * Раньше невалидный submit выглядел «немым»: у текстового поля ещё был
 * фокус, а кастомный Select (родной мир, карьера) на мобильном оставался
 * ниже вьюпорта — сообщение `FormMessage` никто не видел.
 *
 * Теперь на невалидный submit:
 *   • показывается тост «Заполните обязательные поля» с текстом первой
 *     ошибки;
 *   • первое поле с `aria-invalid` прокручивается в центр и получает фокус.
 */

async function expectInvalidFeedback(page: import('@playwright/test').Page) {
  await expect(
    page.getByText('Fill in the required fields').first(),
  ).toBeVisible();
  // Первая ошибка — незаполненный Select «родной мир».
  await expect(
    page.getByText('You must select a home world.').first(),
  ).toBeVisible();
  // Фокус действительно на невалидном контроле (а не потерян).
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute('aria-invalid')),
    )
    .toBe('true');
}

test.describe('создание персонажа: невалидная отправка', () => {
  test('DH: тост + фокус на первом незаполненном Select (en)', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/new?game=darkHeresy&edition=dh1');

    await page.locator('[name="name"]').fill('Test Hero');
    await page.getByRole('button', { name: /Create Character/i }).click();

    await expectInvalidFeedback(page);
  });

  test('DH: тост на русском (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/new?game=darkHeresy&edition=dh1');

    await page.locator('[name="name"]').fill('Тестовый Герой');
    await page.getByRole('button', { name: /Создать персонажа/i }).click();

    await expect(
      page.getByText('Заполните обязательные поля').first(),
    ).toBeVisible();
    await expect(
      page.getByText('Вы должны выбрать родной мир.').first(),
    ).toBeVisible();
  });

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
