import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import {
  readAdminState,
  readCanonicalState,
  readState,
  type VisualState,
} from './state';

/**
 * Общие помощники визуальных тестов.
 *
 * Правила детерминизма:
 *   - тема и язык кладутся в localStorage ДО загрузки приложения (init script),
 *     поэтому next-themes не мигает и не зависит от prefers-color-scheme;
 *   - анимации/переходы гасятся CSS-инъекцией и опцией `animations: disabled`;
 *   - каретка и фокус убираются, мышь уводится в угол;
 *   - шрифты дожидаемся через document.fonts.ready.
 */

export const MOTION_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html, body, * { scroll-behavior: auto !important; }
`;

export interface PrepareOptions {
  theme?: 'light' | 'dark' | 'warm';
  language?: 'en' | 'ru';
  /** false — гость (например, страница /login). */
  authenticated?: boolean;
  /**
   * Каким аккаунтом входить:
   *   worker    — изолированный аккаунт текущего воркера (по умолчанию);
   *   canonical — фиксированный `visual-tests`, нужен только там, где логин
   *               виден на скриншоте (страница `/settings`);
   *   admin     — служебный администратор временного сервера для `/admin`
   *               (появляется только при запуске через scripts/visual.sh).
   */
  account?: 'worker' | 'canonical' | 'admin';
}

/** Аккаунт текущего воркера: у каждого воркера свои персонажи. */
export function getState(): VisualState {
  return readState(test.info().workerIndex);
}

/** Фиксированный аккаунт для снимков, где виден логин. */
export function getCanonicalState(): VisualState {
  return readCanonicalState();
}

/**
 * Кладёт сессию/тему/язык в localStorage до выполнения скриптов страницы.
 *
 * authenticated: false НЕ удаляет сессию на каждой навигации: init-скрипт
 * выполняется при каждой загрузке документа, и удаление «на всякий случай»
 * стирало бы её после реального логина через UI (см. creation.spec.ts).
 * Гостевые тесты и так стартуют в пустом browser context.
 */
export async function prepare(
  context: BrowserContext,
  options: PrepareOptions = {},
): Promise<void> {
  const {
    theme = 'light',
    language = 'en',
    authenticated = true,
    account = 'worker',
  } = options;
  const state =
    account === 'canonical'
      ? getCanonicalState()
      : account === 'admin'
        ? readAdminState()
        : getState();

  if (!state) {
    throw new Error(
      'prepare(account: "admin"): нет админского аккаунта в состоянии. ' +
        'Запускайте снимки через "npm run test:visual" (scripts/visual.sh ' +
        'поднимает временный сервер с data-dir).',
    );
  }

  // Сессия теперь httpOnly-cookie: localStorage-снимка недостаточно,
  // поэтому логинимся в cookie-jar контекста (он общий для страниц и
  // context.request).
  if (authenticated) {
    // Под параллельным прогоном (4 воркера) сервер иногда отвечает
    // медленнее — повторяем пару раз, чтобы флейк не валил весь тест.
    let lastStatus = 0;
    let lastBody = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await context.request.post('/api/auth', {
        data: { username: state.username, password: state.password },
      });
      if (response.ok()) {
        lastStatus = response.status();
        lastBody = '';
        break;
      }
      lastStatus = response.status();
      lastBody = await response.text();
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    if (lastBody) {
      throw new Error(
        `prepare(): не удалось войти аккаунтом ${state.username}: ` +
          `HTTP ${lastStatus} ${lastBody}`,
      );
    }
  }

  await context.addInitScript(
    ({ user, theme, language }) => {
      try {
        localStorage.setItem('theme', theme);
        localStorage.setItem('language', language);
        if (user) {
          localStorage.setItem('digital_charsheets_user', JSON.stringify(user));
        }
      } catch {
        /* localStorage может быть недоступен до навигации — не критично */
      }
    },
    {
      user: authenticated ? { ...state.user, hasRecoveryPhrase: true } : null,
      theme,
      language,
    },
  );
}

/** Открывает страницу и ждёт, пока приложение закончит первичную загрузку. */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: MOTION_CSS });

  // Loader — единственный .animate-spin на страницах; ждём его исчезновения.
  await page
    .locator('.animate-spin')
    .first()
    .waitFor({ state: 'detached', timeout: 10_000 })
    .catch(() => undefined);

  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
}

/** Убирает всё «живое» из кадра (фокус, hover, каретку). */
async function settle(page: Page, resetScroll = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((reset) => {
    if (reset) window.scrollTo(0, 0);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, resetScroll);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(120);
}

/** Скриншот всего вьюпорта (страница в приложении и так h-dvh). */
export async function screenshotPage(
  page: Page,
  name: string,
  options: { mask?: Locator[]; maxDiffPixelRatio?: number } = {},
): Promise<void> {
  await settle(page);
  await expect(page).toHaveScreenshot(name, {
    ...(options.mask ? { mask: options.mask } : {}),
    ...(options.maxDiffPixelRatio !== undefined
      ? { maxDiffPixelRatio: options.maxDiffPixelRatio }
      : {}),
  });
}

/**
 * Скриншот отдельного элемента (карточки/секции).
 *
 * Если элемент выше своего скролл-контейнера, снимать его «целиком» нельзя:
 * приложение живёт в фиксированной оболочке (`h-dvh` + `overflow: hidden`),
 * и Chromium дорисовывает область ниже вьюпорта недетерминированно — кадр
 * зависит от `scrollTop` и таймингов (именно это флакало при параллельном
 * прогоне). Для таких элементов привязываем верх к контейнеру и снимаем
 * видимую часть по `clip` — это ровно те же пиксели, но без «дорисовки».
 */
export async function screenshotElement(
  locator: Locator,
  name: string,
): Promise<void> {
  const page = locator.page();
  await locator.page().evaluate(() => document.fonts.ready);
  await locator.page().mouse.move(1, 1);

  const info = await locator.evaluate((el) => {
    const node = el as HTMLElement;
    const scroller = node.closest('main') as HTMLElement | null;
    const rect = node.getBoundingClientRect();
    const scrollerRect = scroller?.getBoundingClientRect();
    return {
      tall: !!scroller && node.offsetHeight > scroller.clientHeight,
      clip:
        scrollerRect && rect
          ? {
              x: Math.max(rect.left, scrollerRect.left),
              y: Math.max(rect.top, scrollerRect.top),
              width:
                Math.min(rect.right, scrollerRect.right) -
                Math.max(rect.left, scrollerRect.left),
              height:
                Math.min(rect.bottom, scrollerRect.bottom) -
                Math.max(rect.top, scrollerRect.top),
            }
          : null,
    };
  });

  if (info.tall && info.clip) {
    await locator.evaluate((el) => {
      const node = el as HTMLElement;
      const scroller = node.closest('main') as HTMLElement | null;
      if (!scroller) return;
      const top =
        node.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      scroller.scrollTo({ top });
    });
    await waitForScrollSettled(page);
    // Координаты берём ровно как у рамки элемента (без «подрезки» слева и
    // сверху), иначе сдвиг на пиксель округления меняет весь кадр.
    const clip = await locator.evaluate((el) => {
      const node = el as HTMLElement;
      const scroller = node.closest('main') as HTMLElement;
      const rect = node.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      // Округляем «наружу», как это делает элементный снимок Playwright:
      // дробная рамка иначе сдвигает кадр на пиксель и рвёт эталон.
      const x = Math.floor(rect.left);
      const y = Math.floor(rect.top);
      const bottom = Math.ceil(Math.min(rect.bottom, scrollerRect.bottom));
      return {
        x,
        y,
        width: Math.ceil(rect.right) - x,
        height: bottom - y,
      };
    });
    await expect(page).toHaveScreenshot(name, { clip });
    return;
  }

  await locator.scrollIntoViewIfNeeded();
  await locator.page().evaluate(() => document.fonts.ready);
  await locator.page().mouse.move(1, 1);
  await expect(locator).toHaveScreenshot(name);
}

/**
 * На мобильном нажимает кнопку секции в левом компактном сайдбаре.
 * sectionId — если у секции есть свой id, прокручиваем к ней (иначе к началу).
 */
export async function openMobileSection(
  page: Page,
  label: string,
  sectionId?: string,
): Promise<void> {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: label, exact: true })
    .click();
  await waitForScrollSettled(page);
  await page.evaluate((id) => {
    document.querySelector('main')?.scrollTo({ top: 0 });
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, sectionId ?? '');
  await waitForScrollSettled(page);
  await page.waitForTimeout(100);
}

/**
 * Открывает диалог из шапки (desktop) или из компактного сайдбара (mobile).
 * label — локализованный текст/aria-label кнопки.
 */
export async function openDialog(
  page: Page,
  label: string,
  mobile: boolean,
): Promise<Locator> {
  if (mobile) {
    await page
      .getByRole('navigation')
      .getByRole('button', { name: label, exact: true })
      .click();
  } else {
    await page
      .getByRole('banner')
      .getByRole('button', { name: label, exact: true })
      .click();
  }
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Если при переходе между секциями всплыл диалог «есть несохранённые
 * изменения», выбирает Discard (данные не меняются: тесты ничего не печатают).
 */
export async function discardUnsavedChanges(page: Page): Promise<void> {
  const dialog = page.getByRole('alertdialog');
  const visible = await dialog
    .waitFor({ state: 'visible', timeout: 1_500 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  await dialog
    .getByRole('button', {
      name: /Discard Changes|Сбросить изменения|Отменить изменения/,
    })
    .click();
  await expect(dialog).not.toBeVisible();
  await waitForScrollSettled(page);
  await page.waitForTimeout(100);
}

/** Ждёт, пока внутренний <main> перестанет плавно скроллиться. */
export async function waitForScrollSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const main = document.querySelector('main');
        if (!main) return resolve(true);
        let last = -1;
        let stable = 0;
        let frames = 0;
        const tick = () => {
          frames += 1;
          if (Math.abs(main.scrollTop - last) < 1) stable += 1;
          else {
            stable = 0;
            last = main.scrollTop;
          }
          if (stable >= 8 || frames > 180) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    undefined,
    { timeout: 10_000 },
  );
}

/** Проверяет, что страница не «разъехалась» по горизонтали. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
  });
  expect(
    overflow,
    'появился горизонтальный скролл страницы',
  ).toBeLessThanOrEqual(1);
}

/**
 * Логин через реальную форму (проверяет UI-путь, а не только API).
 * По умолчанию — seeded-аккаунт визуальных тестов, но можно передать любой
 * (см. tests/visual/creation.spec.ts, там аккаунт создаётся под тест).
 */
export async function signInViaUI(
  page: Page,
  state: Pick<VisualState, 'username' | 'password'> = getState(),
): Promise<void> {
  // Вход через UI дергает сервер; под параллельным прогоном запрос может
  // не дойти с первого раза (страница показывает «не удалось подключиться»).
  // Повторяем форму до трёх раз и, если не вышло, сообщаем HTTP-статус —
  // иначе тест падает таймаутом без причины.
  let lastStatus: number | string = '—';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page
      .getByLabel('Username or Email', { exact: true })
      .fill(state.username);
    await page.getByLabel('Password', { exact: true }).fill(state.password);

    const responsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/auth') &&
          response.request().method() === 'POST',
        { timeout: 30_000 },
      )
      .catch(() => null);

    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    const response = await responsePromise;
    lastStatus = response ? response.status() : 'нет ответа';

    const navigated = await page
      .waitForURL((url) => !url.pathname.startsWith('/login'), {
        timeout: 15_000,
      })
      .then(() => true)
      .catch(() => false);

    if (navigated) {
      await page.waitForLoadState('networkidle');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  throw new Error(
    `signInViaUI: не удалось войти аккаунтом ${state.username} после 3 попыток ` +
      `(последний ответ: ${lastStatus})`,
  );
}

/** Открывает на /login форму регистрации (кнопка под формой входа). */
export async function openRegisterForm(
  page: Page,
  options: { navigate?: boolean } = {},
): Promise<void> {
  if (options.navigate !== false) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  }
  await page.getByTestId('open-register').click();
  await expect(page.getByTestId('register-form')).toBeVisible();
}

/** Регистрация через UI (английские подписи по умолчанию). */
export async function registerViaUI(
  page: Page,
  account: {
    username: string;
    password: string;
    displayName: string;
    recoveryPhrase: string;
  },
): Promise<void> {
  await openRegisterForm(page);
  await page
    .getByLabel('Username or Email', { exact: true })
    .fill(account.username);
  await page
    .getByLabel('Display Name', { exact: true })
    .fill(account.displayName);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page
    .getByLabel('Recovery Phrase', { exact: true })
    .fill(account.recoveryPhrase);
  await page.getByRole('button', { name: 'Create Account & Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle');
}

/** Ошибки JS (uncaught exceptions) за время теста. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
