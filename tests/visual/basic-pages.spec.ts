import { expect, test } from '@playwright/test';

import { dhCharacter, dndCharacter } from './fixtures';
import {
  collectPageErrors,
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openDialog,
  openMobileSection,
  prepare,
  signInViaUI,
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

  test(
    'гостевая главная и /demo: контент скроллится на мобильном',
    { tag: '@mobile' },
    async ({ page, context }) => {
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
    },
  );

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

  test(
    'шапка листа: одна строка на планшете и до 768px',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, `/${getState().dhId}`);

      const header = page.locator('header.app-header');
      const sheetActions = header.locator('.header-sheet-actions');
      const viewActions = header.locator('.header-view-actions');
      const account = header.getByRole('button', { name: 'Open user menu' });

      // После перехода инструментов листа на иконки группа занимает ~180px
      // (было 414–493px), поэтому шапка листа укладывается в ОДНУ строку
      // вплоть до 768px. Ниже 768px включается мобильный компактный вид,
      // где инструменты живут в сайдбаре. Раньше на 768..1299px шапка
      // переносилась на две строки и съедала 125–141px высоты.
      for (const width of [768, 800, 900, 1024, 1180, 1280, 1299]) {
        await page.setViewportSize({ width, height: 900 });

        // Одна строка: высота шапки без переноса (73/77/93 — зависит от
        // вертикальных паддингов md/lg/xl, но всегда < 100).
        await expect
          .poll(async () => Math.round((await header.boundingBox())!.height))
          .toBeLessThan(100);

        // Все три группы на одной линии.
        await expect
          .poll(async () => {
            const boxes = await Promise.all([
              header.locator('.header-identity').boundingBox(),
              sheetActions.boundingBox(),
              viewActions.boundingBox(),
            ]);
            const centers = boxes.map(
              (box) => box!.y + Math.round(box!.height / 2),
            );
            return Math.max(...centers) - Math.min(...centers);
          })
          .toBeLessThanOrEqual(8);

        // Инструменты листа и иконки приложения на месте, иконки — у правого края.
        await expect(sheetActions).toBeVisible();
        await expect(viewActions).toBeVisible();
        await expect
          .poll(async () =>
            Math.round(
              (await header.boundingBox())!.x +
                (await header.boundingBox())!.width -
                ((await account.boundingBox())!.x +
                  (await account.boundingBox())!.width),
            ),
          )
          .toBeLessThanOrEqual(24);

        // Страница целиком, шапка и скролл-контейнер — без горизонтального
        // «излишка»: это ловит и «уехал вбок корень», и контент шире вьюпорта.
        await expectNoHorizontalOverflow(page);
        const inner = await page.evaluate(() => {
          const header = document.querySelector('header.app-header')!;
          const main = document.querySelector('main')!;
          return {
            header: header.scrollWidth - header.clientWidth,
            main: main.scrollWidth - main.clientWidth,
          };
        });
        expect(
          inner.header,
          `${width}px: шапка не вылезает вбок`,
        ).toBeLessThanOrEqual(1);
        expect(
          inner.main,
          `${width}px: main не вылезает вбок`,
        ).toBeLessThanOrEqual(1);
      }

      // На 768..1023px имя персонажа ужимается, но не в точку: у него есть
      // title с полным именем, а с 1024px оно помещается целиком.
      await page.setViewportSize({ width: 768, height: 900 });
      const name = header.locator('.header-identity h2');
      await expect(name).toBeVisible();
      await expect
        .poll(async () => Math.round((await name.boundingBox())!.width))
        .toBeGreaterThanOrEqual(80);
      await expect(name).toHaveAttribute('title', 'Lucius Varn');
      await page.setViewportSize({ width: 1024, height: 900 });
      await expect
        .poll(async () => Math.round((await name.boundingBox())!.width))
        .toBeGreaterThanOrEqual(150);

      // Без персонажа (дашборд) шапка тоже одной строкой: инструментов листа
      // нет, иконки в правом верхнем углу.
      await openApp(page, '/');
      await page.setViewportSize({ width: 1085, height: 900 });
      await expect(sheetActions).toHaveCount(0);
      const rowOffset = async () => {
        const [identityBox, actionsBox] = await Promise.all([
          header.locator('.header-identity').boundingBox(),
          header.locator('.header-actions').boundingBox(),
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
        .poll(async () =>
          Math.round(
            (await header.boundingBox())!.x +
              (await header.boundingBox())!.width -
              ((await account.boundingBox())!.x +
                (await account.boundingBox())!.width),
          ),
        )
        .toBeLessThanOrEqual(24);
    },
  );

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

  test(
    'мобильные секции D&D: переключение и отсутствие скролла',
    { tag: '@mobile' },
    async ({ page, context }) => {
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
    },
  );

  test(
    'мобильные секции Dark Heresy: переключение',
    { tag: '@mobile' },
    async ({ page, context }) => {
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
    },
  );

  test(
    'минимальный размер тач-целей в шапке',
    { tag: '@mobile' },
    async ({ page, context }) => {
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
    },
  );

  test(
    'инструменты листа: иконки с подсказками и состоянием',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, `/${getState().dhId}`);

      const header = page.getByTestId('app-header');
      const notes = header.getByRole('button', { name: 'Notes', exact: true });
      const journal = header.getByRole('button', {
        name: 'Quest Journal',
        exact: true,
      });
      const notesToggle = header.getByRole('button', {
        name: 'Hide Notes',
        exact: true,
      });
      const editToggle = header.getByRole('button', {
        name: 'Edit Buttons',
        exact: true,
      });

      // Кнопки остались доступными по имени, хотя видимого текста больше нет:
      // на него опираются и openDialog(), и скриншот-тесты диалогов.
      for (const button of [notes, journal, notesToggle, editToggle]) {
        await expect(button).toBeVisible();
      }
      await expect(notes, 'у кнопки только иконка, без подписи').toHaveText('');

      // Подсказка при наведении — вместо убранной подписи.
      await notes.hover();
      await expect(page.getByRole('tooltip')).toHaveText('Notes');

      // Состояние тумблера живёт в aria-pressed, а не в видимом тексте.
      await expect(notesToggle).toHaveAttribute('aria-pressed', 'true');
      await notesToggle.click();
      const showNotes = header.getByRole('button', {
        name: 'Show Notes',
        exact: true,
      });
      await expect(showNotes).toHaveAttribute('aria-pressed', 'false');
      await showNotes.click();
      await expect(
        header.getByRole('button', { name: 'Hide Notes', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');

      // Иконочные кнопки не должны стать мельче тач-цели на планшете.
      for (const button of [notes, journal, notesToggle, editToggle]) {
        const box = await button.boundingBox();
        expect(box, 'кнопка должна иметь размер').not.toBeNull();
        expect(box!.width, 'ширина тач-цели').toBeGreaterThanOrEqual(32);
        expect(box!.height, 'высота тач-цели').toBeGreaterThanOrEqual(32);
      }
    },
  );

  test(
    'Display Settings: смена UI Scale на 80% не двигает корень',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, `/${getState().dhId}`);

      // Ровно путь пользователя: профиль → Display Settings → UI Scale 80%.
      // Пока диалог открыт, Radix ставит body.style.overflow = 'hidden'
      // инлайном и перебивает наш `overflow: clip`; если оболочка приложения
      // остаётся в потоке, у body появляется прокручиваемый «излишек»
      // (125dvh при 80%) и корень можно сдвинуть — тогда «уезжают» шапка
      // и левое меню. Оболочка вынесена из потока (position: fixed),
      // поэтому сдвигать нечего.
      await page.getByRole('button', { name: 'Open user menu' }).click();
      await page.getByRole('menuitem', { name: /Display Settings/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();

      const decrease = dialog.getByRole('button', {
        name: 'Decrease UI scale',
      });
      for (let i = 0; i < 2; i += 1) {
        await decrease.click();
        await page.waitForTimeout(200);
      }
      await expect(dialog).toContainText('80%');

      // Пока диалог открыт: body реально переключён на overflow: hidden.
      await expect
        .poll(async () =>
          page.evaluate(() => getComputedStyle(document.body).overflow),
        )
        .toBe('hidden');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await page.waitForTimeout(400);

      const state = async () =>
        page.evaluate(() => {
          const wrapper = document.querySelector(
            '[data-ui-scale-wrapper]',
          ) as HTMLElement;
          return {
            scale: getComputedStyle(document.documentElement)
              .getPropertyValue('--ui-scale')
              .trim(),
            rootTop: document.documentElement.scrollTop,
            rootLeft: document.documentElement.scrollLeft,
            bodyTop: document.body.scrollTop,
            bodyLeft: document.body.scrollLeft,
            wrapperTop: Math.round(wrapper.getBoundingClientRect().top),
            wrapperLeft: Math.round(wrapper.getBoundingClientRect().left),
            wrapperPosition: getComputedStyle(wrapper).position,
          };
        });

      const afterScale = await state();
      expect(afterScale.scale, 'масштаб применён').toBe('0.8');
      expect(afterScale.wrapperPosition, 'оболочка вне потока').toBe('fixed');
      expect(
        {
          rootTop: afterScale.rootTop,
          rootLeft: afterScale.rootLeft,
          bodyTop: afterScale.bodyTop,
          bodyLeft: afterScale.bodyLeft,
        },
        'после закрытия диалога корень на месте',
      ).toEqual({ rootTop: 0, rootLeft: 0, bodyTop: 0, bodyLeft: 0 });
      expect(afterScale.wrapperTop, 'оболочка не уехала вверх').toBe(0);
      expect(afterScale.wrapperLeft, 'оболочка не уехала вбок').toBe(0);

      // И переход между секциями при 80% тоже ничего не сдвигает.
      await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Inventory', exact: true })
        .click();
      await page.waitForTimeout(600);
      const afterSection = await state();
      expect(afterSection.scale).toBe('0.8');
      expect(
        {
          rootTop: afterSection.rootTop,
          rootLeft: afterSection.rootLeft,
          bodyTop: afterSection.bodyTop,
          bodyLeft: afterSection.bodyLeft,
        },
        'после смены секции корень на месте',
      ).toEqual({ rootTop: 0, rootLeft: 0, bodyTop: 0, bodyLeft: 0 });
      expect(afterSection.wrapperTop).toBe(0);
    },
  );

  test(
    'масштаб интерфейса ≠ 100%: корень не прокручивается',
    { tag: '@mobile' },
    async ({ page, context }) => {
      for (const scale of ['0.5', '0.8', '1.25', '1.5']) {
        await prepare(context);
        await context.addInitScript((value) => {
          try {
            localStorage.setItem('ui-scale', value);
          } catch {
            /* storage недоступен — не критично */
          }
        }, scale);
        await openApp(page, `/${getState().dhId}`);
        await page.waitForFunction(
          (value) =>
            getComputedStyle(document.documentElement)
              .getPropertyValue('--ui-scale')
              .trim() === value,
          scale,
        );

        const header = page.locator('header.app-header');
        const nav = page.getByRole('navigation');
        const before = {
          header: (await header.boundingBox())!.y,
          headerX: (await header.boundingBox())!.x,
          nav: (await nav.boundingBox())!.y,
        };

        // Переход между секциями — именно он вызывал scrollIntoView по корню.
        await nav
          .getByRole('button', { name: 'Inventory', exact: true })
          .click();
        await page.waitForTimeout(600);

        // UIScaleWrapper раскладывается в 1/scale раз больше вьюпорта,
        // поэтому body получает «лишнюю» высоту/ширину. overflow: clip
        // на html/body не даёт корню сдвинуться — иначе шапка и левое
        // меню уезжали вверх/вбок (баг «меню убегает»).
        const root = await page.evaluate(() => ({
          top: document.documentElement.scrollTop,
          left: document.documentElement.scrollLeft,
          bodyTop: document.body.scrollTop,
          bodyLeft: document.body.scrollLeft,
        }));
        expect(root, `масштаб ${scale}: корень остаётся на месте`).toEqual({
          top: 0,
          left: 0,
          bodyTop: 0,
          bodyLeft: 0,
        });
        expect(
          Math.abs((await header.boundingBox())!.y - before.header),
          `масштаб ${scale}: шапка на месте`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs((await nav.boundingBox())!.y - before.nav),
          `масштаб ${scale}: левое меню на месте`,
        ).toBeLessThanOrEqual(1);

        // `expectNoHorizontalOverflow` здесь не годится: при масштабе ≠ 100%
        // scrollWidth body намеренно больше вьюпорта (обёртка раскладывается
        // в 1/scale раз крупнее и масштабируется трансформом). Проверяем то,
        // что важно: «лишним» размером нельзя уехать ни вбок, ни вниз.
        await page.mouse.move(200, 300);
        await page.mouse.wheel(400, 0);
        await page.waitForTimeout(300);
        const shifted = await page.evaluate(() => ({
          root: document.documentElement.scrollLeft,
          body: document.body.scrollLeft,
        }));
        expect(shifted, 'горизонтально корень тоже не двигается').toEqual({
          root: 0,
          body: 0,
        });
        expect(
          Math.abs((await header.boundingBox())!.x - before.headerX),
          `масштаб ${scale}: шапка не сдвинулась вбок`,
        ).toBeLessThanOrEqual(1);

        // Оболочка масштабируется трансформом, поэтому её layout-размер
        // намеренно больше вьюпорта — проверяем ВИЗУАЛЬНЫЙ прямоугольник:
        // после масштаба он обязан совпадать с вьюпортом.
        const shell = await page.evaluate(() => {
          const rect = document
            .querySelector('[data-ui-scale-wrapper]')!
            .getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            w: window.innerWidth,
            h: window.innerHeight,
          };
        });
        expect(
          shell.left,
          `масштаб ${scale}: оболочка не уехала влево`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          shell.top,
          `масштаб ${scale}: оболочка не уехала вверх`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          shell.right - shell.w,
          `масштаб ${scale}: оболочка вписана по ширине`,
        ).toBeLessThanOrEqual(1);
        expect(
          shell.bottom - shell.h,
          `масштаб ${scale}: оболочка вписана по высоте`,
        ).toBeLessThanOrEqual(1);
      }
    },
  );
});

test(
  'планшетные ширины: нет горизонтального скролла',
  { tag: '@desktop' },
  async ({ page, context }) => {
    await prepare(context);

    // 768..1299 — «планшетная» полоса: здесь жили последние вёрстко-баги
    // (двухрядная шапка, «уезжание» левого меню), а пиксельного покрытия
    // у неё до сих пор не было.
    for (const width of [768, 1024, 1200]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        ...PAGES,
        `/${getState().dndId}`,
        `/${getState().dhId}`,
      ]) {
        await openApp(page, path);
        await expectNoHorizontalOverflow(page);
        const overflow = await page
          .locator('main')
          .evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(
          overflow,
          `${path} @${width}px: контент шире скролл-контейнера`,
        ).toBeLessThanOrEqual(1);
      }
    }
  },
);

test('нет дублей id на страницах', async ({ page, context }) => {
  await prepare(context);

  const duplicates = () =>
    page.evaluate(() => {
      const seen = new Map<string, number>();
      for (const el of document.querySelectorAll('[id]')) {
        seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
      }
      return [...seen.entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `${id} x${count}`);
    });

  // Дубли id ломают htmlFor/aria-* и селекторы `#...` в тестах.
  // Реальный пример: лист компаньона переиспользует секции персонажа
  // (`stats-card`, `hit-points-card`, ...) — поэтому копии получают
  // префикс `companion-`.
  for (const path of [
    '/',
    `/${getState().dndId}`,
    `/${getState().dhId}`,
    '/settings',
    '/stats-editor',
  ]) {
    await openApp(page, path);
    await page.waitForTimeout(300);
    expect(await duplicates(), `${path}: дубли id`).toEqual([]);
  }

  // И с открытым диалогом поверх листа (на телефоне он открывается из
  // компактного сайдбара, на десктопе — из шапки; helper умеет оба пути).
  await openApp(page, `/${getState().dhId}`);
  await openDialog(page, 'Notes', isMobile());
  await page.waitForTimeout(300);
  expect(await duplicates(), 'лист с открытым диалогом: дубли id').toEqual([]);
});

test(
  'клавиатура: иконочные инструменты листа работают с Enter',
  { tag: '@desktop' },
  async ({ page, context }) => {
    await prepare(context);
    await openApp(page, `/${getState().dhId}`);

    const header = page.getByTestId('app-header');
    const toggle = header.getByRole('button', {
      name: 'Hide Notes',
      exact: true,
    });
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');

    // Состояние переключается и доступно скринридеру.
    const switched = header.getByRole('button', {
      name: 'Show Notes',
      exact: true,
    });
    await expect(switched).toHaveAttribute('aria-pressed', 'false');
    await switched.focus();
    await page.keyboard.press(' ');
    await expect(
      header.getByRole('button', { name: 'Hide Notes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
);

test('фокус: Escape закрывает Display Settings и возвращает фокус', async ({
  page,
  context,
}) => {
  await prepare(context);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: /Display Settings/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();

  // Фокус-трап: Tab не должен уводить фокус из диалога.
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const active = document.activeElement;
      const dialogEl = document.querySelector('[role="dialog"]');
      return !!(active && dialogEl && dialogEl.contains(active));
    });
    expect(inside, `Tab #${i + 1}: фокус остаётся в диалоге`).toBe(true);
  }

  // Триггер (пункт меню) исчезает вместе с меню, поэтому фокус обязан
  // вернуться на кнопку профиля, а не «упасть» на body (см.
  // returnFocusRef в DisplaySettingsModal).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Open user menu' }),
  ).toBeFocused();
});

test(
  'длинное имя персонажа: шапка не ломается на 768/1024/1280',
  { tag: '@desktop' },
  async ({ page }) => {
    const LONG_NAME =
      'Александра-Мария фон дер Вельденштайн цу Штайнберг унд Ротенбург';

    // Отдельный аккаунт и персонаж: фикстуры визуальных тестов не трогаем,
    // иначе поехали бы эталоны дашборда.
    const username = `long-name-${Date.now()}`;
    const password = 'long-name-password-1';
    const registered = await page.request.post('/api/auth/register', {
      data: {
        username,
        password,
        displayName: 'Long Name',
        recoveryPhrase: 'amber cobalt lantern',
      },
    });
    expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

    const created = await page.request.post('/api/characters', {
      data: { ...dhCharacter, name: LONG_NAME },
    });
    expect([200, 201], 'создание персонажа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await page.context().clearCookies();
    await signInViaUI(page, { username, password });

    for (const width of [768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await openApp(page, `/${id}`);

      const header = page.locator('header.app-header');
      await expect
        .poll(async () => Math.round((await header.boundingBox())!.height))
        .toBeLessThan(100);
      const name = header.locator('.header-identity h2');
      await expect(name).toHaveAttribute('title', LONG_NAME);
      await expect
        .poll(async () => Math.round((await name.boundingBox())!.width))
        .toBeGreaterThanOrEqual(90);
      await expectNoHorizontalOverflow(page);
    }
  },
);

test.describe('вид листа: компактный и обычный', () => {
  test(
    'переключатель вида: компактный ↔ обычный',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, `/${getState().dhId}`);

      const toggle = page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true });

      // ── обычный вид ────────────────────────────────────────────────────
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(0);

      // ── включаем компактный ───────────────────────────────────────────
      await toggle.click();
      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(1);
      await expect(
        page
          .getByTestId('app-header')
          .getByRole('button', { name: 'Switch to Default View', exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // В компактном виде видна только активная секция.
      await expect(page.locator('#info-section:visible')).toHaveCount(1);
      await expect(page.locator('#inventory-section:visible')).toHaveCount(0);

      // Переключение секций из левого меню работает и в этом режиме.
      await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Inventory', exact: true })
        .click();
      await page.waitForTimeout(500);
      await expect(page.locator('#inventory-section:visible')).toHaveCount(1);
      await expect(page.locator('#info-section:visible')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      // ── возвращаемся в обычный ────────────────────────────────────────
      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Default View', exact: true })
        .click();
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.locator('.dh-sheet.is-compact')).toHaveCount(0);
      await expect(
        page
          .getByTestId('app-header')
          .getByRole('button', { name: 'Switch to Compact View', exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    },
  );

  test(
    'компактный вид на 1024px: без горизонтального скролла',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await page.setViewportSize({ width: 1024, height: 900 });
      await openApp(page, `/${getState().dndId}`);

      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true })
        .click();
      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(page.locator('.dnd-sheet.is-compact')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      const inner = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const nav = document.querySelector('nav')!;
        return {
          main: main.scrollWidth - main.clientWidth,
          nav: nav.scrollWidth - nav.clientWidth,
        };
      });
      expect(
        inner.main,
        'main не вылезает вбок в компактном виде',
      ).toBeLessThanOrEqual(1);
      expect(inner.nav, 'сайдбар не вылезает вбок').toBeLessThanOrEqual(1);
    },
  );

  test(
    'дубли id: компаньон со всеми секциями, обычный и компактный вид',
    { tag: '@desktop' },
    async ({ page }) => {
      // Отдельный аккаунт и персонаж: фикстуры и эталоны не затрагиваем.
      // У компаньона включены ВСЕ необязательные секции — именно они раньше
      // дублировали id (attunement-card, inventory-box, spells-section, ...).
      const username = `compact-dupes-${Date.now()}`;
      const password = 'compact-dupes-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Compact Dupes',
          recoveryPhrase: 'amber cobalt lantern',
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const companion = {
        ...dndCharacter.companions![0],
        showInventory: true,
        showSpells: true,
        showNarrative: true,
        showInfo: true,
        showProgression: true,
        showDivineBoons: true,
      };
      const created = await page.request.post('/api/characters', {
        data: {
          ...dndCharacter,
          name: 'Companion Dupes',
          companions: [companion],
        },
      });
      expect([200, 201], 'создание персонажа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      await page.context().clearCookies();
      await signInViaUI(page, { username, password });

      const duplicates = () =>
        page.evaluate(() => {
          const seen = new Map<string, number>();
          for (const el of document.querySelectorAll('[id]')) {
            seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
          }
          return [...seen.entries()]
            .filter(([, count]) => count > 1)
            .map(([dupId, count]) => `${dupId} x${count}`);
        });

      await openApp(page, `/${id}`);
      await page.waitForTimeout(600);
      expect(await duplicates(), 'обычный вид: дубли id').toEqual([]);

      // Все необязательные секции компаньона действительно отрисовались.
      for (const id_ of [
        'companion-attunement-card',
        'companion-inventory-box',
        'companion-spells-section',
        'companion-narrative-section',
        'companion-progression-section',
        'companion-character-info-card',
        'companion-divine-boons-section',
      ]) {
        await expect(page.locator(`#${id_}`), `${id_} отрисован`).toHaveCount(
          1,
        );
      }

      await page
        .getByTestId('app-header')
        .getByRole('button', { name: 'Switch to Compact View', exact: true })
        .click();
      await page.waitForTimeout(600);
      expect(await duplicates(), 'компактный вид: дубли id').toEqual([]);
    },
  );
});

test.describe('синхронизация между вкладками', () => {
  test('дашборд: персонаж из другой вкладки появляется без перезагрузки', async ({
    browser,
  }) => {
    // Отдельный аккаунт, чтобы не менять фикстуры и не влиять на эталоны
    // дашборда (файлы спеков идут параллельно).
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const username = `cross-tab-${Date.now()}`;
    const password = 'cross-tab-password-1';

    const registered = await page.request.post('/api/auth/register', {
      data: {
        username,
        password,
        displayName: 'Cross Tab',
        recoveryPhrase: 'amber cobalt lantern',
      },
    });
    expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

    // Приложение берёт профиль из localStorage (cookie — только для API),
    // поэтому кладём снимок пользователя до загрузки документа.
    const registeredBody = (await registered.json()) as {
      user?: Record<string, unknown>;
    };
    expect(registeredBody.user, 'сервер вернул пользователя').toBeTruthy();
    await context.addInitScript(
      (user) => {
        try {
          localStorage.setItem(
            'digital_charsheets_user',
            JSON.stringify({ ...user, hasRecoveryPhrase: true }),
          );
        } catch {
          /* storage может быть недоступен — не критично */
        }
      },
      registeredBody.user as Record<string, unknown>,
    );

    const first = await page.request.post('/api/characters', {
      data: { ...dhCharacter, name: 'First Tab Character' },
    });
    expect([200, 201], 'первый персонаж').toContain(first.status());
    const { id: firstId } = (await first.json()) as { id: string };

    await page.goto(`/${firstId}`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'First Tab Character' }),
    ).toBeVisible();

    // «Вторая вкладка» создаёт ещё одного персонажа — серверная запись.
    const second = await page.request.post('/api/characters', {
      data: { ...dhCharacter, name: 'Second Tab Character' },
    });
    expect([200, 201], 'персонаж из второй вкладки').toContain(second.status());

    // Переход на дашборд через интерфейс — SPA-навигация без перезагрузки
    // документа, ровно как в жизни.
    await page
      .getByTestId('app-header')
      .getByRole('link', { name: 'Back to Dashboard' })
      .click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(
      page.getByText('Second Tab Character'),
      'список обновился при возврате на дашборд',
    ).toBeVisible({ timeout: 10_000 });

    const navigations = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    expect(navigations, 'переход был SPA, без перезагрузки').toBe(1);

    // Второй сценарий: вкладка уже на дашборде, персонажа создали в другом
    // окне — возврат фокуса тоже обновляет список. Ждём, чтобы выйти за
    // антидребезг освежения (300 мс после предыдущей загрузки).
    await page.waitForTimeout(600);
    const third = await page.request.post('/api/characters', {
      data: { ...dhCharacter, name: 'Focus Refreshed Character' },
    });
    expect([200, 201], 'персонаж для проверки фокуса').toContain(
      third.status(),
    );
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(
      page.getByText('Focus Refreshed Character'),
      'список обновился по возврату фокуса',
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
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
