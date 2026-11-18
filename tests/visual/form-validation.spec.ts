import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: CREATE FORM VALIDATION UX ──────────────────────────────────
 * Невалидный submit не должен быть «немым»: у D&D обязательных полей
 * несколько, поэтому на ошибку показывается тост с первой ошибкой, а
 * невалидный контрол прокручивается в центр и получает фокус.
 *
 * У Dark Heresy 1e обязательно только имя (как в dh2): мир, карьера и
 * пророчество выбираются позже на листе, поэтому форма с одним именем
 * создаёт персонажа без ошибок.
 */

test.describe('создание персонажа: невалидная отправка', () => {
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

test.describe('создание DH1: обязательно только имя', () => {
  test(
    'пустые мир и карьера не блокируют создание, выбор доступен на листе (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
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
      // Иконка вкладки — ассет из папки плагина, а не общий public/favicon-*.
      const icon = await page
        .locator("link[rel*='icon']")
        .first()
        .getAttribute('href');
      expect(icon, 'favicon').toBeTruthy();
      expect(icon).not.toContain('favicon-dh.png');
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
