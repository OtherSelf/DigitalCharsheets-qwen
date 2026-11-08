/**
 * ─── LANDMARK: PORTABLE CHARACTER ───────────────────────────────────────────
 * Поля листа, которые НЕ переносятся между аккаунтами и не нужны в экспорте:
 *
 *   • провенанс миграции (`migratedFrom`, `migratedAt`, `migratedFromUid`) —
 *     служебная информация о том, откуда пришёл лист (в т.ч. чужой Firebase UID);
 *   • старые Firestore-идентификаторы (`originalFirebaseId`, `Document ID`);
 *   • внутренние маркеры записи (`_key`, `__page`, `__seq`);
 *   • `userId` — владелец: при импорте он назначается заново по сессии, так что
 *     в переносимом JSON это только шум (и лишний идентификатор в бэкапе).
 *
 * На диске в `users/<uid>/characters/<id>.json` эти поля остаются: провенанс
 * нужен для аудита, `userId` — для диагностики (см. dcs-migrate-check.py).
 * Чистим их только на границе экспорта/импорта.
 *
 * Модуль без `'use client'` и без DOM: используется и серверным `/api/export`,
 * и клиентским разбором импортируемых файлов.
 */
export const NON_PORTABLE_CHARACTER_FIELDS = [
  'migratedFrom',
  'migratedAt',
  'migratedFromUid',
  'originalFirebaseId',
  'Document ID',
  '_key',
  '__page',
  '__seq',
  'userId',
] as const;

const NON_PORTABLE = new Set<string>(NON_PORTABLE_CHARACTER_FIELDS);

/**
 * Копия листа без служебных полей (верхний уровень). Вложенные объекты не
 * трогаем: перечисленные ключи встречаются только в корне листа.
 */
export function toPortableCharacter<T extends Record<string, unknown>>(character: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(character)) {
    if (NON_PORTABLE.has(key)) continue;
    result[key] = value;
  }
  return result as T;
}

/** Нужно ли выбросить ключ при импорте/экспорте. */
export function isNonPortableField(key: string): boolean {
  return NON_PORTABLE.has(key);
}
