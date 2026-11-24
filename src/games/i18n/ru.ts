// ─── LANDMARK: TRANSLATIONS_GAMES_CORE ───
// Метаданные реестра: названия/описания игр и шаги мастера создания.
// Язык: ru. Правила: docs/i18n.md.
// `satisfies` сохраняет литеральные ключи для `TranslationKey`.
export const ru = {
  'games.stepGame': 'Игра',
  'games.stepEdition': 'Редакция',
  'games.stepCharacter': 'Персонаж',
  'games.chooseGame': 'Выберите игру',
  'games.chooseGameDesc': 'Шаг 1: выберите игровой мир.',
  'games.chooseEdition': 'Выберите редакцию',
  'games.chooseEditionDesc':
    'Шаг 2: у редакций разные правила и листы персонажа.',
  'games.backToGames': 'Назад к играм',
  'games.backToEditions': 'Назад к редакциям',
} satisfies Record<string, string>;
