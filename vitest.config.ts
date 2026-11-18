import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // Тест-кит лежит вне src, поэтому у него отдельный алиас (как в tsconfig).
      {
        find: '@tests',
        replacement: fileURLToPath(new URL('./tests', import.meta.url)),
      },
      // Тот же алиас, что в tsconfig.json ("@/*" -> "./src/*").
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    // Юнит-тесты гоняют серверные модули (fs, crypto, next/server), поэтому node.
    environment: 'node',
    // Хостовые тесты и тесты плагинов; тест-кит — в tests/support.
    include: ['tests/**/*.test.ts', 'src/games/*/tests/**/*.test.ts'],
    setupFiles: ['./tests/support/setup.ts'],
    // Файлы изолированы (по умолчанию isolate: true), каждый тест пишет
    // в свой временный DCS_DATA_DIR — реальный ./data не трогается.
    // 40 с, а не 20: plugin-slots динамически импортирует листы всех плагинов,
    // и под полной нагрузкой импорт выходит за 20 с (в одиночку — ~10 с).
    testTimeout: 40_000,
    hookTimeout: 20_000,
  },
});
