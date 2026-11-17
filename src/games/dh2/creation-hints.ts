import {
  DH2E_BACKGROUNDS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from './dh2e-data';
import { grantOption, grantOptionLabel } from './dh2e-grants';
import {
  aptitudeLabels,
  backgroundLabel,
  divinationEffectLabel,
  divinationLabel,
  homeWorldLabel,
  roleLabel,
  talentLabel,
} from './dh2e-labels';
import type {
  Dh2eChoice,
  Dh2eSkillGrantSlot,
  Dh2eTalentGrantSlot,
} from './dh2e-types';
import type { DH2StartingChoices } from './types';

type Translate = (key: string) => string;

/**
 * ─── LANDMARK: DH2 CREATION HINTS ─────────────────────────────────────────
 * Markdown-памятка из выбранного на создании пакета: мир/бэкграунд/роль,
 * бонусы, стартовые навыки/таланты (с уже сделанными выборами), черты,
 * Порча/малигнантность, раны/Судьба, склонности и пророчество.
 *
 * Строки идут в `notes` листа (D11): игрок переносит их на лист вручную и
 * может удалить блок. Никаких новых полей персонажа — только `notes`.
 */
export interface Dh2CreationHintsInput {
  readonly homeWorld: string;
  readonly background: string;
  readonly role: string;
  readonly aptitudes: readonly string[];
  readonly startingChoices?: DH2StartingChoices;
  readonly divination?: string;
  readonly wounds?: number;
  readonly fatePoints?: number;
}

function isChoice<T>(slot: T | Dh2eChoice<T>): slot is Dh2eChoice<T> {
  return (
    typeof slot === 'object' &&
    slot !== null &&
    'choose' in slot &&
    Array.isArray((slot as Dh2eChoice<T>).of)
  );
}

function skillSlotsText(
  slots: readonly Dh2eSkillGrantSlot[],
  chosen: readonly string[] | undefined,
  t: Translate,
): string {
  let choiceIndex = 0;
  return slots
    .map((slot) => {
      if (isChoice(slot)) {
        const value = chosen?.[choiceIndex];
        choiceIndex += 1;
        const picked = slot.of.find(
          (option) => grantOption('skill', option).key === value,
        );
        if (picked) {
          return `${t('dh2.chosenPrefix')} ${grantOptionLabel(grantOption('skill', picked), t)}`;
        }
        return slot.of
          .map((option) => grantOptionLabel(grantOption('skill', option), t))
          .join(' / ');
      }
      return grantOptionLabel(grantOption('skill', slot), t);
    })
    .join(', ');
}

function talentSlotsText(
  slots: readonly Dh2eTalentGrantSlot[],
  chosen: readonly string[] | undefined,
  t: Translate,
): string {
  let choiceIndex = 0;
  return slots
    .map((slot) => {
      if (isChoice(slot)) {
        const value = chosen?.[choiceIndex];
        choiceIndex += 1;
        const picked = slot.of.find(
          (option) => grantOption('talent', option).key === value,
        );
        if (picked) {
          return `${t('dh2.chosenPrefix')} ${grantOptionLabel(grantOption('talent', picked), t)}`;
        }
        return slot.of
          .map((option) => grantOptionLabel(grantOption('talent', option), t))
          .join(' / ');
      }
      return grantOptionLabel(grantOption('talent', slot), t);
    })
    .join(', ');
}

function roleTalentText(
  talents: readonly string[],
  chosen: string | undefined,
  t: Translate,
): string {
  if (chosen) {
    return talents.includes(chosen)
      ? `${t('dh2.chosenPrefix')} ${talentLabel(chosen, t)}`
      : chosen;
  }
  return talents.map((id) => talentLabel(id, t)).join(' / ');
}

export function dh2CreationHintsMarkdown(
  input: Dh2CreationHintsInput,
  t: Translate,
): string {
  const lines: string[] = [
    `# ${t('dh2.creationHintsTitle')}`,
    '',
    t('dh2.creationHintsIntro'),
    '',
  ];

  const world = DH2E_HOMEWORLDS.find((item) => item.id === input.homeWorld);
  if (world) {
    lines.push(
      `## ${t('dh2.stageHomeWorld')}: ${homeWorldLabel(world.id, t)}`,
      `- ${t(world.bonusKey)}`,
      `- ${t('dh2.wounds')}: ${world.wounds}${
        input.wounds !== undefined ? ` (${input.wounds})` : ''
      }`,
      `- ${t('dh2.fate')}: ${world.fateThreshold} (${t(
        'dh2.emperorsBlessing',
      )} ${world.emperorsBlessing}+)${
        input.fatePoints !== undefined ? ` (${input.fatePoints})` : ''
      }`,
      '',
    );
  }

  const background = DH2E_BACKGROUNDS.find(
    (item) => item.id === input.background,
  );
  if (background) {
    lines.push(
      `## ${t('dh2.background')}: ${backgroundLabel(background.id, t)}`,
    );
    for (const key of background.bonusKeys) lines.push(`- ${t(key)}`);
    if (background.startingSkills.length > 0) {
      lines.push(
        `- ${t('dh2.startingSkills')}: ${skillSlotsText(
          background.startingSkills,
          input.startingChoices?.skills,
          t,
        )}`,
      );
    }
    if (background.startingTalents.length > 0) {
      lines.push(
        `- ${t('dh2.startingTalents')}: ${talentSlotsText(
          background.startingTalents,
          input.startingChoices?.talents,
          t,
        )}`,
      );
    }
    if (background.startingTraits) {
      const traits = background.startingTraits.keys
        .map((key) => t(key))
        .join(', ');
      const choose =
        background.startingTraits.choose === 1
          ? `${t('dh2.chooseOnePrefix')} `
          : '';
      lines.push(`- ${t('dh2.startingTraits')}: ${choose}${traits}`);
    }
    if (background.startingCorruption !== undefined) {
      lines.push(
        `- ${t('dh2.startingCorruption')}: ${background.startingCorruption}`,
      );
    }
    if (background.startingMalignancy !== undefined) {
      lines.push(
        `- ${t('dh2.startingMalignancy')}: ${background.startingMalignancy}`,
      );
    }
    lines.push('');
  }

  const role = DH2E_ROLES.find((item) => item.id === input.role);
  if (role) {
    lines.push(`## ${t('dh2.role')}: ${roleLabel(role.id, t)}`);
    lines.push(`- ${t(role.bonusKey)}`);
    lines.push(
      `- ${t('dh2.roleTalent')}: ${roleTalentText(
        role.talentChoice.of,
        input.startingChoices?.roleTalent,
        t,
      )}`,
    );
    lines.push('');
  }

  if (input.aptitudes.length > 0) {
    lines.push(
      `## ${t('dh2.aptitudes')}`,
      '',
      aptitudeLabels(input.aptitudes, t),
      '',
    );
  }

  const divination = input.divination
    ? DH2E_DIVINATIONS.find((item) => item.id === input.divination)
    : undefined;
  if (divination) {
    lines.push(
      `## ${t('dh2.divination')}`,
      '',
      `${divinationLabel(divination.id, t)}: ${divinationEffectLabel(
        divination.id,
        t,
      )}`,
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
