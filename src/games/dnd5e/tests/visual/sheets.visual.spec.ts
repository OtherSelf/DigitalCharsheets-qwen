import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  expectNoRawI18nKeys,
  expectThemeFont,
  gameCharacterId,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  waitForScrollSettled,
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

      await openMobileSection(page, 'Ability Scores', 'stats-section');
      await expect(
        page.locator('#saving-throws-card:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-stats-en.png');

      await openMobileSection(page, 'Combat Stats', 'combat-section');
      await expect(
        page.locator('#hit-points-card:visible').first(),
      ).toBeVisible();
      await screenshotPage(page, 'sheet-dnd-mobile-combat-en.png');

      await openMobileSection(
        page,
        'Inventory & Attunement',
        'inventory-section',
      );
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

  test(
    'mobile: Companions и вдохновение без наложения',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));
      await openMobileSection(page, 'Companions', 'companions-section');

      const heading = page.getByRole('heading', {
        name: 'Companions',
        exact: true,
      });
      const addButton = page.getByRole('button', { name: 'Add Companion' });
      await expect(heading).toBeVisible();
      await expect(addButton).toBeVisible();
      await expect(heading).toHaveText('Companions');

      const title = await heading.boundingBox();
      const button = await addButton.boundingBox();
      expect(title && button, 'заголовок и кнопка имеют размер').toBeTruthy();
      // Прямоугольники не пересекаются: либо по горизонтали, либо кнопка
      // перенесена на вторую строку и они разделены по вертикали.
      const separated =
        title!.x + title!.width <= button!.x + 1 ||
        button!.x + button!.width <= title!.x + 1 ||
        title!.y + title!.height <= button!.y + 1 ||
        button!.y + button!.height <= title!.y + 1;
      expect(
        separated,
        `заголовок ${JSON.stringify(title)} и кнопка ${JSON.stringify(button)} пересекаются`,
      ).toBe(true);

      const inspiration = page.getByRole('group', { name: 'Inspiration' });
      await expect(inspiration).toBeVisible();
      for (const action of ['Decrease', 'Increase']) {
        const target = inspiration.getByRole('button', { name: action });
        const box = await target.boundingBox();
        expect(box, `кнопка ${action} имеет размер`).not.toBeNull();
        expect(box!.width, `ширина ${action}`).toBeGreaterThanOrEqual(32);
        expect(box!.height, `высота ${action}`).toBeGreaterThanOrEqual(32);
      }

      // Усечённое имя обязано раскрываться подсказкой.
      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toHaveAttribute('title', 'Seraphina Vael');
    },
  );
});

/**
 * ─── LANDMARK: DND TABLET ─────────────────────────────────────────────────
 * Полоса 768..1299px — та, где у листов жили вёрстко-баги (двухрядная шапка,
 * «уезжание» меню при масштабе). Сценарий листа принадлежит игре, поэтому
 * эталоны планшета лежат здесь, а не в host-проекте `tablet`.
 */
test.describe('лист D&D — планшет', { tag: '@plugin:dnd5e' }, () => {
  test(
    'tablet 1024x768: верх листа и плотный вид (en)',
    { tag: '@tablet' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));

      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      const header = page.locator('header.app-header');
      expect(
        Math.round((await header.boundingBox())!.height),
        'шапка листа на планшете — одна строка',
      ).toBeLessThan(100);
      await expectNoHorizontalOverflow(page);
      await screenshotPage(page, 'sheet-dnd-tablet-top-en.png');

      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true })
        .click();
      await expect(page.locator('.dnd-sheet.is-compact')).toHaveCount(1);
      // Плотность не включает телефонную подачу: рейла и закреплённой полосы
      // характеристик нет, сетка остаётся планшетной двухколоночной.
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.getByTestId('compact-stats-bar')).toHaveCount(0);
      const columns = await page
        .locator('.dnd-sheet .sheet-main-grid')
        .evaluate(
          (element) =>
            getComputedStyle(element)
              .gridTemplateColumns.split(' ')
              .filter(Boolean).length,
        );
      expect(columns, 'плотный вид на планшете — две колонки').toBe(2);

      // Подводим карточку инвентаря к верху: эталон не зависит от скролла.
      await page.evaluate(() => {
        const main = document.querySelector('main');
        const card = document.getElementById('inventory-box');
        if (!main || !card) return;
        const top =
          card.getBoundingClientRect().top -
          main.getBoundingClientRect().top +
          main.scrollTop;
        main.scrollTo({ top });
      });
      await waitForScrollSettled(page);
      await expect(page.locator('#inventory-box:visible')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      await screenshotPage(page, 'sheet-dnd-tablet-compact-en.png');
    },
  );
});

/**
 * T2: Forum в титуле/заголовках и крупных числах, но не в лейблах.
 * Проверяем и `.font-headline`, и `.text-2xl`: если селектор сузили или
 * правило потерялось, тест падает до сравнения снимков.
 */
test.describe('лист D&D — шрифт темы', { tag: '@plugin:dnd5e' }, () => {
  const numberFamily = (page: import('@playwright/test').Page) =>
    page
      .locator('.text-2xl')
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);

  test(
    'desktop: Forum в en и ru',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));
      await expectThemeFont(page, 'dhforum');
      expect((await numberFamily(page)).toLowerCase()).toContain('dhforum');

      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dnd')));
      const { cyrillicLoaded } = await expectThemeFont(page, 'dhforum');
      expect(cyrillicLoaded, 'кириллическое подмножество загружено').toBe(true);
      expect((await numberFamily(page)).toLowerCase()).toContain('dhforum');
      await expectNoRawI18nKeys(page, 'лист D&D: шрифт (ru)');
    },
  );

  test(
    'mobile: Forum в заголовках',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dnd')));
      await expectThemeFont(page, 'dhforum');
    },
  );
});
