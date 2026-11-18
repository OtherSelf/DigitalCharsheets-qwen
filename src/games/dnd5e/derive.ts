import type {
  DnD5eCharacter,
  DnDAbility,
  DnDSavingThrow,
  DnDSkill,
  SpellcastingEntry,
} from './types';

/**
 * ─── LANDMARK: DND5E DERIVE ────────────────────────────────────────────────
 * Формулы производных значений 5e в одном месте (D14): сервер зовёт их при
 * записи листа, лист — при каждом рендере. Пока формулы были только в UI,
 * сохранённый документ мог разойтись с тем, что видит игрок: `level=5` рядом с
 * `proficiencyBonus=99` никто не запрещал.
 *
 * Что пересчитывается: бонус мастерства, значения спасбросков и навыков,
 * DC спасения от заклинаний и значения записей колдовства.
 *
 * Что НЕ пересчитывается (D14): `armorClass`, `speed`, `hitPoints`,
 * `spellAttackBonus` верхнего уровня — их источник снаряжение, домашние
 * правила и формат строки, а не характеристики.
 *
 * Функция чистая: не мутирует документ, не читает окружение и не зависит от
 * порядка ключей; повторный вызов не меняет результат.
 */

/**
 * Характеристики листа. Принимаем расширяемо (`Record`), потому что секции
 * держат их в локальном стейте и не обязаны повторять точный тип листа.
 */
export type AbilityScores = Readonly<Record<string, number | undefined>>;

/** Карта «навык → характеристика»; незнакомое имя навыка не пересчитываем. */
export const SKILL_ABILITY: Readonly<Record<string, DnDAbility>> = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};

/** Границы уровня 5e: по ним же ограничен ввод в форме и листе. */
const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

/** Бонус мастерства: +2 на первом уровне, +1 за каждые четыре уровня. */
export function proficiencyBonusForLevel(level: number): number {
  const safe = Number.isFinite(level) ? Math.trunc(level) : MIN_LEVEL;
  const clamped = Math.min(Math.max(safe, MIN_LEVEL), MAX_LEVEL);
  return 2 + Math.floor((clamped - MIN_LEVEL) / 4);
}

/** Модификатор характеристики: (значение − 10) / 2, округление вниз. */
export function abilityModifier(value: number): number {
  const safe = Number.isFinite(value) ? value : 10;
  return Math.floor((safe - 10) / 2);
}

/** Модификатор характеристики по имени; неизвестное имя считается 10. */
function statModifier(stats: AbilityScores, ability: string): number {
  const value = stats[ability as DnDAbility];
  return abilityModifier(typeof value === 'number' ? value : 10);
}

/** Спасбросок: мод характеристики + мастерство + ручная поправка. */
export function savingThrowValue(
  save: Pick<DnDSavingThrow, 'name' | 'proficient' | 'manualModifier'>,
  stats: AbilityScores,
  proficiencyBonus: number,
): number {
  const modifier = statModifier(stats, save.name.toLowerCase());
  return (
    modifier +
    (save.proficient ? proficiencyBonus : 0) +
    (save.manualModifier ?? 0)
  );
}

/** Навык: мод + мастерство + экспертиза + ручная поправка. */
export function skillValue(
  skill: Pick<DnDSkill, 'name' | 'proficient' | 'expertise' | 'manualModifier'>,
  stats: AbilityScores,
  proficiencyBonus: number,
): number {
  const ability = SKILL_ABILITY[skill.name];
  if (!ability) return skill.manualModifier ?? 0;
  const modifier = statModifier(stats, ability);
  return (
    modifier +
    (skill.proficient ? proficiencyBonus : 0) +
    (skill.expertise ? proficiencyBonus : 0) +
    (skill.manualModifier ?? 0)
  );
}

/** DC спасения от заклинаний: 8 + мастерство + мод характеристики. */
export function spellSaveDc(
  ability: DnDAbility | 'none' | undefined,
  stats: AbilityScores,
  proficiencyBonus: number,
): number {
  if (!ability || ability === 'none') return 8 + proficiencyBonus;
  return 8 + proficiencyBonus + statModifier(stats, ability);
}

/** Строка бонуса атаки заклинанием в формате листа: `+7` или `-1`. */
export function spellAttackBonus(
  ability: DnDAbility | 'none' | undefined,
  stats: AbilityScores,
  proficiencyBonus: number,
): string {
  const modifier =
    !ability || ability === 'none' ? 0 : statModifier(stats, ability);
  const total = proficiencyBonus + modifier;
  return total >= 0 ? `+${total}` : `${total}`;
}

/** Запись колдовства: у `none` значения не наши — оставляем как есть. */
function deriveSpellcastingEntry(
  entry: SpellcastingEntry,
  stats: AbilityScores,
  proficiencyBonus: number,
): SpellcastingEntry {
  if (entry.ability === 'none') return entry;
  return {
    ...entry,
    attackBonus: spellAttackBonus(entry.ability, stats, proficiencyBonus),
    saveDC: spellSaveDc(entry.ability, stats, proficiencyBonus),
  };
}

/**
 * Пересчитать производные значения листа 5e.
 *
 * `spellSaveDifficulty` не создаётся заново: если поле есть, оно получает
 * вычисленное значение, если его нет — оно и не появляется (derive не меняет
 * состав полей).
 */
export function deriveDnd5e(character: DnD5eCharacter): DnD5eCharacter {
  const proficiencyBonus = proficiencyBonusForLevel(character.level);
  const stats = character.stats;

  const derived: DnD5eCharacter = {
    ...character,
    proficiencyBonus,
    savingThrows: character.savingThrows.map((save) => ({
      ...save,
      value: savingThrowValue(save, stats, proficiencyBonus),
    })),
    skills: character.skills.map((skill) => ({
      ...skill,
      value: skillValue(skill, stats, proficiencyBonus),
    })),
  };

  if (
    character.spellSaveDifficulty !== undefined &&
    character.spellcastingAbility !== undefined
  ) {
    derived.spellSaveDifficulty = spellSaveDc(
      character.spellcastingAbility,
      stats,
      proficiencyBonus,
    );
  }

  if (character.spellcastingEntries) {
    derived.spellcastingEntries = character.spellcastingEntries.map((entry) =>
      deriveSpellcastingEntry(entry, stats, proficiencyBonus),
    );
  }

  return derived;
}
