/**
 * ─── LANDMARK: SHARED MERGE HELPERS ────────────────────────────────────────
 * Крошечное игро-агностичное ядро слияния импортированных данных: поля,
 * которые есть у любой редакции (имя, заметки, снаряжение, журнал квестов,
 * домашние правила). Механики, характеристики и редакционные поля остаются
 * в `src/games/<id>/merge.ts` — сюда они не попадают (см. docs/game-modules).
 */

export type MergeTarget = Record<string, unknown>;
export type MergeSource = Readonly<Record<string, unknown>>;
export type MergeConfig = Readonly<Record<string, boolean>>;

/** Скопировать только заданные (не `undefined`) поля источника. */
export function copyDefinedFields(
  target: MergeTarget,
  source: MergeSource,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (source[key] !== undefined) target[key] = source[key];
  }
}

/** Наложить объект источника поверх объекта цели (мелкое слияние). */
export function mergeShallow(
  target: MergeTarget,
  source: MergeSource,
  key: string,
): void {
  const value = source[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const current =
    target[key] &&
    typeof target[key] === 'object' &&
    !Array.isArray(target[key])
      ? (target[key] as Record<string, unknown>)
      : {};
  target[key] = { ...current, ...(value as Record<string, unknown>) };
}

/**
 * Общие разделы любой редакции: снаряжение (целиком), журнал квестов и
 * домашние правила. Характеристики/навыки сюда не входят.
 */
export function mergeCommonSections(
  target: MergeTarget,
  source: MergeSource,
  config: MergeConfig,
): void {
  if (config.includeEquipment && source.equipment) {
    target.equipment = source.equipment;
  }
  if (config.includeQuestLog && source.questLog) {
    target.questLog = source.questLog;
  }
  if (config.includeCustomHouseRules && source.customHouseRules) {
    target.customHouseRules = source.customHouseRules;
  }
}

/** Описательные поля, которые есть у всех редакций. */
export const NARRATIVE_FIELDS = [
  'backstory',
  'notes',
  'otherProficienciesAndLanguages',
  'personalityTraits',
  'ideals',
  'bonds',
  'flaws',
  'featuresAndTraits',
] as const;
