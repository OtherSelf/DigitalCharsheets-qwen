/**
 * Общие помощники юнит-тестов: изолированный каталог данных, чтение JSON,
 * валидные фикстуры персонажей D&D и Dark Heresy.
 *
 * В ./data тесты не пишут: useTempDataDir() создаёт каталог в os.tmpdir() и
 * выставляет DCS_DATA_DIR, removeDir() удаляет его в afterEach.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSession } from '@/lib/session';

/**
 * Создаёт пустой временный каталог и делает его DATA_DIR для приложения
 * (src/lib/data-dir.ts читает DCS_DATA_DIR при каждом вызове).
 * Так тесты не видят и не портят реальные ./data.
 */
export function useTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-test-'));
  process.env.DCS_DATA_DIR = dir;
  return dir;
}

export function removeDir(dir: string | undefined | null) {
  if (!dir) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/**
 * Подпись пользователя: файловый макет каталога
 * `<data-dir>/users/<uid>/{user.json,characters}` (схема v2).
 */
export function userPaths(dataDir: string, userId: string) {
  const userDir = path.join(dataDir, 'users', userId);
  return {
    userDir,
    userFile: path.join(userDir, 'user.json'),
    charactersDir: path.join(userDir, 'characters'),
  };
}

/** Индекс «логин → uid»: `<data-dir>/index/logins.json`. */
export function loginIndexPath(dataDir: string): string {
  return path.join(dataDir, 'index', 'logins.json');
}

/** Значение cookie-сессии для uid — то, что поставил бы `/api/auth`. */
export function sessionCookie(uid: string): string {
  return `dcs_session=${createSession(uid).value}`;
}

/** Заголовки запроса с сессией: `headers: sessionHeaders(uid)`. */
export function sessionHeaders(uid: string): Record<string, string> {
  return { cookie: sessionCookie(uid) };
}

/** Незамысловатый D&D-персонаж — минимум, который принимает хранилище. */
export function makeDndCharacter(overrides: Record<string, any> = {}): any {
  return {
    id: 'dnd-1',
    userId: 'user-test',
    gameSystem: 'Dungeons & Dragons',
    name: 'Ragnar Testborn',
    characterClass: 'Fighter',
    level: 3,
    race: 'Human',
    background: 'Soldier',
    alignment: 'Lawful Good',
    proficiencyBonus: 2,
    stats: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 11,
      charisma: 9,
    },
    hitPoints: { current: 24, max: 28 },
    armorClass: 17,
    skills: [],
    equipment: [],
    inventory: [],
    spells: [],
    questLog: [],
    customHouseRules: [],
    ...overrides,
  };
}

/** Незамысловатый персонаж Dark Heresy. */
export function makeDhCharacter(overrides: Record<string, any> = {}): any {
  return {
    id: 'dh-1',
    userId: 'user-test',
    gameSystem: 'Dark Heresy',
    name: 'Acolyte Vex',
    careerPath: 'Adept',
    homeWorld: 'Hive World',
    rank: 'Acolyte',
    statUpgrades: {
      weaponSkill: [false, false, false, false],
      ballisticSkill: [false, false, false, false],
      strength: [false, false, false, false],
      toughness: [false, false, false, false],
      agility: [false, false, false, false],
      intelligence: [false, false, false, false],
      perception: [false, false, false, false],
      willpower: [false, false, false, false],
      fellowship: [false, false, false, false],
      influence: [false, false, false, false],
    },
    statNotes: {},
    stats: {
      weaponSkill: 30,
      ballisticSkill: 35,
      strength: 30,
      toughness: 30,
      agility: 32,
      intelligence: 40,
      perception: 33,
      willpower: 31,
      fellowship: 28,
      influence: 5,
    },
    wounds: { current: 10, max: 10, notes: '' },
    fatePoints: { current: 1, max: 1, notes: '' },
    insanityPoints: { total: 0, notes: '' },
    corruptionPoints: { total: 0, notes: '' },
    movement: { walkHalf: 3, walkFull: 6, charge: 9, run: 18 },
    experience: 0,
    totalExpSpent: 0,
    equipment: {
      armor: {
        Head: null,
        'Right arm': null,
        Body: null,
        'Left arm': null,
        'Right leg': null,
        'Left leg': null,
      },
      weapons: { melee: [], ranged: [] },
    },
    inventory: [],
    wealth: { throneGelt: 0, monthlyIncome: 0 },
    skills: [],
    talents: [],
    questLog: [],
    customHouseRules: [],
    ...overrides,
  };
}
