import { expect, test } from '@playwright/test';

import { getState, openApp, prepare, screenshotPage } from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Темы и их сочетание с языком. Тёмная тема проверяется на дашборде и обоих
 * листах (en/ru), тёплая — на мобильных листах обеих систем.
 */
test.describe('темы', () => {
  test('dashboard — тёмная тема (en)', async ({ page, context }) => {
    await prepare(context, { theme: 'dark' });
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
    await screenshotPage(page, 'dashboard-dark-en.png');
  });

  test('dashboard — тёмная тема (ru)', async ({ page, context }) => {
    await prepare(context, { theme: 'dark', language: 'ru' });
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Существующие персонажи' }),
    ).toBeVisible();
    await screenshotPage(page, 'dashboard-dark-ru.png');
  });

  test('лист D&D — тёмная тема (en)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { theme: 'dark' });
    await openApp(page, `/${getState().dndId}`);

    await expect(
      page.getByRole('heading', { name: 'Seraphina Vael' }),
    ).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-dark-en.png');
  });

  test('лист DH — тёмная тема (en)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { theme: 'dark' });
    await openApp(page, `/${getState().dhId}`);

    await expect(
      page.getByRole('heading', { name: 'Lucius Varn' }),
    ).toBeVisible();
    await screenshotPage(page, 'sheet-dh-dark-en.png');
  });

  test('лист D&D — тёмная тема (ru)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { theme: 'dark', language: 'ru' });
    await openApp(page, `/${getState().dndId}`);

    await screenshotPage(page, 'sheet-dnd-dark-ru.png');
  });

  test('лист DH — тёмная тема (ru)', async ({ page, context }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context, { theme: 'dark', language: 'ru' });
    await openApp(page, `/${getState().dhId}`);

    await screenshotPage(page, 'sheet-dh-dark-ru.png');
  });

  test('лист D&D — тёмная тема на мобильном (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { theme: 'dark' });
    await openApp(page, `/${getState().dndId}`);

    await screenshotPage(page, 'sheet-dnd-mobile-dark-en.png');
  });

  test('лист DH — тёплая тема на мобильном (en)', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { theme: 'warm' });
    await openApp(page, `/${getState().dhId}`);

    await screenshotPage(page, 'sheet-dh-mobile-warm-en.png');
  });

  test('лист D&D — тёплая тема на мобильном (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context, { theme: 'warm' });
    await openApp(page, `/${getState().dndId}`);

    await screenshotPage(page, 'sheet-dnd-mobile-warm-en.png');
  });
});
