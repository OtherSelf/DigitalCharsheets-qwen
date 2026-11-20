/**
 * ─── LANDMARK: SKILL TRAINING CLOSURE ──────────────────────────────────────
 * Тренировка навыка в Dark Heresy кумулятивна: `+20` не существует без `+10`,
 * `+10` — без `skilled`, а `+30` — без `+20`. Лист хранит четыре независимых
 * флага, поэтому «правильную» комбинацию нужно восстанавливать, а не надеяться
 * на неё: клиент мог прислать любую.
 *
 * Копия редакции: dh2 держит свою (`src/games/dh2/skill-training.ts`).
 * UI-секции и `derive` этой редакции зовут её; при расхождении правил
 * правится здесь, а не в общем файле (редакции независимы).
 */

/** Флаги тренировки навыка; форма совпадает у dh1 и dh2. */
export interface SkillTraining {
  skilled: boolean;
  plus10: boolean;
  plus20: boolean;
  plus30: boolean;
}

/** Порядок уровней: следующий флаг без предыдущего не имеет смысла. */
export const TRAINING_KEYS = ['skilled', 'plus10', 'plus20', 'plus30'] as const;

/**
 * Достроить тренировку до согласованной: выставляя уровень, поднимаем все
 * предыдущие; снимая уровень, гасим все последующие.
 *
 * Идемпотентна: повторный вызов с тем же входом даёт тот же результат.
 */
export function closeTraining(
  training: Partial<SkillTraining> | undefined,
): SkillTraining {
  const flags = TRAINING_KEYS.map((key) => Boolean(training?.[key]));
  // Последний выставленный уровень определяет все ниже: gaps недопустимы.
  let highest = -1;
  flags.forEach((flag, index) => {
    if (flag) highest = index;
  });
  return {
    skilled: highest >= 0,
    plus10: highest >= 1,
    plus20: highest >= 2,
    plus30: highest >= 3,
  };
}

/** Переключить один уровень тренировки, сохранив кумулятивность. */
export function toggleTraining(
  training: Partial<SkillTraining> | undefined,
  key: keyof SkillTraining,
  value: boolean,
): SkillTraining {
  return closeTraining({ ...training, [key]: value });
}
