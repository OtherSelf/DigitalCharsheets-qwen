import { createExcelSections } from '../shared/excel';
import type { ExcelSection, ExportTranslate, GameExportConfig } from '../types';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E EXCEL ─────────────────────────────────────────────────
 * Секции Excel для D&D 5e. Подписи — i18n-ключи, язык выбирает ядро через
 * `translate`. Модуль не знает о конверте/имени файла — только о своих полях.
 */
export function buildDnd5eExcelSections(
  character: DnD5eCharacter,
  config: GameExportConfig,
  t: ExportTranslate,
): readonly ExcelSection[] {
  const w = createExcelSections(t);
  const deathSaves = character.deathSaves ?? { successes: 0, failures: 0 };
  const currency = character.currency ?? {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  };
  const modifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return `${score} (${mod >= 0 ? '+' : ''}${mod})`;
  };

  if (config.includeBasicInfo) {
    w.section('io.excel.basicInformation');
    w.row('io.excel.name', character.name);
    w.row('io.excel.classCareer', character.characterClass);
    w.row('dnd.race', character.race);
    w.row('dnd.background', character.background);
    w.row('dnd.alignment', character.alignment);
    w.row('io.excel.level', character.level);
    w.row('io.excel.experiencePoints', character.experiencePoints);
    w.row('io.excel.proficiencyBonus', character.proficiencyBonus);
    w.row('io.excel.inspiration', character.inspiration);
    w.row('common.age', character.age);
    w.row('common.height', character.height);
    w.row('common.weight', character.weight);
    w.row('io.excel.eyes', character.eyes);
    w.row('io.excel.hair', character.hair);
    w.row('io.excel.skin', character.skin);
  }

  if (config.includeStats) {
    w.section('io.excel.abilityScores');
    const labels: [keyof DnD5eCharacter['stats'], string][] = [
      ['strength', 'common.strength'],
      ['dexterity', 'common.dexterity'],
      ['constitution', 'common.constitution'],
      ['intelligence', 'common.intelligence'],
      ['wisdom', 'common.wisdom'],
      ['charisma', 'common.charisma'],
    ];
    for (const [key, labelKey] of labels) {
      const note = character.statNotes?.[key];
      w.row(
        labelKey,
        `${modifier(character.stats[key])}${note ? ` — ${note}` : ''}`,
      );
    }
  }

  if (config.includeCombat) {
    w.section('io.excel.combat');
    w.row('io.excel.armorClass', character.armorClass);
    w.row('io.excel.speed', `${character.speed} ft.`);
    w.row(
      'io.excel.hitPoints',
      `${character.hitPoints.current} / ${character.hitPoints.max}`,
    );
    w.row('io.excel.temporaryHitPoints', character.temporaryHitPoints);
    w.row('io.excel.hitDice', character.hitDice);
    w.row(
      'io.excel.hitDiceUsed',
      Object.entries(character.hitDiceUsed ?? {})
        .map(([die, used]) => `${die}: ${used}`)
        .join(', '),
    );
    w.row(
      'io.excel.deathSaves',
      `${deathSaves.successes} / ${deathSaves.failures}`,
    );
    w.row('io.excel.exhaustion', character.exhaustion);
    w.row('io.excel.hpNotes', character.hitPointsNotes);
    w.row('io.excel.combatResources', w.list(character.combatResources ?? []));

    w.section('io.excel.savingThrows');
    w.tableHeader([
      'io.excel.name',
      'io.excel.proficient',
      'io.excel.value',
      'io.excel.notes',
    ]);
    for (const save of character.savingThrows ?? []) {
      w.tableRow([save.name, save.proficient, save.value, save.notes ?? '']);
    }

    w.section('io.excel.skills');
    w.tableHeader([
      'io.excel.name',
      'io.excel.proficient',
      'io.excel.expertise',
      'io.excel.value',
      'io.excel.notes',
    ]);
    for (const skill of character.skills ?? []) {
      w.tableRow([
        skill.name,
        skill.proficient,
        skill.expertise,
        skill.value,
        skill.notes ?? '',
      ]);
    }

    w.section('io.excel.attacks');
    w.tableHeader([
      'io.excel.name',
      'io.excel.ability',
      'io.excel.damage',
      'io.excel.notes',
    ]);
    for (const attack of character.attacks ?? []) {
      w.tableRow([
        attack.name,
        attack.ability,
        `${attack.damageDice} ${attack.damageModifier}`.trim(),
        attack.notes ?? '',
      ]);
    }
  }

  if (config.includeSpells) {
    w.section('io.excel.spellcasting');
    w.row('io.excel.spellcastingAbility', character.spellcastingAbility);
    w.row('io.excel.spellSaveDC', character.spellSaveDifficulty);
    w.row('io.excel.spellAttackBonus', character.spellAttackBonus);

    const entries = character.spellcastingEntries ?? [];
    if (entries.length > 0) {
      w.sub('io.excel.entries');
      for (const entry of entries) {
        w.raw(
          `    ${entry.id}`,
          entry.ability,
          entry.attackBonus,
          String(entry.saveDC),
        );
      }
    }

    const slots = Object.entries(character.spellSlots ?? {});
    if (slots.length > 0) {
      w.sub('io.excel.spellSlots');
      for (const [level, slot] of slots) {
        w.raw(`    ${level}`, `${slot.current} / ${slot.max}`);
      }
    }

    if ((character.spells ?? []).length > 0) {
      w.sub('io.excel.spells');
      for (const spell of character.spells) {
        w.raw(`    ${spell.name}`, String(spell.level), spell.notes);
      }
    }
  }

  if (config.includeEquipment) {
    w.section('io.excel.equipmentInventory');
    w.sub('io.excel.currency');
    w.row('io.excel.cp', currency.cp);
    w.row('io.excel.sp', currency.sp);
    w.row('io.excel.ep', currency.ep);
    w.row('io.excel.gp', currency.gp);
    w.row('io.excel.pp', currency.pp);
    w.sub('io.excel.equipment');
    w.raw(`    ${w.list(character.equipment ?? [])}`);
  }

  if (config.includeInventory) {
    w.sub('io.excel.inventory');
    w.raw(`    ${w.list(character.inventory ?? [])}`);
    const attunement = character.attunementItems ?? [];
    if (attunement.length > 0) {
      w.sub('io.excel.attunement');
      w.raw(`    ${w.list(attunement, 'description')}`);
    }
  }

  if (config.includeNarrative) {
    w.section('io.excel.featuresTraits');
    w.raw(`    ${w.list(character.featuresAndTraits ?? [])}`);

    w.section('io.excel.narrative');
    w.row('io.excel.backstory', character.backstory);
    w.row('common.notes', character.notes);
    w.row('io.excel.personalityTraits', w.list(character.personalityTraits));
    w.row('io.excel.ideals', w.list(character.ideals));
    w.row('io.excel.bonds', w.list(character.bonds));
    w.row('io.excel.flaws', w.list(character.flaws));
    w.row(
      'io.excel.proficiencies',
      w.list(character.otherProficienciesAndLanguages),
    );
  }

  if (config.includeCompanions) {
    const companions = character.companions ?? [];
    if (companions.length > 0) {
      w.section('io.excel.companions');
      w.tableHeader([
        'io.excel.name',
        'io.excel.companionType',
        'io.excel.armorClass',
        'io.excel.hitPoints',
      ]);
      for (const companion of companions) {
        w.tableRow([
          companion.name,
          companion.type,
          companion.armorClass,
          `${companion.hitPoints.current} / ${companion.hitPoints.max}`,
        ]);
      }
    }
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
