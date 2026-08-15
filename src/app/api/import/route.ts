import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const IMPORT_FILE = path.join(DATA_DIR, 'import-source.json');
const DEFAULT_PASSWORD = '1234'; // Default password for all imported users

// ─── CLEANING UTILITIES ────────────────────────────────────────────

function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj.trim();
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(item => cleanObject(item));
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = key.trim();
      cleaned[cleanKey] = cleanObject(value);
    }
    return cleaned;
  }
  return obj;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ─── CHARACTER NAME GENERATION ─────────────────────────────────────

function generateCharacterName(raw: any, index: number): string {
  const system = (raw.gameSystem || '').trim();

  if (system.includes('Dark Heresy')) {
    const career = (raw.careerPath || 'Unknown').trim();
    const world = (raw.homeWorld || '').trim();
    return world ? `${career} (${world})` : `${career} #${index + 1}`;
  }

  if (system.includes('Dungeons')) {
    const cls = (raw.characterClass || 'Unknown').trim();
    const level = raw.level || 1;
    const bg = (raw.background || '').trim();
    return bg ? `Level ${level} ${cls} (${bg})` : `Level ${level} ${cls} #${index + 1}`;
  }

  return `Character #${index + 1}`;
}

// ─── DARK HERESY CONVERTER ─────────────────────────────────────────

function convertDarkHeresyCharacter(raw: any, userId: string, name: string): any {
  // Clean equipment
  const rawEquipment = raw.equipment && raw.equipment !== 0 ? raw.equipment : {};
  const armor = rawEquipment.armor || {};
  const weapons = rawEquipment.weapons || {};

  // Normalize armor (replace 0/null with proper null)
  const armorParts = ['Head', 'Right arm', 'Body', 'Left arm', 'Right leg', 'Left leg'];
  const normalizedArmor: any = {};
  for (const part of armorParts) {
    normalizedArmor[part] = armor[part] && armor[part] !== 0 ? armor[part] : null;
  }

  // Normalize weapons
  const meleeWeapons = Array.isArray(weapons.melee) ? weapons.melee : [];
  const rangedWeapons = Array.isArray(weapons.ranged) ? weapons.ranged : [];

  // Normalize points
  const wounds = (raw.wounds && raw.wounds !== 0) ? raw.wounds : { current: 0, max: 0, notes: '' };
  const fatePoints = (raw.fatePoints && raw.fatePoints !== 0) ? raw.fatePoints : { current: 1, max: 1, notes: '' };
  const insanityPoints = (raw.insanityPoints && raw.insanityPoints !== 0) ? raw.insanityPoints : { total: 0, notes: '' };
  const corruptionPoints = (raw.corruptionPoints && raw.corruptionPoints !== 0) ? raw.corruptionPoints : { total: 0, notes: '' };

  // Normalize inventory
  const inventory = Array.isArray(raw.inventory) ? raw.inventory : [];

  return {
    id: generateId(),
    userId,
    gameSystem: 'Dark Heresy',
    name,
    careerPath: (raw.careerPath || '').trim(),
    characterClass: (raw.characterClass || '').trim(),
    homeWorld: (raw.homeWorld || '').trim(),
    rank: 'Acolyte',
    advancedPath: (raw.advancedPath && raw.advancedPath !== 0) ? String(raw.advancedPath).trim() : null,
    alternatePath: (raw.alternatePath && raw.alternatePath !== 0) ? String(raw.alternatePath).trim() : null,
    divination: (raw.divination || '').trim(),
    divinationEffect: (raw.divinationEffect || '').trim(),
    backstory: (raw.backstory || '').trim(),
    age: (raw.age || '').trim(),
    height: (raw.height || '').trim(),
    weight: '',
    hairColor: (raw.hairColor || '').trim(),
    eyeColor: (raw.eyeColor || '').trim(),
    skinColor: '',
    quirk: '',
    worldVariant: '',
    stats: {
      weaponSkill: 30, ballisticSkill: 30, strength: 30, toughness: 30,
      agility: 30, intelligence: 30, perception: 30, willpower: 30,
      fellowship: 30, influence: 0,
    },
    statUpgrades: {},
    statNotes: {},
    skills: [],
    talents: [],
    movement: { walkHalf: 0, walkFull: 0, charge: 0, run: 0 },
    wounds,
    fatePoints,
    insanityPoints,
    corruptionPoints,
    experience: raw.experience || 0,
    totalExpSpent: raw.experience || 0,
    equipment: {
      armor: normalizedArmor,
      weapons: { melee: meleeWeapons, ranged: rangedWeapons },
    },
    inventory,
    wealth: { throneGelt: 0, monthlyIncome: 0 },
  };
}

// ─── DND CONVERTER ─────────────────────────────────────────────────

function convertDndCharacter(raw: any, userId: string, name: string): any {
  const hitPoints = (raw.hitPoints && raw.hitPoints !== 0) ? raw.hitPoints : { current: 0, max: 0 };
  const currency = (raw.currency && raw.currency !== 0) ? raw.currency : { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const deathSaves = (raw.deathSaves && raw.deathSaves !== 0) ? raw.deathSaves : { successes: 0, failures: 0 };

  return {
    id: generateId(),
    userId,
    gameSystem: 'Dungeons & Dragons',
    name,
    characterClass: (raw.characterClass || '').trim(),
    background: (raw.background || '').trim(),
    alignment: (raw.alignment || '').trim(),
    level: raw.level || 1,
    inspiration: (raw.inspiration === 'Yes' || raw.inspiration === '1' || raw.inspiration === 1) ? '1' : '0',
    backstory: (raw.backstory || '').trim(),
    age: (raw.age || '').trim(),
    height: (raw.height || '').trim(),
    weight: '',
    eyes: (raw.eyes || '').trim(),
    hair: (raw.hair || '').trim(),
    stats: {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    },
    armorClass: raw.armorClass || 10,
    hitPoints,
    hitDice: (raw.hitDice || '').trim(),
    hitDiceUsed: (raw.hitDiceUsed && raw.hitDiceUsed !== 0) ? raw.hitDiceUsed : 0,
    speed: '30ft',
    proficiencyBonus: 2,
    initiative: 0,
    experience: raw.experiencePoints || 0,
    skills: [],
    attacks: Array.isArray(raw.attacks) ? raw.attacks : [],
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    currency,
    featuresAndTraits: Array.isArray(raw.featuresAndTraits) ? raw.featuresAndTraits : [],
    companions: Array.isArray(raw.companions) ? raw.companions : [],
    combatResources: Array.isArray(raw.combatResources) ? raw.combatResources : [],
    attunementItems: Array.isArray(raw.attunementItems) ? raw.attunementItems : [],
    bonds: Array.isArray(raw.bonds) ? raw.bonds : [],
    ideals: Array.isArray(raw.ideals) ? raw.ideals : [],
    flaws: Array.isArray(raw.flaws) ? raw.flaws : [],
    deathSaves,
    hpTracking: (raw.hpTracking || '').trim(),
    isMulticlass: raw.isMulticlass === true,
    spells: {},
  };
}

// ─── IMPORT HANDLER (GET request - just visit the URL) ─────────────

export async function GET() {
  try {
    // Check if import file exists
    if (!fs.existsSync(IMPORT_FILE)) {
      return NextResponse.json({
        success: false,
        error: `Import file not found. Please save your Firestore export as "data/import-source.json" and try again.`,
      }, { status: 404 });
    }

    // Read the import file
    const fileContent = fs.readFileSync(IMPORT_FILE, 'utf8');
    const rawData = JSON.parse(fileContent);

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Import file is empty or not a valid array.',
      }, { status: 400 });
    }

    // Step 1: Clean all data
    const cleanedData = rawData.map((char: any) => cleanObject(char));

    // Step 2: Group by Firebase user ID
    const userGroups: Record<string, any[]> = {};
    for (const char of cleanedData) {
      const docId = char['Document ID'] || '';
      const match = docId.match(/\/users\/([^\/]+)\/characterSheets\//);
      if (match) {
        const firebaseUserId = match[1];
        if (!userGroups[firebaseUserId]) userGroups[firebaseUserId] = [];
        userGroups[firebaseUserId].push(char);
      }
    }

    // Step 3: Process each user
    const results: any[] = [];
    let totalImported = 0;
    const passwordHash = hashPassword(DEFAULT_PASSWORD);

    for (const [firebaseUserId, chars] of Object.entries(userGroups)) {
      // Create a deterministic local user ID
      const localUserId = 'user-' + crypto.createHash('md5').update(firebaseUserId).digest('hex').substr(0, 8);
      const userEmail = `imported-${firebaseUserId.substr(0, 6)}@local.charsheets`;
      const displayName = `Player ${firebaseUserId.substr(0, 4)}`;

      // Create directories
      const userDir = path.join(DATA_DIR, localUserId);
      const charsDir = path.join(userDir, 'characters');
      if (!fs.existsSync(charsDir)) {
        fs.mkdirSync(charsDir, { recursive: true });
      }

      // Create user.json with default password
      const userFile = path.join(userDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({
        email: userEmail,
        displayName: displayName,
        passwordHash: passwordHash,
        originalFirebaseId: firebaseUserId,
      }, null, 2), 'utf8');

      // Process each character
      const importedChars: any[] = [];
      chars.forEach((raw, index) => {
        const system = (raw.gameSystem || '').trim();
        const name = generateCharacterName(raw, index);

        let character: any;
        if (system.includes('Dark Heresy')) {
          character = convertDarkHeresyCharacter(raw, localUserId, name);
        } else if (system.includes('Dungeons')) {
          character = convertDndCharacter(raw, localUserId, name);
        } else {
          return; // Skip unknown systems
        }

        // Write individual character file
        const charFile = path.join(charsDir, `${character.id}.json`);
        fs.writeFileSync(charFile, JSON.stringify(character, null, 2), 'utf8');
        importedChars.push({ name: character.name, system: character.gameSystem });
        totalImported++;
      });

      results.push({
        localUserId,
        email: userEmail,
        password: DEFAULT_PASSWORD,
        charactersImported: importedChars.length,
        characters: importedChars,
      });
    }

    // Step 4: Delete the import file after success
    fs.unlinkSync(IMPORT_FILE);

    return NextResponse.json({
      success: true,
      message: `Import complete! ${totalImported} characters imported across ${results.length} user accounts.`,
      defaultPassword: DEFAULT_PASSWORD,
      users: results,
      note: 'The import-source.json file has been deleted. You can now log in with the emails listed above using the default password.',
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: `Import failed: ${error.message}`,
    }, { status: 500 });
  }
}