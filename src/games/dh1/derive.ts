import { closeTraining } from '../shared/skill-training';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 DERIVE ──────────────────────────────────────────────────
 * В dh1 производных чисел в файле нет: характеристики хранятся базовыми, а
 * итог (база + 5 за каждое повышение) считается на показ, раны и очки судьбы
 * вводит игрок. Единственная величина, которая зависит от других полей и при
 * этом попадает в документ, — кумулятивность тренировки навыка: `plus30` без
 * `plus20` в правилах не существует.
 *
 * Пересчёт чистый и идемпотентный; он не создаёт и не удаляет поля (D14).
 */
export function deriveDh1(character: DH1Character): DH1Character {
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
