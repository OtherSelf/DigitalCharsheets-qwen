import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

/** Демо-превью DH1 на host-странице `/demo`; страница принадлежит хосту. */
test.describe('демо Dark Heresy', { tag: '@plugin:dh1' }, () => {
  test('demo — превью персонажа DH1 (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/demo');

    await page
      .getByRole('button', { name: 'Dark Heresy · 1st Edition' })
      .click();
    await expect(page.getByText('Demo Mode Active')).toBeVisible();
    await expect(page.getByText('Inquisitor Vane').first()).toBeVisible();
    await screenshotPage(page, 'demo-dh-en.png');
  });
});
