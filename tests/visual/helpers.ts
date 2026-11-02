import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readState, type VisualState } from './state';

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
}

export function getState(): VisualState {
  return readState();
}

/** Кладёт сессию/тему/язык в localStorage до выполнения скриптов страницы. */
export async function prepare(
  context: BrowserContext,
  options: PrepareOptions = {},
): Promise<void> {
  const { theme = 'light', language = 'en', authenticated = true } = options;
  const state = getState();

  await context.addInitScript(
    ({ user, theme, language, authenticated }) => {
      try {
        localStorage.setItem('theme', theme);
        localStorage.setItem('language', language);
        if (authenticated && user) {
          localStorage.setItem('digital_charsheets_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('digital_charsheets_user');
        }
      } catch {
        /* localStorage может быть недоступен до навигации — не критично */
      }
    },
    {
      user: { ...state.user, hasRecoveryPhrase: true },
      theme,
      language,
      authenticated,
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

/** Скриншот отдельного элемента (карточки/секции) целиком. */
export async function screenshotElement(
  locator: Locator,
  name: string,
): Promise<void> {
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
    .getByRole('button', { name: /Discard Changes|Сбросить изменения/ })
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
  expect(overflow, 'появился горизонтальный скролл страницы').toBeLessThanOrEqual(1);
}

/** Логин через реальную форму (проверяет UI-путь, а не только API). */
export async function signInViaUI(page: Page, state = getState()): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('e.g., your@email.com or username').fill(state.username);
  await page.locator('input[type="password"]').fill(state.password);
  await page.getByRole('button', { name: /sign up \/ log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/** Ошибки JS (uncaught exceptions) за время теста. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
