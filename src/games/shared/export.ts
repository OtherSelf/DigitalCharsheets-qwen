import { isNonPortableField } from '@/lib/character-portable';

/**
 * ─── LANDMARK: PORTABLE RECORD ─────────────────────────────────────────────
 * Переносимая копия листа для адаптеров экспорта модулей: те же правила, что
 * в `src/lib/character-portable.ts` (не тащим `userId`, провенанс миграции и
 * служебные маркеры записи), но без ограничения `Record<string, unknown>` —
 * листы типизированы интерфейсами, у которых нет index signature.
 */
export function toPortableRecord(character: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(character)) {
    if (isNonPortableField(key)) continue;
    result[key] = value;
  }
  return result;
}
