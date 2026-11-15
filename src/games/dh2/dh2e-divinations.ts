/**
 * ─── LANDMARK: DH2E DIVINATIONS ────────────────────────────────────────────
 * Пророчества 2e — строки таблицы 2-9 с диапазоном d100; в листе хранится
 * id строки (`d100-10`), а не текст. DH1-листы хранили свои id (`painOfBullet`)
 * и эффекты — для них есть карта перехода: при миграции значение уходит в
 * `notes`, а игрок выбирает строку 2-9 заново.
 */

import { DH2E_DIVINATIONS } from './dh2e-data';

const BY_ID = new Map(DH2E_DIVINATIONS.map((row) => [row.id, row]));

/** Id строк 2-9, на которые переносятся совместимые пророчества DH1. */
const LEGACY_TO_D100: Readonly<Record<string, string>> = {
  mutationWithout: 'd100-01',
  onlyTheInsane: 'd100-64',
  innocenceIllusion: 'd100-84',
  darkDreams: 'd100-50',
  painOfBullet: 'd100-10',
  killTheAlien: 'd100-22',
  truthSubjective: 'd100-26',
  offerHisLife: 'd100-96',
  jobWorthDying: 'd100-44',
  onlyInDeath: 'd100-80',
  mindWithoutPurpose: 'd100-39',
  violenceSolves: 'd100-55',
  toWarHuman: 'd100-88',
  boonToBrothers: 'd100-14',
  menMustDie: 'd100-06',
  onlyTrueFear: 'd100-76',
  thoughtBegetsHeresy: 'd100-30',
  wiseManLearns: 'd100-18',
  suspiciousMind: 'd100-68',
  trustYourFear: 'd100-02',
  noSubstituteForZeal: 'd100-92',
  askHowNotWhy: 'd100-100',
};

export function isDivinationId(value: string): boolean {
  return BY_ID.has(value);
}

export function divinationById(value: string) {
  return BY_ID.get(value);
}

export function divinationTextKey(value: string): string {
  return BY_ID.get(value)?.textKey ?? '';
}

export function divinationEffectKey(value: string): string {
  return BY_ID.get(value)?.effectKey ?? '';
}

/**
 * Приводит значение к id 2-9: уже 2-9 остаётся, известный DH1-id переносится
 * на совместимую строку, всё остальное — пустая строка (текст уйдёт в notes).
 */
export function resolveDivinationId(value: string): string {
  if (!value) return '';
  if (isDivinationId(value)) return value;
  return LEGACY_TO_D100[value] ?? '';
}

/** Строка 2-9 по броску d100 (для предпросмотра эффекта в форме). */
export function divinationForRoll(roll: number): string {
  const row = DH2E_DIVINATIONS.find(
    (item) => roll >= item.from && roll <= item.to,
  );
  return row?.id ?? '';
}
