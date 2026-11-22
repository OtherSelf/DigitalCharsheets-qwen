import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация @perf-проверок: web-vitals и бюджеты чанков. Запускается
 * `npm run test:perf`, который поднимает одноразовый production-сервер;
 * прямого `npx playwright test` без DCS_PERF_BASE_URL недостаточно.
 */
export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: 'test-results/perf',
  reporter: [['list']],
  use: {
    baseURL: process.env.DCS_PERF_BASE_URL || 'http://127.0.0.1:3000',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'off',
  },
  projects: [
    {
      name: 'perf-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
