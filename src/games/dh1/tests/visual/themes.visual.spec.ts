import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  prepare,
  screenshotPage,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/** Темы листа Dark Heresy 1e на desktop; dashboard остаётся host-сценарием. */
test.describe('темы листа Dark Heresy', { tag: '@plugin:dh1' }, () => {
  test(
    'лист DH — тёмная тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'dark' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-dark-en.png');
    },
  );

  test(
    'лист DH — тёплая тема (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { theme: 'warm' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-warm-en.png');
    },
  );
});
