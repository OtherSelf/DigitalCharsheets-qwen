/**
 * ─── LANDMARK: DH2E DATA TYPES ─────────────────────────────────────────────
 * Типы данных 2-й редакции, которые генерируются из контент-каталога
 * workspace (`scripts/dh2e/generate.mjs`). Модуль не читает `content/` в
 * runtime: сгенерированные файлы лежат рядом и коммитятся.
 *
 * Идентификаторы характеристик здесь — ключи `stats` листа (`weaponSkill`),
 * идентификаторы аптитюд — смысловые (`weapon-skill`): это разные домены,
 * и совпадение написания у части из них намеренное (аптитюда характеристики
 * называется так же, как сама характеристика).
 */

export type Dh2eAptitudeGroup = 'general' | 'characteristic' | 'other';

export interface Dh2eAptitude {
  readonly id: string;
  readonly labelKey: string;
  readonly group: Dh2eAptitudeGroup;
}

export interface Dh2eCharacteristic {
  readonly id: string;
  readonly labelKey: string;
  readonly short: string;
  readonly purchasable: boolean;
  readonly aptitudeIds: readonly string[];
}

export interface Dh2eCharacteristicModifiers {
  readonly plus: readonly string[];
  readonly minus: readonly string[];
}

export interface Dh2eChoice<T> {
  readonly choose: number;
  readonly of: readonly T[];
}

export interface Dh2eHomeWorld {
  readonly id: string;
  readonly labelKey: string;
  readonly characteristicModifiers: Dh2eCharacteristicModifiers;
  readonly fateThreshold: number;
  readonly emperorsBlessing: number;
  readonly wounds: string;
  readonly aptitudeId: string;
  readonly bonusKey: string;
  readonly recommendedBackgroundIds: readonly string[];
}

export interface Dh2eSkillGrant {
  readonly skillId: string;
  readonly specialisation?: string;
}

export type Dh2eSkillGrantSlot = Dh2eSkillGrant | Dh2eChoice<Dh2eSkillGrant>;

export interface Dh2eTalentGrant {
  readonly talentId: string;
  readonly specialisation?: string;
  readonly specialisations?: readonly string[];
}

export type Dh2eTalentGrantSlot = Dh2eTalentGrant | Dh2eChoice<Dh2eTalentGrant>;

/** Стартовые черты бэкграунда: `choose: 1` — «одна из» (например, Mutant). */
export interface Dh2eBackgroundTraits {
  readonly choose?: number;
  readonly keys: readonly string[];
}

export interface Dh2eBackground {
  readonly id: string;
  readonly labelKey: string;
  readonly startingSkills: readonly Dh2eSkillGrantSlot[];
  readonly startingTalents: readonly Dh2eTalentGrantSlot[];
  readonly bonusKeys: readonly string[];
  readonly aptitudeChoice: readonly string[];
  readonly recommendedRoleIds: readonly string[];
  readonly startingTraits?: Dh2eBackgroundTraits;
  readonly startingCorruption?: number;
  readonly startingMalignancy?: number;
  /** Пол, который бэкграунд фиксирует правилами (Адептус Сороритас — female). */
  readonly genderLock?: 'male' | 'female';
}

export type Dh2eAptitudeSlot = string | Dh2eChoice<string>;

export interface Dh2eRole {
  readonly id: string;
  readonly labelKey: string;
  readonly aptitudes: readonly Dh2eAptitudeSlot[];
  readonly talentChoice: Dh2eChoice<string>;
  readonly bonusKey: string;
}

export interface Dh2eDivination {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly textKey: string;
  readonly effectKey: string;
  readonly deltas?: Readonly<Record<string, number>>;
  readonly deltasElse?: Readonly<Record<string, number>>;
  readonly choices?: readonly Readonly<Record<string, unknown>>[];
  readonly fateThreshold?: number;
  readonly corruptionFirst?: number;
  readonly insanityFirst?: number;
  readonly grants?: readonly Readonly<Record<string, unknown>>[];
}

export interface Dh2eSkill {
  readonly id: string;
  readonly labelKey: string;
  readonly aptitudeIds: readonly string[];
  readonly specialist: boolean;
}

export interface Dh2eTalent {
  readonly id: string;
  readonly labelKey: string;
  readonly hintKey?: string;
  readonly tier: number;
  readonly aptitudeSlots: readonly Dh2eAptitudeSlot[];
  readonly eliteAdvance?: string;
}

export interface Dh2eDiscipline {
  readonly id: string;
  readonly labelKey: string;
  readonly powerCount: number;
}

export interface Dh2ePower {
  readonly id: string;
  readonly labelKey: string;
  readonly disciplineId: string;
  readonly value: number;
}

/**
 * Структурное требование элитного продвижения из каталога. Проверяются
 * все виды, кроме `trait`: черты на листе — свободный текст, поэтому черта
 * остаётся подсказкой в `prereqText`.
 */
export type Dh2eEliteRequirement =
  | {
      readonly kind: 'characteristic';
      /** Ключ характеристики листа (`influence`). */
      readonly characteristic: string;
      readonly min: number;
    }
  | { readonly kind: 'background'; readonly backgroundId: string }
  | { readonly kind: 'gender'; readonly gender: 'male' | 'female' }
  | { readonly kind: 'elite'; readonly eliteId: string }
  | { readonly kind: 'notElite'; readonly eliteId: string }
  | { readonly kind: 'trait'; readonly traitId: string };

export interface Dh2eEliteAdvance {
  readonly id: string;
  readonly labelKey: string;
  readonly cost: number;
  readonly changeKeys: readonly string[];
  /** Полные пререквизиты из книги: показываются рядом с выбором. */
  readonly prereqText?: string;
  /** Требования, которые лист может проверить сам. */
  readonly requirements?: readonly Dh2eEliteRequirement[];
}

export interface Dh2eCostRow {
  readonly two: readonly number[];
  readonly one: readonly number[];
  readonly zero: readonly number[];
}

export interface Dh2eStatStep {
  readonly id: string;
  readonly order: number;
  readonly labelKey: string;
  readonly bonus: number;
}

export interface Dh2eSkillTier {
  readonly id: string;
  readonly rank: number;
  readonly labelKey: string;
  readonly bonus: number;
}

export interface Dh2eTalentTier {
  readonly id: number;
  readonly labelKey: string;
}

/** Ступень доступности и её модификатор к Реквизиции (таблица 5-1). */
export interface Dh2eAvailabilityModifier {
  readonly id: string;
  readonly labelKey: string;
  /** `null` у Ubiquitous: тест не требуется. */
  readonly modifier: number | null;
  readonly automatic: boolean;
}

/** Качество предмета и его модификатор к Реквизиции (таблица 5-2). */
export interface Dh2eCraftsmanshipModifier {
  readonly id: string;
  readonly labelKey: string;
  readonly modifier: number;
}
