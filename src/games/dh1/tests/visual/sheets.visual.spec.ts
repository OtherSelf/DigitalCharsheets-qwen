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

/**
 * ─── LANDMARK: HIT LOCATIONS ON NARROW SCREENS ────────────────────────────
 * Блок попаданий (схема 1d100 по частям тела) раньше был скрыт на <md.
 * Теперь на телефоне он живёт во вкладке «Информация», а на планшете
 * остаётся в правой колонке листа.
 */
test.describe(
  'локации попаданий на узких экранах',
  { tag: '@plugin:dh1' },
  () => {
    test(
      'мобильный и планшет показывают локации',
      { tag: '@mobile' },
      async ({ page, context }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dh')));

        await openMobileSection(page, 'Info', 'info-section');
        const info = page.locator('#info-section:visible').first();
        await expect(info.getByText('(1-10)')).toBeVisible();
        await expect(info.getByText('(86-00)')).toBeVisible();
        await expect(info.getByText('(31-70)')).toBeVisible();

        // Планшет: та же схема видна в правой колонке листа.
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(500);
        await expect(page.getByText('(1-10)').first()).toBeVisible();
        await expect(page.getByText('(86-00)').first()).toBeVisible();
      },
    );
  },
);

/**
 * ─── LANDMARK: CUSTOM RESOURCES IN ITEMS ──────────────────────────────────
 * «Пользовательские ресурсы» — счётчики, а не предметы (схема не менялась),
 * но игрок видит их внутри вкладки «Предметы», а не отдельной карточкой.
 */
test.describe(
  'пользовательские ресурсы внутри «Предметов»',
  { tag: '@plugin:dh1' },
  () => {
    test(
      'ресурсы рендерятся в инвентаре и только там',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dh')));

        const inventory = page.locator('#inventory-section:visible').first();
        await expect(
          inventory.getByText('Custom Resources', { exact: true }),
        ).toBeVisible();
        await expect(
          page
            .getByText('Custom Resources', { exact: true })
            .filter({ visible: true }),
        ).toHaveCount(1);
      },
    );
  },
);
