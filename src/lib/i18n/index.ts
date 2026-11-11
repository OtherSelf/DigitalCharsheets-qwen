import { en as gamesCoreEn } from '@/games/i18n/en';
import { ru as gamesCoreRu } from '@/games/i18n/ru';
import { gameRegistry } from '@/games/registry';

import { enTranslations } from './translations.en';
import { ruTranslations } from './translations.ru';

/**
 * ─── LANDMARK: TRANSLATIONS_MAIN ───────────────────────────────────────────
 * Сборка словарей: общий слой + метаданные реестра + словари всех модулей
 * из реестра. Модули (`src/games/<id>/i18n`) не знают друг о друге и не делят
 * DH-словарь; единственный список — `gameRegistry`.
 *
 * Дубликат ключа между слоями — ошибка разработчика: падаем на старте (и в
 * тестах), а не молча затираем строку.
 */
function mergeDictionaries(
  layers: readonly Readonly<Record<string, string>>[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (key in result) {
        throw new Error(`Дублирующийся i18n-ключ между слоями: ${key}`);
      }
      result[key] = value;
    }
  }
  return result;
}

const modules = gameRegistry.list();

export const translations: Record<string, Record<string, string>> = {
  en: mergeDictionaries([
    enTranslations,
    gamesCoreEn,
    ...modules.map((gameModule) => gameModule.i18n.en),
  ]),
  ru: mergeDictionaries([
    ruTranslations,
    gamesCoreRu,
    ...modules.map((gameModule) => gameModule.i18n.ru),
  ]),
};
