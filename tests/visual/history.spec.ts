import { expect, test } from '@playwright/test';

import {
  expectNoRawI18nKeys,
  getState,
  openApp,
  prepare,
  screenshotPage,
} from './helpers';

const historyUrl = (id: string) => `/character/${id}/history`;

/**
 * Экран истории изменений. История засеяна global-setup фиксированными
 * датами: две сессии, создание, статы, инвентарь и заметки. Очистка
 * проверяется отдельно и идёт последней, чтобы не ломать снимок таймлайна.
 */
test.describe('история изменений', () => {
  test(
    'desktop: таймлайн сессий (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, historyUrl(getState().dndId));

      await expect(page.getByTestId('history-page')).toBeVisible();
      await expect(page.getByTestId('history-session')).toHaveCount(2);
      await expect(page.getByTestId('history-change').first()).toBeVisible();
      await expect(page.getByText('Change history')).toBeVisible();
      await expectNoRawI18nKeys(page, 'история (en)');
      await screenshotPage(page, 'history-timeline-en.png');
    },
  );

  test(
    'mobile: таймлайн (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, historyUrl(getState().dndId));

      await expect(page.getByTestId('history-page')).toBeVisible();
      await expect(page.getByTestId('history-session')).toHaveCount(2);
      await expectNoRawI18nKeys(page, 'история mobile (en)');
      await screenshotPage(page, 'history-mobile-en.png');
    },
  );

  test(
    'desktop: пустая история после очистки (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      const state = getState();
      await prepare(context);
      const cleared = await context.request.delete(
        `/api/characters/${encodeURIComponent(state.dndId)}/history`,
      );
      expect(cleared.status()).toBe(200);

      await openApp(page, historyUrl(state.dndId));
      await expect(page.getByTestId('history-empty')).toBeVisible();
      await expectNoRawI18nKeys(page, 'пустая история (en)');
      await screenshotPage(page, 'history-empty-en.png');
    },
  );
});
