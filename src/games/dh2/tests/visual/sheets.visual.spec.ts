import { expect, test } from '@playwright/test';

import {
  expectInputValue,
  expectNoRawI18nKeys,
  gameCharacterId,
  openApp,
  openDialog,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  startEditing,
  waitForScrollSettled,
} from '../../../../../tests/visual/helpers';

/**
 * Лист Dark Heresy 2-й редакции — собственные эталоны.
 *
 * Раньше 2e делила сегмент `dh` с 1-й редакцией: матрица покрытия считала их
 * одной игрой, поэтому снимков листа DH2 не было вовсе, и любая правка её
 * раскладки или темы (у 2e свой `ui.theme`) проходила незамеченной.
 * Теперь у редакции свой сегмент (`tests/visual.json#nameSegment: "dh2"`),
 * свой персонаж (`tests/fixtures/visual.ts`) и свои PNG.
 */
test.describe('лист Dark Heresy 2e — чтение', { tag: '@plugin:dh2' }, () => {
  test(
    'desktop: верх, инфо, прогрессия, характеристики (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      await expect(
        page.getByRole('heading', { name: 'Interrogator Vane' }),
      ).toBeVisible();
      await expectNoRawI18nKeys(page, 'лист DH2 (en)');
      await screenshotPage(page, 'sheet-dh2-top-en.png');

      await screenshotElement(
        page.locator('#info-section:visible').first(),
        'sheet-dh2-info-en.png',
      );
      await screenshotElement(
        page.locator('#progression-section:visible').first(),
        'sheet-dh2-progression-en.png',
      );
      // У 2e десять характеристик: Influence идёт десятой.
      const characteristics = page
        .locator('#characteristics-card:visible')
        .first();
      await screenshotElement(
        characteristics,
        'sheet-dh2-characteristics-en.png',
      );
    },
  );

  test(
    'desktop: навыки, таланты, снаряжение, инвентарь (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      await screenshotElement(
        page.locator('#skills-talents-panel:visible').first(),
        'sheet-dh2-skills-en.png',
      );
      await screenshotElement(
        page.locator('#skills-talents-panel:visible').first(),
        'sheet-dh2-talents-en.png',
      );
      await screenshotElement(
        page.locator('#equipment-section:visible').first(),
        'sheet-dh2-equipment-en.png',
      );
      await screenshotElement(
        page.locator('#inventory-section:visible').first(),
        'sheet-dh2-inventory-en.png',
      );
    },
  );

  test(
    'desktop: русский лист (ru)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      await expectNoRawI18nKeys(page, 'лист DH2 (ru)');
      await screenshotPage(page, 'sheet-dh2-top-ru.png');
      await screenshotElement(
        page.locator('#info-section:visible').first(),
        'sheet-dh2-info-ru.png',
      );
    },
  );

  test(
    'mobile: секции компактного сайдбара (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      await screenshotPage(page, 'sheet-dh2-mobile-info-en.png');

      await openMobileSection(page, 'Progression');
      await screenshotPage(page, 'sheet-dh2-mobile-progression-en.png');

      await openMobileSection(page, 'Skills');
      await screenshotPage(page, 'sheet-dh2-mobile-skills-en.png');

      await openMobileSection(page, 'Talents & Traits');
      await screenshotPage(page, 'sheet-dh2-mobile-talents-en.png');

      await openMobileSection(page, 'Equipment', 'equipment-section');
      await expect(
        page.locator('#equipment-section:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh2-mobile-equipment-en.png');

      await openMobileSection(page, 'Inventory', 'inventory-section');
      await expect(
        page.locator('#inventory-section:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dh2-mobile-inventory-en.png');
    },
  );
});

test.describe(
  'лист Dark Heresy 2e — редактирование',
  { tag: '@plugin:dh2' },
  () => {
    test(
      'desktop: инфо, прогрессия, характеристики, навыки (en)',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await page.setViewportSize({ width: 1920, height: 1600 });
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dh2')));

        const info = page.locator('#info-section:visible').first();
        await startEditing(info);
        await expectInputValue(info, 'Interrogator Vane');
        await screenshotElement(info, 'sheet-dh2-edit-info-en.png');

        const progression = page
          .locator('#progression-section:visible')
          .first();
        await startEditing(progression);
        await screenshotElement(
          progression,
          'sheet-dh2-edit-progression-en.png',
        );

        const characteristics = page
          .locator('#characteristics-card:visible')
          .first();
        await startEditing(characteristics);
        await expect(
          characteristics.locator('input[type="number"]'),
        ).toHaveCount(10);
        await screenshotElement(
          characteristics,
          'sheet-dh2-edit-characteristics-en.png',
        );

        const skills = page.locator('#skills-talents-panel:visible').first();
        await startEditing(skills);
        await screenshotElement(skills, 'sheet-dh2-edit-skills-en.png');
      },
    );

    test(
      'desktop: русское редактирование характеристик и навыков (ru)',
      { tag: '@desktop' },
      async ({ page, context }) => {
        await page.setViewportSize({ width: 1920, height: 1600 });
        await prepare(context, { language: 'ru' });
        await openApp(page, sheetPath(gameCharacterId('dh2')));

        const characteristics = page
          .locator('#characteristics-card:visible')
          .first();
        await startEditing(characteristics);
        await screenshotElement(
          characteristics,
          'sheet-dh2-edit-characteristics-ru.png',
        );

        const skills = page.locator('#skills-talents-panel:visible').first();
        await startEditing(skills);
        await screenshotElement(skills, 'sheet-dh2-edit-skills-ru.png');
      },
    );

    test(
      'mobile: характеристики и навыки (en)',
      { tag: '@mobile' },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dh2')));

        const characteristics = page.getByTestId('characteristics-compact');
        await startEditing(characteristics);
        await screenshotPage(
          page,
          'sheet-dh2-mobile-edit-characteristics-en.png',
        );

        await openMobileSection(page, 'Skills');
        // На мобильном навыки и таланты — один блок `#skills-talents-content`.
        const skills = page.locator('#skills-talents-content:visible').first();
        await startEditing(skills);
        await screenshotPage(page, 'sheet-dh2-mobile-edit-skills-en.png');
      },
    );
  },
);

/**
 * ─── LANDMARK: DH2 TABLET ─────────────────────────────────────────────────
 * Планшетная полоса 768–1299px — та, где у обеих редакций жили вёрстко-баги
 * (двухрядная шапка, «уезжание» меню). У 2e своя тема, поэтому её эталоны
 * должны быть отдельными: правка раскладки или токенов не должна проходить
 * незамеченной.
 */
test.describe('лист Dark Heresy 2e — планшет', { tag: '@plugin:dh2' }, () => {
  test(
    'tablet 1024x768: верх листа и компактный вид (en)',
    { tag: '@tablet' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      await expect(
        page.getByRole('heading', { name: 'Interrogator Vane' }),
      ).toBeVisible();
      // Шапка листа на планшете — одна строка (как и у host-эталона).
      const header = page.locator('header.app-header');
      expect(
        Math.round((await header.boundingBox())!.height),
        'шапка листа на планшете — одна строка',
      ).toBeLessThan(100);
      await screenshotPage(page, 'sheet-dh2-tablet-top-en.png');

      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true })
        .click();
      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(1);
      await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Inventory', exact: true })
        .click();
      await waitForScrollSettled(page);
      await expect(page.locator('#inventory-section:visible')).toHaveCount(1);
      await screenshotPage(page, 'sheet-dh2-tablet-compact-en.png');
      // Галочка внутри 10-пиксельного бокса не влезает и выглядит грязью:
      // на мобильном и планшете блок характеристик рисует только заливку
      // (`hideIndicator`). Проверяем структурно — порог пиксельного сравнения
      // такой мелкий дефект не видит.
      await expect(
        page
          .getByTestId('characteristics-compact')
          .locator('[role="checkbox"] svg'),
      ).toHaveCount(0);
    },
  );
});

test.describe('диалоги листа Dark Heresy 2e', { tag: '@plugin:dh2' }, () => {
  test(
    'desktop: заметки и домашние правила (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh2')));

      const notes = await openDialog(page, 'Notes', false);
      await screenshotElement(notes, 'dialog-dh2-notes-en.png');
      await page.keyboard.press('Escape');

      const rules = await openDialog(page, 'House Rules', false);
      await expect(
        rules.getByRole('heading', { name: 'House Rules' }),
      ).toBeVisible();
      await screenshotElement(rules, 'dialog-dh2-house-rules-en.png');
    },
  );
});
