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
                weaponSkill: [false,false,false,false], ballisticSkill: [false,false,false,false],
                strength: [false,false,false,false], toughness: [false,false,false,false],
                agility: [false,false,false,false], intelligence: [false,false,false,false],
                perception: [false,false,false,false], willpower: [false,false,false,false],
                fellowship: [false,false,false,false], influence: [false,false,false,false]
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

// 🎯 LANDMARK: COMPREHENSIVE_USER_FRIENDLY_EXCEL_EXPORT
export const exportCharacterToExcel = (character: Character) => {
    const data: any[][] = [];
    const isDnD = character.gameSystem === 'Dungeons & Dragons';
    const dnd = character as DnD5eCharacter;
    const dh = character as DarkHeresyCharacter;

    // Helper functions
    const addHeader = (text: string) => {
        data.push([text.toUpperCase()]);
        data.push([]);
    };

    const addSubHeader = (text: string) => {
        data.push([`  ${text}`]);
    };

    const addRow = (label: string, value: any) => {
        if (value === undefined || value === null || value === '') return;
        data.push([`    ${label}`, value]);
    };

    const addEmptyRow = () => data.push([]);

    const formatList = (items: any[], nameKey = 'name'): string => {
        if (!items || items.length === 0) return 'None';
        return items.map(item => {
            if (typeof item === 'string') return `• ${item}`;
            if (item && typeof item === 'object') {
                const name = item[nameKey] || item.label || item.title || JSON.stringify(item);
                return `• ${name}`;
            }
            return `• ${String(item)}`;
        }).join('\n');
    };

    // ═══════════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════════
    data.push([`${character.name.toUpperCase()} — CHARACTER SHEET`]);
    data.push([`Game System: ${character.gameSystem}`]);
    data.push([`Exported: ${new Date().toLocaleString()}`]);
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // BASIC INFORMATION
    // ═══════════════════════════════════════════════════════════
    addHeader('Basic Information');
    addRow('Name', character.name);
    addRow('Class / Career', character.characterClass);
    
    if (isDnD) {
        addRow('Race', dnd.race);
        addRow('Level', dnd.level);
        addRow('Background', dnd.background);
        addRow('Alignment', dnd.alignment);
        addRow('Age', dnd.age);
        addRow('Height', dnd.height);
        addRow('Weight', dnd.weight);
        addRow('Eyes', dnd.eyes);
        addRow('Hair', dnd.hair);
        addRow('Skin', dnd.skin);
        addRow('Experience Points', dnd.experiencePoints);
        addRow('Proficiency Bonus', (dnd as any).proficiencyBonus);
        addRow('Inspiration', (dnd as any).inspiration);
    } else {
        addRow('Rank', dh.rank);
        addRow('Home World', dh.homeWorld);
        addRow('World Variant', dh.worldVariant);
        addRow('Career Path', dh.careerPath);
        addRow('Divination', dh.divination);
        addRow('Divination Effect', dh.divinationEffect);
        addRow('Quirk', dh.quirk);
        addRow('Age', dh.age);
        addRow('Height', dh.height);
        addRow('Weight', dh.weight);
        addRow('Skin Color', dh.skinColor);
        addRow('Hair Color', dh.hairColor);
        addRow('Eye Color', dh.eyeColor);
        addRow('Experience', dh.experience);
        addRow('Total XP Spent', dh.totalExpSpent);
        addRow('Alternate Path', dh.alternatePath);
        addRow('Advanced Path', dh.advancedPath);
    }
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // STATS / CHARACTERISTICS
    // ═══════════════════════════════════════════════════════════
    addHeader(isDnD ? 'Ability Scores' : 'Characteristics');
    
    if (isDnD) {
        const stats = dnd.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
        data.push(['    Stat', 'Score', 'Modifier']);
        const statNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        statNames.forEach(stat => {
            const val = (stats as any)[stat] || 10;
            const mod = Math.floor((val - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            data.push(['    ' + stat.charAt(0).toUpperCase() + stat.slice(1), val, modStr]);
        });
    } else {
        const stats = dh.stats || { weaponSkill: 0, ballisticSkill: 0, strength: 0, toughness: 0, agility: 0, intelligence: 0, perception: 0, willpower: 0, fellowship: 0, influence: 0 };
        const statKeys = ['weaponSkill', 'ballisticSkill', 'strength', 'toughness', 'agility', 'intelligence', 'perception', 'willpower', 'fellowship', 'influence'];
        const statLabels = ['Weapon Skill', 'Ballistic Skill', 'Strength', 'Toughness', 'Agility', 'Intelligence', 'Perception', 'Willpower', 'Fellowship', 'Influence'];
        
        data.push(['    Characteristic', 'Value', 'Advances']);
        statKeys.forEach((key, idx) => {
            const val = (stats as any)[key] || 0;
            const upgrades = (dh.statUpgrades as any)?.[key];
            const advCount = Array.isArray(upgrades) ? upgrades.filter(Boolean).length : 0;
            data.push(['    ' + statLabels[idx], val, advCount]);
        });
    }
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // COMBAT & STATUS
    // ═══════════════════════════════════════════════════════════
    addHeader('Combat & Status');
    
    if (isDnD) {
        addRow('Armor Class', dnd.armorClass);
        addRow('Speed', dnd.speed ? `${dnd.speed} ft.` : undefined);
        addRow('Hit Points', dnd.hitPoints ? `${dnd.hitPoints.current} / ${dnd.hitPoints.max}` : undefined);
        addRow('Temporary Hit Points', dnd.temporaryHitPoints);
        addRow('Hit Dice', dnd.hitDice);
        addRow('Hit Dice Used', dnd.hitDiceUsed);
        addRow('Death Saves', dnd.deathSaves ? `Successes: ${dnd.deathSaves.successes}, Failures: ${dnd.deathSaves.failures}` : undefined);
        addRow('Exhaustion', dnd.exhaustion);
        addRow('HP Notes', dnd.hitPointsNotes);
    } else {
        addRow('Wounds', dh.wounds ? `${dh.wounds.current} / ${dh.wounds.max}` : undefined);
        addRow('Wounds Notes', dh.wounds?.notes);
        addRow('Fate Points', dh.fatePoints ? `${dh.fatePoints.current} / ${dh.fatePoints.max}` : undefined);
        addRow('Fate Points Notes', dh.fatePoints?.notes);
        addRow('Insanity Points', dh.insanityPoints?.total);
        addRow('Insanity Notes', dh.insanityPoints?.notes);
        addRow('Corruption Points', dh.corruptionPoints?.total);
        addRow('Corruption Notes', dh.corruptionPoints?.notes);
        addRow('Movement - Walk (Half)', dh.movement?.walkHalf);
        addRow('Movement - Walk (Full)', dh.movement?.walkFull);
        addRow('Movement - Charge', dh.movement?.charge);
        addRow('Movement - Run', dh.movement?.run);
    }
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // SAVING THROWS (DnD) / SKILLS & TALENTS
    // ═══════════════════════════════════════════════════════════
    if (isDnD) {
        addHeader('Saving Throws');
        const saves = (dnd as any).savingThrows || [];
        if (saves.length > 0) {
            data.push(['    Ability', 'Proficient', 'Bonus']);
            saves.forEach((save: any) => {
                if (typeof save === 'string') {
                    data.push(['    ' + save]);
                } else if (save && typeof save === 'object') {
                    const name = save.name || save.ability || '';
                    const prof = save.proficient ? 'Yes' : '';
                    const bonus = save.bonus !== undefined ? (save.bonus >= 0 ? `+${save.bonus}` : `${save.bonus}`) : '';
                    data.push(['    ' + name, prof, bonus]);
                }
            });
        } else {
            data.push(['    None']);
        }
        addEmptyRow();
    }

    addHeader('Skills');
    if (isDnD) {
        const skills = (dnd as any).skills || [];
        if (skills.length > 0) {
            data.push(['    Skill Name', 'Ability', 'Bonus', 'Proficient', 'Expertise', 'Notes']);
            skills.forEach((skill: any) => {
                if (typeof skill === 'string') {
                    data.push(['    ' + skill]);
                } else if (skill && typeof skill === 'object') {
                    data.push([
                        '    ' + (skill.name || ''),
                        skill.ability || '',
                        skill.bonus !== undefined ? (skill.bonus >= 0 ? `+${skill.bonus}` : `${skill.bonus}`) : '',
                        skill.proficient ? 'Yes' : '',
                        skill.expertise ? 'Yes' : '',
                        skill.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
    } else {
        const skills = dh.skills || [];
        if (skills.length > 0) {
            data.push(['    Skill Name', 'Characteristic', 'Proficiency', 'Notes']);
            skills.forEach((skill: any) => {
                if (typeof skill === 'string') {
                    data.push(['    ' + skill]);
                } else if (skill && typeof skill === 'object') {
                    // DH skills have proficiency checkboxes: +0, +10, +20
                    let proficiency = '+0';
                    if (skill.proficiency === '+10' || skill.proficiency === 10 || skill.trained) {
                        proficiency = '+10';
                    } else if (skill.proficiency === '+20' || skill.proficiency === 20 || skill.focused) {
                        proficiency = '+20';
                    }
                    data.push([
                        '    ' + (skill.name || ''),
                        skill.characteristic || '',
                        proficiency,
                        skill.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
    }
    addEmptyRow();

    if (!isDnD) {
        addHeader('Talents');
        const talents = dh.talents || [];
        if (talents.length > 0) {
            data.push(['    Talent Name', 'Notes']);
            talents.forEach((t: any) => {
                if (typeof t === 'string') {
                    data.push(['    ' + t]);
                } else if (t && typeof t === 'object') {
                    data.push([
                        '    ' + (t.name || ''),
                        t.notes || t.description || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // ATTACKS & COMBAT RESOURCES (DnD)
    // ═══════════════════════════════════════════════════════════
    if (isDnD) {
        addHeader('Attacks & Combat');
        const attacks = (dnd as any).attacks || [];
        if (attacks.length > 0) {
            data.push(['    Name', 'Attack Bonus', 'Damage', 'Damage Type', 'Properties', 'Notes']);
            attacks.forEach((a: any) => {
                if (typeof a === 'string') {
                    data.push(['    ' + a]);
                } else if (a && typeof a === 'object') {
                    data.push([
                        '    ' + (a.name || ''),
                        a.attackBonus || a.bonus || '',
                        a.damage || '',
                        a.damageType || a.type || '',
                        a.properties || '',
                        a.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        
        const resources = (dnd as any).combatResources || [];
        if (resources.length > 0) {
            addSubHeader('Combat Resources');
            data.push(['    Resource', 'Current', 'Max', 'Notes']);
            resources.forEach((r: any) => {
                if (typeof r === 'string') {
                    data.push(['    ' + r]);
                } else if (r && typeof r === 'object') {
                    data.push([
                        '    ' + (r.name || ''),
                        r.current || '',
                        r.max || '',
                        r.notes || ''
                    ]);
                }
            });
        }
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // EQUIPMENT & INVENTORY
    // ═══════════════════════════════════════════════════════════
    addHeader('Equipment & Inventory');
    
    if (isDnD) {
        const c = dnd.currency || { cp: 0, sp: 0, gp: 0, ep: 0, pp: 0 };
        addSubHeader('Currency');
        data.push(['    CP', c.cp, 'SP', c.sp, 'GP', c.gp]);
        data.push(['    EP', c.ep, 'PP', c.pp]);
        
        addSubHeader('Equipment');
        const equipment = (dnd as any).equipment || [];
        if (equipment.length > 0) {
            data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
            equipment.forEach((e: any) => {
                if (typeof e === 'string') {
                    data.push(['    ' + e]);
                } else if (e && typeof e === 'object') {
                    data.push([
                        '    ' + (e.name || ''),
                        e.quantity || e.count || 1,
                        e.weight || '',
                        e.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        
        addSubHeader('Inventory');
        const inventory = (dnd as any).inventory || [];
        if (inventory.length > 0) {
            data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
            inventory.forEach((i: any) => {
                if (typeof i === 'string') {
                    data.push(['    ' + i]);
                } else if (i && typeof i === 'object') {
                    data.push([
                        '    ' + (i.name || ''),
                        i.quantity || i.count || 1,
                        i.weight || '',
                        i.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        
        const attunement = (dnd as any).attunementItems || [];
        if (attunement.length > 0) {
            addSubHeader('Attunement Items');
            data.push(['    ' + formatList(attunement)]);
        }
    } else {
        addSubHeader('Wealth');
        data.push(['    Throne Gelt', dh.wealth?.throneGelt || 0]);
        data.push(['    Monthly Income', dh.wealth?.monthlyIncome || 0]);
        data.push(['    Notes', dh.wealth?.notes || '']);
        
        addSubHeader('Armor');
        const armor = (dh.equipment as any)?.armor || {};
        const armorEntries = Object.entries(armor).filter(([_, v]) => v !== null && v !== undefined && v !== '');
        if (armorEntries.length > 0) {
            data.push(['    Location', 'Armor Name', 'AP', 'Penalties', 'Traits']);
            armorEntries.forEach(([loc, item]) => {
                if (typeof item === 'string') {
                    data.push(['    ' + loc, item, '', '', '']);
                } else if (item && typeof item === 'object') {
                    data.push([
                        '    ' + loc,
                        item.name || '',
                        item.ap || item.armorPoints || '',
                        item.penalties || item.penalty || '',
                        item.traits || item.qualities || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        
        addSubHeader('Weapons');
        const weapons = (dh.equipment as any)?.weapons || { melee: [], ranged: [] };
        const allWeapons = [...(weapons.melee || []), ...(weapons.ranged || [])];
        if (allWeapons.length > 0) {
            data.push(['    Name', 'Type', 'Range', 'Damage', 'Penetration', 'Traits']);
            allWeapons.forEach((w: any) => {
                if (typeof w === 'string') {
                    data.push(['    ' + w, '', '', '', '', '']);
                } else if (w && typeof w === 'object') {
                    data.push([
                        '    ' + (w.name || ''),
                        w.type || w.class || '',
                        w.range || '',
                        w.damage || '',
                        w.penetration || w.pen || '',
                        w.traits || w.qualities || w.special || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        
        addSubHeader('Inventory');
        const inventory = dh.inventory || [];
        if (inventory.length > 0) {
            data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
            inventory.forEach((i: any) => {
                if (typeof i === 'string') {
                    data.push(['    ' + i]);
                } else if (i && typeof i === 'object') {
                    data.push([
                        '    ' + (i.name || ''),
                        i.quantity || i.count || 1,
                        i.weight || '',
                        i.notes || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
    }
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // SPELLS (DnD only)
    // ═══════════════════════════════════════════════════════════
    if (isDnD) {
        addHeader('Spellcasting');
        addRow('Spellcasting Ability', (dnd as any).spellcastingAbility);
        addRow('Spell Save DC', (dnd as any).spellSaveDifficulty);
        addRow('Spell Attack Bonus', (dnd as any).spellAttackBonus);
        
        const slots = (dnd as any).spellSlots || {};
        if (typeof slots === 'object' && !Array.isArray(slots) && Object.keys(slots).length > 0) {
            addSubHeader('Spell Slots');
            data.push(['    Level', 'Total', 'Used']);
            Object.entries(slots).forEach(([level, count]) => {
                const used = ((dnd as any).spellSlotsUsed || {})[level] || 0;
                data.push(['    ' + level, count, used]);
            });
        }
        
        const spells = (dnd as any).spells || [];
        if (spells.length > 0) {
            addSubHeader('Known / Prepared Spells');
            data.push(['    Spell Name', 'Level', 'School', 'Casting Time', 'Components', 'Range', 'Duration', 'Prepared', 'Notes']);
            spells.forEach((s: any) => {
                if (typeof s === 'string') {
                    data.push(['    ' + s]);
                } else if (s && typeof s === 'object') {
                    data.push([
                        '    ' + (s.name || ''),
                        s.level !== undefined ? s.level : '',
                        s.school || '',
                        s.castingTime || s.casting_time || '',
                        s.components || '',
                        s.range || '',
                        s.duration || '',
                        s.prepared ? 'Yes' : '',
                        s.notes || ''
                    ]);
                }
            });
        }
        
        const entries = (dnd as any).spellcastingEntries || [];
        if (entries.length > 0) {
            addSubHeader('Spellcasting Entries');
            data.push(['    ' + formatList(entries)]);
        }
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // FEATURES & TRAITS (DnD)
    // ═══════════════════════════════════════════════════════════
    if (isDnD) {
        addHeader('Features & Traits');
        const features = (dnd as any).featuresAndTraits || [];
        if (features.length > 0) {
            data.push(['    Name', 'Source', 'Description']);
            features.forEach((f: any) => {
                if (typeof f === 'string') {
                    data.push(['    ' + f]);
                } else if (f && typeof f === 'object') {
                    data.push([
                        '    ' + (f.name || ''),
                        f.source || '',
                        f.description || ''
                    ]);
                }
            });
        } else {
            data.push(['    None']);
        }
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // NARRATIVE
    // ═══════════════════════════════════════════════════════════
    addHeader('Narrative & Notes');
    addRow('Backstory', character.backstory);
    addRow('Notes', character.notes);
    
    if (isDnD) {
        addRow('Personality Traits', (dnd as any).personalityTraits);
        addRow('Ideals', (dnd as any).ideals);
        addRow('Bonds', (dnd as any).bonds);
        addRow('Flaws', (dnd as any).flaws);
        addRow('Proficiencies & Languages', (dnd as any).otherProficienciesAndLanguages);
    }
    addEmptyRow();

    // ═══════════════════════════════════════════════════════════
    // COMPANIONS (DnD)
    // ═══════════════════════════════════════════════════════════
    if (isDnD) {
        const companions = (dnd as any).companions || [];
        if (companions.length > 0) {
            addHeader('Companions');
            data.push(['    Name', 'Type', 'AC', 'HP', 'Notes']);
            companions.forEach((c: any) => {
                if (typeof c === 'string') {
                    data.push(['    ' + c]);
                } else if (c && typeof c === 'object') {
                    data.push([
                        '    ' + (c.name || ''),
                        c.type || '',
                        c.ac || '',
                        c.hp || '',
                        c.notes || ''
                    ]);
                }
            });
            addEmptyRow();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // QUEST LOG
    // ═══════════════════════════════════════════════════════════
    const quests = character.questLog || [];
    if (quests.length > 0) {
        addHeader('Quest Log');
        data.push(['    Quest Name', 'Status', 'Description', 'Rewards', 'Notes']);
        quests.forEach((q: any) => {
            if (typeof q === 'string') {
                data.push(['    ' + q]);
            } else if (q && typeof q === 'object') {
                data.push([
                    '    ' + (q.name || q.title || ''),
                    q.status || '',
                    q.description || '',
                    q.rewards || '',
                    q.notes || ''
                ]);
            }
        });
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // CUSTOM HOUSE RULES
    // ═══════════════════════════════════════════════════════════
    const houseRules = character.customHouseRules || [];
    if (houseRules.length > 0) {
        addHeader('Custom House Rules');
        data.push(['    Rule Name', 'Description']);
        if (Array.isArray(houseRules)) {
            houseRules.forEach((r: any) => {
                if (typeof r === 'string') {
                    data.push(['    ' + r]);
                } else if (r && typeof r === 'object') {
                    data.push([
                        '    ' + (r.name || r.title || ''),
                        r.description || ''
                    ]);
                }
            });
        } else if (typeof houseRules === 'string') {
            data.push(['    ' + houseRules]);
        }
        addEmptyRow();
    }

    // ═══════════════════════════════════════════════════════════
    // CREATE WORKSHEET
    // ═══════════════════════════════════════════════════════════
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [
        { wch: 35 },  // Column A: Labels
        { wch: 20 },  // Column B: Values
        { wch: 15 },  // Column C: Additional
        { wch: 15 },  // Column D: Additional
        { wch: 15 },  // Column E: Additional
        { wch: 15 },  // Column F: Additional
        { wch: 20 },  // Column G: Additional
        { wch: 20 },  // Column H: Additional
        { wch: 30 }   // Column I: Notes/Description
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Character Sheet");
    
    const fileName = `${character.name.replace(/\s+/g, '_')}_Complete_Character_Sheet.xlsx`;
    XLSX.writeFile(workbook, fileName);
};