import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация визуальных (screenshot/regression) тестов.
 *
 * Запускается НЕ напрямую, а через `npm run test:visual` (scripts/visual.sh):
 * скрипт собирает приложение, поднимает `next start` на свободном порту с
 * временным DCS_DATA_DIR, кладёт в окружение DCS_VISUAL_BASE_URL и запускает
 * Playwright. Прямой `npx playwright test` тоже возможен, но тогда сервер
 * должен быть уже запущен и данные будут созданы в его каталоге data/.
 */

const { defaultBrowserType: _ignored, ...pixel7 } = devices['Pixel 7'];

const baseURL = process.env.DCS_VISUAL_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/visual',
  globalSetup: './tests/visual/global-setup.ts',
  globalTeardown: './tests/visual/global-teardown.ts',

  /*
    Воркеры. Визуальные тесты правят персонажей (редактирование секций,
    массовый редактор), поэтому параллельность безопасна только при
    изоляции данных: global-setup сеет отдельный аккаунт на каждый воркер
    (`tests/visual/state.ts`), и `getState()` выдаёт воркеру его персонажей.

    `fullyParallel: false` — внутри файла тесты идут последовательно (у них
    общий сценарий и общий аккаунт), а разные файлы Playwright раскладывает
    по воркерам сам. Так на 6 ядрах прогон идёт в ~2.5 раза быстрее, чем
    при `workers: 1`, а скриншоты остаются детерминированными.
    Переопределяется через DCS_VISUAL_WORKERS.
  */
  fullyParallel: false,
  workers: Number(process.env.DCS_VISUAL_WORKERS || 4),
  /*
    Повторы. Визуальные тесты в 4 воркера изредка флейкуют на «высоких»
    элементах (секция выше вьюпорта снимается за его пределами — положение
    в кадре зависит от scrollTop, см. screenshotElement). Два повтора
    убирают шум: настоящий дифф провалится все попытки, а случайный —
    пройдёт со второй.
  */
  retries: 2,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,

  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Анимации/переходы гасим, каретку убираем, снимаем в CSS-пикселях
      // (scale: 'css'), чтобы PNG не зависели от DPR устройства.
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.2,
      maxDiffPixelRatio: 0.002,
    },
  },

  // Путь без {platform}: эталоны должны сниматься в одном и том же окружении
  // (Linux/Docker), иначе шрифты и рендеринг отличаются.
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',

  outputDir: 'test-results/visual',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // Никаких «живых» курсоров и фокуса в кадре.
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      // Планшетные эталоны снимаются только в проекте `tablet`.
      testIgnore: /tablet\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      // Android/Chrome: настоящий мобильный вьюпорт, touch, isMobile.
      name: 'mobile',
      testIgnore: /tablet\.spec\.ts/,
      use: {
        ...pixel7,
        // Скриншоты и так в CSS-пикселях, но DPR важен для отрисовки.
        deviceScaleFactor: 2.625,
      },
    },
    {
      /*
        Планшетный вьюпорт (iPad-подобный 1024x768, без touch-эмуляции).
        Нужен потому, что полоса 768..1299px не имела пиксельного покрытия,
        а оба последних вёрстко-бага были именно там: двухрядная шапка и
        «уезжание» шапки/левого меню при масштабе интерфейса.

        `testMatch` ограничивает проект одним файлом: остальные спеки
        снимают свои эталоны только в desktop/mobile, иначе каждая из них
        породила бы третий набор PNG в новой ширине.
      */
      name: 'tablet',
      testMatch: /tablet\.spec\.ts/,
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
});
