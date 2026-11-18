import { closeTraining } from '../shared/skill-training';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 DERIVE ──────────────────────────────────────────────────
 * Как и в dh1, во 2-й редакции в файле нет вычисленных чисел: характеристики
 * базовые, итог считается на показ, а раны/очки судьбы вводит игрок.
 * Производная величина — только кумулятивность тренировки навыка, включая
 * колонку `+30`, которой в 1-й редакции нет.
 *
 * Пересчёт чистый и идемпотентный; состав полей не меняет (D14).
 */
export function deriveDh2(character: DH2Character): DH2Character {
  return {
    ...character,
    skills: character.skills.map((skill) => ({
      ...skill,
      training: closeTraining(skill.training),
    })),
  };
}
