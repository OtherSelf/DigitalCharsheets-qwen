import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * ESLint 9 (flat config). Правила Next.js и TypeScript — через FlatCompat,
 * потому что eslint-config-next 15.x по-прежнему отдаёт eslintrc-конфиг.
 *
 * Задача линтера здесь — ловить явные баги (hooks, async, a11y, React/Next),
 * а не спорить о стиле: форматирование и импорты отданы Prettier.
 */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      '.chromium-deps/**',
      '.playwright-browsers/**',
      '.npm-cache/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 200+ вхождений: включать постепенно, иначе сигнал тонет в шуме.
      '@typescript-eslint/no-explicit-any': 'off',
      // Мёртвый код и забытые аргументы; `_` — осознанно неиспользуемое.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // Настоящие баги: устаревший стейт в эффектах. Пока warn — 6 известных
      // мест чинятся отдельной задачей, см. _AUDIT.md.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // CommonJS — это не костыль, а формат: шим для EXDEV и фикстуры тестов
    // обязаны быть .cjs, а tailwind.config.ts подключает плагин через require().
    files: ['**/*.cjs', 'tailwind.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
