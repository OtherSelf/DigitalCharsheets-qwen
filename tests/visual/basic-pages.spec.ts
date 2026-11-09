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
test.describe('гостевая шапка (главная и /login)', () => {
  test('главная до входа: мобильный вид, тема и язык', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/');

    const header = page.getByTestId('guest-header');
    await expect(header).toBeVisible();
    await expect(
      header.getByRole('link', { name: 'Login / Register' }),
    ).toBeVisible();

    const compactToggle = header.getByTestId('guest-compact-toggle');
    if (isMobile()) {
      // На телефоне компактный вид включается сам — кнопки нет, как и в приложении.
      await expect(compactToggle).toHaveCount(0);
    } else {
      await expect(compactToggle).toBeVisible();
      await expect(compactToggle).toHaveAttribute(
        'aria-label',
        'Switch to Compact View',
      );
      await compactToggle.click();
      await expect(compactToggle).toHaveAttribute(
        'aria-label',
        'Switch to Default View',
      );
    }

    // Кнопка входа — самый правый элемент: её ширина не должна менять
    // положение иконок (вид, язык, тема) при смене языка.
    const themeToggle = header.getByRole('button', {
      name: /toggle theme|переключить тему/i,
    });
    const themeBoxBefore = await themeToggle.boundingBox();
    expect(themeBoxBefore, 'кнопка темы должна быть видна').not.toBeNull();

    // Язык переводит подпись кнопки входа и сам демо-лендинг.
    await header.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(
      header.getByRole('link', { name: 'Вход / Регистрация' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Попробуйте без регистрации' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Начать создание персонажа' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Предпросмотр персонажа D&D 5e' }),
    ).toBeVisible();

    const themeBoxAfter = await themeToggle.boundingBox();
    expect(themeBoxAfter, 'кнопка темы должна остаться видимой').not.toBeNull();
    expect(
      Math.abs(themeBoxAfter!.x - themeBoxBefore!.x),
      'иконки перед кнопкой входа не должны сдвигаться при смене языка',
    ).toBeLessThanOrEqual(1);

    // Тема переключается через то же меню, что и в приложении.
    await header.getByRole('button', { name: /переключить тему/i }).click();
    await page.getByRole('menuitem', { name: 'Темная' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await expectNoHorizontalOverflow(page);
  });

  test('гостевая главная и /demo: контент скроллится на мобильном', async ({
    page,
    context,
  }) => {
    test.skip(!isMobile(), 'мобильный сценарий: проверяем touch-скролл');

    await prepare(context, { authenticated: false });
    for (const path of ['/', '/demo']) {
      await openApp(page, path);

      const main = page.locator('main');
      const metrics = await main.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        const style = getComputedStyle(el);
        return {
          top: el.scrollTop,
          overflowY: style.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });

      expect(metrics.overflowY, `${path}: main — скролл-контейнер`).toMatch(
        /auto|scroll/,
      );
      expect(
        metrics.scrollHeight,
        `${path}: контент длиннее экрана`,
      ).toBeGreaterThan(metrics.clientHeight);
      expect(metrics.top, `${path}: main прокручивается`).toBeGreaterThan(0);
    }
  });

  test('login: шапка с видом/темой/языком и перевод формы', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/login');

    const header = page.getByTestId('guest-header');
    await expect(header).toBeVisible();
    // На самой /login кнопка «Вход / Регистрация» не нужна (бренд-ссылка — есть).
    await expect(
      header.getByRole('link', { name: 'Login / Register' }),
    ).toHaveCount(0);

    const compactToggle = header.getByTestId('guest-compact-toggle');
    if (isMobile()) {
      await expect(compactToggle).toHaveCount(0);
    } else {
      await expect(compactToggle).toBeVisible();
    }

    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );

    // EN → RU: вся карточка входа переводится.
    await header.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'С возвращением',
    );
    await expect(
      page.getByLabel('Логин или Email', { exact: true }),
    ).toBeVisible();

    // RU → EN.
    await header.getByRole('button', { name: 'RU', exact: true }).click();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );

    // Тема.
    await header.getByRole('button', { name: /toggle theme/i }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await expectNoHorizontalOverflow(page);
  });

  test('login: кнопка регистрации открывает отдельную форму', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/login');

    await expect(page.getByTestId('register-form')).toHaveCount(0);
    await page.getByTestId('open-register').click();

    const form = page.getByTestId('register-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Create Account',
    );
    await expect(
      form.getByLabel('Username or Email', { exact: true }),
    ).toBeVisible();
    await expect(
      form.getByLabel('Display Name', { exact: true }),
    ).toBeVisible();
    await expect(form.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(
      form.getByLabel('Recovery Phrase', { exact: true }),
    ).toBeVisible();

    // Назад ко входу — форма регистрации закрывается.
    await form.getByRole('button', { name: 'Back to login' }).click();
    await expect(page.getByTestId('register-form')).toHaveCount(0);
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );
  });

  test('login: из восстановления можно вернуться ко входу', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/login');

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Recover Account',
    );

    // Текстовая кнопка внизу формы (плюс иконка-стрелка в заголовке).
    const back = page.getByTestId('back-to-login');
    await expect(back).toBeVisible();
    await expect(back).toHaveText('Back to login');
    await back.click();

    await expect(page.getByTestId('auth-card-title')).toHaveText(
      'Welcome Back',
    );
    await expect(
      page.getByLabel('Username or Email', { exact: true }),
    ).toBeVisible();
  });
});

test.describe('адаптивность', () => {
  test('все страницы: нет JS-ошибок и горизонтального скролла', async ({
    page,
    context,
  }) => {
    await prepare(context);
    const errors = collectPageErrors(page);

    for (const path of [
      ...PAGES,
      `/${getState().dndId}`,
      `/${getState().dhId}`,
    ]) {
      await openApp(page, path);
      await expectNoHorizontalOverflow(page);

      // Вертикальный скролл живёт на <main> (html/body в layout-е
      // зафиксированы в 100dvh с overflow: hidden), поэтому он обязан быть
      // скролл-контейнером на каждой странице.
      const overflowY = await page
        .locator('main')
        .evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY, `${path}: main — скролл-контейнер`).toMatch(
        /auto|scroll/,
      );
    }

    expect(errors, 'uncaught JS-ошибки на страницах').toEqual([]);
  });

  test('все страницы (ru): нет JS-ошибок и горизонтального скролла', async ({
    page,
    context,
  }) => {
    await prepare(context, { language: 'ru' });
    const errors = collectPageErrors(page);

    for (const path of [
      ...PAGES,
      `/${getState().dndId}`,
      `/${getState().dhId}`,
    ]) {
      await openApp(page, path);
      await expectNoHorizontalOverflow(page);

      const overflowY = await page
        .locator('main')
        .evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY, `${path}: main — скролл-контейнер (ru)`).toMatch(
        /auto|scroll/,
      );
    }

    expect(errors, 'uncaught JS-ошибки на страницах (ru)').toEqual([]);
  });

  test('навигация дашборда: мобильная и десктопная', async ({
    page,
    context,
  }) => {
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

  test('единая шапка: бренд на дашборде и чистый /settings из меню', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    // После входа шапка не пустая: рядом с иконкой есть название приложения.
    const header = page.getByTestId('app-header');
    await expect(header).toBeVisible();
    await expect(
      header.getByRole('link', { name: 'Back to Dashboard' }),
    ).toContainText('Digital Character Sheets');

    // «Настройки» из меню профиля: возврат ведёт на дашборд, поэтому
    // ?from=%2F не нужен — URL остаётся чистым, шапка та же.
    await header.getByRole('button', { name: 'Open user menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/settings');
    expect(new URL(page.url()).search, 'без ?from для возврата на /').toBe('');

    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Profile Settings' }),
    ).toBeVisible();
  });

  test('шапка: на планшете инструменты листа слева, иконки справа', async ({
    page,
    context,
  }) => {
    test.skip(isMobile(), 'desktop/tablet-only сценарий');
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const header = page.locator('header.app-header');
    const sheetActions = header.locator('.header-sheet-actions');
    const viewActions = header.locator('.header-view-actions');
    const account = header.getByRole('button', { name: 'Open user menu' });

    const gaps = async () => {
      const [headerBox, sheetBox, viewBox, accountBox] = await Promise.all([
        header.boundingBox(),
        sheetActions.boundingBox(),
        viewActions.boundingBox(),
        account.boundingBox(),
      ]);
      return {
        left: Math.round(sheetBox!.x - headerBox!.x),
        right: Math.round(
          headerBox!.x + headerBox!.width - (accountBox!.x + accountBox!.width),
        ),
        separated: sheetBox!.x + sheetBox!.width < viewBox!.x,
      };
    };

    // 768..1299: на второй строке инструменты листа («Заметки», «Журнал»,
    // чекбоксы) стоят слева, а иконки вид/язык/тема/профиль — справа.
    for (const width of [1200, 1085, 900]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(async () => (await gaps()).left)
        .toBeLessThanOrEqual(24);
      await expect
        .poll(async () => (await gaps()).right)
        .toBeLessThanOrEqual(24);
      await expect.poll(async () => (await gaps()).separated).toBe(true);
      await expectNoHorizontalOverflow(page);
    }

    // Без персонажа (дашборд) шапка не разъезжается на две строки:
    // иконки остаются в правом верхнем углу.
    await openApp(page, '/');
    await page.setViewportSize({ width: 1085, height: 900 });
    const plainSheetActions = header.locator('.header-sheet-actions');
    const identity = header.locator('.header-identity');
    const actions = header.locator('.header-actions');
    await expect(plainSheetActions).toHaveCount(0);
    const rowOffset = async () => {
      const [identityBox, actionsBox] = await Promise.all([
        identity.boundingBox(),
        actions.boundingBox(),
      ]);
      return Math.round(
        Math.abs(
          identityBox!.y +
            identityBox!.height / 2 -
            (actionsBox!.y + actionsBox!.height / 2),
        ),
      );
    };
    await expect.poll(rowOffset).toBeLessThanOrEqual(8);
    await expect
      .poll(async () => {
        const [headerBox, accountBox] = await Promise.all([
          header.boundingBox(),
          account.boundingBox(),
        ]);
        return Math.round(
          headerBox!.x + headerBox!.width - (accountBox!.x + accountBox!.width),
        );
      })
      .toBeLessThanOrEqual(24);
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
      await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(
        0,
      );
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

  test('мобильные секции Dark Heresy: переключение', async ({
    page,
    context,
  }) => {
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
      await expect(
        page.getByRole('heading', { name: 'Seraphina Vael' }),
      ).toBeVisible();
      await expect(
        page.locator('#hit-points-card:visible').first(),
      ).toContainText('38');
      await expect(page.locator('#skills-card:visible').first()).toContainText(
        'Arcana',
      );
    } else {
      await openMobileSection(page, 'Combat Stats');
      await expect(
        page.locator('#hit-points-card:visible').first(),
      ).toContainText('38');
    }
  });

  test('Dark Heresy: ключевые значения на месте', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    await expectNoHorizontalOverflow(page);
    if (!isMobile()) {
      await expect(
        page.getByRole('heading', { name: 'Lucius Varn' }),
      ).toBeVisible();
      await expect(
        page.locator('#skills-talents-panel:visible').first(),
      ).toContainText('Scholastic Lore');
      await expect(
        page.locator('#skills-talents-panel:visible').first(),
      ).toContainText('Total Recall');
      await expect(
        page.locator('#equipment-section:visible').first(),
      ).toContainText('Cameleoline');
      await expect(
        page.locator('#inventory-section:visible').first(),
      ).toContainText('Data-slate');
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
