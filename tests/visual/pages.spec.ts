import { expect, test } from '@playwright/test';
import {
  collectPageErrors,
  getState,
  openApp,
  prepare,
  screenshotPage,
  signInViaUI,
} from './helpers';

/**
 * Общие (не зависящие от системы) страницы.
 *
 * Каждый эталон называется по схеме
 *   <страница>-[<игра>]-[<доп. поле>]-<язык>.png
 * поэтому в имени всегда видно и язык, и игру (если экран игровой).
 * Языки приложения: en и ru; /login локализован не полностью (тексты
 * захардкожены по-английски), поэтому для него снимается только en.
 */

const isMobile = () => test.info().project.name === 'mobile';

test.describe('общие страницы', () => {
  test('login — гостевая страница (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await expect(
      page.getByRole('heading', { name: 'Digital Character Sheets', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Welcome Back')).toBeVisible();

    await screenshotPage(page, 'login-en.png');
  });

  test('login — восстановление аккаунта (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await openApp(page, '/login');

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByText('Recover Account')).toBeVisible();
    await expect(page.getByText('Three words from your sheets')).toBeVisible();

    await screenshotPage(page, 'login-recovery-en.png');
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
    await expect(page.getByRole('button', { name: 'Create Character' })).toBeVisible();
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

  test('new/manual — параллельный маршрут создания (en)', async ({ page, context }) => {
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

    await expect(page.getByRole('heading', { name: 'Bulk Editor' })).toBeVisible();
    await expect(page.getByText('Seraphina Vael')).toBeVisible();

    await screenshotPage(page, 'stats-editor-en.png');
  });

  test('stats-editor — массовый редактор (ru)', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/stats-editor');

    await expect(page.getByRole('heading', { name: 'Массовый редактор' })).toBeVisible();

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
