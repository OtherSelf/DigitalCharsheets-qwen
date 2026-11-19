/**
 * ─── LANDMARK: DH2E STARTING GRANTS ────────────────────────────────────────
 * Стартовые навыки и таланты бэкграунда бывают «одно из»: слот `choose/of`.
 * Игрок выбирает вариант при создании, выбор фиксируется в
 * `startingChoices` и показывается подсказкой (на лист вносится вручную).
 *
 * Ключ варианта — `id` плюс специализация (`operate:any`,
 * `weapon-training:flame`): у Ministorum оба варианта — один и тот же талант
 * с разными специализациями, поэтому одного `talentId` мало.
 */

import { DH2E_SKILLS, DH2E_TALENTS } from './dh2e-reference';
import type {
  Dh2eBackground,
  Dh2eChoice,
  Dh2eRole,
  Dh2eSkillGrant,
  Dh2eSkillGrantSlot,
  Dh2eTalentGrant,
  Dh2eTalentGrantSlot,
} from './dh2e-types';
import type { DH2StartingChoices } from './types';

export type Dh2eGrantKind = 'skill' | 'talent';

export interface Dh2eGrantOption {
  readonly key: string;
  readonly labelKey: string;
  readonly specialisation?: string;
  readonly specialisations?: readonly string[];
}

export interface Dh2eGrantChoice {
  readonly kind: Dh2eGrantKind;
  /** Порядковый номер среди выборов того же вида (0-based). */
  readonly index: number;
  /** Индекс слота в исходном списке пакета: нужен для подсказки. */
  readonly slotIndex: number;
  readonly options: readonly Dh2eGrantOption[];
}

type Translate = (key: string) => string;

const SKILL_KEYS = new Map(DH2E_SKILLS.map((item) => [item.id, item.labelKey]));
const TALENT_KEYS = new Map(
  DH2E_TALENTS.map((item) => [item.id, item.labelKey]),
);

function isChoice<T>(slot: T | Dh2eChoice<T>): slot is Dh2eChoice<T> {
  return (
    typeof slot === 'object' &&
    slot !== null &&
    'choose' in slot &&
    Array.isArray((slot as Dh2eChoice<T>).of)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionKey(
  id: string,
  specialisation?: string,
  specialisations?: readonly string[],
): string {
  const spec =
    specialisations && specialisations.length > 0
      ? specialisations.join('+')
      : specialisation;
  return spec ? `${id}:${spec}` : id;
}

function skillOption(grant: Dh2eSkillGrant): Dh2eGrantOption {
  return {
    key: optionKey(grant.skillId, grant.specialisation),
    labelKey: SKILL_KEYS.get(grant.skillId) ?? grant.skillId,
    specialisation: grant.specialisation,
  };
}

function talentOption(grant: Dh2eTalentGrant): Dh2eGrantOption {
  return {
    key: optionKey(grant.talentId, grant.specialisation, grant.specialisations),
    labelKey: TALENT_KEYS.get(grant.talentId) ?? grant.talentId,
    specialisation: grant.specialisation,
    specialisations: grant.specialisations,
  };
}

/** Вариант пакета как элемент выбора: ключ, подпись, специализация. */
export function grantOption(
  kind: Dh2eGrantKind,
  grant: Dh2eSkillGrant | Dh2eTalentGrant,
): Dh2eGrantOption {
  return kind === 'skill'
    ? skillOption(grant as Dh2eSkillGrant)
    : talentOption(grant as Dh2eTalentGrant);
}

function choiceSlots<T>(
  slots: readonly (T | Dh2eChoice<T>)[],
): { slotIndex: number; of: readonly T[] }[] {
  const result: { slotIndex: number; of: readonly T[] }[] = [];
  slots.forEach((slot, slotIndex) => {
    if (isChoice(slot)) result.push({ slotIndex, of: slot.of });
  });
  return result;
}

/** Все места выбора в стартовом пакете бэкграунда (навыки, затем таланты). */
export function backgroundGrantChoices(
  background: Dh2eBackground,
): Dh2eGrantChoice[] {
  const choices: Dh2eGrantChoice[] = [];

  choiceSlots<Dh2eSkillGrant>(
    background.startingSkills as readonly Dh2eSkillGrantSlot[],
  ).forEach((slot, index) => {
    choices.push({
      kind: 'skill',
      index,
      slotIndex: slot.slotIndex,
      options: slot.of.map(skillOption),
    });
  });

  choiceSlots<Dh2eTalentGrant>(
    background.startingTalents as readonly Dh2eTalentGrantSlot[],
  ).forEach((slot, index) => {
    choices.push({
      kind: 'talent',
      index,
      slotIndex: slot.slotIndex,
      options: slot.of.map(talentOption),
    });
  });

  return choices;
}

function grantChoicesOf(
  background: Dh2eBackground | undefined,
  kind: Dh2eGrantKind,
): Dh2eGrantChoice[] {
  if (!background) return [];
  return backgroundGrantChoices(background).filter(
    (choice) => choice.kind === kind,
  );
}

/** Значения выбора по слотам вида: `''` — игрок ещё не выбрал. */
export function grantValues(
  background: Dh2eBackground | undefined,
  kind: Dh2eGrantKind,
  selected: Readonly<Record<string, string>>,
): string[] {
  return grantChoicesOf(background, kind).map(
    (choice) => selected[`${kind}:${choice.index}`] ?? '',
  );
}

/** Человеческий текст варианта: подпись справочника + специализация. */
export function grantOptionLabel(
  option: Dh2eGrantOption,
  t: Translate,
): string {
  const base = t(option.labelKey);
  const spec =
    option.specialisations && option.specialisations.length > 0
      ? option.specialisations.join(' / ')
      : option.specialisation;
  return spec ? `${base} (${spec})` : base;
}

/** Подписи выбранных навыков/талантов бэкграунда для листа и экспорта. */
export function startingChoiceLabels(
  background: Dh2eBackground | undefined,
  kind: Dh2eGrantKind,
  values: readonly string[] | undefined,
  t: Translate,
): string[] {
  if (!values) return [];
  return grantChoicesOf(background, kind)
    .map((choice) => {
      const value = values[choice.index];
      const option = choice.options.find((item) => item.key === value);
      return option ? grantOptionLabel(option, t) : '';
    })
    .filter(Boolean);
}

/**
 * Читает `startingChoices` из формы или JSON, отбрасывая значения, которых
 * нет в пакете выбранных мира/бэкграунда/роли (данные каталога могли
 * измениться).
 */
export function readStartingChoices(
  input: unknown,
  background: Dh2eBackground | undefined,
  role: Dh2eRole | undefined,
): DH2StartingChoices {
  const raw = isRecord(input) ? input : {};
  const rawRoleTalent =
    typeof raw.roleTalent === 'string' ? raw.roleTalent : '';
  const roleTalent =
    role && role.talentChoice.of.includes(rawRoleTalent)
      ? rawRoleTalent
      : undefined;

  const values = (kind: Dh2eGrantKind): string[] => {
    const source = raw[kind === 'skill' ? 'skills' : 'talents'];
    return grantChoicesOf(background, kind).map((choice) => {
      const value = Array.isArray(source) ? source[choice.index] : undefined;
      return typeof value === 'string' &&
        choice.options.some((option) => option.key === value)
        ? value
        : '';
    });
  };

  return {
    ...(roleTalent ? { roleTalent } : {}),
    skills: values('skill'),
    talents: values('talent'),
  };
}
