import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

/** Демо-превью D&D на host-странице `/demo`; страница принадлежит хосту. */
test.describe('демо D&D', { tag: '@plugin:dnd5e' }, () => {
  test('demo — превью персонажа D&D (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/demo');

    await page
      .getByRole('button', { name: 'Dungeons & Dragons · 5th Edition' })
      .click();
    await expect(page.getByText('Demo Mode Active')).toBeVisible();
    await expect(page.getByText('Thorin Ironforge').first()).toBeVisible();
    await screenshotPage(page, 'demo-dnd-en.png');
  });
});
