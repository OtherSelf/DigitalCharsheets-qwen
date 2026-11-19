/**
 * ─── LANDMARK: DND5E MIGRATIONS ────────────────────────────────────────────
 * Цепочка версий схемы листа 5e. Версий всего две, поэтому и шаг один.
 *
 * `v1 → v2` — дискриминант редакции: хост ставит `systemId` и убирает legacy
 * `edition`. Собственных потерь полей у редакции нет, поэтому шаг
 * ничего не переписывает, а только фиксирует версию, — но без него цепочка
 * `1 → 2` не объявлена, и лист «старой» версии неотличим от битого.
 */

type RawRecord = Record<string, unknown>;

/** v1 → v2: дискриминант редакции (ставит хост, шаг фиксирует версию). */
export function migrateDnd5eV1toV2(character: Readonly<RawRecord>): RawRecord {
  const next: RawRecord = { ...character };
  delete next.edition;
  return next;
}
