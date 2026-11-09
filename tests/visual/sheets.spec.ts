import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
} from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Листы персонажей в режиме чтения (без нажатия Edit).
 *
 * У каждой системы есть уникальные экраны, которые проверяются отдельно:
 *   D&D: характеристики, спасброски, навыки, бой, атаки, инвентарь,
 *        настройка, заклинания, спутники, нарратив, инфо, божественные дары;
 *   DH:  инфо, прогрессия, характеристики, навыки, таланты, снаряжение,
 *        инвентарь.
 *
 * Desktop снимает элементы целиком, mobile — секции компактного сайдбара.
 */

test.describe('лист D&D — чтение', () => {
  test('desktop: верх, характеристики и бой (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    await expect(
      page.getByRole('heading', { name: 'Seraphina Vael' }),
    ).toBeVisible();
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
  });

  test('desktop: инвентарь, заклинания, спутники, нарратив (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

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
  });

  test('mobile: секции компактного сайдбара (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

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
    await expect(page.locator('#inventory-box:visible').first()).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-mobile-inventory-en.png');

    await openMobileSection(page, 'Spells', 'spells-section');
    await expect(
      page.locator('main').getByRole('heading', { name: 'Spell List' }),
    ).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-mobile-spells-en.png');

    await openMobileSection(page, 'Companions', 'companions-section');
    await expect(page.getByText('Ember')).toBeVisible();
    await screenshotPage(page, 'sheet-dnd-mobile-companions-en.png');
  });
});

test.describe('лист Dark Heresy — чтение', () => {
  test('desktop: верх, инфо, прогрессия, характеристики (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    await expect(
      page.getByRole('heading', { name: 'Lucius Varn' }),
    ).toBeVisible();
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
  });

  test('desktop: навыки, таланты, снаряжение, инвентарь (en)', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

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
  });

  test('mobile: секции компактного сайдбара (en)', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

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
  });
});
