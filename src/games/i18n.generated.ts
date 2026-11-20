/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Словари плагинов, сгенерированные из `src/games/<id>/plugin.json` (поле
 * `i18n`) плюс названия/описания семейств игр (поле `game`).
 * Импортируются `src/lib/i18n` до инициализации реестра, поэтому здесь
 * только словари — без модулей, схем и UI (этап 3).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check
 */
import dh1En from './dh1/i18n/en.json';
import dh1Ru from './dh1/i18n/ru.json';
import dh2En from './dh2/i18n/en.json';
import dh2Ru from './dh2/i18n/ru.json';
import dnd5eEn from './dnd5e/i18n/en.json';
import dnd5eRu from './dnd5e/i18n/ru.json';
import sandboxEn from './sandbox/i18n/en.json';
import sandboxRu from './sandbox/i18n/ru.json';
import type { LocalizedMessages, PluginLocalizedMessages } from './types';

/** Локали плагина из манифеста; порядок ключей — по id. */
type PluginDictionaries = Readonly<Record<string, PluginLocalizedMessages>>;

/** Словари по `systemId`; порядок ключей — по id (стабильная генерация). */
export const generatedI18n: PluginDictionaries = {
  dh1: { en: dh1En, ru: dh1Ru },
  dh2: { en: dh2En, ru: dh2Ru },
  dnd5e: { en: dnd5eEn, ru: dnd5eRu },
  sandbox: { en: sandboxEn, ru: sandboxRu },
};

/** Названия и описания семейств игр (ключи `games.generated.*`). */
export const generatedGameI18n: LocalizedMessages = {
  en: {
    'games.generated.dnd.name': 'Dungeons & Dragons',
    'games.generated.dnd.description':
      'Heroic fantasy: classes, spells and d20 checks.',
    'games.generated.darkHeresy.name': 'Warhammer 40k: Dark Heresy',
    'games.generated.darkHeresy.description':
      'Grimdark investigation in the Warhammer 40,000 universe.',
    'games.generated.sandbox.name': 'Sandbox',
    'games.generated.sandbox.description':
      'A test game for checking the plugin contract end to end.',
  },
  ru: {
    'games.generated.dnd.name': 'Dungeons & Dragons',
    'games.generated.dnd.description':
      'Героическое фэнтези: классы, заклинания и проверки d20.',
    'games.generated.darkHeresy.name': 'Warhammer 40k: Dark Heresy',
    'games.generated.darkHeresy.description':
      'Мрачное расследование во вселенной Warhammer 40,000.',
    'games.generated.sandbox.name': 'Песочница',
    'games.generated.sandbox.description':
      'Тестовая игра для сквозной проверки контракта плагинов.',
  },
};
