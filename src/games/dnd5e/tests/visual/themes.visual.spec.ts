import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  prepare,
  screenshotPage,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * Темы листа D&D: тёмная и тёплая на desktop, тёмная и тёплая на мобильном.
 * Dashboard и переключатель темы остаются host-сценариями.
 */
test.describe('темы листа D&D', { tag: '@plugin:dnd5e' }, () => {
  test(
    'лист D&D — тёмная тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-dark-en.png');
    },
  );

  test(
    'лист D&D — тёплая тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-warm-en.png');
    },
  );

  test(
    'лист D&D — тёмная тема на мобильном (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await screenshotPage(page, 'sheet-dnd-mobile-dark-en.png');
    },
  );

  test(
    'лист D&D — тёплая тема на мобильном (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await screenshotPage(page, 'sheet-dnd-mobile-warm-en.png');
    },
  );
});
