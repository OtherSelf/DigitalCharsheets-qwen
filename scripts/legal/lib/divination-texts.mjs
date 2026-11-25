/**
 * ─── LANDMARK: DIVINATION TEXT MAPS ────────────────────────────────────────
 * Чистые функции бэкфилла 0.22.0: собрать из i18n текст пророчества и его
 * эффекта в обеих локалях и решить, что записать в лист.
 *
 * Модуль без fs и без зависимостей: CLI (`backfill-divinations.mjs`) читает
 * файлы сам, а тесты проверяют только отображение id → текст.
 */

/** Языки, которые замораживаются в листе. */
export const LANGS = ['en', 'ru'];

/**
 * Ключ текста пророчества в словаре редакции.
 * @param {'dh1'|'dh2'} system
 * @param {string} id
 */
export function divinationKey(system, id) {
  return system === 'dh1'
    ? `dh1.data.divination.${id}`
    : `dh2.catalog.divination.${id}`;
}

/**
 * Ключ текста эффекта. У DH1 эффект — отдельный id (`toughness1`), у DH2 —
 * подключай `divinationEffectKey('dh2', id)` с id строки (`d100-10`).
 * @param {'dh1'|'dh2'} system
 * @param {string} effectId
 */
export function divinationEffectKey(system, effectId) {
  return system === 'dh1'
    ? `dh1.data.divinationEffect.${effectId}`
    : `dh2.catalog.divination.${effectId}.effect`;
}

/**
 * @typedef {{ en?: string, ru?: string }} LocalizedText
 * @typedef {{ text: LocalizedText, effect: LocalizedText }} FrozenFields
 */

/**
 * Замороженные поля для листа.
 * @param {'dh1'|'dh2'} system
 * @param {{ id: string, effectId?: string }} ids
 * @param {Record<string, Record<string, string>>} dictionaries — язык → словарь
 * @returns {FrozenFields}
 */
export function freezeFields(system, ids, dictionaries) {
  /** @type {LocalizedText} */
  const text = {};
  /** @type {LocalizedText} */
  const effect = {};

  for (const lang of LANGS) {
    const dict = dictionaries[lang] ?? {};
    const textValue = dict[divinationKey(system, ids.id)];
    if (typeof textValue === 'string' && textValue.trim())
      text[lang] = textValue;

    if (ids.effectId) {
      const effectValue = dict[divinationEffectKey(system, ids.effectId)];
      if (typeof effectValue === 'string' && effectValue.trim()) {
        effect[lang] = effectValue;
      }
    }
  }

  return { text, effect };
}

/**
 * Уже заморожено? Достаточно непустой строки хотя бы в одной локали: повторный
 * прогон не должен переписывать то, что человек мог отредактировать.
 * @param {unknown} value
 */
export function isFrozen(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(
    (item) => typeof item === 'string' && item.trim().length > 0,
  );
}

/**
 * Обратный поиск: старая установка могла хранить в `divination` саму фразу
 * (до миграции v1), а не id. Ищем точное совпадение текста в словаре.
 * @param {'dh1'|'dh2'} system
 * @param {string} value
 * @param {Record<string, Record<string, string>>} dictionaries
 */
export function findIdByText(system, value, dictionaries) {
  const prefix =
    system === 'dh1' ? 'dh1.data.divination.' : 'dh2.catalog.divination.';
  const needle = value.trim();
  for (const dict of Object.values(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) {
      if (!key.startsWith(prefix) || key.endsWith('.effect')) continue;
      if (typeof text === 'string' && text.trim() === needle) {
        return key.slice(prefix.length);
      }
    }
  }
  return undefined;
}

/**
 * То же для эффекта DH1: `divinationEffect` мог хранить фразу.
 * @param {string} value
 * @param {Record<string, Record<string, string>>} dictionaries
 */
export function findEffectIdByText(value, dictionaries) {
  const prefix = 'dh1.data.divinationEffect.';
  const needle = value.trim();
  for (const dict of Object.values(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) {
      if (!key.startsWith(prefix)) continue;
      if (typeof text === 'string' && text.trim() === needle) {
        return key.slice(prefix.length);
      }
    }
  }
  return undefined;
}

/**
 * Есть ли для этого id текст хотя бы в одной локали.
 * @param {'dh1'|'dh2'} system
 * @param {string} id
 * @param {Record<string, Record<string, string>>} dictionaries
 */
export function hasDivinationText(system, id, dictionaries) {
  const key = divinationKey(system, id);
  return Object.values(dictionaries).some(
    (dict) => typeof dict[key] === 'string' && dict[key].trim().length > 0,
  );
}

/**
 * Есть ли текст эффекта (DH1).
 * @param {string} effectId
 * @param {Record<string, Record<string, string>>} dictionaries
 */
export function hasEffectText(effectId, dictionaries) {
  const key = divinationEffectKey('dh1', effectId);
  return Object.values(dictionaries).some(
    (dict) => typeof dict[key] === 'string' && dict[key].trim().length > 0,
  );
}
