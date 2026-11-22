/**
 * ─── LANDMARK: EXAMPLE MIGRATIONS ─────────────────────────────────────────
 * Цепочка версий листа песочницы: `1 → 2` убирает legacy-дискриминант
 * `edition`, `2 → 3` добавляет производное `total`. Шаги идемпотентны и
 * возвращают документ целиком — так же, как у боевых плагинов.
 */
export function migrateV1toV2(
  character: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const next = { ...character };
  delete next.edition;
  return next;
}

/**
 * `total` — производное значение; при переносе считаем его из характеристик,
 * а если их нет — берём дефолтную сумму. Шаг не трогает `schemaVersion`:
 * версию выставляет раннер после цепочки.
 */
export function migrateV2toV3(
  character: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  if (typeof character.total === 'number') return { ...character };
  const stats =
    character.stats && typeof character.stats === 'object'
      ? (character.stats as Record<string, unknown>)
      : {};
  const might = typeof stats.might === 'number' ? stats.might : 10;
  const wits = typeof stats.wits === 'number' ? stats.wits : 10;
  return { ...character, total: might + wits };
}
