import { upgradeBonus } from '@/games/shared/dh-stats';

import { createExcelSections } from '../shared/excel';
import type { ExcelSection, ExportTranslate, GameExportConfig } from '../types';
import { DH2E_BACKGROUNDS } from './dh2e-data';
import { startingChoiceLabels } from './dh2e-grants';
import {
  aptitudeLabels,
  backgroundLabel,
  divinationEffectLabel,
  divinationLabel,
  eliteAdvanceLabel,
  homeWorldLabel,
  roleLabel,
  talentLabel,
} from './dh2e-labels';
import type { DarkHeresyStatUpgrade, DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 EXCEL ─────────────────────────────────────────────────
 * Секции Excel для Dark Heresy 2-й редакции. Модуль не зависит от второй
 * редакции: состав характеристик, усталость и колонка `+30` зафиксированы.
 */
export function buildDh2ExcelSections(
  character: DH2Character,
  config: GameExportConfig,
  t: ExportTranslate,
): readonly ExcelSection[] {
  const w = createExcelSections(t);
  const stats = character.stats as unknown as Record<string, number>;
  const upgrades = character.statUpgrades as unknown as Record<
    string,
    DarkHeresyStatUpgrade | undefined
  >;
  const notes = (character.statNotes ?? {}) as Record<string, string>;
  const fatigue = character.fatigue2nd;

  const statLabels: [string, string][] = [
    ['weaponSkill', 'dh2.weaponSkill'],
    ['ballisticSkill', 'dh2.ballisticSkill'],
    ['strength', 'dh2.strength'],
    ['toughness', 'dh2.toughness'],
    ['agility', 'dh2.agility'],
    ['intelligence', 'dh2.intelligence'],
    ['perception', 'dh2.perception'],
    ['willpower', 'dh2.willpower'],
    ['fellowship', 'dh2.fellowship'],
    ['influence', 'dh2.influence'],
  ];

  if (config.includeBasicInfo) {
    w.section('dh2.excel.basicInformation');
    w.row('dh2.excel.name', character.name);
    w.row('dh2.homeWorld', homeWorldLabel(character.homeWorld, t));
    w.row('dh2.background', backgroundLabel(character.background, t));
    w.row('dh2.role', roleLabel(character.role, t));
    w.row('dh2.aptitudes', aptitudeLabels(character.aptitudes.profile, t));
    const backgroundEntry = DH2E_BACKGROUNDS.find(
      (item) => item.id === character.background,
    );
    const starting = character.startingChoices;
    if (starting?.roleTalent) {
      w.row('dh2.roleTalent', talentLabel(starting.roleTalent, t));
    }
    const chosenSkills = startingChoiceLabels(
      backgroundEntry,
      'skill',
      starting?.skills,
      t,
    );
    if (chosenSkills.length > 0) {
      w.row('dh2.startingSkillsChosen', chosenSkills.join(', '));
    }
    const chosenTalents = startingChoiceLabels(
      backgroundEntry,
      'talent',
      starting?.talents,
      t,
    );
    if (chosenTalents.length > 0) {
      w.row('dh2.startingTalentsChosen', chosenTalents.join(', '));
    }
    w.row(
      'dh2.eliteAdvances',
      character.eliteAdvances.map((id) => eliteAdvanceLabel(id, t)).join(', '),
    );
    w.row('dh2.psyRating', character.psy.rating);
    w.row('dh2.psyDisciplines', character.psy.disciplines.join(', '));
    w.row('dh2.psyPowers', character.psy.powers.join(', '));
    w.row('dh2.divination', divinationLabel(character.divination, t));
    w.row(
      'dh2.divinationEffect',
      divinationEffectLabel(character.divination, t),
    );
    w.row('common.age', character.age);
    w.row('common.height', character.height);
    w.row('common.weight', character.weight);
    w.row('dh2.skinColor', character.skinColor);
    w.row('dh2.hairColor', character.hairColor);
    w.row('dh2.eyeColor', character.eyeColor);
    w.row('dh2.experience', character.experience);
    w.row('dh2.totalExpSpent', character.totalExpSpent);
  }

  if (config.includeStats) {
    w.section('dh2.excel.characteristics');
    for (const [key, labelKey] of statLabels) {
      const base = stats[key] ?? 0;
      const bonus = upgradeBonus(upgrades[key]);
      const note = notes[key];
      w.row(labelKey, `${base + bonus}${note ? ` — ${note}` : ''}`);
    }
  }

  if (config.includeCombat) {
    w.section('dh2.excel.combat');
    w.row(
      'dh2.wounds',
      `${character.wounds.current} / ${character.wounds.max}`,
    );
    w.row('dh2.excel.woundsNotes', character.wounds.notes);
    w.row(
      'dh2.fatePoints',
      `${character.fatePoints.current} / ${character.fatePoints.max}`,
    );
    w.row('dh2.excel.fateNotes', character.fatePoints.notes);
    w.row('dh2.excel.insanityPoints', character.insanityPoints.total);
    w.row('dh2.excel.insanityNotes', character.insanityPoints.notes);
    w.row('dh2.excel.corruptionPoints', character.corruptionPoints.total);
    w.row('dh2.excel.corruptionNotes', character.corruptionPoints.notes);
    w.row('dh2.excel.fatigue', fatigue.current);
    w.row('dh2.excel.fatigueNotes', fatigue.notes);

    const conditions = (character.conditions ?? []).filter(
      (condition) => condition.name.trim() !== '',
    );
    if (conditions.length > 0) {
      w.tableHeader([
        'dh2.conditions.name',
        'dh2.conditions.kind',
        'dh2.conditions.effect',
        'dh2.conditions.source',
      ]);
      for (const condition of conditions) {
        w.tableRow([
          condition.name,
          t(`dh2.conditions.kind.${condition.kind}`),
          [condition.severity, condition.effect, condition.notes]
            .filter(Boolean)
            .join(' · '),
          t(`dh2.conditions.source.${condition.source ?? 'manual'}`),
        ]);
      }
    }
    w.row('dh2.criticalConditions', w.list(character.criticalConditions ?? []));
    w.row(
      'dh2.customResources',
      w.list(
        (character.customResources ?? []).map((resource) => ({
          name: `${resource.description}: ${resource.current}/${resource.max}`,
        })),
      ),
    );
    w.row(
      'dh2.excel.movement',
      [
        `${t('dh2.excel.movementWalkHalf')}: ${character.movement.walkHalf}`,
        `${t('dh2.excel.movementWalkFull')}: ${character.movement.walkFull}`,
        `${t('dh2.excel.movementCharge')}: ${character.movement.charge}`,
        `${t('dh2.excel.movementRun')}: ${character.movement.run}`,
      ].join(', '),
    );
  }

  if (config.includeCombat) {
    w.section('dh2.skills');
    w.tableHeader([
      'dh2.excel.name',
      'dh2.excel.skillType',
      'dh2.excel.skilled',
      'dh2.excel.plus10',
      'dh2.excel.plus20',
      'dh2.excel.plus30',
    ]);
    for (const skill of character.skills ?? []) {
      w.tableRow([
        skill.name,
        skill.type,
        skill.training.skilled,
        skill.training.plus10,
        skill.training.plus20,
        skill.training.plus30,
      ]);
    }

    const talents = character.talents ?? [];
    if (talents.length > 0) {
      w.section('dh2.excel.talents');
      w.tableHeader(['dh2.excel.name', 'dh2.excel.description']);
      for (const talent of talents) {
        w.tableRow([talent.name, talent.description ?? talent.notes ?? '']);
      }
    }
  }

  if (config.includeEquipment) {
    w.section('dh2.excel.equipmentInventory');
    w.sub('dh2.excel.armor');
    const armorLabels: [keyof typeof character.equipment.armor, string][] = [
      ['Head', 'dh2.excel.armorHead'],
      ['Body', 'dh2.excel.armorBody'],
      ['Left arm', 'dh2.excel.armorLeftArm'],
      ['Right arm', 'dh2.excel.armorRightArm'],
      ['Left leg', 'dh2.excel.armorLeftLeg'],
      ['Right leg', 'dh2.excel.armorRightLeg'],
    ];
    for (const [part, labelKey] of armorLabels) {
      const piece = character.equipment.armor[part];
      if (!piece) continue;
      w.row(labelKey, `AP ${piece.ap} · ${piece.type} · ${piece.quality}`);
    }
    w.sub('dh2.excel.weapons');
    w.tableHeader([
      'dh2.excel.name',
      'dh2.excel.weaponType',
      'dh2.excel.range',
      'dh2.excel.damage',
      'dh2.excel.traits',
    ]);
    for (const weapon of character.equipment.weapons.melee) {
      w.tableRow([
        weapon.name,
        weapon.type,
        weapon.range,
        weapon.damage,
        weapon.traits,
      ]);
    }
    for (const weapon of character.equipment.weapons.ranged) {
      w.tableRow([
        weapon.name,
        weapon.type,
        weapon.range,
        weapon.damage,
        weapon.traits,
      ]);
    }
  }

  if (config.includeInventory) {
    w.sub('dh2.excel.inventory');
    w.raw(`    ${w.list(character.inventory ?? [])}`);
  }

  if (config.includeNarrative) {
    w.section('dh2.excel.narrative');
    w.row('dh2.excel.backstory', character.backstory);
    w.row('common.notes', character.notes);
  }

  if (config.includeQuestLog) {
    const quests = character.questLog ?? [];
    if (quests.length > 0) {
      w.section('dh2.excel.questLog');
      w.tableHeader([
        'dh2.excel.questTitle',
        'dh2.excel.questStatus',
        'dh2.excel.description',
        'dh2.excel.rewards',
      ]);
      for (const quest of quests) {
        w.tableRow([
          quest.title,
          quest.status,
          quest.description,
          quest.rewards ?? '',
        ]);
      }
    }
  }

  if (config.includeCustomHouseRules) {
    const rules = character.customHouseRules ?? [];
    if (rules.length > 0) {
      w.section('dh2.excel.houseRules');
      for (const rule of rules) {
        w.tableRow([rule.name, rule.description]);
      }
    }
  }

  return w.sections;
}
