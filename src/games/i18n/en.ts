// ─── LANDMARK: TRANSLATIONS_GAMES_CORE ───
// Метаданные реестра: названия/описания игр и шаги мастера создания.
// Язык: en. Правила: docs/i18n.md.
// `satisfies` сохраняет литеральные ключи для `TranslationKey`.
export const en = {
  'games.stepGame': 'Game',
  'games.stepEdition': 'Edition',
  'games.stepCharacter': 'Character',
  'games.chooseGame': 'Choose a game',
  'games.chooseGameDesc': 'Step 1: pick the game world.',
  'games.chooseEdition': 'Choose an edition',
  'games.chooseEditionDesc':
    'Step 2: editions have different rules and character sheets.',
  'games.backToGames': 'Back to games',
  'games.backToEditions': 'Back to editions',
} satisfies Record<string, string>;
