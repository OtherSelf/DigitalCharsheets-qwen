import { expect, test } from '@playwright/test';
import {
  collectPageErrors,
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openMobileSection,
  prepare,
} from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

const PAGES = [
  '/',
  '/new',
  '/new/manual',
  '/stats-editor',
  '/demo',
  '/settings',
] as const;

/**
 * Функционально-вёрсткие проверки (без эталонных PNG):
 *   - страницы открываются без JS-исключений и горизонтального скролла;
 *   - на мобильном есть компактный сайдбар и меню, на десктопе — нет;
 *   - ключевые блоки листа действительно видны.
 */
test.describe('адаптивность', () => {
  test('все страницы: нет JS-ошибок и горизонтального скролла', async ({
    page,
    context,
  }) => {
    await prepare(context);
    const errors = collectPageErrors(page);

    for (const path of [...PAGES, `/${getState().dndId}`, `/${getState().dhId}`]) {
      await openApp(page, path);
      await expectNoHorizontalOverflow(page);
    }

    expect(errors, 'uncaught JS-ошибки на страницах').toEqual([]);
  });

  test('все страницы (ru): нет JS-ошибок и горизонтального скролла', async ({
    page,
    context,
  }) => {
    await prepare(context, { language: 'ru' });
    const errors = collectPageErrors(page);

    for (const path of [...PAGES, `/${getState().dndId}`, `/${getState().dhId}`]) {
      await openApp(page, path);
      await expectNoHorizontalOverflow(page);
    }

    expect(errors, 'uncaught JS-ошибки на страницах (ru)').toEqual([]);
  });

  test('навигация дашборда: мобильная и десктопная', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');

    const menu = page.getByRole('button', { name: 'Open menu' });
    const backup = page.getByRole('button', { name: 'Backup All' });
    const compactToggle = page.getByRole('button', {
      name: /switch to (compact|default) view/i,
    });

    if (isMobile()) {
      await expect(menu).toBeVisible();
      await expect(backup).not.toBeVisible();
      // На телефоне кнопка переключения вида не нужна.
      await expect(compactToggle).not.toBeVisible();
    } else {
      await expect(menu).not.toBeVisible();
      await expect(backup).toBeVisible();
      await expect(compactToggle).toBeVisible();
    }
  });

  test('переключение языка EN ↔ RU', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Существующие персонажи' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'RU', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();
  });

  test('компактный сайдбар есть только на мобильном листе', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    const nav = page.getByRole('navigation');
    if (isMobile()) {
      await expect(nav).toBeVisible();
      // В шапке листа на телефоне нет кнопки меню — всё в сайдбаре.
      await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0);
    } else {
      await expect(nav).toHaveCount(0);
    }
  });

  test('мобильные секции D&D: переключение и отсутствие скролла', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    for (const [label, selector] of [
      ['Ability Scores', '#saving-throws-card'],
      ['Combat Stats', '#hit-points-card'],
      ['Inventory & Attunement', '#inventory-box'],
    ] as const) {
      await openMobileSection(page, label);
      await expect(page.locator(selector + ':visible').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('мобильные секции Dark Heresy: переключение', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    for (const [label, selector, sectionId] of [
      ['Skills', 'main', undefined],
      ['Talents & Traits', 'main', undefined],
      ['Equipment', '#equipment-section', 'equipment-section'],
      ['Inventory', '#inventory-section', 'inventory-section'],
    ] as const) {
      await openMobileSection(page, label, sectionId);
      await expect(page.locator(selector + ':visible').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('минимальный размер тач-целей в шапке', async ({ page, context }) => {
    test.skip(!isMobile(), 'mobile-only сценарий');
    await prepare(context);
    await openApp(page, '/');

    const targets = [
      page.getByRole('button', { name: 'Open menu' }),
      page.getByRole('button', { name: /toggle theme/i }),
      page.getByRole('button', { name: /^EN$/ }),
    ];

    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, 'кнопка должна иметь размер').not.toBeNull();
      expect(box!.width, 'ширина тач-цели').toBeGreaterThanOrEqual(32);
      expect(box!.height, 'высота тач-цели').toBeGreaterThanOrEqual(32);
    }
  });
});

/** Пара мелких проверок содержимого, которые не сводятся к пикселям. */
test.describe('содержимое листа', () => {
  test('D&D: ключевые значения на месте', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dndId}`);

    await expectNoHorizontalOverflow(page);
    if (!isMobile()) {
      await expect(page.getByRole('heading', { name: 'Seraphina Vael' })).toBeVisible();
      await expect(page.locator('#hit-points-card:visible').first()).toContainText('38');
      await expect(page.locator('#skills-card:visible').first()).toContainText('Arcana');
    } else {
      await openMobileSection(page, 'Combat Stats');
      await expect(page.locator('#hit-points-card:visible').first()).toContainText('38');
    }
  });

  test('Dark Heresy: ключевые значения на месте', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    await expectNoHorizontalOverflow(page);
    if (!isMobile()) {
      await expect(page.getByRole('heading', { name: 'Lucius Varn' })).toBeVisible();
      await expect(page.locator('#skills-talents-panel:visible').first()).toContainText('Scholastic Lore');
      await expect(page.locator('#skills-talents-panel:visible').first()).toContainText('Total Recall');
      await expect(page.locator('#equipment-section:visible').first()).toContainText('Cameleoline');
      await expect(page.locator('#inventory-section:visible').first()).toContainText('Data-slate');
      await expect(page.getByText('Mono-sword')).toBeVisible();
    } else {
      await openMobileSection(page, 'Talents & Traits');
      await expect(page.getByText('Total Recall')).toBeVisible();

      await openMobileSection(page, 'Equipment', 'equipment-section');
      await expect(page.getByText('Mono-sword')).toBeVisible();

      await openMobileSection(page, 'Inventory', 'inventory-section');
      await expect(page.getByText('Data-slate')).toBeVisible();
    }
  });
});

