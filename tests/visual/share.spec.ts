import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  expectNoRawI18nKeys,
  getState,
  openApp,
  prepare,
  screenshotPage,
  sheetPath,
} from './helpers';
import { readGuestShare } from './state';

/**
 * Публичная гостевая ссылка: страница без логина, баннер read-only, ввод
 * закрыт, но свёртки и история живые; недействительный токен — один экран.
 * Диалог владельца снимается отдельно: у воркера уже есть активная ссылка.
 */
test.describe('гостевая ссылка', () => {
  test(
    'desktop: лист открыт без логина и не редактируется (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      const share = readGuestShare();
      test.skip(!share, 'нет DCS_VISUAL_DATA_DIR: ссылка не засеяна');

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.token}`);

      await expect(page.getByTestId('shared-read-only-banner')).toBeVisible();
      const sheet = page.getByTestId('shared-sheet');
      await expect(sheet).toBeVisible();
      await expect(page.getByTestId('shared-sheet-inert')).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await expect(page.getByTestId('share-button')).toHaveCount(0);
      await expect(page.getByTestId('shared-tab-history')).toHaveCount(0);

      // Ввод закрыт, но интерфейс живой: все видимые textarea read-only,
      // чекбоксы/переключатели disabled.
      const editableTextareas = await sheet
        .locator('textarea')
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (node) =>
                (node as HTMLElement).offsetParent !== null &&
                !(node as HTMLTextAreaElement).readOnly,
            ).length,
        );
      expect(editableTextareas, 'видимые textarea только для чтения').toBe(0);
      const enabledToggles = await page
        .locator('button[role="checkbox"]:not([disabled])')
        .count();
      expect(enabledToggles, 'переключатели данных выключены').toBe(0);

      await expectNoRawI18nKeys(page, 'гостевая ссылка (en)');
      await screenshotPage(page, 'share-sheet-en.png');

      // Сворачивание секции работает без inert (после снимка, чтобы не
      // менять его состояние).
      const companionsToggle = page
        .getByRole('button', { name: /Companions|Spell List/ })
        .first();
      await expect(
        companionsToggle,
        'на листе есть секция для сворачивания',
      ).toHaveCount(1);
      const before = await companionsToggle.getAttribute('data-state');
      await companionsToggle.click();
      await expect(companionsToggle).not.toHaveAttribute(
        'data-state',
        before ?? 'open',
      );
    },
  );

  test(
    'mobile: гостевая ссылка (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      const share = readGuestShare();
      test.skip(!share, 'нет DCS_VISUAL_DATA_DIR: ссылка не засеяна');

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.token}`);

      await expect(page.getByTestId('shared-read-only-banner')).toBeVisible();
      await expectNoRawI18nKeys(page, 'гостевая ссылка mobile (en)');
      await expectNoHorizontalOverflow(page);
      await screenshotPage(page, 'share-sheet-mobile-en.png');
    },
  );

  test(
    'mobile: гостевая ссылка DH — весь лист в одну колонку',
    { tag: '@mobile' },
    async ({ page, context }) => {
      const share = readGuestShare();
      test.skip(!share?.dhToken, 'нет DH-ссылки: данные не засеяны');

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.dhToken}`);

      await expect(page.getByTestId('shared-read-only-banner')).toBeVisible();
      await expectNoRawI18nKeys(page, 'гостевая ссылка DH mobile (en)');
      await expectNoHorizontalOverflow(page);

      // Внутренний скролл `main` — отдельная беда трёхпанельного DH-листа:
      // документ может быть в порядке, а панели всё равно шире окна.
      const mainOverflow = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) return null;
        return main.scrollWidth - main.clientWidth;
      });
      expect(mainOverflow, 'main найден').not.toBeNull();
      expect(
        mainOverflow!,
        'main не переполнен по горизонтали',
      ).toBeLessThanOrEqual(1);

      // На телефоне гость получает тот же компактный рейл, что и владелец:
      // одна секция и переключение, а не вся простыня сразу.
      const rail = page.locator('nav [data-section-id]').first();
      await expect(rail, 'компактный рейл гостя').toBeVisible();
      await expect(page.locator('#info-section')).toBeVisible();
      await rail.click();
      await expect(page.locator('#info-section')).toBeVisible();

      await screenshotPage(page, 'share-dh-mobile-en.png');
    },
  );

  test(
    'desktop: история в гостевой ссылке (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      const share = readGuestShare();
      test.skip(
        !share?.historyToken,
        'нет ссылки с историей: данные не засеяны',
      );

      await prepare(context, { authenticated: false, language: 'en' });
      await openApp(page, `/share/${share!.historyToken}`);

      await expect(page.getByTestId('shared-tab-history')).toBeVisible();
      await page.getByTestId('shared-tab-history').click();
      await expect(page.getByTestId('shared-history')).toBeVisible();
      await expect(page.getByTestId('history-session')).toHaveCount(2);
      await expect(page.getByTestId('history-clear')).toHaveCount(0);
      await expectNoRawI18nKeys(page, 'история гостевой ссылки (en)');
      await screenshotPage(page, 'share-sheet-history-en.png');
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
