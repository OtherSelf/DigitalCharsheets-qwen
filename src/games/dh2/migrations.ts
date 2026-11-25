import {
  enforceDh2Fields,
  ensureConditions,
  migrateGender,
  migrateLegacyFields,
} from './normalize';

/**
 * ─── LANDMARK: DH2 MIGRATIONS ──────────────────────────────────────────────
 * Цепочка версий схемы листа DH2: `1 → 6`.
 *
 *   1 → 2  дискриминант редакции (`systemId`, legacy `edition` убран);
 *   2 → 3  поля 1-й редакции перенесены в notes, появились `influence` и
 *          `fatigue2nd` (2e-generation);
 *   3 → 4  состояния стали структурными записями `conditions`;
 *   4 → 5  пол — каноническим кодом (`gender`);
 *   5 → 6  замороженный текст пророчества (бэкфилл 0.22.0) — без правок данных.
 *
 * Шаги вызывают те же фазовые функции, что и `normalize`, поэтому цепочка и
 * нормализация не могут разойтись.
 */

type RawRecord = Record<string, unknown>;

/** v1 → v2: дискриминант редакции. */
export function migrateDh2V1toV2(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  delete next.edition;
  return next;
}

/** v2 → v3: 2e-generation — поля DH1 в notes, влияние и усталость 2e. */
export function migrateDh2V2toV3(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  migrateLegacyFields(next, warnings);
  enforceDh2Fields(next, warnings);
  return next;
}

/** v3 → v4: состояния стали структурными записями. */
export function migrateDh2V3toV4(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  ensureConditions(next);
  return next;
}

/** v4 → v5: пол хранится кодом. */
export function migrateDh2V4toV5(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  migrateGender(next, warnings);
  return next;
}

/**
 * v5 → v6: появляются необязательные `divinationText`/`divinationEffectText`
 * (бэкфилл 0.22.0). Шаг ничего не переписывает: у старых листов полей просто
 * нет, а UI покажет образец.
 */
export function migrateDh2V5toV6(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  return { ...character };
}
