import { expect, test } from '@playwright/test';

import {
  expectNoRawI18nKeys,
  getState,
  openApp,
  prepare,
  screenshotPage,
  sheetPath,
} from './helpers';

/**
 * Публичная гостевая ссылка: страница без логина, баннер read-only, `inert`
 * на листе и единый экран для недействительного токена. Диалог владельца
 * снимается отдельно: у воркера уже есть активная ссылка из global-setup.
 */
test.describe('гостевая ссылка', () => {
  test(
    'desktop: лист открыт без логина и не редактируется (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      const share = getState().share;
      test.skip(!share, 'нет DCS_VISUAL_DATA_DIR: ссылка не засеяна');

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.token}`);

      await expect(page.getByTestId('shared-read-only-banner')).toBeVisible();
      await expect(page.getByTestId('shared-sheet-inert')).toHaveAttribute(
        'inert',
        '',
      );
      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await expect(page.getByTestId('share-button')).toHaveCount(0);
      await expectNoRawI18nKeys(page, 'гостевая ссылка (en)');
      await screenshotPage(page, 'share-sheet-en.png');
    },
  );

  test(
    'mobile: гостевая ссылка (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      const share = getState().share;
      test.skip(!share, 'нет DCS_VISUAL_DATA_DIR: ссылка не засеяна');

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.token}`);

      await expect(page.getByTestId('shared-read-only-banner')).toBeVisible();
      await expectNoRawI18nKeys(page, 'гостевая ссылка mobile (en)');
      await screenshotPage(page, 'share-sheet-mobile-en.png');
    },
  );

  test(
    'desktop: недействительная ссылка (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${'Z'.repeat(43)}`);

      await expect(page.getByTestId('shared-link-unavailable')).toBeVisible();
      await screenshotPage(page, 'share-invalid-en.png');
    },
  );

  test(
    'desktop: диалог владельца с активной ссылкой (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      const share = getState().share;
      test.skip(!share, 'нет DCS_VISUAL_DATA_DIR: ссылка не засеяна');

      await prepare(context);
      await openApp(page, sheetPath(getState().dndId));
      await page.getByTestId('share-button').click();

      await expect(page.getByTestId('share-dialog')).toBeVisible();
      await expect(page.getByTestId('share-revoke')).toBeVisible();
      await expect(page.getByText(/whole sheet/i)).toBeVisible();
      await expectNoRawI18nKeys(page, 'диалог гостевой ссылки (en)');
      await screenshotPage(page, 'share-dialog-active-en.png');
    },
  );
});
