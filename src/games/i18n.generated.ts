/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Словари плагинов, сгенерированные из `src/games/<id>/plugin.json` (поле
 * `i18n`). Импортируются `src/lib/i18n` до инициализации реестра, поэтому
 * здесь только словари — без модулей, схем и UI (этап 3).
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
import type { LocalizedMessages } from './types';

/** Словари по `systemId`; порядок ключей — по id (стабильная генерация). */
export const generatedI18n: Readonly<Record<string, LocalizedMessages>> = {
  dh1: { en: dh1En, ru: dh1Ru },
  dh2: { en: dh2En, ru: dh2Ru },
  dnd5e: { en: dnd5eEn, ru: dnd5eRu },
};
