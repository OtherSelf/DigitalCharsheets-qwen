/** @type {import('prettier').Config} */
const config = {
  // --- «black»-часть: форматирование без споров ---
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',

  plugins: [
    // «isort»-часть: сортировка и группировка импортов. Должен быть первым.
    '@ianvs/prettier-plugin-sort-imports',
    // Сортировка Tailwind-классов в className. Должен быть последним.
    'prettier-plugin-tailwindcss',
  ],

  importOrder: [
    '<BUILTIN_MODULES>',
    '',
    '^react$',
    '^react-dom(/.*)?$',
    '^next(/.*)?$',
    '',
    '<THIRD_PARTY_MODULES>',
    '',
    '^@/(.*)$',
    '',
    '^[.]',
  ],
  importOrderTypeScriptVersion: '5.0.0',
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
};

export default config;
