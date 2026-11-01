import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Тот же алиас, что в tsconfig.json ("@/*" -> "./src/*").
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Юнит-тесты гоняют серверные модули (fs, crypto, next/server), поэтому node.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Файлы изолированы (по умолчанию isolate: true), каждый тест пишет
    // в свой временный DCS_DATA_DIR — реальный ./data не трогается.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
