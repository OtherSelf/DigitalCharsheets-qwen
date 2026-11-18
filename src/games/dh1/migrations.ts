import {
  enforceDh1Fields,
  ensureConditions,
  ensureExperienceLog,
  migrateGender,
} from './normalize';

/**
 * ─── LANDMARK: DH1 MIGRATIONS ──────────────────────────────────────────────
 * Цепочка версий схемы листа DH1: `1 → 5`. Каждый шаг вызывает ту же фазовую
 * функцию, что и `normalize`, но привязан к своей версии, поэтому лист можно
 * провести по цепочке и увидеть, что именно изменилось на каждом шаге.
 *
 *   1 → 2  дискриминант редакции (`systemId`, legacy `edition` убран);
 *   2 → 3  поля 2-й редакции разведены: `influence`/`fatigue2nd` → notes;
 *   3 → 4  состояния (`mutations`, `insanityDetails`, `corruptionDetails`)
 *          становятся структурированными записями `conditions`;
 *   4 → 5  пол — каноническим кодом (`identity.gender`).
 *
 * Все фазы идемпотентны и не теряют значений: вытесненные поля уходят в
 * `notes` с маркером миграции.
 */

type RawRecord = Record<string, unknown>;

/** v1 → v2: дискриминант редакции. */
export function migrateDh1V1toV2(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  delete next.edition;
  return next;
}

/** v2 → v3: поля 2-й редакции убраны, значения сохранены в notes. */
export function migrateDh1V2toV3(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  enforceDh1Fields(next, warnings);
  ensureExperienceLog(next);
  return next;
}

/** v3 → v4: состояния стали структурными записями. */
export function migrateDh1V3toV4(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  ensureConditions(next);
  return next;
}

/** v4 → v5: пол хранится кодом, старый текст — в notes. */
export function migrateDh1V4toV5(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  migrateGender(next, warnings);
  return next;
}
