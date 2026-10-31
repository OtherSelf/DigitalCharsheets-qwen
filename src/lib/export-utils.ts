// src/lib/export-utils.ts
'use client';

import * as XLSX from 'xlsx';
import { Character, DnD5eCharacter, DarkHeresyCharacter } from './types';

export interface ExportConfig {
  includeBasicInfo: boolean;
  includeStats: boolean;
  includeCombat: boolean;
  includeEquipment: boolean;
  includeInventory: boolean;
  includeSpells: boolean;
  includeNarrative: boolean;
  includeProgression: boolean;
  includeCompanions: boolean;
  includeQuestLog: boolean;
  includeCustomHouseRules: boolean;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  includeBasicInfo: true,
  includeStats: true,
  includeCombat: true,
  includeEquipment: true,
  includeInventory: true,
  includeSpells: true,
  includeNarrative: true,
  includeProgression: true,
  includeCompanions: true,
  includeQuestLog: true,
  includeCustomHouseRules: true,
};

export interface ExportMetadata {
  appName: string;
  version: string;
  exportDate: string;
  config: ExportConfig;
}

export interface ExportData {
  metadata: ExportMetadata;
  character: Partial<Character>;
}

export const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  } 
  if (data !== null && typeof data === 'object') {
    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      const cleanKey = key.trim();
      if (cleanKey === 'userId' || cleanKey === 'Document ID') continue; 
      sanitizedObj[cleanKey] = sanitizeData(value);
    }
    return sanitizedObj;
  } 
  if (typeof data === 'string') {
    return data.trim();
  }
  return data;
};

const normalizeCharacter = (char: any): any => {
  if (char.gameSystem === 'Dark Heresy') {
    return {
      ...char,
      stats: char.stats || {
        weaponSkill: 0, ballisticSkill: 0, strength: 0, toughness: 0, agility: 0,
        intelligence: 0, perception: 0, willpower: 0, fellowship: 0, influence: 0
      },
      statUpgrades: char.statUpgrades || {
        weaponSkill: [false, false, false, false], ballisticSkill: [false, false, false, false],
        strength: [false, false, false, false], toughness: [false, false, false, false],
        agility: [false, false, false, false], intelligence: [false, false, false, false],
        perception: [false, false, false, false], willpower: [false, false, false, false],
        fellowship: [false, false, false, false], influence: [false, false, false, false]
      },
      movement: char.movement || { walkHalf: 0, walkFull: 0, charge: 0, run: 0 },
      wounds: char.wounds || { current: 0, max: 0, notes: "" },
      fatePoints: char.fatePoints || { current: 0, max: 0, notes: "" },
      insanityPoints: char.insanityPoints || { total: 0, notes: "" },
      corruptionPoints: char.corruptionPoints || { total: 0, notes: "" },
      wealth: char.wealth || { throneGelt: 0, monthlyIncome: 0, notes: "" },
      equipment: char.equipment || { 
        armor: { Head: null, Body: null, "Left arm": null, "Right arm": null, "Left leg": null, "Right leg": null }, 
        weapons: { melee: [], ranged: [] } 
      },
      skills: char.skills || [],
      talents: char.talents || [],
    };
  }
  
  if (char.gameSystem === 'Dungeons & Dragons') {
    return {
      ...char,
      stats: char.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      savingThrows: char.savingThrows || [],
      skills: char.skills || [],
      hitPoints: char.hitPoints || { current: 0, max: 0 },
      deathSaves: char.deathSaves || { successes: 0, failures: 0 },
      currency: char.currency || { cp: 0, sp: 0, gp: 0, pp: 0, ep: 0 },
      equipment: char.equipment || [],
      inventory: char.inventory || [],
      spells: char.spells || [],
      spellSlots: char.spellSlots || {},
    };
  }
  
  return char;
};

export type ImportResult = {
  success: boolean;
  data?: ExportData;
  batchData?: Partial<Character>[];
  error?: string;
};

export const filterCharacterForExport = (character: Character, config: ExportConfig): Partial<Character> => {
  const filtered: any = { id: character.id, gameSystem: character.gameSystem };

  if (config.includeBasicInfo) {
    filtered.name = character.name;
    filtered.characterClass = character.characterClass;
    if (character.gameSystem === 'Dungeons & Dragons') {
      const dnd = character as DnD5eCharacter;
      filtered.race = dnd.race; filtered.background = dnd.background; filtered.alignment = dnd.alignment;
      filtered.age = dnd.age; filtered.height = dnd.height; filtered.weight = dnd.weight;
      filtered.eyes = dnd.eyes; filtered.skin = dnd.skin; filtered.hair = dnd.hair;
    } else {
      const dh = character as DarkHeresyCharacter;
      filtered.homeWorld = dh.homeWorld; filtered.worldVariant = dh.worldVariant; filtered.careerPath = dh.careerPath;
      filtered.rank = dh.rank; filtered.divination = dh.divination; filtered.divinationEffect = dh.divinationEffect;
      filtered.quirk = dh.quirk; filtered.height = dh.height; filtered.weight = dh.weight; filtered.age = dh.age;
      filtered.skinColor = dh.skinColor; filtered.hairColor = dh.hairColor; filtered.eyeColor = dh.eyeColor;
    }
  }

  if (config.includeStats) {
    filtered.stats = character.stats;
    filtered.statNotes = character.statNotes;
    if (character.gameSystem === 'Dark Heresy') {
      filtered.statUpgrades = (character as DarkHeresyCharacter).statUpgrades;
    }
  }

  if (config.includeCombat) {
    if (character.gameSystem === 'Dungeons & Dragons') {
      const dnd = character as DnD5eCharacter;
      filtered.armorClass = dnd.armorClass; filtered.speed = dnd.speed; filtered.hitPoints = dnd.hitPoints;
      filtered.hpTracking = dnd.hpTracking; filtered.hitPointsNotes = dnd.hitPointsNotes;
      filtered.temporaryHitPoints = dnd.temporaryHitPoints; filtered.hitDice = dnd.hitDice;
      filtered.hitDiceUsed = dnd.hitDiceUsed; filtered.deathSaves = dnd.deathSaves;
      filtered.exhaustion = dnd.exhaustion; filtered.savingThrows = dnd.savingThrows;
      filtered.skills = dnd.skills; filtered.attacks = dnd.attacks; filtered.combatResources = dnd.combatResources;
    } else {
      const dh = character as DarkHeresyCharacter;
      filtered.wounds = dh.wounds; filtered.fatePoints = dh.fatePoints;
      filtered.insanityPoints = dh.insanityPoints; filtered.corruptionPoints = dh.corruptionPoints;
      filtered.movement = dh.movement; filtered.skills = dh.skills; filtered.talents = dh.talents;
    }
  }

  if (config.includeEquipment) filtered.equipment = character.equipment;

  if (config.includeInventory) {
    filtered.inventory = character.inventory;
    if (character.gameSystem === 'Dungeons & Dragons') {
      filtered.currency = (character as DnD5eCharacter).currency;
      filtered.attunementItems = (character as DnD5eCharacter).attunementItems;
    } else {
      filtered.wealth = (character as DarkHeresyCharacter).wealth;
    }
  }

  if (config.includeSpells && character.gameSystem === 'Dungeons & Dragons') {
    const dnd = character as DnD5eCharacter;
    filtered.spells = dnd.spells; filtered.spellSlots = dnd.spellSlots;
    filtered.spellcastingAbility = dnd.spellcastingAbility; filtered.spellAttackBonus = dnd.spellAttackBonus;
    filtered.spellSaveDifficulty = dnd.spellSaveDifficulty; filtered.spellcastingEntries = dnd.spellcastingEntries;
  }

  if (config.includeNarrative) {
    filtered.backstory = character.backstory; filtered.notes = character.notes;
    const src = character as any;
    if (src.otherProficienciesAndLanguages !== undefined) filtered.otherProficienciesAndLanguages = src.otherProficienciesAndLanguages;
    if (src.personalityTraits !== undefined) filtered.personalityTraits = src.personalityTraits;
    if (src.ideals !== undefined) filtered.ideals = src.ideals;
    if (src.bonds !== undefined) filtered.bonds = src.bonds;
    if (src.flaws !== undefined) filtered.flaws = src.flaws;
    if (src.featuresAndTraits !== undefined) filtered.featuresAndTraits = src.featuresAndTraits;
  }

  if (config.includeProgression) {
    if (character.gameSystem === 'Dungeons & Dragons') {
      const dnd = character as DnD5eCharacter;
      filtered.level = dnd.level; filtered.experiencePoints = dnd.experiencePoints;
      filtered.isMulticlass = dnd.isMulticlass; filtered.multiclasses = dnd.multiclasses;
      filtered.divineBoons = dnd.divineBoons; filtered.allowDivineBoonsBeforeLevel20 = dnd.allowDivineBoonsBeforeLevel20;
      filtered.inspiration = dnd.inspiration; filtered.allowInspirationHomeRule = dnd.allowInspirationHomeRule;
    } else {
      const dh = character as DarkHeresyCharacter;
      filtered.experience = dh.experience; filtered.totalExpSpent = dh.totalExpSpent;
      filtered.alternatePath = dh.alternatePath; filtered.advancedPath = dh.advancedPath;
    }
  }

  if (config.includeCompanions && character.gameSystem === 'Dungeons & Dragons') {
    filtered.companions = (character as DnD5eCharacter).companions;
  }

  if (config.includeQuestLog) filtered.questLog = character.questLog;
  if (config.includeCustomHouseRules) filtered.customHouseRules = character.customHouseRules;

  return filtered;
};

export const exportCharacterToJSON = (character: Character, config: ExportConfig) => {
  const exportData: ExportData = {
    metadata: { appName: "DigitalCharsheets-qwen", version: "1.0", exportDate: new Date().toISOString(), config },
    character: filterCharacterForExport(character, config),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${character.name.replace(/\s+/g, '_')}_Character.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importCharacterFromJSON = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let parsed = JSON.parse(text);

        parsed = sanitizeData(parsed);

        if (parsed.metadata && parsed.metadata.appName === "DigitalCharsheets-qwen") {
          resolve({ success: true, data: parsed as ExportData });
          return;
        }

        let rawCharacters: any[] = [];
        if (Array.isArray(parsed)) {
          rawCharacters = parsed;
        } else if (parsed.gameSystem) {
          rawCharacters = [parsed];
        } else {
          resolve({ success: false, error: "Invalid file format: Missing 'gameSystem'." });
          return;
        }

        if (rawCharacters.length === 0) {
          resolve({ success: false, error: "The backup file is empty." });
          return;
        }

        const normalizedCharacters = rawCharacters.map(normalizeCharacter);

        const wrappedData: ExportData = {
          metadata: {
            appName: "DigitalCharsheets-qwen",
            version: "1.0 (Backup Import)",
            exportDate: new Date().toISOString(),
            config: DEFAULT_EXPORT_CONFIG,
          },
          character: normalizedCharacters[0] as Partial<Character>,
        };

        resolve({ 
          success: true, 
          data: wrappedData, 
          batchData: normalizedCharacters 
        });
      } catch (err) {
        console.error("Import parse error:", err);
        resolve({ success: false, error: "Failed to parse JSON file. Ensure it is a valid backup." });
      }
    };
    reader.onerror = () => resolve({ success: false, error: "Failed to read file." });
    reader.readAsText(file);
  });
};

export const mergeImportedData = (
  targetCharacter: Character,
  importedData: ExportData,
  importConfig: ExportConfig
): Character => {
  const merged = { ...targetCharacter } as any;
  const source = importedData.character as any;

  if (importConfig.includeBasicInfo) {
    if (source.name !== undefined) merged.name = source.name;
    if (source.characterClass !== undefined) merged.characterClass = source.characterClass;
    if (merged.gameSystem === 'Dungeons & Dragons') {
      if (source.race !== undefined) merged.race = source.race;
      if (source.background !== undefined) merged.background = source.background;
      if (source.alignment !== undefined) merged.alignment = source.alignment;
      if (source.age !== undefined) merged.age = source.age;
      if (source.height !== undefined) merged.height = source.height;
      if (source.weight !== undefined) merged.weight = source.weight;
      if (source.eyes !== undefined) merged.eyes = source.eyes;
      if (source.skin !== undefined) merged.skin = source.skin;
      if (source.hair !== undefined) merged.hair = source.hair;
    } else {
      if (source.homeWorld !== undefined) merged.homeWorld = source.homeWorld;
      if (source.worldVariant !== undefined) merged.worldVariant = source.worldVariant;
      if (source.careerPath !== undefined) merged.careerPath = source.careerPath;
      if (source.rank !== undefined) merged.rank = source.rank;
      if (source.divination !== undefined) merged.divination = source.divination;
      if (source.divinationEffect !== undefined) merged.divinationEffect = source.divinationEffect;
      if (source.quirk !== undefined) merged.quirk = source.quirk;
      if (source.height !== undefined) merged.height = source.height;
      if (source.weight !== undefined) merged.weight = source.weight;
      if (source.age !== undefined) merged.age = source.age;
      if (source.skinColor !== undefined) merged.skinColor = source.skinColor;
      if (source.hairColor !== undefined) merged.hairColor = source.hairColor;
      if (source.eyeColor !== undefined) merged.eyeColor = source.eyeColor;
    }
  }

  if (importConfig.includeStats) {
    if (source.stats) merged.stats = source.stats;
    if (source.statNotes) merged.statNotes = source.statNotes;
    if (merged.gameSystem === 'Dark Heresy' && source.statUpgrades) merged.statUpgrades = source.statUpgrades;
  }

  if (importConfig.includeCombat) {
    if (merged.gameSystem === 'Dungeons & Dragons') {
      if (source.armorClass !== undefined) merged.armorClass = source.armorClass;
      if (source.speed !== undefined) merged.speed = source.speed;
      if (source.hitPoints) merged.hitPoints = { ...merged.hitPoints, ...source.hitPoints };
      if (source.hpTracking !== undefined) merged.hpTracking = source.hpTracking;
      if (source.hitPointsNotes !== undefined) merged.hitPointsNotes = source.hitPointsNotes;
      if (source.temporaryHitPoints !== undefined) merged.temporaryHitPoints = source.temporaryHitPoints;
      if (source.hitDice !== undefined) merged.hitDice = source.hitDice;
      if (source.hitDiceUsed) merged.hitDiceUsed = { ...merged.hitDiceUsed, ...source.hitDiceUsed };
      if (source.deathSaves) merged.deathSaves = { ...merged.deathSaves, ...source.deathSaves };
      if (source.exhaustion !== undefined) merged.exhaustion = source.exhaustion;
      if (source.savingThrows) merged.savingThrows = source.savingThrows;
      if (source.skills) merged.skills = source.skills;
      if (source.attacks) merged.attacks = source.attacks;
      if (source.combatResources) merged.combatResources = source.combatResources;
    } else {
      if (source.wounds) merged.wounds = { ...merged.wounds, ...source.wounds };
      if (source.fatePoints) merged.fatePoints = { ...merged.fatePoints, ...source.fatePoints };
      if (source.insanityPoints) merged.insanityPoints = { ...merged.insanityPoints, ...source.insanityPoints };
      if (source.corruptionPoints) merged.corruptionPoints = { ...merged.corruptionPoints, ...source.corruptionPoints };
      if (source.movement) merged.movement = { ...merged.movement, ...source.movement };
      if (source.skills) merged.skills = source.skills;
      if (source.talents) merged.talents = source.talents;
    }
  }

  if (importConfig.includeEquipment) {
    if (source.equipment) merged.equipment = source.equipment;
  }

  if (importConfig.includeInventory) {
    if (source.inventory) merged.inventory = source.inventory;
    if (merged.gameSystem === 'Dungeons & Dragons') {
      if (source.currency) merged.currency = { ...merged.currency, ...source.currency };
      if (source.attunementItems !== undefined) merged.attunementItems = source.attunementItems;
    } else {
      if (source.wealth) merged.wealth = { ...merged.wealth, ...source.wealth };
    }
  }

  if (importConfig.includeSpells && merged.gameSystem === 'Dungeons & Dragons') {
    if (source.spells !== undefined) merged.spells = source.spells;
    if (source.spellSlots !== undefined) merged.spellSlots = source.spellSlots;
    if (source.spellcastingAbility !== undefined) merged.spellcastingAbility = source.spellcastingAbility;
    if (source.spellAttackBonus !== undefined) merged.spellAttackBonus = source.spellAttackBonus;
    if (source.spellSaveDifficulty !== undefined) merged.spellSaveDifficulty = source.spellSaveDifficulty;
    if (source.spellcastingEntries !== undefined) merged.spellcastingEntries = source.spellcastingEntries;
  }

  if (importConfig.includeNarrative) {
    if (source.backstory !== undefined) merged.backstory = source.backstory;
    if (source.notes !== undefined) merged.notes = source.notes;
    if (source.otherProficienciesAndLanguages !== undefined) merged.otherProficienciesAndLanguages = source.otherProficienciesAndLanguages;
    if (source.personalityTraits !== undefined) merged.personalityTraits = source.personalityTraits;
    if (source.ideals !== undefined) merged.ideals = source.ideals;
    if (source.bonds !== undefined) merged.bonds = source.bonds;
    if (source.flaws !== undefined) merged.flaws = source.flaws;
    if (source.featuresAndTraits !== undefined) merged.featuresAndTraits = source.featuresAndTraits;
  }

  if (importConfig.includeProgression) {
    if (merged.gameSystem === 'Dungeons & Dragons') {
      if (source.level !== undefined) merged.level = source.level;
      if (source.experiencePoints !== undefined) merged.experiencePoints = source.experiencePoints;
      if (source.isMulticlass !== undefined) merged.isMulticlass = source.isMulticlass;
      if (source.multiclasses !== undefined) merged.multiclasses = source.multiclasses;
      if (source.divineBoons !== undefined) merged.divineBoons = source.divineBoons;
      if (source.allowDivineBoonsBeforeLevel20 !== undefined) merged.allowDivineBoonsBeforeLevel20 = source.allowDivineBoonsBeforeLevel20;
      if (source.inspiration !== undefined) merged.inspiration = source.inspiration;
      if (source.allowInspirationHomeRule !== undefined) merged.allowInspirationHomeRule = source.allowInspirationHomeRule;
    } else {
      if (source.experience !== undefined) merged.experience = source.experience;
      if (source.totalExpSpent !== undefined) merged.totalExpSpent = source.totalExpSpent;
      if (source.alternatePath !== undefined) merged.alternatePath = source.alternatePath;
      if (source.advancedPath !== undefined) merged.advancedPath = source.advancedPath;
    }
  }

  if (importConfig.includeCompanions && merged.gameSystem === 'Dungeons & Dragons') {
    if (source.companions !== undefined) merged.companions = source.companions;
  }

  if (importConfig.includeQuestLog) {
    if (source.questLog) merged.questLog = source.questLog;
  }

  if (importConfig.includeCustomHouseRules) {
    if (source.customHouseRules) merged.customHouseRules = source.customHouseRules;
  }

  return merged as Character;
};

export const exportCharacterToExcel = (character: Character) => {
  const data: any[] = [];
  data.push(['DIGITAL CHARACTER SHEETS - CHARACTER SHEET']);
  data.push(['Generated on:', new Date().toLocaleDateString()]);
  data.push([]);
  data.push(['BASIC INFORMATION']);
  data.push(['Name', character.name]);
  data.push(['System', character.gameSystem]);
  data.push(['Class/Path', character.characterClass]);
  
  if (character.gameSystem === 'Dark Heresy') {
    const dh = character as DarkHeresyCharacter;
    data.push(['Home World', dh.homeWorld]);
    data.push(['Rank', dh.rank]);
  } else {
    const dnd = character as DnD5eCharacter;
    data.push(['Race', dnd.race]);
    data.push(['Level', dnd.level]);
  }
  data.push([]);
  data.push(['CHARACTERISTICS / ABILITY SCORES']);
  Object.entries(character.stats).forEach(([key, val]) => {
    data.push([key.replace(/([A-Z])/g, ' $1').toUpperCase(), val]);
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 20 }, { wch: 60 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${character.name.replace(/\s+/g, '_')}_Sheet.xlsx`);
};