import { createExcelSections } from '../shared/excel';
import type { ExcelSection, ExportTranslate, GameExportConfig } from '../types';
import { upgradeBonus } from './dh-stats';
import { genderLabel } from './gender';
import {
  characteristicLabel,
  resolveSkillCharacteristic,
} from './skill-characteristic';
import type { DarkHeresyStatUpgrade, DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 EXCEL ─────────────────────────────────────────────────
 * Секции Excel для Dark Heresy 1-й редакции. Модуль не зависит от второй
 * редакции: состав характеристик, усталость и колонка `+30` зафиксированы.
 */
export function buildDh1ExcelSections(
  character: DH1Character,
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
  const fatigue = character.fatigue1st;

  const statLabels: [string, string][] = [
    ['weaponSkill', 'dh1.weaponSkill'],
    ['ballisticSkill', 'dh1.ballisticSkill'],
    ['strength', 'dh1.strength'],
    ['toughness', 'dh1.toughness'],
    ['agility', 'dh1.agility'],
    ['intelligence', 'dh1.intelligence'],
    ['perception', 'dh1.perception'],
    ['willpower', 'dh1.willpower'],
    ['fellowship', 'dh1.fellowship'],
  ];

  if (config.includeBasicInfo) {
    w.section('dh1.excel.basicInformation');
    w.row('dh1.excel.name', character.name);
    w.row('dh1.excel.classCareer', character.characterClass);
    w.row('dh1.rank', character.rank);
    w.row('dh1.homeWorld', character.homeWorld);
    w.row('dh1.worldVariant', character.worldVariant);
    w.row('dh1.careerPath', character.careerPath);
    w.row('dh1.divination', character.divination);
    w.row('dh1.divinationEffect', character.divinationEffect);
    w.row('dh1.quirk', character.quirk);
    w.row('common.age', character.age);
    w.row('common.height', character.height);
    w.row('common.weight', character.weight);
    w.row('dh1.skinColor', character.skinColor);
    w.row('dh1.hairColor', character.hairColor);
    w.row('dh1.eyeColor', character.eyeColor);
    w.row('dh1.gender', genderLabel(character.identity?.gender ?? '', t));
    w.row('dh1.build', character.identity?.build ?? '');
    w.row('dh1.handedness', character.identity?.handedness ?? '');
    w.row('dh1.experience', character.experience);
    w.row('dh1.totalExpSpent', character.totalExpSpent);
    w.row('dh1.alternatePath', character.alternatePath);
    w.row('dh1.advancedPath', character.advancedPath);
  }

  if (config.includeStats) {
    w.section('dh1.excel.characteristics');
    for (const [key, labelKey] of statLabels) {
      const base = stats[key] ?? 0;
      const bonus = upgradeBonus(upgrades[key]);
      const note = notes[key];
      w.row(labelKey, `${base + bonus}${note ? ` — ${note}` : ''}`);
    }
  }

  if (config.includeCombat) {
    w.section('dh1.excel.combat');
    w.row(
      'dh1.wounds',
      `${character.wounds.current} / ${character.wounds.max}`,
    );
    w.row('dh1.excel.woundsNotes', character.wounds.notes);
    w.row(
      'dh1.fatePoints',
      `${character.fatePoints.current} / ${character.fatePoints.max}`,
    );
    w.row('dh1.excel.fateNotes', character.fatePoints.notes);
    w.row('dh1.excel.insanityPoints', character.insanityPoints.total);
    w.row('dh1.excel.insanityNotes', character.insanityPoints.notes);
    w.row('dh1.excel.corruptionPoints', character.corruptionPoints.total);
    w.row('dh1.excel.corruptionNotes', character.corruptionPoints.notes);
    w.row('dh1.traits', w.list(character.traits ?? []));
    w.row('dh1.mutations', w.list(character.mutations ?? []));
    w.row('dh1.eliteAdvances', w.list(character.eliteAdvances ?? []));
    if (character.psy) {
      w.row('dh1.psyRating', character.psy.rating ?? '');
      w.row('dh1.discipline', character.psy.discipline ?? '');
      w.row('dh1.psychicPowers', w.list(character.psy.powers ?? []));
      w.row('dh1.testedAgainst', character.psy.testedAgainst ?? '');
    }
    if (character.insanityDetails) {
      w.row('dh1.insanityDegree', character.insanityDetails.degree ?? '');
      w.row(
        'dh1.traumaModifier',
        character.insanityDetails.traumaModifier ?? '',
      );
      w.row('dh1.disorders', character.insanityDetails.disorders ?? '');
      w.row('dh1.severity', character.insanityDetails.severity ?? '');
    }
    if (character.corruptionDetails) {
      w.row('dh1.corruptionDegree', character.corruptionDetails.degree ?? '');
      w.row('dh1.corruptionTest', character.corruptionDetails.test ?? '');
      w.row('dh1.defilements', character.corruptionDetails.defilements ?? '');
    }
    w.row('dh1.excel.fatigue', fatigue.current);
    w.row('dh1.excel.fatigueNotes', fatigue.notes);

    const conditions = (character.conditions ?? []).filter(
      (condition) => condition.name.trim() !== '',
    );
    if (conditions.length > 0) {
      w.tableHeader([
        'dh1.conditions.name',
        'dh1.conditions.kind',
        'dh1.conditions.effect',
        'dh1.conditions.source',
      ]);
      for (const condition of conditions) {
        w.tableRow([
          condition.name,
          t(`dh1.conditions.kind.${condition.kind}`),
          [condition.severity, condition.effect, condition.notes]
            .filter(Boolean)
            .join(' · '),
          t(`dh1.conditions.source.${condition.source ?? 'manual'}`),
        ]);
      }
    }
    w.row('dh1.criticalConditions', w.list(character.criticalConditions ?? []));
    w.row(
      'dh1.customResources',
      w.list(
        (character.customResources ?? []).map((resource) => ({
          name: `${resource.description}: ${resource.current}/${resource.max}`,
        })),
      ),
    );
    w.row(
      'dh1.excel.movement',
      [
        `${t('dh1.excel.movementWalkHalf')}: ${character.movement.walkHalf}`,
        `${t('dh1.excel.movementWalkFull')}: ${character.movement.walkFull}`,
        `${t('dh1.excel.movementCharge')}: ${character.movement.charge}`,
        `${t('dh1.excel.movementRun')}: ${character.movement.run}`,
      ].join(', '),
    );
  }

  if (config.includeCombat) {
    w.section('dh1.excel.skills');
    w.tableHeader([
      'dh1.excel.name',
      'dh1.excel.characteristic',
      'dh1.excel.skillType',
      'dh1.excel.skilled',
      'dh1.excel.plus10',
      'dh1.excel.plus20',
    ]);
    for (const skill of character.skills ?? []) {
      // Характеристика — отдельное поле; у старых строк её выводим из
      // суффикса названия, иначе экспорт потерял бы её после чистого имени.
      const { name, code, suffix } = resolveSkillCharacteristic(skill);
      w.tableRow([
        name,
        code ? characteristicLabel(code, t) : (suffix ?? ''),
        skill.type,
        skill.training.skilled,
        skill.training.plus10,
        skill.training.plus20,
      ]);
    }

    const talents = character.talents ?? [];
    if (talents.length > 0) {
      w.section('dh1.excel.talents');
      w.tableHeader(['dh1.excel.name', 'dh1.excel.description']);
      for (const talent of talents) {
        w.tableRow([talent.name, talent.description ?? talent.notes ?? '']);
      }
    }
  }

  if (config.includeEquipment) {
    w.section('dh1.excel.equipmentInventory');
    w.sub('dh1.excel.armor');
    const armorLabels: [keyof typeof character.equipment.armor, string][] = [
      ['Head', 'dh1.excel.armorHead'],
      ['Body', 'dh1.excel.armorBody'],
      ['Left arm', 'dh1.excel.armorLeftArm'],
      ['Right arm', 'dh1.excel.armorRightArm'],
      ['Left leg', 'dh1.excel.armorLeftLeg'],
      ['Right leg', 'dh1.excel.armorRightLeg'],
    ];
    for (const [part, labelKey] of armorLabels) {
      const piece = character.equipment.armor[part];
      if (!piece) continue;
      w.row(
        labelKey,
        `AP ${piece.ap} · ${piece.type} · ${piece.quality}${
          piece.weight ? ` · ${piece.weight}` : ''
        }`,
      );
    }
    w.row('dh1.armourWeight', character.equipment.armorWeight ?? '');
    w.row('dh1.totalCarriedWeight', character.carry?.totalCarriedWeight ?? '');
    w.row('dh1.carryWeight', character.carry?.carry ?? '');
    w.row('dh1.liftWeight', character.carry?.lift ?? '');
    w.row('dh1.pushWeight', character.carry?.push ?? '');
    w.sub('dh1.excel.weapons');
    w.tableHeader([
      'dh1.excel.name',
      'dh1.excel.weaponType',
      'dh1.excel.range',
      'dh1.excel.damage',
      'dh1.weaponPenetration',
      'dh1.excel.traits',
    ]);
    for (const weapon of character.equipment.weapons.melee) {
      w.tableRow([
        weapon.name,
        weapon.type,
        weapon.range,
        weapon.damage,
        weapon.penetration,
        weapon.traits,
      ]);
    }
    for (const weapon of character.equipment.weapons.ranged) {
      w.tableRow([
        weapon.name,
        weapon.type,
        weapon.range,
        weapon.damage,
        weapon.penetration ?? '',
        weapon.traits,
      ]);
    }
  }

  if (config.includeInventory) {
    w.sub('dh1.excel.inventory');
    w.raw(`    ${w.list(character.inventory ?? [])}`);
    w.sub('dh1.excel.wealth');
    w.row('dh1.throneGelt', character.wealth.throneGelt);
    w.row('dh1.monthlyIncome', character.wealth.monthlyIncome);
    w.row('dh1.excel.wealthNotes', character.wealth.notes);
  }

  if (config.includeNarrative) {
    w.section('dh1.excel.narrative');
    w.row('dh1.excel.backstory', character.backstory);
    w.row('common.notes', character.notes);
    for (const tab of character.noteTabs ?? []) {
      w.row(tab.title, tab.body);
    }
  }

  if (config.includeQuestLog) {
    const quests = character.questLog ?? [];
    if (quests.length > 0) {
      w.section('dh1.excel.questLog');
      w.tableHeader([
        'dh1.excel.questTitle',
        'dh1.excel.questStatus',
        'dh1.excel.description',
        'dh1.excel.rewards',
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
      w.section('dh1.excel.houseRules');
      for (const rule of rules) {
        w.tableRow([rule.name, rule.description]);
      }
    }
  }

  return w.sections;
}
