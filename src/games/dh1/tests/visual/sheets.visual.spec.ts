import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  expectNoRawI18nKeys,
  expectThemeFont,
  gameCharacterId,
  openApp,
  openDialog,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  waitForScrollSettled,
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

      await openMobileSection(page, 'Progression', 'progression-section');
      await screenshotPage(page, 'sheet-dh-mobile-progression-en.png');

      await openMobileSection(page, 'Skills', 'skills-section');
      await screenshotPage(page, 'sheet-dh-mobile-skills-en.png');

      await openMobileSection(page, 'Talents & Traits', 'talents-section');
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

        // Доспех — внизу вкладки «Информация», без отдельной вкладки.
        await openMobileSection(page, 'Info', 'info-section');
        const info = page.locator('#info-section:visible').first();
        await expect(info.getByText('(1-10)')).toBeVisible();
        await expect(info.getByText('(86-00)')).toBeVisible();
        await expect(info.getByText('(31-70)')).toBeVisible();

        // Блок локаций — отдельная карточка внутри вкладки, а не строка
        // внутри карточки «Информация»: эталон стережёт ширину и отступы.
        await screenshotElement(
          page.locator('[data-testid="armor-display"]:visible').first(),
          'sheet-dh-mobile-armor-en.png',
        );

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

/**
 * ─── LANDMARK: DH1 TABLET ─────────────────────────────────────────────────
 * Полоса 768..1299px — та, где жили оба последних вёрстко-бага листа
 * (двухрядная шапка и «уезжание» шапки/левого меню при масштабе интерфейса).
 * Сценарий листа принадлежит игре, поэтому эталоны планшета лежат здесь, а
 * не в host-проекте `tablet`.
 */
test.describe('лист Dark Heresy 1e — планшет', { tag: '@plugin:dh1' }, () => {
  test(
    'tablet 1024x768: верх листа и компактный вид в одну колонку (en)',
    { tag: '@tablet' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await screenshotPage(page, 'sheet-dh-tablet-top-en.png');

      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true })
        .click();
      await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(1);
      // Компакт на планшете — одна колонка без рейла: секции не прячутся,
      // закреплённой полосы нет, шрифт остаётся обычным.
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.getByTestId('characteristics-compact')).toHaveCount(0);
      const columns = await page
        .locator('.dh-sheet .sheet-info-grid')
        .evaluate(
          (element) =>
            getComputedStyle(element)
              .gridTemplateColumns.split(' ')
              .filter(Boolean).length,
        );
      expect(columns, 'компактный вид на планшете — одна колонка').toBe(1);
      // Рейла, который открывал секцию, больше нет: подводим её сами.
      await page.evaluate(() => {
        const main = document.querySelector('main');
        const section = document.getElementById('inventory-section');
        if (!main || !section) return;
        const top =
          section.getBoundingClientRect().top -
          main.getBoundingClientRect().top +
          main.scrollTop;
        main.scrollTo({ top });
      });
      await waitForScrollSettled(page);
      await expect(page.locator('#inventory-section:visible')).toHaveCount(1);
      await screenshotPage(page, 'sheet-dh-tablet-compact-en.png');
    },
  );

  test(
    'tablet 1024x768: диалог заметок (en)',
    { tag: '@tablet' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));
      const dialog = await openDialog(page, 'Notes', false);
      await expect(
        dialog.getByRole('heading', { name: 'Character Notes' }),
      ).toBeVisible();
      await screenshotElement(dialog, 'dialog-dh-tablet-notes-en.png');
    },
  );
});

/**
 * Шрифт темы DH1: заголовки идут Cormorant Garamond в обеих локалях.
 * Проверяем не только класс на обёртке, но и фактическое семейство дочернего
 * заголовка — CSS-модуль плагина должен победить утилиту `font-headline`.
 */
test.describe('лист Dark Heresy — шрифт темы', { tag: '@plugin:dh1' }, () => {
  test(
    'desktop: Cormorant Garamond в en и ru',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));
      await expectThemeFont(page, 'dhcormorant');

      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));
      const { cyrillicLoaded } = await expectThemeFont(page, 'dhcormorant');
      expect(cyrillicLoaded, 'кириллическое подмножество загружено').toBe(true);
      await expectNoRawI18nKeys(page, 'лист Dark Heresy: шрифт (ru)');
    },
  );

  test(
    'mobile: шрифт темы применяется',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));
      await expectThemeFont(page, 'dhcormorant');
    },
  );
});

test(
  'mobile: точки характеристик — зона нажатия 24x24',
  { tag: '@mobile' },
  async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(gameCharacterId('dh')));

    // Точка на вид остаётся 12 px, но бокс 24x24: проверяем не пиксели, а
    // попадание по краю увеличенной зоны — именно там раньше был промах.
    const dot = page
      .locator('[data-testid="characteristics-compact"] [role="checkbox"]')
      .first();
    await expect(dot).toHaveAttribute('aria-checked', 'false');
    const box = await dot.boundingBox();
    expect(box, 'точка характеристик имеет размер').not.toBeNull();
    expect(box!.width, 'ширина зоны').toBeGreaterThanOrEqual(24);
    expect(box!.height, 'высота зоны').toBeGreaterThanOrEqual(24);

    // 10 px от центра — внутри зоны, но далеко за пределами видимых 12 px.
    await page.mouse.click(
      box!.x + box!.width / 2 + 10,
      box!.y + box!.height / 2,
    );
    await expect(dot).toHaveAttribute('aria-checked', 'true');
  },
);

/**
 * ─── LANDMARK: DH1 TALENTS_GRID ────────────────────────────────────────────
 * Секция «Умения и таланты» живёт в панели, ширина которой меняется: рядом
 * стоит снаряжение, которое можно свернуть, а в компактном виде листа панель
 * занимает всю ширину. Сетка обязана идти по ширине ПАНЕЛИ (контейнерные
 * запросы), а не окна: иначе на планшете и в компакте карточки талантов
 * остаются одной узкой колонкой с пустотой справа.
 */
test.describe('DH1: сетка умений и талантов', { tag: '@plugin:dh1' }, () => {
  test(
    'узкая панель — одна колонка, свёрнутое снаряжение — две',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const talents = page.locator('#talents-section [class*="talents"]');
      await expect(talents).toHaveCount(1);
      const columnCount = () =>
        talents.evaluate(
          (element) =>
            getComputedStyle(element)
              .gridTemplateColumns.split(' ')
              .filter(Boolean).length,
        );

      expect(await columnCount(), 'узкая панель — одна колонка').toBe(1);

      // Таблица умений не должна уезжать в горизонтальный скролл внутри себя.
      const tableFits = await page.evaluate(() => {
        const table = document.querySelector<HTMLElement>(
          '#skills-section table',
        )!;
        return (
          table.offsetWidth <=
          (table.parentElement as HTMLElement).offsetWidth + 1
        );
      });
      expect(tableFits, 'таблица умений влезает в колонку').toBe(true);

      await page.getByTestId('collapse-equipment-panel').click();
      await expect.poll(columnCount, { timeout: 5_000 }).toBe(2);

      // Кадр — именно про таланты: подводим секцию к верху, иначе снимок
      // показывает верх листа и ничего не говорит о второй колонке.
      await page.evaluate(() => {
        const main = document.querySelector('main');
        const section = document.getElementById('talents-section');
        if (!main || !section) return;
        const top =
          section.getBoundingClientRect().top -
          main.getBoundingClientRect().top +
          main.scrollTop;
        main.scrollTo({ top });
      });
      await waitForScrollSettled(page);
      await screenshotPage(page, 'sheet-dh-talents-wide-en.png');
      await expectNoHorizontalOverflow(page);
    },
  );
});

test.describe('DH1: зарплата', { tag: '@plugin:dh1' }, () => {
  test(
    'кнопка прибавляет месячный доход к капиталу',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const inventory = page.locator('#inventory-section:visible').first();
      await expect(inventory.getByText('240', { exact: true })).toBeVisible();
      const salary = page.getByTestId('dh1-collect-salary');
      await expect(salary).toHaveText(/Collect salary/i);
      await salary.click();
      await expect(inventory.getByText('330', { exact: true })).toBeVisible();
    },
  );
});
