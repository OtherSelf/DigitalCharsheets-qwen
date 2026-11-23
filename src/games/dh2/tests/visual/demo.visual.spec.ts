import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

/** Демо-превью DH2 на host-странице `/demo`; страница принадлежит хосту. */
test.describe('демо Dark Heresy 2e', { tag: '@plugin:dh2' }, () => {
  test('demo — превью персонажа DH2 (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/demo');

    await page
      .getByRole('button', { name: 'Dark Heresy · 2nd Edition' })
      .click();
    await expect(page.getByText('Interrogator Vane').first()).toBeVisible();
    await screenshotPage(page, 'demo-dh2-en.png');

    // 2e-лист с пси и элитными: блок аптитюд/пси в info-секции. Превью
    // перерисовывается после выбора редакции, поэтому скролл повторяем.
    const infoSection = page.locator('#info-section');
    await expect(infoSection).toBeVisible({ timeout: 15_000 });
    await expect(async () => {
      await infoSection.scrollIntoViewIfNeeded();
    }).toPass({ timeout: 15_000 });
    await screenshotPage(page, 'demo-dh2-info-en.png');
  });
});
