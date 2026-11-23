#!/usr/bin/env node
/**
 * Opt-in smoke проверка внешнего стенда (dev/prod) через браузер.
 *
 * Не входит в `npm run verify`: стенд обновляется вручную, а тест требует
 * сеть и готовую учётную запись. Запуск:
 *
 *   DCS_STAND_URL=https://dcs-dev.thfree.space \
 *   DCS_STAND_LOGIN=qa-agent-... \
 *   DCS_STAND_PASSWORD=... \
 *   npm run test:stand
 *
 * Скрипт создаёт временного персонажа, проверяет вход, список, лист, архив,
 * историю и мобильную гостевую ссылку, затем убирает за собой. Пароль и
 * токены не печатаются.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

// Локальные браузеры/библиотеки — как в scripts/visual.sh.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const localBrowsers = path.join(APP_DIR, '.playwright-browsers');
  if (fs.existsSync(localBrowsers)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
  }
}
const chromiumLibs = [
  path.join(APP_DIR, '.chromium-deps/root/usr/lib/x86_64-linux-gnu'),
  path.join(APP_DIR, '.chromium-deps/root/lib/x86_64-linux-gnu'),
].filter((dir) => fs.existsSync(dir));
if (chromiumLibs.length > 0) {
  process.env.LD_LIBRARY_PATH = [...chromiumLibs, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(':');
}

const baseUrl = (process.env.DCS_STAND_URL || '').replace(/\/+$/, '');
const login = process.env.DCS_STAND_LOGIN || '';
const password = process.env.DCS_STAND_PASSWORD || '';

if (!baseUrl || !login || !password) {
  console.log(
    '[stand-smoke] пропущено: задайте DCS_STAND_URL, DCS_STAND_LOGIN, DCS_STAND_PASSWORD',
  );
  process.exit(0);
}

function fail(message) {
  console.error(`[stand-smoke] ✗ ${message}`);
  throw new Error(message);
}

function ok(message) {
  console.log(`[stand-smoke] ✓ ${message}`);
}

const { chromium } = await import('playwright');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
let characterId = '';

try {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-username').fill(login);
  await page.locator('#auth-password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
  await page.getByTestId('open-archive').waitFor({ timeout: 30_000 });
  ok('вход и дашборд');

  await page.goto(`${baseUrl}/archive`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('archive-page').waitFor({ timeout: 30_000 });
  ok('страница архива');

  const created = await context.request.post(`${baseUrl}/api/characters`, {
    data: {
      systemId: 'dnd5e',
      name: `Stand smoke ${new Date().toISOString()}`,
    },
  });
  if (![200, 201].includes(created.status())) {
    fail(`создание листа: HTTP ${created.status()}`);
  }
  characterId = (await created.json()).id;
  ok('временный лист создан');

  await page.goto(`${baseUrl}/character/${characterId}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('main').waitFor({ timeout: 30_000 });
  if ((await page.getByTestId('sheet-unavailable').count()) > 0) {
    fail('лист не отрисовался (sheet-unavailable)');
  }
  ok('лист персонажа');

  await page.goto(`${baseUrl}/character/${characterId}/history`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('history-page').waitFor({ timeout: 30_000 });
  ok('история изменений');

  const archived = await context.request.post(
    `${baseUrl}/api/characters/${characterId}/archive`,
  );
  if (archived.status() !== 200) {
    fail(`архивирование: HTTP ${archived.status()}`);
  }
  await page.goto(`${baseUrl}/archive`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`archive-item-${characterId}`).waitFor({
    timeout: 30_000,
  });
  ok('лист в архиве');

  const restored = await context.request.delete(
    `${baseUrl}/api/characters/${characterId}/archive`,
  );
  if (restored.status() !== 200) {
    fail(`возврат из архива: HTTP ${restored.status()}`);
  }
  ok('лист возвращён из архива');

  const share = await context.request.post(
    `${baseUrl}/api/characters/${characterId}/share`,
    { data: { expiresInDays: 7 } },
  );
  if (share.status() !== 201) {
    fail(`создание ссылки: HTTP ${share.status()}`);
  }
  const token = (await share.json()).token;

  const mobile = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${baseUrl}/share/${token}`, {
      waitUntil: 'domcontentloaded',
    });
    await mobilePage
      .getByRole('main')
      .getByTestId('shared-read-only-banner')
      .waitFor({ timeout: 30_000 });
    const rail = mobilePage.locator('nav [data-section-id]').first();
    await rail.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {
      // Ниже проверка даст понятную ошибку вместо таймаута Playwright.
    });
    if ((await rail.count()) === 0 || !(await rail.isVisible())) {
      fail('мобильный гостевой лист без компактного рейла');
    }
    ok('мобильный гостевой лист с рейлом');
  } finally {
    await mobile.close();
  }
} catch (error) {
  console.error(
    `[stand-smoke] ошибка: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  if (characterId) {
    // Убираем тестовый лист: DELETE — корзина, затем окончательная очистка.
    await context.request
      .delete(`${baseUrl}/api/characters/${characterId}`)
      .catch(() => undefined);
    await context.request
      .delete(`${baseUrl}/api/characters/trash/${characterId}`)
      .catch(() => undefined);
  }
  await browser.close();
}
