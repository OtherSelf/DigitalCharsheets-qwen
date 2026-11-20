/**
 * ─── LANDMARK: DH STAT ARITHMETIC ──────────────────────────────────────────
 * Арифметика характеристик Dark Heresy: каждая ступень повышения даёт +5,
 * а бонус характеристики — это её десятки (35 → 3). Формула нужна листу,
 * секциям, форме создания и Excel-выгрузке, поэтому живёт одним модулем.
 *
 * Копия редакции: dh2 держит свою (см. `src/games/dh2/dh-stats.ts`). Редакции
 * независимы — расхождение правил правится здесь, а не в общем файле.
 */

/** Сколько стоит одна ступень повышения характеристики. */
export const STAT_UPGRADE_STEP = 5;

/**
 * Прибавка за повышения: +5 за каждую отмеченную ступень.
 *
 * Принимает и массив флагов, и `undefined` — у части листов улучшений нет.
 */
export function upgradeBonus(
  upgrades: readonly boolean[] | undefined | null,
): number {
  if (!Array.isArray(upgrades)) return 0;
  return upgrades.filter(Boolean).length * STAT_UPGRADE_STEP;
}

/** Итог характеристики: база + повышения. */
export function statTotal(
  base: number | undefined,
  upgrades: readonly boolean[] | undefined | null,
): number {
  const safe = Number.isFinite(base) ? Number(base) : 0;
  return safe + upgradeBonus(upgrades);
}

/** Бонус характеристики — целые десятки: 35 → 3, 9 → 0. */
export function statBonus(total: number | undefined): number {
  const safe = Number.isFinite(total) ? Number(total) : 0;
  return Math.floor(safe / 10);
}
