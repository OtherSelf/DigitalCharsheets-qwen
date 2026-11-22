import { closeTraining } from './skill-training';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 DERIVE ──────────────────────────────────────────────────
 * В файле нет вычисленных чисел: характеристики базовые, итог считается на
 * показ, а раны/очки судьбы вводит игрок. Производная величина — только
 * кумулятивность тренировки навыка, включая колонку `+30`.
 *
 * Пересчёт чистый и идемпотентный; состав полей не меняет.
 */
export function deriveDh2(character: DH2Character): DH2Character {
  // Неполный документ (черновик, legacy) не должен ломать сохранение: правим
  // только те структуры, которые в нём есть.
  if (!Array.isArray(character.skills)) return { ...character };
  return {
    ...character,
    skills: character.skills.map((skill) => ({
      ...skill,
      training: closeTraining(skill.training),
    })),
  };
}
