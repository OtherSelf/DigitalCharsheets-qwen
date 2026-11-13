import { expect, test, type Page } from '@playwright/test';

import { openApp, prepare, screenshotPage } from './helpers';
import { readAdminState } from './state';

/**
 * ─── LANDMARK: PROFILE MENU VISUAL SPEC ────────────────────────────────────
 * Выпадающее меню профиля в правом верхнем углу — отдельный экран, который
 * раньше не попадал ни в один снимок.
 *
 * Покрыты:
 *   • обычный пользователь (canonical `visual-tests`, стабильный логин);
 *   • администратор (пункт Administration);
 *   • русская локаль.
 *
 * Админский вариант использует служебного админа, которого сеет
 * scripts/visual.sh; при запуске с --base-url его нет, поэтому тест
 * пропускается (как и остальные админские снимки).
 */

const admin = readAdminState();

async function openUserMenu(
  page: Page,
  language: 'en' | 'ru' = 'en',
): Promise<void> {
  await page
    .getByRole('button', {
      name: language === 'ru' ? 'Открыть меню пользователя' : 'Open user menu',
    })
    .click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test.describe('profile menu', () => {
  test('profile menu — обычный пользователь (en)', async ({
    page,
    context,
  }) => {
    await prepare(context, { account: 'canonical', theme: 'light' });
    await openApp(page, '/');
    await openUserMenu(page);

    const menu = page.getByRole('menu');
    await expect(menu.getByText('Visual Tester')).toBeVisible();
    await expect(menu.getByText('visual-tests', { exact: true })).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Display Settings' }),
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Settings', exact: true }),
    ).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Log out' })).toBeVisible();
    // У обычного пользователя пункта админки быть не должно.
    await expect(
      menu.getByRole('menuitem', { name: 'Administration' }),
    ).toHaveCount(0);
    // Подпись версии в подвале меню. Визуальный стенд задаёт фиктивный коммит
    // (DCS_GIT_COMMIT=0000000), поэтому форма — «vX.Y.Z · 0000000»; регэксп
    // намеренно свободный, чтобы работал и режим --base-url против чужого
    // сервера.
    await expect(menu.getByText(/v\d+\.\d+\.\d+/)).toBeVisible();

    await screenshotPage(page, 'profile-menu-en.png');
  });

  test(
    'display settings — модалка (en)',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context, { account: 'canonical', theme: 'light' });
      await openApp(page, '/');
      await openUserMenu(page);

      await page.getByRole('menuitem', { name: 'Display Settings' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: 'Display Settings' }),
      ).toBeVisible();
      await expect(
        dialog.getByText('Font Size', { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByText('UI Scale', { exact: true })).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Reset to defaults' }),
      ).toBeVisible();

      await screenshotPage(page, 'display-settings-en.png');
    },
  );

  test(
    'ui scale 80% — dashboard (en)',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context, { account: 'canonical', theme: 'light' });
      await openApp(page, '/');
      await openUserMenu(page);

      await page.getByRole('menuitem', { name: 'Display Settings' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const decrease = dialog.getByRole('button', {
        name: 'Decrease UI scale',
      });
      for (let i = 0; i < 2; i += 1) {
        await decrease.click();
        await page.waitForTimeout(200);
      }
      await expect(dialog).toContainText('80%');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue('--ui-scale')
              .trim(),
          ),
        )
        .toBe('0.8');

      await screenshotPage(page, 'dashboard-ui-scale-80-en.png');
    },
  );

  test('profile menu — администратор (en)', async ({ page, context }) => {
    test.skip(
      !admin,
      'нет админского аккаунта в .visual-state.json — запустите npm run test:visual',
    );

    await prepare(context, { account: 'admin', theme: 'light' });
    await openApp(page, '/');
    await openUserMenu(page);

    const menu = page.getByRole('menu');
    await expect(menu.getByText('Administrator')).toBeVisible();
    await expect(menu.getByText('admin', { exact: true })).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Administration' }),
    ).toBeVisible();
    await expect(menu.getByText(/v\d+\.\d+\.\d+/)).toBeVisible();

    await screenshotPage(page, 'profile-menu-admin-en.png');
  });

  test('profile menu — обычный пользователь (ru)', async ({
    page,
    context,
  }) => {
    await prepare(context, {
      account: 'canonical',
      theme: 'light',
      language: 'ru',
    });
    await openApp(page, '/');
    await openUserMenu(page, 'ru');

    const menu = page.getByRole('menu');
    await expect(menu.getByText('Visual Tester')).toBeVisible();
    await expect(menu.getByText('visual-tests', { exact: true })).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Настройки отображения' }),
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Настройки', exact: true }),
    ).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Выйти' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Админка' })).toHaveCount(
      0,
    );
    await expect(menu.getByText(/v\d+\.\d+\.\d+/)).toBeVisible();

    await screenshotPage(page, 'profile-menu-ru.png');
  });
});
