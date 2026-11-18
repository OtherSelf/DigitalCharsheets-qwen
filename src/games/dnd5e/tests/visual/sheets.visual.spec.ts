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
 * Лист D&D 5e в режиме чтения (без нажатия Edit).
 *
 * Система снимается отдельно от хоста: уникальные экраны D&D — характеристики,
 * спасброски, навыки, бой, атаки, инвентарь, настройка, заклинания, спутники,
 * нарратив, инфо, божественные дары.
 *
 * Desktop снимает элементы целиком, mobile — секции компактного сайдбара.
 */

test.describe('лист D&D — чтение', { tag: '@plugin:dnd5e' }, () => {
  test(
    'desktop: верх, характеристики и бой (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await expectNoRawI18nKeys(page, 'лист D&D (en)');
      await screenshotPage(page, 'sheet-dnd-top-en.png');

      await screenshotElement(
        page.locator('#character-info-card:visible').first(),
        'sheet-dnd-info-en.png',
      );
      await screenshotElement(
        page.locator('#stats-card:visible').first(),
        'sheet-dnd-stats-en.png',
      );
      await screenshotElement(
        page.locator('#saving-throws-card:visible').first(),
        'sheet-dnd-saves-en.png',
      );
      await screenshotElement(
        page.locator('#skills-card:visible').first(),
        'sheet-dnd-skills-en.png',
      );
      await screenshotElement(
        page.locator('#hit-points-card:visible').first(),
        'sheet-dnd-combat-en.png',
      );
      await screenshotElement(
        page.locator('#attacks-and-spellcasting-box:visible').first(),
        'sheet-dnd-attacks-en.png',
      );
      await screenshotElement(
        page.locator('#divine-boons-section:visible').first(),
        'sheet-dnd-divine-boons-en.png',
      );
    },
  );

  test(
    'desktop: инвентарь, заклинания, спутники, нарратив (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await screenshotElement(
        page.locator('#inventory-box:visible').first(),
        'sheet-dnd-inventory-en.png',
      );
      await screenshotElement(
        page.locator('#attunement-card:visible').first(),
        'sheet-dnd-attunement-en.png',
      );
      await screenshotElement(
        page.locator('#spells-section:visible').first(),
        'sheet-dnd-spells-en.png',
      );
      await screenshotElement(
        page.locator('#companions-section:visible').first(),
        'sheet-dnd-companions-en.png',
      );
      await expect(page.getByText('Ember')).toBeVisible();

      await screenshotElement(
        page.locator('#narrative-section:visible').first(),
        'sheet-dnd-narrative-en.png',
      );
      await expect(page.getByText('Arcane Recovery').first()).toBeVisible();
    },
  );

  test(
    'mobile: секции компактного сайдбара (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await screenshotPage(page, 'sheet-dnd-mobile-info-en.png');

      await openMobileSection(page, 'Ability Scores');
      await expect(
        page.locator('#saving-throws-card:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-stats-en.png');

      await openMobileSection(page, 'Combat Stats');
      await expect(
        page.locator('#hit-points-card:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-combat-en.png');

      await openMobileSection(page, 'Inventory & Attunement');
      await expect(
        page.locator('#inventory-box:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-inventory-en.png');

      await openMobileSection(page, 'Spells', 'spells-section');
      await expect(
        page.locator('main').getByRole('heading', { name: 'Spell List' }),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-spells-en.png');

      await openMobileSection(page, 'Companions', 'companions-section');
      await expect(page.getByText('Ember')).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-companions-en.png');
    },
  );
});
