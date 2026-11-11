import { createExcelSections } from '../shared/excel';
import type { ExcelSection, ExportTranslate, GameExportConfig } from '../types';
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
    ['strength', 'common.strength'],
    ['toughness', 'dh2.toughness'],
    ['agility', 'dh2.agility'],
    ['intelligence', 'common.intelligence'],
    ['perception', 'common.perception'],
    ['willpower', 'common.willpower'],
    ['fellowship', 'dh2.fellowship'],
    ['influence', 'dh2.influence'],
  ];

  if (config.includeBasicInfo) {
    w.section('io.excel.basicInformation');
    w.row('io.excel.name', character.name);
    w.row('io.excel.classCareer', character.characterClass);
    w.row('dh2.rank', character.rank);
    w.row('dh2.homeWorld', character.homeWorld);
    w.row('dh2.worldVariant', character.worldVariant);
    w.row('dh2.careerPath', character.careerPath);
    w.row('dh2.divination', character.divination);
    w.row('dh2.divinationEffect', character.divinationEffect);
    w.row('dh2.quirk', character.quirk);
    w.row('common.age', character.age);
    w.row('common.height', character.height);
    w.row('common.weight', character.weight);
    w.row('dh2.skinColor', character.skinColor);
    w.row('dh2.hairColor', character.hairColor);
    w.row('dh2.eyeColor', character.eyeColor);
    w.row('dh2.experience', character.experience);
    w.row('dh2.totalExpSpent', character.totalExpSpent);
    w.row('dh2.alternatePath', character.alternatePath);
    w.row('dh2.advancedPath', character.advancedPath);
  }

  if (config.includeStats) {
    w.section('io.excel.characteristics');
    for (const [key, labelKey] of statLabels) {
      const base = stats[key] ?? 0;
      const bonus = (upgrades[key] ?? []).filter(Boolean).length * 5;
      const note = notes[key];
      w.row(labelKey, `${base + bonus}${note ? ` — ${note}` : ''}`);
    }
  }

  if (config.includeCombat) {
    w.section('io.excel.combat');
    w.row(
      'dh2.wounds',
      `${character.wounds.current} / ${character.wounds.max}`,
    );
    w.row('io.excel.woundsNotes', character.wounds.notes);
    w.row(
      'dh2.fatePoints',
      `${character.fatePoints.current} / ${character.fatePoints.max}`,
    );
    w.row('io.excel.fateNotes', character.fatePoints.notes);
    w.row('io.excel.insanityPoints', character.insanityPoints.total);
    w.row('io.excel.insanityNotes', character.insanityPoints.notes);
    w.row('io.excel.corruptionPoints', character.corruptionPoints.total);
    w.row('io.excel.corruptionNotes', character.corruptionPoints.notes);
    w.row('io.excel.fatigueSecond', fatigue.current);
    w.row('io.excel.fatigueNotes', fatigue.notes);
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
      'io.excel.movement',
      [
        `${t('io.excel.movementWalkHalf')}: ${character.movement.walkHalf}`,
        `${t('io.excel.movementWalkFull')}: ${character.movement.walkFull}`,
        `${t('io.excel.movementCharge')}: ${character.movement.charge}`,
        `${t('io.excel.movementRun')}: ${character.movement.run}`,
      ].join(', '),
    );
  }

  if (config.includeCombat) {
    w.section('io.excel.skills');
    w.tableHeader([
      'io.excel.name',
      'io.excel.skillType',
      'io.excel.skilled',
      'io.excel.plus10',
      'io.excel.plus20',
      'io.excel.plus30',
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
      w.section('io.excel.talents');
      w.tableHeader(['io.excel.name', 'io.excel.description']);
      for (const talent of talents) {
        w.tableRow([talent.name, talent.description ?? talent.notes ?? '']);
      }
    }
  }

  if (config.includeEquipment) {
    w.section('io.excel.equipmentInventory');
    w.sub('io.excel.armor');
    const armorLabels: [keyof typeof character.equipment.armor, string][] = [
      ['Head', 'io.excel.armorHead'],
      ['Body', 'io.excel.armorBody'],
      ['Left arm', 'io.excel.armorLeftArm'],
      ['Right arm', 'io.excel.armorRightArm'],
      ['Left leg', 'io.excel.armorLeftLeg'],
      ['Right leg', 'io.excel.armorRightLeg'],
    ];
    for (const [part, labelKey] of armorLabels) {
      const piece = character.equipment.armor[part];
      if (!piece) continue;
      w.row(labelKey, `AP ${piece.ap} · ${piece.type} · ${piece.quality}`);
    }
    w.sub('io.excel.weapons');
    w.tableHeader([
      'io.excel.name',
      'io.excel.weaponType',
      'io.excel.range',
      'io.excel.damage',
      'io.excel.traits',
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
    w.sub('io.excel.inventory');
    w.raw(`    ${w.list(character.inventory ?? [])}`);
    w.sub('io.excel.wealth');
    w.row('dh2.throneGelt', character.wealth.throneGelt);
    w.row('dh2.monthlyIncome', character.wealth.monthlyIncome);
    w.row('io.excel.wealthNotes', character.wealth.notes);
  }

  if (config.includeNarrative) {
    w.section('io.excel.narrative');
    w.row('io.excel.backstory', character.backstory);
    w.row('common.notes', character.notes);
  }

  if (config.includeQuestLog) {
    const quests = character.questLog ?? [];
    if (quests.length > 0) {
      w.section('io.excel.questLog');
      w.tableHeader([
        'io.excel.questTitle',
        'io.excel.questStatus',
        'io.excel.description',
        'io.excel.rewards',
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
      w.section('io.excel.houseRules');
      for (const rule of rules) {
        w.tableRow([rule.name, rule.description]);
      }
    }
  }

  return w.sections;
}
