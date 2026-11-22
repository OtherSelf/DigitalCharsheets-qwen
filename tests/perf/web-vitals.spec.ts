import { expect, test } from '@playwright/test';

/**
 * @perf: web-vitals гостевых страниц и бюджет начальных чанков. Это не
 * скриншоты и не гейт verify — проверка клиентской скорости на живом
 * production-сервере (`npm run test:perf`).
 *
 * LCP/CLS снимаются PerformanceObserver'ом до навигации; first-input — после
 * первого клика/фокуса. Бюджеты намеренно с запасом: они ловят удвоение
 * бандла или регрессию на секунды, а не шум CI.
 */

const LCP_BUDGET_MS = 4000;
const CLS_BUDGET = 0.1;
const INPUT_BUDGET_MS = 500;
const CHUNK_BUDGET_BYTES = 5 * 1024 * 1024;

declare global {
  interface Window {
    __perf?: {
      lcp: number;
      cls: number;
      firstInput: number | null;
    };
  }
}

async function installObservers(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const perf = { lcp: 0, cls: 0, firstInput: null as number | null };
    window.__perf = perf;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.lcp = Math.max(perf.lcp, entry.startTime);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) perf.cls += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const event = entry as PerformanceEntry & {
          duration: number;
          processingStart?: number;
        };
        const delay =
          event.processingStart !== undefined
            ? event.processingStart - event.startTime + event.duration
            : event.duration;
        perf.firstInput = Math.max(perf.firstInput ?? 0, delay);
      }
    }).observe({ type: 'first-input', buffered: true });
  });
}

for (const path of ['/demo', '/login']) {
  test(`@perf ${path}: LCP/CLS/бандл в бюджете`, async ({ page }, testInfo) => {
    await installObservers(page);
    let chunks = 0;
    page.on('response', async (response) => {
      if (!/\/_next\/static\/chunks\/.*\.js/.test(response.url())) return;
      try {
        chunks += (await response.body()).byteLength;
      } catch {
        /* отменённая навигация */
      }
    });

    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const perf = await page.evaluate(() => window.__perf);
    const line = `LCP ${Math.round(perf?.lcp ?? 0)} ms, CLS ${(perf?.cls ?? 0).toFixed(3)}, JS ${(chunks / 1024).toFixed(0)} KiB`;
    testInfo.annotations.push({ type: 'web-vitals', description: line });
    console.log(`[perf] ${path}: ${line}`);

    expect(perf?.lcp ?? 0).toBeLessThan(LCP_BUDGET_MS);
    expect(perf?.cls ?? 0).toBeLessThan(CLS_BUDGET);
    expect(chunks).toBeLessThan(CHUNK_BUDGET_BYTES);
  });
}

test('@perf /login: первый ввод не блокирует дольше бюджета', async ({
  page,
}, testInfo) => {
  await installObservers(page);
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Любое пользовательское событие даёт first-input; Tab не уводит со страницы.
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);

  const perf = await page.evaluate(() => window.__perf);
  const line = `${Math.round(perf?.firstInput ?? 0)} ms`;
  testInfo.annotations.push({ type: 'first-input', description: line });
  console.log(`[perf] /login first-input: ${line}`);
  expect(perf?.firstInput ?? 0).toBeLessThan(INPUT_BUDGET_MS);
});
