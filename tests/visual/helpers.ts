import {
  expect,
  request,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { LANGUAGE_COOKIE, type Language } from '@/lib/language';

import { PRIVACY_VERSION } from '../../src/lib/legal/privacy';
import { TERMS_VERSION } from '../../src/lib/legal/terms';
import { SHEET_VIEW_COMPACT_KEY } from '../../src/lib/sheet-view';
import { VISUAL_RECOVERY_PHRASE } from './fixtures';
import {
  readAdminState,
  readCanonicalState,
  readSandboxAdminState,
  readState,
  type VisualState,
} from './state';

/**
 * Общие помощники визуальных тестов.
 *
 * Правила детерминизма:
 *   - язык кладётся в cookie (его читает root layout на сервере, поэтому
 *     первый кадр уже на нужном языке) и в localStorage — как зеркало для
 *     `storage`-событий и аварийной страницы;
 *   - тема кладётся в localStorage ДО загрузки приложения (init script),
 *     поэтому next-themes не мигает и не зависит от prefers-color-scheme;
 *   - анимации/переходы гасятся CSS-инъекцией и опцией `animations: disabled`;
 *   - каретка и фокус убираются, мышь уводится в угол;
 *   - шрифты дожидаемся через document.fonts.ready.
 */

/** Абсолютный адрес временного сервера: `context.addCookies` ждёт URL. */
export function servedUrl(path = '/'): string {
  const configured = test.info().project.use.baseURL;
  const base =
    typeof configured === 'string' && configured
      ? configured
      : process.env.DCS_VISUAL_BASE_URL || 'http://127.0.0.1:3000';
  return new URL(path, base).toString();
}

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
  language?: Language;
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
  account?: 'worker' | 'canonical' | 'admin' | 'sandboxAdmin';
  /**
   * `compact` — кладёт в storage предпочтение «плотный вид листа» до загрузки
   * страницы. Нужен снимкам плотного вида: клик по кнопке оставляет в кадре
   * всплывающую подсказку, а режим переживает перезагрузку.
   *
   * Пишем только `'1'` и никогда `'0'`: иначе init-скрипт стирал бы выбор
   * пользователя на каждом `reload()` и сценарий «включил и перезагрузил» было
   * бы невозможно проверить. Пустой context и так означает «обычный вид».
   */
  viewMode?: 'default' | 'compact';
}

/** Аккаунт текущего проекта и воркера: у каждой пары свои персонажи. */
export function getState(): VisualState {
  return readState(test.info().project.name, test.info().workerIndex);
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
    viewMode = 'default',
  } = options;
  const state =
    account === 'canonical'
      ? getCanonicalState()
      : account === 'admin'
        ? readAdminState()
        : account === 'sandboxAdmin'
          ? readSandboxAdminState()
          : getState();

  if (!state) {
    throw new Error(
      `prepare(account: "${account}"): нет аккаунта в состоянии. ` +
        'Запускайте снимки через "npm run test:visual" (scripts/visual.sh ' +
        'поднимает временный сервер с data-dir).',
    );
  }

  // Подпись сборки в подвале и в меню берётся из `/api/version`. Фикстура
  // подменяет только её: иначе каждый выпуск меняет эталоны, а диф одного
  // глифа проходит под порогом и эталон тихо врёт.
  // Ответ статический, без похода на сервер: `route.fetch()` под четырьмя
  // воркерами иногда падал с ECONNRESET и валил тест. `buildId` в фикстуре
  // нет — `BuildWatcher` в этом случае просто ждёт (`decideBuildAction` →
  // `wait`), а его собственный запрос идёт с `?t=`, мимо этого обработчика.
  await context.route('**/api/version', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: '0.0.0-test',
        commit: null,
        commitShort: '0000000',
        branch: 'test',
        buildDate: '2026-01-01T00:00:00.000Z',
        buildId: null,
      }),
    }),
  );

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

  /*
    Язык — cookie до первой навигации: root layout читает её на сервере, так
    что HTML и снимок совпадают с ожидаемым языком без клиентского
    переключения. Ставим после входа: вход переносит в cookie язык профиля, а
    у снимка язык задан сценарием — сценарий обязан победить.
  */
  await context.addCookies([
    { name: LANGUAGE_COOKIE, value: language, url: servedUrl() },
  ]);

  await context.addInitScript(
    ({ user, theme, language, viewKey, compact }) => {
      try {
        localStorage.setItem('theme', theme);
        localStorage.setItem('language', language);
        if (compact) localStorage.setItem(viewKey, '1');
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
      viewKey: SHEET_VIEW_COMPACT_KEY,
      compact: viewMode === 'compact',
    },
  );
}

/** Открывает страницу и ждёт, пока приложение закончит первичную загрузку. */
/**
 * URL листа персонажа: маршрут собирается в одном месте, чтобы переезд
 * (`/[id]` → `/character/[id]`) не правил каждый спек отдельно.
 */
export function sheetPath(characterId: string): string {
  return `/character/${encodeURIComponent(characterId)}`;
}

/** id листа из текущего URL: последний сегмент пути. */
export function sheetIdFromUrl(page: Page): string {
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean);
  return segments.pop() ?? '';
}

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

/**
 * Ждёт шрифт темы плагина: обёртка получила `data-font-ready` (ленивый чанк
 * загружен, класс навешен), затем — сами файлы шрифта. Только атрибута мало:
 * CSS с `@font-face` уже в документе, а woff2 ещё качается.
 */
export async function waitForFontReady(page: Page): Promise<void> {
  await page
    .locator('[data-font-ready]')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Проверка шрифта темы плагина: обёртка получила `data-font-ready`, первое
 * семейство заголовка содержит ожидаемый фрагмент (например `dhcormorant`),
 * и файл действительно загружен. Возвращает признак кириллического
 * подмножества для RU-проверок.
 */
export async function expectThemeFont(
  page: Page,
  family: string,
): Promise<{ family: string; cyrillicLoaded: boolean }> {
  await expect(page.locator('[data-font-ready]').first()).toBeAttached();
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const element = document.querySelector('.font-headline');
    const family = element ? getComputedStyle(element).fontFamily : '';
    const first = family.split(',')[0]?.trim().replace(/^"|"$/g, '') ?? '';
    return {
      family,
      first,
      firstLoaded: first ? document.fonts.check(`600 16px "${first}"`) : false,
      cyrillicLoaded: first
        ? document.fonts.check(`600 16px "${first}"`, 'Привет')
        : false,
    };
  });
  expect(result.first.toLowerCase()).toContain(family.toLowerCase());
  expect(result.firstLoaded, `font-family: ${result.family}`).toBe(true);
  return { family: result.family, cyrillicLoaded: result.cyrillicLoaded };
}

/**
 * Тема со шрифтом помечает обёртку `data-font-expected`; до снимка ждём и
 * `data-font-ready`, иначе часть кадров успевает сняться в хостовом шрифте.
 */
async function waitForThemeFont(page: Page): Promise<void> {
  if ((await page.locator('[data-font-expected]').count()) === 0) return;
  await page
    .locator('[data-font-ready]')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Убирает всё «живое» из кадра (фокус, hover, каретку). */
async function settle(page: Page, resetScroll = true): Promise<void> {
  await waitForThemeFont(page);
  await page.evaluate((reset) => {
    if (reset) window.scrollTo(0, 0);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, resetScroll);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(120);
}

/** Скриншот всего вьюпорта (страница в приложении и так h-dvh). */
/**
 * Сырые i18n-ключи в видимом тексте страницы (например `dh.rankScholar`).
 *
 * Проверка намеренно шире, чем скриншот: визуальный дифф прощает небольшие
 * изменения текста (порог по пикселям), а «сырой ключ» — это всегда баг,
 * даже если он занимает одну строку на карточке. Домены перечислены явно,
 * чтобы не ловить обычные сокращения/email в тексте.
 */
const RAW_I18N_KEY_RE =
  /\b(?:dh|dh1|dh2|dnd|dnd5e|common|games|auth|admin|io|settings|error)\.(?:[a-z][A-Za-z0-9_]*|data\.)/g;

export async function expectNoRawI18nKeys(
  page: Page,
  label = 'страница',
): Promise<void> {
  // Даём ленивым слотам/словарям догрузиться, чтобы проверка была не гонкой.
  await page.waitForTimeout(500);
  const text = await page.locator('body').innerText();
  const matches = [...new Set(text.match(RAW_I18N_KEY_RE) ?? [])];
  expect(
    matches,
    `${label}: в тексте остались сырые i18n-ключи: ${matches.join(', ')}`,
  ).toEqual([]);
}

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
  await waitForThemeFont(locator.page());
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
  await waitForThemeFont(locator.page());
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
  sectionId: string,
): Promise<void> {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: label, exact: true })
    .click();
  await waitForScrollSettled(page);
  // Скроллим ту же секцию, что выбрал пользователь, и тем же способом, что и
  // приложение: считаем смещение внутри `main` и делим на эффективный масштаб
  // (оболочка UI Scale живёт на `transform: scale()`). Сброс в начало
  // страницы здесь недопустим: кадр секции обязан содержать саму секцию.
  await page.evaluate((id) => {
    const scroller = document.querySelector('main');
    const element = document.getElementById(id);
    if (!scroller || !element) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const scale =
      scroller.clientHeight > 0
        ? scrollerRect.height / scroller.clientHeight
        : 1;
    const padding =
      Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
    const top =
      scroller.scrollTop +
      (element.getBoundingClientRect().top - scrollerRect.top) / (scale || 1) -
      padding;
    scroller.scrollTo({ top });
  }, sectionId);
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
    const main = document.querySelector('main');
    return {
      page: Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth,
      // Внутренний скролл `main` не виден в `scrollWidth` документа: лист
      // может переполняться внутри контейнера при «чистом» документе.
      // Намеренные скроллеры (таблица в `overflow-x-auto`) на `main` не
      // влияют — их содержимое остаётся внутри своего контейнера.
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(
    overflow.page,
    'появился горизонтальный скролл страницы',
  ).toBeLessThanOrEqual(1);
  expect(
    overflow.main,
    'появился горизонтальный скролл внутри main',
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
    await openApp(page, '/login');
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
    await openApp(page, '/login');
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
  await page.getByTestId('register-consent').click();
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

/**
 * ─── LANDMARK: PLUGIN VISUAL HELPERS ────────────────────────────────────────
 * Общий тест-кит игровых спеков: они лежат в `src/games/<id>/tests/visual` и
 * импортируют его относительным путём (`../../../../../tests/visual/helpers`),
 * потому что alias `@/*` в Playwright не работает. Игр здесь нет — только
 * шаги, одинаковые для любой редакции: id персонажа из состояния,
 * регистрация временного аккаунта, форма создания, режим правки.
 */

const VISUAL_PASSWORD = 'visual-pass-1234';

/**
 * id персонажа, посеянного из фикстуры игры (`src/games/<id>/tests/fixtures/
 * visual.ts`). Ошибка вместо тихого `undefined`: спека плагина без фикстуры —
 * это не «пропустим», а забытый файл.
 */
export function gameCharacterId(segment: string): string {
  const id = getState().characters[segment];
  if (!id) {
    throw new Error(
      `Нет посеянного персонажа "${segment}": у плагина нет ` +
        'tests/fixtures/visual.ts (или global-setup не нашёл файл).',
    );
  }
  return id;
}

export interface RegisteredAccount {
  username: string;
  password: string;
  uid: string;
}

/** Регистрирует уникальный аккаунт под тест (сессия остаётся в контексте). */
export async function registerAccount(
  page: Page,
  prefix: string,
  displayName: string,
): Promise<RegisteredAccount> {
  const username = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const auth = await page.request.post('/api/auth/register', {
    data: {
      username,
      password: VISUAL_PASSWORD,
      displayName,
      recoveryPhrase: VISUAL_RECOVERY_PHRASE,
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    },
  });
  expect(auth.status(), 'регистрация аккаунта через /api/auth/register').toBe(
    200,
  );
  const body = await auth.json();
  expect(body.success).toBe(true);
  expect(body.user.hasRecoveryPhrase, 'фраза задана при регистрации').toBe(
    true,
  );

  return {
    username,
    password: VISUAL_PASSWORD,
    uid: body.user.uid as string,
  };
}

/** Листы владельца сессионной cookie контекста. */
export async function fetchCharacters(page: Page): Promise<any[]> {
  // Владелец определяется сессионной cookie контекста.
  const res = await page.request.get('/api/characters');
  expect(res.status()).toBe(200);
  return (await res.json()) as any[];
}

/**
 * Шаблон сидированного листа игры для POST /api/characters.
 *
 * Хостовые спеки не импортируют игровые фикстуры: сценарию, которому
 * нужен «богатый» лист, достаточно взять его у seeded-аккаунта — global-setup
 * создал лист тем же шаблоном, поэтому данные (и пиксели) совпадают. Сегмент
 * игры (`dnd`, `dh`) — ключ `state.characters`.
 *
 * Читаем отдельным API-контекстом, а не `page.request`: хелпер можно звать до
 * регистрации временного аккаунта, и он не переключает сессию теста. Нет
 * листа/сегмента — сценарий пропускается: это фича конкретной игры, а не
 * хоста.
 */
export async function seededCharacterPayload(
  segment: string,
): Promise<Record<string, unknown>> {
  const state = getState();
  const seededId = state.characters[segment];
  if (!seededId) {
    test.skip(
      true,
      `нет сидированного листа "${segment}": игра не установлена или не имеет ` +
        'фикстуры tests/fixtures/visual.ts',
    );
    return {};
  }

  const api = await request.newContext({ baseURL: state.baseURL });
  try {
    const auth = await api.post('/api/auth', {
      data: { username: state.username, password: state.password },
    });
    expect(auth.status(), 'вход seeded-аккаунтом для чтения листа').toBe(200);

    const response = await api.get('/api/characters');
    expect(response.status(), 'чтение seeded-листов').toBe(200);
    const characters = (await response.json()) as Array<
      Record<string, unknown> & { id?: string }
    >;
    const character = characters.find((item) => item.id === seededId);
    if (!character) {
      test.skip(true, `сидированный лист "${segment}" (${seededId}) не найден`);
      return {};
    }

    // `id`/`userId` выдаёт сервер; `systemId` оставляем — по нему POST
    // выбирает редакцию, а в файл листа он всё равно не пишется.
    const { id: _id, userId: _userId, ...payload } = character;
    return payload;
  } finally {
    await api.dispose();
  }
}

/** Создаёт лист текущим (уже авторизованным) контекстом запросов. */
export async function createCharacterViaApi(
  page: Page,
  data: Record<string, unknown>,
): Promise<string> {
  const created = await page.request.post('/api/characters', { data });
  expect([200, 201], 'создание листа').toContain(created.status());
  const { id } = (await created.json()) as { id: string };
  return id;
}

/**
 * Временный аккаунт с одним листом для сценариев, которым нужна запись:
 * фикстуры воркеров остаются нетронутыми. Вход через UI уже выполнен.
 */
export async function seedTempAccountSheet(
  page: Page,
  systemId: string,
  values: Record<string, unknown> = {},
): Promise<string> {
  const username = `tmp-${systemId}-${Date.now()}`;
  const password = 'tmp-password-1';
  const registered = await page.request.post('/api/auth/register', {
    data: {
      username,
      password,
      displayName: `Temp ${systemId}`,
      recoveryPhrase: VISUAL_RECOVERY_PHRASE,
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    },
  });
  expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

  const id = await createCharacterViaApi(page, {
    systemId,
    name: `Temp ${systemId}`,
    ...values,
  });

  await signInViaUI(page, { username, password });
  return id;
}

/**
 * Путь реального пользователя: дашборд → «Create New Character» → игра →
 * редакция. id игры и редакции — те же, из которых собраны data-testid
 * манифеста (`create-game-<gameId>`, `create-edition-<plugin id>`).
 */
export async function openCreationForm(
  page: Page,
  game: string,
  edition: string,
): Promise<void> {
  await page.getByRole('link', { name: 'Create New Character' }).click();
  await page.waitForURL(/\/new$/, { timeout: 15_000 });

  await page.getByTestId(`create-game-${game}`).click();
  await page.getByTestId(`create-edition-${edition}`).click();

  await expect(
    page.getByRole('button', { name: 'Create Character' }),
  ).toBeVisible();
}

/** Дожидается редиректа на лист /<id> и возвращает id. */
export async function waitForSheetRedirect(page: Page): Promise<string> {
  await page.waitForURL((url) => !url.pathname.startsWith('/new'), {
    timeout: 30_000,
  });
  const id = sheetIdFromUrl(page);
  expect(id, 'после создания открывается лист /<id>').not.toBe('');
  return id;
}

/** Включает редактирование первой карточки секции. */
export async function startEditing(scope: Locator): Promise<void> {
  await scope.locator('[data-testid="edit-button"]:visible').first().click();
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/**
 * Включает редактирование сразу во всех карточках секции (например, у
 * заклинаний Edit есть у каждого уровня). Иначе поля Fireball/Shield
 * остались бы в режиме чтения.
 */
export async function startEditingAll(scope: Locator): Promise<void> {
  const buttons = scope.locator('[data-testid="edit-button"]:visible');
  for (let guard = 0; guard < 24; guard += 1) {
    if ((await buttons.count()) === 0) break;
    await buttons.first().click();
  }
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/** Проверяет, что среди input-полей секции есть поле с указанным значением. */
export async function expectInputValue(
  scope: Locator,
  value: string,
): Promise<void> {
  await expect
    .poll(() =>
      scope
        .locator('input')
        .evaluateAll(
          (inputs, expected) =>
            inputs.some(
              (input) => (input as HTMLInputElement).value === expected,
            ),
          value,
        ),
    )
    .toBe(true);
}

/** Открывает секцию «Прогрессия» (на мобильном — через компактную навигацию). */
export async function openProgressionSection(page: Page): Promise<Locator> {
  const progression = page.locator('#progression-section');
  if (!(await progression.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: 'Progression', exact: true })
      .click();
  }
  await expect(progression).toBeVisible();
  return progression;
}

export interface ExperienceAwardLabels {
  button: string;
  amount: string;
  what: string;
  confirm: string;
}

/** Начисление/штраф опыта через диалог; подписи зависят от редакции. */
export async function awardExperience(
  page: Page,
  amount: string,
  note: string,
  labels: ExperienceAwardLabels,
): Promise<void> {
  await page.getByRole('button', { name: labels.button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Пресет по умолчанию — 100, поле свободное.
  await expect(dialog.getByLabel(labels.amount)).toHaveValue('100');
  await dialog.getByLabel(labels.amount).fill(amount);
  await dialog.getByLabel(labels.what).fill(note);
  await dialog.getByRole('button', { name: labels.confirm }).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Свайп по открытой правой шторке через CDP touch-события (Chromium).
 * Обычные `page.mouse` не дают `pointerType: 'touch'`, поэтому жест не
 * включился бы. Между шагами есть пауза: короткий свайп не должен набирать
 * скорость выше порога закрытия.
 */
export async function swipeSheet(
  page: Page,
  options: {
    direction?: 'right' | 'left';
    distance?: number;
    steps?: number;
  } = {},
): Promise<void> {
  const { direction = 'right', distance = 220, steps = 6 } = options;
  const dialog = page.getByRole('dialog').first();
  const box = await dialog.boundingBox();
  if (!box) throw new Error('swipeSheet: шторка не найдена');

  const fromX = direction === 'right' ? box.x + 24 : box.x + box.width - 24;
  const toX = fromX + (direction === 'right' ? distance : -distance);
  const y = box.y + box.height / 2;

  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: fromX, y }],
    });
    for (let step = 1; step <= steps; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: fromX + ((toX - fromX) * step) / steps, y }],
      });
      await page.waitForTimeout(20);
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
}
