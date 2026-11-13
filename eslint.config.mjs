import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * ESLint 9/10 (flat config). eslint-config-next 16 отдаёт готовые flat-массивы,
 * поэтому FlatCompat больше не нужен (в 15.x конфиг был eslintrc-формата).
 *
 * Задача линтера здесь — ловить явные баги (hooks, async, a11y, React/Next),
 * а не спорить о стиле: форматирование и импорты отданы Prettier.
 */
const eslintConfig = [
  // Глобальные игноры (дополняют те, что уже заданы внутри next-конфига).
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      '.chromium-deps/**',
      '.playwright-browsers/**',
      '.npm-cache/**',
      'public/vendor/**',
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    // Тот же набор файлов, что и у next-конфига: плагин `react-hooks`
    // объявлен только для этих расширений (для .cjs его нет).
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
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
      // Новые правила react-hooks v6 (эпоха React Compiler), которых не было
      // при ESLint 9 / Next 15. Пока warn: 34 известных места (setState в
      // эффектах, компоненты внутри компонентов и т.п.) — отдельной задачей.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
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
    // обязаны быть .cjs, а tailwind.config.ts подключается к PostCSS.
    files: ['**/*.cjs', 'tailwind.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
