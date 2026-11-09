import { expect, test, type BrowserContext } from '@playwright/test';

import {
  collectPageErrors,
  getState,
  openApp,
  openRegisterForm,
  prepare,
  registerViaUI,
  screenshotPage,
  signInViaUI,
} from './helpers';

/**
 * Общие (не зависящие от системы) страницы.
 *
 * Каждый эталон называется по схеме
 *   <страница>-[<игра>]-[<доп. поле>]-<язык>.png
 * поэтому в имени всегда видно и язык, и игру (если экран игровой).
 * Языки приложения: en и ru; /login теперь полностью переведён, поэтому
 * снимается на обоих языках — включая регистрацию и восстановление.
 */

const isMobile = () => test.info().project.name === 'mobile';

test.describe('login: вход, регистрация, восстановление', () => {
  test('login — гостевая страница (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await expect(
      page.getByRole('heading', { name: 'Digital Character Sheets', level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );

    // Шапка как на главной: бренд + компактный вид + тема + язык.
    await expect(page.getByTestId('guest-header')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /toggle theme/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'EN', exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'login-en.png');
  });

  test('login — гостевая страница (ru)', async ({ page, context }) => {
    await prepare(context, {
      authenticated: false,
      theme: 'light',
      language: 'ru',
    });
    await openApp(page, '/login');

    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'С возвращением',
    );
    await expect(
      page.getByRole('button', { name: 'RU', exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'login-ru.png');
  });

  test('login — восстановление аккаунта (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Recover Account',
    );
    await expect(page.getByText('Three words from your sheets')).toBeVisible();

    await screenshotPage(page, 'login-recovery-en.png');
  });

  test('login — восстановление аккаунта (ru)', async ({ page, context }) => {
    await prepare(context, {
      authenticated: false,
      theme: 'light',
      language: 'ru',
    });
    await openApp(page, '/login');

    await page.getByRole('button', { name: 'Забыли пароль?' }).click();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Восстановление аккаунта',
    );
    await expect(page.getByText('Три слова из ваших листов')).toBeVisible();

    await screenshotPage(page, 'login-recovery-ru.png');
  });

  test('login — форма регистрации (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await openRegisterForm(page, { navigate: false });
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Create Account',
    );
    await expect(
      page.getByLabel('Display Name', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Recovery Phrase', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'login-register-en.png');
  });

  test('login — форма регистрации (ru)', async ({ page, context }) => {
    await prepare(context, {
      authenticated: false,
      theme: 'light',
      language: 'ru',
    });
    await openApp(page, '/login');

    await openRegisterForm(page, { navigate: false });
    await expect(page.getByTestId('auth-card-title')).toHaveText('Регистрация');
    await expect(
      page.getByLabel('Отображаемое имя', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'login-register-ru.png');
  });

  test('login — неизвестный аккаунт даёт понятную ошибку', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await page
      .getByLabel('Username or Email', { exact: true })
      .fill('definitely-missing-account');
    await page.getByLabel('Password', { exact: true }).fill('not-a-real-pass');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page.getByTestId('auth-error')).toContainText(
      'No account found with this login. Create an account first.',
    );
    expect(new URL(page.url()).pathname, 'остаёмся на /login').toBe('/login');
  });

  test('login — регистрация через UI создаёт сессию и пускает в дашборд', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const errors = collectPageErrors(page);
    const account = {
      username: `ui-register-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'visual-pass-1234',
      displayName: 'UI Register',
      recoveryPhrase: 'amber cobalt lantern',
    };

    await registerViaUI(page, account);

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    const session = await page.evaluate(() =>
      localStorage.getItem('digital_charsheets_user'),
    );
    expect(session).toContain(account.username);
    expect(errors, 'ошибки JS при регистрации').toEqual([]);
  });

  test('login — вход через форму', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const errors = collectPageErrors(page);

    await signInViaUI(page, getState());

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    await expect(page.getByText('Seraphina Vael')).toBeVisible();
    await expect(page.getByText('Lucius Varn')).toBeVisible();
    expect(errors, 'ошибки JS при входе').toEqual([]);
  });
});

test.describe('общие страницы', () => {
  test('dashboard — английский язык', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    await expect(page.getByText('Seraphina Vael')).toBeVisible();
    await expect(page.getByText('Lucius Varn')).toBeVisible();

    await screenshotPage(page, 'dashboard-en.png');
  });

  test('dashboard — русский язык', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Существующие персонажи' }),
    ).toBeVisible();

    await screenshotPage(page, 'dashboard-ru.png');
  });

  test('dashboard — гостевая демо-страница (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/');

    // Для гостя главная — это демо-лендинг (DemoLandingView в app/page.tsx).
    await expect(
      page.getByRole('heading', { name: 'Try Before You Commit' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Preview D&D 5e Character' }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('guest-header')
        .getByRole('link', { name: 'Login / Register' }),
    ).toBeVisible();

    await screenshotPage(page, 'dashboard-guest-en.png');
  });

  test('dashboard — гостевая демо-страница (ru)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, language: 'ru' });
    await openApp(page, '/');

    // Гостевая главная переведена: лендинг и кнопка входа по-русски.
    await expect(
      page.getByRole('heading', { name: 'Попробуйте без регистрации' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Предпросмотр персонажа D&D 5e' }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('guest-header')
        .getByRole('link', { name: 'Вход / Регистрация' }),
    ).toBeVisible();

    await screenshotPage(page, 'dashboard-guest-ru.png');
  });

  /**
   * ─── LANDMARK: PENDING_DRAFT_ETALON ──────────────────────────────────────
   * Дашборд с плашкой «незавершённый черновик»: персонажа начертил гость до
   * входа, в аккаунт он НЕ попадает сам (создаётся кнопкой). Снимок стережёт
   * именно вёрстку плашки: две кнопки не должны наезжать на текст, длинная
   * русская фраза — обрезаться, а на mobile кнопки — уезжать за экран.
   *
   * Черновик кладём init-скриптом в sessionStorage до запуска приложения:
   * так тест не зависит от многошагового гостевого сценария (он проверяется
   * в creation.spec.ts) и остаётся детерминированным.
   */
  const seedGuestDraft = async (context: BrowserContext, name: string) => {
    await context.addInitScript((draftName: string) => {
      try {
        sessionStorage.setItem(
          'pending_character',
          JSON.stringify({
            name: draftName,
            gameSystem: 'Dungeons & Dragons',
            characterClass: 'Rogue',
            race: 'Halfling',
            background: 'Criminal',
            level: 1,
          }),
        );
      } catch {
        /* sessionStorage может быть недоступен — снимок тогда не снять */
      }
    }, name);
  };

  test('dashboard — незавершённый черновик (en)', async ({ page, context }) => {
    await prepare(context);
    await seedGuestDraft(context, 'Thalia Nightbreeze');
    await openApp(page, '/');

    await expect(page.getByTestId('pending-draft')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    // Плашка ничего не подменяет: листы аккаунта на месте.
    await expect(page.getByText('Seraphina Vael')).toBeVisible();
    await expect(page.getByText('Lucius Varn')).toBeVisible();

    await screenshotPage(page, 'dashboard-draft-en.png');
  });

  test('dashboard — незавершённый черновик (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await seedGuestDraft(context, 'Thalia Nightbreeze');
    await openApp(page, '/');

    await expect(page.getByTestId('pending-draft')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Существующие персонажи' }),
    ).toBeVisible();

    await screenshotPage(page, 'dashboard-draft-ru.png');
  });

  test('new — выбор системы (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new');

    await expect(
      page.getByRole('heading', { name: 'Create New Character', level: 1 }),
    ).toBeVisible();
    await screenshotPage(page, 'new-en.png');
  });

  test('new — выбор системы (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/new');

    await expect(
      page.getByRole('heading', { name: 'Создать нового персонажа', level: 1 }),
    ).toBeVisible();
    await screenshotPage(page, 'new-ru.png');
  });

  test('new — форма D&D (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new');

    await page.getByRole('combobox').click();
    await page.getByRole('option').first().click();
    await expect(
      page.getByRole('button', { name: 'Create Character' }),
    ).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dnd-form-en.png');
  });

  test('new — форма D&D (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/new');

    await page.getByRole('combobox').click();
    await page.getByRole('option').first().click();
    await expect(page.locator('form').first()).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dnd-form-ru.png');
  });

  test('new — форма Dark Heresy (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new');

    await page.getByRole('combobox').click();
    await page.getByRole('option').nth(1).click();
    await expect(page.getByText('Home World').first()).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dh-form-en.png');
  });

  test('new — форма Dark Heresy (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/new');

    await page.getByRole('combobox').click();
    await page.getByRole('option').nth(1).click();
    await expect(page.locator('form').first()).toBeVisible();
    await page.locator('form').first().scrollIntoViewIfNeeded();

    await screenshotPage(page, 'new-dh-form-ru.png');
  });

  test('new/manual — параллельный маршрут создания (en)', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/new/manual');

    await expect(
      page.getByRole('heading', { name: 'Create New Character', level: 1 }),
    ).toBeVisible();

    await screenshotPage(page, 'new-manual-en.png');
  });

  test('stats-editor — массовый редактор (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/stats-editor');

    await expect(
      page.getByRole('heading', { name: 'Bulk Editor' }),
    ).toBeVisible();
    await expect(page.getByText('Seraphina Vael')).toBeVisible();

    await screenshotPage(page, 'stats-editor-en.png');
  });

  test('stats-editor — массовый редактор (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/stats-editor');

    await expect(
      page.getByRole('heading', { name: 'Массовый редактор' }),
    ).toBeVisible();

    await screenshotPage(page, 'stats-editor-ru.png');
  });

  test('stats-editor — вкладка DH Vitals (en)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: широкие таблицы виталов');
    await prepare(context);
    await openApp(page, '/stats-editor');

    await page.getByRole('button', { name: /^Dark Heresy Vitals/ }).click();
    await expect(page.getByText('Max Wounds').first()).toBeVisible();

    await screenshotPage(page, 'stats-editor-dh-vitals-en.png');
  });

  test('stats-editor — вкладка D&D Vitals (en)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only: широкие таблицы виталов');
    await prepare(context);
    await openApp(page, '/stats-editor');

    await page.getByRole('button', { name: /^D&D Vitals/ }).click();
    await expect(page.getByText('Max HP').first()).toBeVisible();

    await screenshotPage(page, 'stats-editor-dnd-vitals-en.png');
  });
});

/**
 * Демо-лендинг и профиль пользователя.
 *
 * Гостевая главная и /demo используют общий компонент DemoLanding, поэтому
 * базовый лендинг снимается на en и ru. Превью листов внутри демо
 * (demo-dnd, demo-dh) остаются только en: сами листы уже покрыты на обоих
 * языках в sheet:dnd / sheet:dh.
 */
test.describe('демо и настройки профиля', () => {
  test('demo — превью персонажей (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/demo');

    await expect(
      page.getByRole('heading', { name: 'Try Before You Commit' }),
    ).toBeVisible();
    await expect(page.getByText('Create Your Own Character')).toBeVisible();
    await screenshotPage(page, 'demo-en.png');

    await page
      .getByRole('button', { name: 'Preview D&D 5e Character' })
      .click();
    await expect(page.getByText('Demo Mode Active')).toBeVisible();
    await expect(page.getByText('Thorin Ironforge').first()).toBeVisible();
    await screenshotPage(page, 'demo-dnd-en.png');

    await page
      .getByRole('button', { name: 'Preview Dark Heresy Character' })
      .click();
    await expect(page.getByText('Demo Mode Active')).toBeVisible();
    await expect(page.getByText('Inquisitor Vane').first()).toBeVisible();
    await screenshotPage(page, 'demo-dh-en.png');
  });

  test('demo — превью персонажей (ru)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, language: 'ru' });
    await openApp(page, '/demo');

    await expect(
      page.getByRole('heading', { name: 'Попробуйте без регистрации' }),
    ).toBeVisible();
    await expect(page.getByText('Создайте своего персонажа')).toBeVisible();
    await screenshotPage(page, 'demo-ru.png');
  });

  test('settings — профиль и отображение (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/settings');

    await expect(
      page.getByRole('heading', { name: 'Profile Settings' }),
    ).toBeVisible();
    await expect(page.getByText('General Information')).toBeVisible();
    await expect(page.getByText('Display Settings')).toBeVisible();
    await expect(page.getByText('Security')).toBeVisible();
    await screenshotPage(page, 'settings-en.png');

    // Масштаб текста реально доезжает до документа и сбрасывается.
    const textScale = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--text-scale')
          .trim(),
      );

    await expect.poll(textScale).toBe('1');
    await page.getByRole('button', { name: 'Increase text size' }).click();
    await expect.poll(textScale).toBe('1.1');
    await page.getByRole('button', { name: 'Decrease text size' }).click();
    await expect.poll(textScale).toBe('1');

    // UI-масштаб ограничен сверху 150%: кнопка «+» упирается в max и гаснет.
    const increaseScale = page.getByRole('button', {
      name: 'Increase UI scale',
    });
    for (let i = 0; i < 10; i += 1) {
      if (await increaseScale.isDisabled()) break;
      await increaseScale.click();
    }
    const uiScale = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--ui-scale')
        .trim(),
    );
    expect(uiScale).toBe('1.5');
    await expect(
      page.getByRole('button', { name: 'Increase UI scale' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Reset to Defaults' }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--ui-scale')
            .trim(),
        ),
      )
      .toBe('1');
  });

  test('settings — профиль (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/settings');

    await expect(
      page.getByRole('heading', { name: 'Настройки профиля' }),
    ).toBeVisible();
    await expect(page.getByText('Настройки отображения')).toBeVisible();
    await screenshotPage(page, 'settings-ru.png');
  });
});
