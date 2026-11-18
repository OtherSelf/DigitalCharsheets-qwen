import { expect, test } from '@playwright/test';

import {
  expectNoRawI18nKeys,
  gameCharacterId,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * Лист Dark Heresy 1-й редакции в режиме чтения (без нажатия Edit).
 *
 * Уникальные экраны DH: инфо, прогрессия, характеристики, навыки, таланты,
 * снаряжение, инвентарь.
 *
 * Desktop снимает элементы целиком, mobile — секции компактного сайдбара.
 */

test.describe('лист Dark Heresy — чтение', { tag: '@plugin:dh1' }, () => {
  test(
    'desktop: верх, инфо, прогрессия, характеристики (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await expectNoRawI18nKeys(page, 'лист Dark Heresy (en)');
      await screenshotPage(page, 'sheet-dh-top-en.png');

      await screenshotElement(
        page.locator('#info-section:visible').first(),
        'sheet-dh-info-en.png',
      );
      await screenshotElement(
        page.locator('#progression-section:visible').first(),
        'sheet-dh-progression-en.png',
      );
      await screenshotElement(
        page.locator('#characteristics-card:visible').first(),
        'sheet-dh-characteristics-en.png',
      );
    },
  );

  test(
    'desktop: навыки, таланты, снаряжение, инвентарь (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await screenshotElement(
        page.locator('#skills-talents-panel:visible').first(),
        'sheet-dh-skills-en.png',
      );
      await screenshotElement(
        page.locator('#skills-talents-content:visible').first(),
        'sheet-dh-talents-en.png',
      );
      await screenshotElement(
        page.locator('#equipment-section:visible').first(),
        'sheet-dh-equipment-en.png',
      );
      await screenshotElement(
        page.locator('#inventory-section:visible').first(),
        'sheet-dh-inventory-en.png',
      );
    },
  );

  test(
    'mobile: секции компактного сайдбара (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await screenshotPage(page, 'sheet-dh-mobile-info-en.png');

      await openMobileSection(page, 'Progression');
      await screenshotPage(page, 'sheet-dh-mobile-progression-en.png');

      await openMobileSection(page, 'Skills');
      await screenshotPage(page, 'sheet-dh-mobile-skills-en.png');

      await openMobileSection(page, 'Talents & Traits');
      await expect(page.getByText('Total Recall')).toBeVisible();
      await screenshotPage(page, 'sheet-dh-mobile-talents-en.png');

      await openMobileSection(page, 'Equipment', 'equipment-section');
      await expect(
        page.locator('#equipment-section:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-mobile-equipment-en.png');

      await openMobileSection(page, 'Inventory', 'inventory-section');
      await expect(
        page.locator('#inventory-section:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh-mobile-inventory-en.png');
    },
  );
});
