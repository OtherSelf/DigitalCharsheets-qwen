import { rankForCharacter, resolveCharacterClass } from './dark-heresy-ranks';
import { closeTraining } from './skill-training';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 DERIVE ──────────────────────────────────────────────────
 * В dh1 производных чисел в файле нет: характеристики хранятся базовыми, а
 * итог (база + 5 за каждое повышение) считается на показ, раны и очки судьбы
 * вводит игрок. Величины, которые зависят от других полей и при этом попадают
 * в документ: кумулятивность тренировки навыка (`plus30` без `plus20` в
 * правилах не существует) и актуальные `rank`/`characterClass`.
 *
 * Ранг и класс — снимок создания, который обязан следовать за опытом и
 * карьерой: иначе шапка, карточка и экспорт расходятся с правилами. Лист без
 * карьеры оставляет свои значения — это legacy/свободный лист.
 *
 * Пересчёт чистый и идемпотентный; он не создаёт и не удаляет поля: если
 * карьеры и ранга в документе нет, трогать нечего.
 */
export function deriveDh1(character: DH1Character): DH1Character {
  const next: DH1Character = { ...character };
  if (next.careerPath) {
    next.rank = rankForCharacter(next);
    next.characterClass = resolveCharacterClass(next);
  }

  // Неполный документ (черновик, legacy) не должен ломать сохранение: правим
  // только те структуры, которые в нём есть.
  if (!Array.isArray(next.skills)) return next;
  return {
    ...next,
    skills: next.skills.map((skill) => ({
      ...skill,
      training: closeTraining(skill.training),
    })),
  };
}
