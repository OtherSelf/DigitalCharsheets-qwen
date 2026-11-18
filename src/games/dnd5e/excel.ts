import { createExcelSections } from '../shared/excel';
import type { ExcelSection, ExportTranslate, GameExportConfig } from '../types';
import { abilityModifier } from './derive';
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
    const mod = abilityModifier(score);
    return `${score} (${mod >= 0 ? '+' : ''}${mod})`;
  };

  if (config.includeBasicInfo) {
    w.section('dnd.excel.basicInformation');
    w.row('dnd.excel.name', character.name);
    w.row('dnd.excel.classCareer', character.characterClass);
    w.row('dnd.race', character.race);
    w.row('dnd.background', character.background);
    w.row('dnd.alignment', character.alignment);
    w.row('dnd.excel.level', character.level);
    w.row('dnd.excel.experiencePoints', character.experiencePoints);
    w.row('dnd.excel.proficiencyBonus', character.proficiencyBonus);
    w.row('dnd.excel.inspiration', character.inspiration);
    w.row('common.age', character.age);
    w.row('common.height', character.height);
    w.row('common.weight', character.weight);
    w.row('dnd.excel.eyes', character.eyes);
    w.row('dnd.excel.hair', character.hair);
    w.row('dnd.excel.skin', character.skin);
  }

  if (config.includeStats) {
    w.section('dnd.excel.abilityScores');
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
    w.section('dnd.excel.combat');
    w.row('dnd.excel.armorClass', character.armorClass);
    w.row('dnd.excel.speed', `${character.speed} ft.`);
    w.row(
      'dnd.excel.hitPoints',
      `${character.hitPoints.current} / ${character.hitPoints.max}`,
    );
    w.row('dnd.excel.temporaryHitPoints', character.temporaryHitPoints);
    w.row('dnd.excel.hitDice', character.hitDice);
    w.row(
      'dnd.excel.hitDiceUsed',
      Object.entries(character.hitDiceUsed ?? {})
        .map(([die, used]) => `${die}: ${used}`)
        .join(', '),
    );
    w.row(
      'dnd.excel.deathSaves',
      `${deathSaves.successes} / ${deathSaves.failures}`,
    );
    w.row('dnd.excel.exhaustion', character.exhaustion);
    w.row('dnd.excel.hpNotes', character.hitPointsNotes);
    w.row('dnd.excel.combatResources', w.list(character.combatResources ?? []));

    w.section('dnd.excel.savingThrows');
    w.tableHeader([
      'dnd.excel.name',
      'dnd.excel.proficient',
      'dnd.excel.value',
      'dnd.excel.notes',
    ]);
    for (const save of character.savingThrows ?? []) {
      w.tableRow([save.name, save.proficient, save.value, save.notes ?? '']);
    }

    w.section('dnd.excel.skills');
    w.tableHeader([
      'dnd.excel.name',
      'dnd.excel.proficient',
      'dnd.excel.expertise',
      'dnd.excel.value',
      'dnd.excel.notes',
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

    w.section('dnd.excel.attacks');
    w.tableHeader([
      'dnd.excel.name',
      'dnd.excel.ability',
      'dnd.excel.damage',
      'dnd.excel.notes',
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
    w.section('dnd.excel.spellcasting');
    w.row('dnd.excel.spellcastingAbility', character.spellcastingAbility);
    w.row('dnd.excel.spellSaveDC', character.spellSaveDifficulty);
    w.row('dnd.excel.spellAttackBonus', character.spellAttackBonus);

    const entries = character.spellcastingEntries ?? [];
    if (entries.length > 0) {
      w.sub('dnd.excel.entries');
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
      w.sub('dnd.excel.spellSlots');
      for (const [level, slot] of slots) {
        w.raw(`    ${level}`, `${slot.current} / ${slot.max}`);
      }
    }

    if ((character.spells ?? []).length > 0) {
      w.sub('dnd.excel.spells');
      for (const spell of character.spells) {
        w.raw(`    ${spell.name}`, String(spell.level), spell.notes);
      }
    }
  }

  if (config.includeEquipment) {
    w.section('dnd.excel.equipmentInventory');
    w.sub('dnd.excel.currency');
    w.row('dnd.excel.cp', currency.cp);
    w.row('dnd.excel.sp', currency.sp);
    w.row('dnd.excel.ep', currency.ep);
    w.row('dnd.excel.gp', currency.gp);
    w.row('dnd.excel.pp', currency.pp);
    w.sub('dnd.excel.equipment');
    w.raw(`    ${w.list(character.equipment ?? [])}`);
  }

  if (config.includeInventory) {
    w.sub('dnd.excel.inventory');
    w.raw(`    ${w.list(character.inventory ?? [])}`);
    const attunement = character.attunementItems ?? [];
    if (attunement.length > 0) {
      w.sub('dnd.excel.attunement');
      w.raw(`    ${w.list(attunement, 'description')}`);
    }
  }

  if (config.includeNarrative) {
    w.section('dnd.excel.featuresTraits');
    w.raw(`    ${w.list(character.featuresAndTraits ?? [])}`);

    w.section('dnd.excel.narrative');
    w.row('dnd.excel.backstory', character.backstory);
    w.row('common.notes', character.notes);
    w.row('dnd.excel.personalityTraits', w.list(character.personalityTraits));
    w.row('dnd.excel.ideals', w.list(character.ideals));
    w.row('dnd.excel.bonds', w.list(character.bonds));
    w.row('dnd.excel.flaws', w.list(character.flaws));
    w.row(
      'dnd.excel.proficiencies',
      w.list(character.otherProficienciesAndLanguages),
    );
  }

  if (config.includeCompanions) {
    const companions = character.companions ?? [];
    if (companions.length > 0) {
      w.section('dnd.excel.companions');
      w.tableHeader([
        'dnd.excel.name',
        'dnd.excel.companionType',
        'dnd.excel.armorClass',
        'dnd.excel.hitPoints',
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
      w.section('dnd.excel.questLog');
      w.tableHeader([
        'dnd.excel.questTitle',
        'dnd.excel.questStatus',
        'dnd.excel.description',
        'dnd.excel.rewards',
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
      w.section('dnd.excel.houseRules');
      for (const rule of rules) {
        w.tableRow([rule.name, rule.description]);
      }
    }
  }

  return w.sections;
}
