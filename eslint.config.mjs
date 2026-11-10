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
    /*
      a11y-правила. `next/core-web-vitals` уже включает 6 штук
      (alt-text, aria-props, aria-proptypes, aria-unsupported-elements,
      role-has-required-aria-props, role-supports-aria-props) — плагин
      `eslint-plugin-jsx-a11y` подключён им, поэтому здесь только правила,
      которых там нет. Важны именно для иконочных кнопок: имя должно быть
      доступным, а интерактивность — на кнопках, а не на div.
    */
    files: ['**/*.tsx'],
    rules: {
      'jsx-a11y/alt-text': ['error', { elements: ['img'], img: ['Image'] }],
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
      'jsx-a11y/aria-role': 'error',
      // Настоящие подсказки-предупреждения, а не блокеры: интерактив на
      // неинтерактивном элементе требует и role, и обработчиков клавиатуры.
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn',
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
