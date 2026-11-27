import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  rankForCharacter,
  resolveCharacterClass,
} from '@/games/dh1/dark-heresy-ranks';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { deriveDh1 } from '@/games/dh1/derive';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { migrateDh1V7toV8 } from '@/games/dh1/migrations';
import { dh1CardSummary } from '@/games/dh1/slots/card-summary';
import type { DH1Character } from '@/games/dh1/types';
import { getGameModule } from '@/games/registry';
import type { GameExportConfig } from '@/games/types';
import {
  normalizeAllCharacters,
  type NormalizeCharactersReport,
} from '@/lib/character-schema';
import { translations } from '@/lib/i18n';

import { removeDir, useTempDataDir } from '@tests/support';

/**
 * ─── LANDMARK: DH1 DERIVED RANK ───────────────────────────────────────────
 * Ранг и класс — производные от карьеры, опыта и выбранных путей. Сохранённый
 * `rank` — снимок создания, поэтому шапка, карточка, экспорт и Excel считают
 * его живьём, а `derive` пересчитывает при сохранении и на старте.
 *
 * Ключевой regression-кейс: лист Adept с 2200 опыта и сохранённым `Scholar`
 * обязан показывать `Inditor` — именно так расходились шапка и блок опыта.
 */

const EXPORT_ALL: GameExportConfig = {
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

function sheet(overrides: Record<string, unknown> = {}): DH1Character {
  return {
    ...createDh1Defaults({ careerPath: 'Adept' }),
    id: 'dh1-rank-fixture',
    userId: 'user-test',
    totalExpSpent: 2200,
    rank: 'Scholar',
    ...overrides,
  } as DH1Character;
}

describe('DH1: актуальный ранг по опыту', () => {
  it('идёт по порогам карьеры', () => {
    expect(rankForCharacter({ careerPath: 'Adept', totalExpSpent: 0 })).toBe(
      'Archivist',
    );
    expect(rankForCharacter({ careerPath: 'Adept', totalExpSpent: 900 })).toBe(
      'Scrivener',
    );
    expect(rankForCharacter({ careerPath: 'Adept', totalExpSpent: 2200 })).toBe(
      'Inditor',
    );
    expect(
      rankForCharacter({ careerPath: 'Guardsman', totalExpSpent: 7500 }),
    ).toBe('Veteran');
  });

  it('продвинутый путь важнее стандартной ветки, а невалидный игнорируется', () => {
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 6500,
        advancedPath: 'Comptroller',
      }),
    ).toBe('Comptroller');
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 2200,
        advancedPath: 'Нет такого пути',
      }),
    ).toBe('Inditor');
  });

  it('альтернативный Chirurgeon заменяет Inditor только до 3000', () => {
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 2500,
        alternatePath: 'Chirurgeon',
      }),
    ).toBe('Chirurgeon');
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 3200,
        alternatePath: 'Chirurgeon',
      }),
    ).toBe('Scholar');
  });

  it('продвинутый путь ищется по имени ветки, а не по ключу', () => {
    expect(
      rankForCharacter({
        careerPath: 'Imperial Psyker',
        totalExpSpent: 2500,
        advancedPath: 'Savant Militant',
      }),
    ).toBe('Savant Militant');
    expect(
      rankForCharacter({
        careerPath: 'Imperial Psyker',
        totalExpSpent: 2500,
        advancedPath: 'pathA',
      }),
    ).toBe('Aspirant');
    expect(
      rankForCharacter({
        careerPath: 'Scum',
        totalExpSpent: 6500,
        advancedPath: 'Comptroller',
      }),
    ).toBe('Rogue');
  });

  it('лист без известной карьеры сохраняет legacy-ранг', () => {
    expect(rankForCharacter({ rank: 'Acolyte' })).toBe('Acolyte');
    expect(
      rankForCharacter({ careerPath: 'Неизвестная карьера', rank: 'Custom' }),
    ).toBe('Custom');
    expect(rankForCharacter(null)).toBe('');
  });

  it('класс — карьера; без карьеры остаётся сохранённый', () => {
    expect(
      resolveCharacterClass({ careerPath: 'Adept', characterClass: 'Acolyte' }),
    ).toBe('Adept');
    expect(resolveCharacterClass({ characterClass: 'Acolyte' })).toBe(
      'Acolyte',
    );
    expect(resolveCharacterClass({})).toBe('');
  });
});

describe('DH1: derive пересчитывает ранг и класс', () => {
  it('2200 опыта Adept: Scholar → Inditor, класс — карьера', () => {
    const next = deriveDh1(sheet());
    expect(next.rank).toBe('Inditor');
    expect(next.characterClass).toBe('Adept');
  });

  it('идемпотентен', () => {
    const once = deriveDh1(sheet());
    const twice = deriveDh1(once);
    expect(twice).toEqual(once);
  });

  it('не создаёт поля у листа без карьеры и ранга', () => {
    const draft = { skills: [] } as unknown as DH1Character;
    const next = deriveDh1(draft);
    expect('rank' in next).toBe(false);
    expect('characterClass' in next).toBe(false);
  });

  it('legacy-ранг без карьеры сохраняется', () => {
    const draft = {
      ...createDh1Defaults(),
      rank: 'Acolyte',
      characterClass: 'Acolyte',
    } as DH1Character;
    const next = deriveDh1(draft);
    expect(next.rank).toBe('Acolyte');
    expect(next.characterClass).toBe('Acolyte');
  });
});

describe('DH1: ранг в карточке и экспорте', () => {
  it('карточка показывает ранг по опыту, а не снимок', () => {
    const t = (key: string) => translations.en[key] ?? key;
    const result = dh1CardSummary(sheet(), t);
    expect(result.text).toBe('Inditor Adept');
  });

  it('JSON-экспорт несёт вычисленные rank и characterClass', () => {
    const json = buildDh1PortableJson(sheet(), EXPORT_ALL);
    expect(json.rank).toBe('Inditor');
    expect(json.characterClass).toBe('Adept');
    expect(json.careerPath).toBe('Adept');
  });
});

describe('DH1 v7 → v8: ранг стал производным', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = useTempDataDir();
  });

  afterEach(() => {
    delete process.env.DCS_DATA_DIR;
    removeDir(dataDir);
  });

  it('шаг ничего не переписывает и идемпотентен', () => {
    const before = { ...sheet(), schemaVersion: 7 };
    const next = migrateDh1V7toV8(before, []);
    expect(next).toEqual(before);
    expect(next.schemaVersion).toBe(7);
    expect(migrateDh1V7toV8(next, [])).toEqual(next);
  });

  it('модуль объявляет версию 8 и шаг 7 → 8', () => {
    const gameModule = getGameModule('dh1');
    expect(gameModule?.schemaVersion).toBe(8);
    expect(
      gameModule?.migrations?.some((step) => step.from === 7 && step.to === 8),
    ).toBe(true);
  });

  it('startup-обход пересчитывает ранг и пишет .bak с маркером', async () => {
    const uid = '33333333-3333-4333-8333-333333333333';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'dh-rank.json');
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          ...createDh1Defaults({
            careerPath: 'Adept',
            totalExpSpent: 2200,
          }),
          id: 'dh-rank',
          userId: uid,
          name: 'Adept Vex',
          schemaVersion: 7,
          rank: 'Scholar',
        },
        null,
        2,
      ),
      'utf8',
    );

    const report: NormalizeCharactersReport = await normalizeAllCharacters();
    expect(report.updated).toBe(1);
    expect(report.derived).toBeGreaterThanOrEqual(1);

    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.schemaVersion).toBe(8);
    expect(stored.rank).toBe('Inditor');
    expect(stored.characterClass).toBe('Adept');
    expect(fs.existsSync(`${file}.bak`)).toBe(true);

    const history = path.join(
      dataDir,
      'users',
      uid,
      'history',
      'dh-rank.jsonl',
    );
    expect(fs.existsSync(history)).toBe(true);
    expect(fs.readFileSync(history, 'utf8')).toContain('"migration"');

    const second = await normalizeAllCharacters();
    expect(second).toMatchObject({ total: 1, updated: 0 });
  });

  it('лист без карьеры сохраняет legacy-ранг после startup', async () => {
    const uid = '44444444-4444-4444-8444-444444444444';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'dh-legacy.json');
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          ...createDh1Defaults(),
          id: 'dh-legacy',
          userId: uid,
          name: 'Legacy Acolyte',
          schemaVersion: 7,
          rank: 'Acolyte',
          characterClass: 'Acolyte',
        },
        null,
        2,
      ),
      'utf8',
    );

    await normalizeAllCharacters();
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.rank).toBe('Acolyte');
    expect(stored.characterClass).toBe('Acolyte');
  });
});
