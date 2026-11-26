import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { PRIVACY_VERSION } from '../../src/lib/legal/privacy';
import { TERMS_VERSION } from '../../src/lib/legal/terms';
import { qrSvgDataUrl } from '../../src/lib/qr-svg';
import {
  collectPageErrors,
  expectNoRawI18nKeys,
  expectThemeFont,
  getState,
  openApp,
  openRegisterForm,
  prepare,
  registerAccount,
  registerViaUI,
  screenshotPage,
  sheetPath,
  signInViaUI,
} from './helpers';
import { readSandboxAdminState } from './state';

/**
 * Общие (не зависящие от системы) страницы.
 *
 * Каждый эталон называется по схеме
 *   <страница>-[<игра>]-[<доп. поле>]-<язык>.png
 * поэтому в имени всегда видно и язык, и игру (если экран игровой).
 * Языки приложения: en и ru; /login теперь полностью переведён, поэтому
 * снимается на обоих языках — включая регистрацию и восстановление.
 */

test.describe('login: вход, регистрация, восстановление', () => {
  test('глазок пароля показывает значение и не теряет его', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    const password = page.locator('#auth-password');
    await password.fill('visual-secret-12');
    await expect(password).toHaveAttribute('type', 'password');

    await page
      .getByRole('button', { name: 'Show password', exact: true })
      .first()
      .click();
    // Тип переключился, значение на месте, подпись кнопки сменилась.
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('visual-secret-12');
    await expect(
      page.getByRole('button', { name: 'Hide password', exact: true }).first(),
    ).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('button', { name: 'Hide password', exact: true })
      .first()
      .click();
    await expect(password).toHaveAttribute('type', 'password');
  });

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
    await expect(page.getByLabel('Your Recovery Phrase')).toBeVisible();
    // Слова из листов больше не нужны: второй фактор — только фраза.
    await expect(page.getByText('Three words from your sheets')).toHaveCount(0);

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
    await expect(page.getByLabel('Ваша фраза восстановления')).toBeVisible();
    // Слова из листов больше не нужны: второй фактор — только фраза.
    await expect(page.getByText('Три слова из ваших листов')).toHaveCount(0);

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
      recoveryPhrase: 'amber cobalt lantern silver ember frost',
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
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

  test(
    'login — вход через форму',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context, { authenticated: false, theme: 'light' });
      const errors = collectPageErrors(page);

      await signInViaUI(page, getState());

      await expect(
        page.getByRole('heading', { name: 'Existing Characters' }),
      ).toBeVisible();
      await expect(page.getByText('Seraphina Vael')).toBeVisible();
      await expect(page.getByText('Lucius Varn')).toBeVisible();
      expect(errors, 'ошибки JS при входе').toEqual([]);
    },
  );

  // Сквозной путь удаления: свой новый аккаунт (чтобы не трогать seeded),
  // неверный пароль не удаляет, верный — стирает и выводит на /login.
  test('settings — удаление аккаунта с подтверждением паролем', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const errors = collectPageErrors(page);
    const account = {
      username: `ui-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'visual-pass-1234',
      displayName: 'Delete Me',
      recoveryPhrase: 'amber cobalt lantern silver ember frost',
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    };

    await registerViaUI(page, account);
    await openApp(page, '/settings');

    await page.getByTestId('delete-account-open').click();
    const dialog = page.getByTestId('delete-account-dialog');
    await expect(dialog).toBeVisible();

    // Неверный пароль: аккаунт жив, ошибка локализована в диалоге.
    await dialog
      .getByLabel('Confirm your password', { exact: true })
      .fill('definitely-wrong');
    await dialog.getByTestId('delete-account-confirm').click();
    await expect(dialog.getByTestId('delete-account-error')).toContainText(
      'Incorrect password. The account was not deleted.',
    );
    expect(new URL(page.url()).pathname).toBe('/settings');

    // Верный пароль: редирект на /login, старый пароль больше не работает.
    await dialog
      .getByLabel('Confirm your password', { exact: true })
      .fill(account.password);
    await dialog.getByTestId('delete-account-confirm').click();
    await page.waitForURL((url) => url.pathname === '/login', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );

    const relogin = await context.request.post('/api/auth', {
      data: { username: account.username, password: account.password },
    });
    // Ответ неотличим от «неверный пароль»: аккаунта нет, но и подсказки нет.
    expect(relogin.status(), 'удалённый аккаунт не должен входить').toBe(401);
    expect(errors, 'ошибки JS при удалении аккаунта').toEqual([]);
  });
});

test.describe('общие страницы', () => {
  test(
    'dashboard — английский язык',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/');

      await expect(
        page.getByRole('heading', { name: 'Existing Characters' }),
      ).toBeVisible();
      await expect(page.getByText('Seraphina Vael')).toBeVisible();
      await expect(page.getByText('Lucius Varn')).toBeVisible();

      // Бейдж — две строки: игра (жирным) и редакция; обе из реестра и i18n.
      // Бейдж — две строки; редакция приходит из локали плагина. Порядок
      // карточек зависит от mtime, поэтому проверяем состав, а не позиции.
      const badges = page.getByTestId('edition-badge');
      await expect(badges).toHaveCount(3);
      await expect(badges.filter({ hasText: '1st Edition' })).toHaveCount(1);
      await expect(badges.filter({ hasText: '2nd Edition' })).toHaveCount(1);
      await expect(badges.filter({ hasText: '5th Edition' })).toHaveCount(1);

      await expectNoRawI18nKeys(page, 'dashboard (en)');
      await screenshotPage(page, 'dashboard-en.png');
    },
  );

  test(
    'dashboard — русский язык',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, '/');

      await expect(
        page.getByRole('heading', { name: 'Существующие персонажи' }),
      ).toBeVisible();

      // Название редакции локализовано вместе с игрой.
      const badges = page.getByTestId('edition-badge');
      await expect(badges).toHaveCount(3);
      await expect(badges.filter({ hasText: '1-я редакция' })).toHaveCount(1);
      await expect(badges.filter({ hasText: '2-я редакция' })).toHaveCount(1);
      await expect(badges.filter({ hasText: '5-я редакция' })).toHaveCount(1);

      await expectNoRawI18nKeys(page, 'dashboard (ru)');
      await screenshotPage(page, 'dashboard-ru.png');
    },
  );

  test('dashboard — гостевая демо-страница (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/');

    // Для гостя главная — это демо-лендинг (DemoLandingView в app/page.tsx).
    await expect(
      page.getByRole('heading', { name: 'Try Before You Commit' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Dungeons & Dragons · 5th Edition' }),
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
      page.getByRole('button', { name: 'Dungeons & Dragons · 5-я редакция' }),
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

  test(
    'dashboard — диалог импорта персонажа (en)',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context, { account: 'canonical', theme: 'light' });
      await openApp(page, '/');

      await page.getByRole('button', { name: /Import Character/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: /Import Character/i }),
      ).toBeVisible();
      await expect(dialog.locator('input[type="file"]')).toBeAttached();

      await screenshotPage(page, 'import-dialog-en.png');
    },
  );

  /**
   * Выбрать первый пункт открытого Select и дождаться сохранения. Названия
   * опций приходят из каталога редакции, поэтому тест не зависит от их
   * конкретных подписей — ему важен сам факт правки и записи.
   */
  async function pickFirstOption(page: Page, combobox: Locator): Promise<void> {
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/characters/'),
    );
    await combobox.click();
    await page.getByRole('option').first().click();
    await saved;
  }

  /**
   * ─── LANDMARK: IMPORT CREATION REVIEW ─────────────────────────────────
   * Импорт открывает лист в режиме проверки: creation-замки сняты,
   * «Зафиксировать» недоступна, пока пусты обязательные поля. После
   * фиксации замки возвращаются, перезагрузка их сохраняет, а обычный лист
   * баннера не показывает. Эталоны не снимаем.
   */
  test(
    'импорт — режим проверки выборов и фиксация (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `review-${Date.now()}`;
      const password = 'review-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Review',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      // Обычный лист: заполненный мир заперт и без импорта.
      const ordinaryResponse = await page.request.post('/api/characters', {
        data: {
          systemId: 'dh2',
          name: 'Ordinary Review',
          homeWorld: 'hive-world',
        },
      });
      expect([200, 201], 'создание обычного листа').toContain(
        ordinaryResponse.status(),
      );
      const ordinary = (await ordinaryResponse.json()) as { id: string };

      // Импортируемый лист: пол задан (замок должен сняться), обязательные
      // поля пусты.
      const importedResponse = await page.request.post('/api/characters', {
        data: { systemId: 'dh2', name: 'Imported Review', gender: 'male' },
      });
      expect([200, 201], 'создание импортируемого листа').toContain(
        importedResponse.status(),
      );
      const imported = (await importedResponse.json()) as {
        id: string;
        name: string;
      };

      const envelope = {
        metadata: {
          appName: 'DigitalCharsheets-qwen',
          format: 'dcs-export',
          version: '3.0',
          kind: 'character',
          exportDate: '2026-01-01T00:00:00.000Z',
          characterCount: 1,
        },
        character: imported,
      };

      await signInViaUI(page, { username, password });
      await openApp(page, '/');
      await page.getByRole('button', { name: /Import Character/i }).click();
      await page
        .getByRole('dialog')
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'review-dh2.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(envelope)),
        });

      await page.waitForURL(/\/character\/[^/]+$/, { timeout: 30_000 });
      const banner = page.getByTestId('creation-review-banner');
      await expect(banner).toBeVisible();
      const missing = banner.getByTestId('creation-review-missing');
      await expect(missing).toContainText('Home World');
      await expect(missing).toContainText('Background');
      await expect(missing).toContainText('Role');
      const confirm = banner.getByTestId('creation-review-confirm');
      await expect(confirm).toBeDisabled();

      const info = page.locator('#info-section:visible').first();
      await info.locator('[data-testid="edit-button"]:visible').first().click();

      // Пол был заполнен при создании: в проверке он не заперт, а показан
      // выбранным в Select.
      await expect(info.getByTestId('creation-lock')).toHaveCount(0);
      await expect(
        info.getByRole('combobox', { name: 'Gender' }),
      ).toContainText('Male');

      await pickFirstOption(
        page,
        info.getByRole('combobox', { name: 'Home World' }),
      );
      await expect(missing).not.toContainText('Home World');
      await pickFirstOption(
        page,
        info.getByRole('combobox', { name: 'Background' }),
      );
      await pickFirstOption(page, info.getByRole('combobox', { name: 'Role' }));

      await expect(missing).toHaveCount(0);
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(banner).toHaveCount(0);

      // Замки вернулись: мир, бэкграунд, роль и пол снова read-only.
      await expect(info.getByTestId('creation-lock')).toHaveCount(4);

      await page.reload();
      await expect(page.getByTestId('creation-review-banner')).toHaveCount(0);
      const reloaded = page.locator('#info-section:visible').first();
      await reloaded
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await expect(reloaded.getByTestId('creation-lock')).toHaveCount(4);
      await expect(
        reloaded.getByRole('combobox', { name: 'Home World' }),
      ).toHaveCount(0);

      // Обычный лист не попал в режим проверки.
      await openApp(page, `/character/${ordinary.id}`);
      await expect(page.getByTestId('creation-review-banner')).toHaveCount(0);
      const ordinaryInfo = page.locator('#info-section:visible').first();
      await ordinaryInfo
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await expect(ordinaryInfo.getByTestId('creation-lock')).toHaveCount(1);
      await expect(
        ordinaryInfo.getByRole('combobox', { name: 'Home World' }),
      ).toHaveCount(0);
    },
  );

  test(
    'пакетный импорт помечает режимом проверки каждый лист (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `review-batch-${Date.now()}`;
      const password = 'review-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Review Batch',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created: { id: string; name: string }[] = [];
      for (const name of ['Batch One', 'Batch Two']) {
        const response = await page.request.post('/api/characters', {
          data: { systemId: 'dh1', name },
        });
        expect([200, 201], `создание листа ${name}`).toContain(
          response.status(),
        );
        created.push((await response.json()) as { id: string; name: string });
      }

      const envelope = {
        metadata: {
          appName: 'DigitalCharsheets-qwen',
          format: 'dcs-export',
          version: '3.0',
          kind: 'backup',
          exportDate: '2026-01-01T00:00:00.000Z',
          characterCount: created.length,
          account: username,
        },
        characters: created,
      };

      await signInViaUI(page, { username, password });
      await openApp(page, '/');
      await page.getByRole('button', { name: /Import Character/i }).click();
      await page
        .getByRole('dialog')
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'review-batch.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(envelope)),
        });

      await page.waitForURL(/\/character\/[^/]+$/, { timeout: 30_000 });
      const openedId = page.url().split('/').pop();
      const banner = page.getByTestId('creation-review-banner');
      await expect(banner).toBeVisible();
      await expect(banner.getByTestId('creation-review-missing')).toContainText(
        'Home World',
      );
      await expect(
        banner.getByTestId('creation-review-confirm'),
      ).toBeDisabled();

      // Второй лист пакета тоже помечен: открываем его по имени.
      const other = created.find((item) => item.id !== openedId);
      expect(other, 'в пакете есть второй лист').toBeDefined();
      const list = (await (
        await page.request.get('/api/characters')
      ).json()) as { id: string; name: string }[];
      const originalIds = new Set(created.map((item) => item.id));
      const otherId = list.find(
        (item) => item.name === other!.name && !originalIds.has(item.id),
      )?.id;
      expect(otherId, 'второй лист создан').toBeTruthy();
      // Состояние проверки живёт в памяти вкладки, поэтому второй лист
      // открываем клиентской навигацией: полная загрузка его бы сбросила.
      await page.getByRole('link', { name: 'Back to Dashboard' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.locator(`a[href="/character/${otherId}"]`).click();
      await page.waitForURL((url) => url.pathname === `/character/${otherId}`);
      await expect(page.getByTestId('creation-review-banner')).toBeVisible();
    },
  );

  test(
    'импорт — баннер проверки на мобильном (en)',
    { tag: '@mobile' },
    async ({ page }) => {
      const username = `review-mobile-${Date.now()}`;
      const password = 'review-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Review Mobile',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh2', name: 'Mobile Review' },
      });
      const character = (await created.json()) as {
        id: string;
        name: string;
      };
      const envelope = {
        metadata: {
          appName: 'DigitalCharsheets-qwen',
          format: 'dcs-export',
          version: '3.0',
          kind: 'character',
          exportDate: '2026-01-01T00:00:00.000Z',
          characterCount: 1,
        },
        character,
      };

      await signInViaUI(page, { username, password });
      await openApp(page, '/');
      await page.getByRole('button', { name: /Import Character/i }).click();
      await page
        .getByRole('dialog')
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'review-mobile.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(envelope)),
        });

      await page.waitForURL(/\/character\/[^/]+$/, { timeout: 30_000 });
      const banner = page.getByTestId('creation-review-banner');
      await expect(banner).toBeVisible();
      await expect(
        banner.getByTestId('creation-review-confirm'),
      ).toBeDisabled();

      // Баннер в потоке и не шире экрана: на мобильном он не должен
      // выталкивать контент горизонтально.
      const box = await banner.boundingBox();
      const viewport = page.viewportSize();
      expect(box, 'баннер измеряется').toBeTruthy();
      expect(viewport).toBeTruthy();
      expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    },
  );

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

  test('new/manual — алиас /new (en)', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/new/manual');

    await expect(
      page.getByRole('heading', { name: 'Create New Character', level: 1 }),
    ).toBeVisible();
  });

  test('about — о проекте (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/about');

    await expect(
      page.getByRole('heading', { name: 'About this project' }),
    ).toBeVisible();

    // Входы в документацию: обе ссылки ниже первого экрана, поэтому проверяем
    // адреса, а не пиксели (эталон остаётся снимком верхней части страницы).
    await expect(
      page.getByRole('link', { name: 'Documentation', exact: true }),
    ).toHaveAttribute('href', '/docs');
    await expect(
      page.getByRole('link', { name: 'API reference', exact: true }),
    ).toHaveAttribute('href', '/api/docs');

    await screenshotPage(page, 'about-en.png');
  });

  test('about — о проекте (ru)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, language: 'ru' });
    await openApp(page, '/about');

    await expect(
      page.getByRole('heading', { name: 'О проекте' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Документация', exact: true }),
    ).toHaveAttribute('href', '/docs');
    await expect(
      page.getByRole('link', { name: 'Справочник API', exact: true }),
    ).toHaveAttribute('href', '/api/docs');
    await screenshotPage(page, 'about-ru.png');
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

  test(
    'stats-editor — число вне min/max ограничивается',
    { tag: '@fast' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/stats-editor');

      const row = page
        .locator('[data-testid^="bulk-row-"], [data-testid^="bulk-card-"]')
        .first();
      const input = row.locator('input[type="number"]').first();
      await input.fill('-5');
      await expect(input).toHaveValue('-5');
      await row.getByRole('button').last().click();

      // min=0 у характеристик: сохранение не должно записать -5.
      await expect(input).toHaveValue('0');
    },
  );
});

/**
 * Демо-лендинг и профиль пользователя.
 *
 * Гостевая главная и /demo используют общий компонент DemoLanding. Базовый
 * лендинг снимается один раз — на гостевой главной (dashboard-guest); превью
 * конкретных редакций живут в их плагинах (`demo.visual.spec.ts`).
 */
test.describe('демо и настройки профиля', () => {
  test('demo — лендинг (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/demo');

    await expect(
      page.getByRole('heading', { name: 'Try Before You Commit' }),
    ).toBeVisible();
    await expect(page.getByText('Create Your Own Character')).toBeVisible();
  });

  test('demo — превью персонажей (ru)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, language: 'ru' });
    await openApp(page, '/demo');

    await expect(
      page.getByRole('heading', { name: 'Попробуйте без регистрации' }),
    ).toBeVisible();
    await expect(page.getByText('Создайте своего персонажа')).toBeVisible();
  });

  test(
    'settings — профиль и отображение (en)',
    { tag: '@fast' },
    async ({ page, context }) => {
      // Логин виден на странице, поэтому снимаем под фиксированным
      // canonical-аккаунтом (у воркеров имена разные).
      await prepare(context, { account: 'canonical' });
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
    },
  );

  test('settings — профиль (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru', account: 'canonical' });
    await openApp(page, '/settings');

    await expect(
      page.getByRole('heading', { name: 'Настройки профиля' }),
    ).toBeVisible();
    await expect(page.getByText('Настройки отображения')).toBeVisible();
    await screenshotPage(page, 'settings-ru.png');
  });

  // ─── Danger Zone: удаление аккаунта ─────────────────────────────────────
  // Диалог ничего не удаляет: проверяем предупреждение, поле пароля и то, что
  // подтверждение заблокировано до ввода. Аккаунт остаётся жив для других тестов.
  test('settings — удаление аккаунта, предупреждение (en)', async ({
    page,
    context,
  }) => {
    await prepare(context, { account: 'canonical' });
    await openApp(page, '/settings');

    await page.getByTestId('delete-account-open').click();
    const dialog = page.getByTestId('delete-account-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Delete your account?' }),
    ).toBeVisible();
    await expect(
      dialog.getByText(/This action cannot be undone/i),
    ).toBeVisible();
    await expect(dialog.getByText(/service trash for 14 days/i)).toBeVisible();
    await expect(
      dialog.getByLabel('Confirm your password', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByTestId('delete-account-confirm')).toBeDisabled();

    await screenshotPage(page, 'settings-delete-account-en.png');
  });

  test('settings — удаление аккаунта, предупреждение (ru)', async ({
    page,
    context,
  }) => {
    await prepare(context, { language: 'ru', account: 'canonical' });
    await openApp(page, '/settings');

    await page.getByTestId('delete-account-open').click();
    const dialog = page.getByTestId('delete-account-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Удалить ваш аккаунт?' }),
    ).toBeVisible();
    await expect(dialog.getByText(/нельзя отменить/i)).toBeVisible();
    await expect(
      dialog.getByText(/служебную корзину на 14 дней/i),
    ).toBeVisible();
    await expect(
      dialog.getByLabel('Подтвердите пароль', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByTestId('delete-account-confirm')).toBeDisabled();

    await screenshotPage(page, 'settings-delete-account-ru.png');
  });
});

/**
 * Sandbox — единственная боевая игра без собственного visual-набора: её лист
 * виден только сотрудникам, поэтому шрифт проверяем под админом. Персонажа
 * создаём через API, чтобы не заводить фикстуру ради одного теста.
 */
test.describe('Sandbox — шрифт темы', () => {
  test(
    'заголовок карточки в Forum',
    { tag: '@desktop' },
    async ({ page, context }) => {
      // Отдельный админ: воркеру sandbox-лист запрещён, а общий админ
      // попал бы в снимки профильного меню с лишней карточкой.
      test.skip(!readSandboxAdminState(), 'нет второго админа для Sandbox');
      await prepare(context, { account: 'sandboxAdmin', theme: 'light' });
      const created = await page.request.post('/api/characters', {
        data: { systemId: 'sandbox', name: 'Sandbox Font' },
      });
      expect([200, 201], 'создание sandbox-листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      try {
        await openApp(page, sheetPath(id));
        await expectThemeFont(page, 'dhforum');
      } finally {
        await page.request.delete(`/api/characters/${id}`);
      }
    },
  );
});

/**
 * QR для TOTP: рамка, размер и цвет. Секрет показывается один раз, поэтому
 * снимок делается сразу после setup; дальше аккаунт удаляется вместе с
 * временными данными визуального прогона.
 */
test('settings — QR двухфакторной аутентификации (en)', async ({
  page,
  context,
}) => {
  await prepare(context, { authenticated: false });
  const account = await registerAccount(page, 'totp', 'TOTP Visual');
  await signInViaUI(page, account);
  await openApp(page, '/settings');

  // Секрет и QR генерируются на сервере заново; для эталона подменяем
  // ответ setup фиксированными значениями, иначе снимок меняется от запуска
  // к запуску. Стиль QR при этом настоящий — его рисует qrSvgDataUrl.
  const fixedUri =
    'otpauth://totp/Digital%20Character%20Sheets:visual%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Digital%20Character%20Sheets';
  await page.route('**/api/auth/totp/setup', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...body,
        secret: 'JBSWY3DPEHPK3PXP',
        qrDataUrl: qrSvgDataUrl(fixedUri),
      },
    });
  });

  await page.locator('#totp-password').fill(account.password);
  await page
    .getByRole('button', {
      name: 'Set up two-factor authentication',
      exact: true,
    })
    .click();

  const frame = page.getByTestId('totp-qr-frame');
  await expect(frame).toBeVisible();
  await frame.scrollIntoViewIfNeeded();
  await expectNoRawI18nKeys(page, 'QR TOTP (en)');
  await screenshotPage(page, 'settings-totp-qr-en.png');
});
