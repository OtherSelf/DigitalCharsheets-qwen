import { generatedI18n } from '@/games/i18n.generated';
import { en as gamesCoreEn } from '@/games/i18n/en';
import { ru as gamesCoreRu } from '@/games/i18n/ru';

import { enTranslations } from './translations.en';
import { ruTranslations } from './translations.ru';

/**
 * ─── LANDMARK: TRANSLATIONS_MAIN ───────────────────────────────────────────
 * Сборка словарей: общий слой + метаданные реестра + словари всех модулей.
 * Модули (`src/games/<id>/i18n`) не знают друг о друге и не делят
 * DH-словарь.
 *
 * Список словарей берётся из `i18n.generated.ts` (генерируется из
 * `plugin.json#i18n`), а НЕ из `gameRegistry`: реестр импортирует UI-слоты
 * плагинов, которые импортируют контекст языка, — это дало бы цикл
 * `i18n → registry → slots → language-context → i18n` (этап 3).
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

const moduleDictionaries = Object.values(generatedI18n);

export const translations: Record<string, Record<string, string>> = {
  en: mergeDictionaries([
    enTranslations,
    gamesCoreEn,
    ...moduleDictionaries.map((messages) => messages.en),
  ]),
  ru: mergeDictionaries([
    ruTranslations,
    gamesCoreRu,
    ...moduleDictionaries.map((messages) => messages.ru),
  ]),
};
