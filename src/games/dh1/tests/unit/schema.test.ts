import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { DH1_SCHEMA_VERSION } from '@/games/dh1/schema-version';
import type { DH1Character } from '@/games/dh1/types';
import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';
import {
  normalizeAllCharacters,
  type NormalizeCharactersReport,
} from '@/lib/character-schema';
import { normalizeCharacterRecord } from '@/lib/character-version';
import { parseExportPayload } from '@/lib/export-utils';

import { removeDir, useTempDataDir } from '@tests/support';

/**
 * Legacy-лист 1e: фабрика редакции плюс поля 2e (`influence`), из-за которых
 * и запускается миграция. Поля — предмет проверки, поэтому живут в тесте.
 */
function legacyDh1(overrides: Record<string, unknown> = {}) {
  const base = createDh1Defaults(overrides);
  return {
    id: 'dh1-legacy-fixture',
    userId: 'user-test',
    ...base,
    name: 'Acolyte Vex',
    stats: {
      ...(base.stats as Record<string, unknown>),
      influence: 5,
    },
    statUpgrades: {
      ...(base.statUpgrades as Record<string, unknown>),
      influence: [false, false, false, false],
    },
    ...overrides,
  };
}

/**
 * ─── LANDMARK: DH1 CHARACTER SCHEMA TESTS ────────────────────────────────
 * Character schema v1: legacy DH-пророчества были английскими фразами, теперь
 * в файле stable ID + schemaVersion. Проверяем чистую нормализацию и
 * startup-обход файлов для 1e-листа.
 *
 * Проверки 1e живут рядом с редакцией: паритет с dh2 здесь не
 * проверяется, свой лист редакция проверяет сама. Нормализация чужого
 * D&D-листа — поведение хоста, которым пользуются обе редакции, поэтому
 * проверка дублируется в dh2/dh1.
 */
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('character schema v1', () => {
  it('experienceLog принимает штраф (отрицательный cost)', () => {
    const draft = legacyDh1({
      experienceLog: [
        {
          id: 'xp-penalty',
          label: 'Penalty',
          cost: -50,
          createdAt: '2026-11-23T00:00:00.000Z',
          kind: 'award',
        },
      ],
    });
    expect(() => dh1CharacterSchema.parse(draft)).not.toThrow();
  });

  it('переводит legacy DH sentence → stable ID и ставит версию', () => {
    const legacy = legacyDh1({
      divination: 'Flesh is a draft; someone is already editing.',
      divinationEffect: 'Minor Mutation.',
    });

    const { character, changed, issues } = normalizeCharacterRecord(legacy);
    const dh = character as unknown as DH1Character;
    expect(changed).toBe(true);
    // В legacy-листе было influence=5 — это поле 2e, оно уходит в notes.
    expect(issues.join(' ')).toContain('поля 2e перенесены');
    expect(dh.notes).toContain('[migration v2]');
    expect(character.schemaVersion).toBe(DH1_SCHEMA_VERSION);
    expect(dh.divination).toBe('mutationWithout');
    expect(dh.divinationEffect).toBe('minorMutation');
  });

  it('идемпотентна: второй проход ничего не меняет', () => {
    const first = normalizeCharacterRecord(
      legacyDh1({
        divination: 'Sleep is a door that does not lock.',
        divinationEffect: '+2 Insanity Points.',
      }),
    );
    const second = normalizeCharacterRecord(
      first.character as unknown as Record<string, unknown>,
    );
    expect(second.changed).toBe(false);
    const dh = second.character as unknown as DH1Character;
    expect(dh.divination).toBe('darkDreams');
    expect(dh.divinationEffect).toBe('insanity2');
  });

  it('сохраняет неизвестное кастомное пророчество и сообщает о нём', () => {
    const { character, issues } = normalizeCharacterRecord(
      legacyDh1({
        divination: 'Knowledge is power, guard it well.',
        divinationEffect: '+3 Intelligence.',
      }),
    );
    const dh = character as unknown as DH1Character;
    expect(dh.divination).toBe('Knowledge is power, guard it well.');
    expect(character.schemaVersion).toBe(DH1_SCHEMA_VERSION);
    expect(issues.join(' ')).toContain('неизвестное пророчество');
  });

  it('импорт экспорта 2.0 мигрирует sentence → stable ID', () => {
    const payload = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        format: 'dcs-export',
        version: '2.0',
        kind: 'character',
        exportDate: '2026-11-11T00:00:00.000Z',
        characterCount: 1,
      },
      character: legacyDh1({
        divination: 'Unease is cheap insurance.',
        divinationEffect: '+2 Agility, +1 Fate Point.',
      }),
    };
    const parsed = parseExportPayload(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const imported = parsed.characters[0] as unknown as DH1Character;
    expect(imported.schemaVersion).toBe(DH1_SCHEMA_VERSION);
    expect(imported.divination).toBe('trustYourFear');
    expect(imported.divinationEffect).toBe('agility2Fate1');
  });

  it('ставит версию D&D-листу без изменения полей', () => {
    const original = {
      id: 'dnd-1',
      userId: 'user-test',
      gameSystem: 'Dungeons & Dragons',
      name: 'D&D legacy fixture',
    };
    const { character, changed } = normalizeCharacterRecord(original);
    expect(changed).toBe(true);
    expect(character.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(character.name).toBe(original.name);
    expect(character.gameSystem).toBe('Dungeons & Dragons');
  });

  it('startup-обход переписывает legacy-файлы и второй проход идемпотентен', async () => {
    const uid = '11111111-1111-4111-8111-111111111111';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'dh-1.json');
    fs.writeFileSync(
      file,
      JSON.stringify(
        legacyDh1({
          divination: 'What is hidden rots faster than what shows.',
          divinationEffect: '+3 Corruption Points.',
        }),
        null,
        2,
      ),
      'utf8',
    );

    const first: NormalizeCharactersReport = await normalizeAllCharacters();
    expect(first).toMatchObject({ total: 1, updated: 1 });
    // В файле был influence из старой формы — миграция сообщает об этом.
    expect(first.issues.join(' ')).toContain('поля 2e перенесены');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.schemaVersion).toBe(DH1_SCHEMA_VERSION);
    expect(stored.divination).toBe('sinsHidden');
    expect((stored as unknown as DH1Character).divinationEffect).toBe(
      'corruption3',
    );

    const second = await normalizeAllCharacters();
    expect(second).toMatchObject({ total: 1, updated: 0, issues: [] });
  });

  it('не перезаписывает файл с более новой версией схемы', async () => {
    const uid = '22222222-2222-4222-8222-222222222222';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'future.json');
    const future = legacyDh1({
      schemaVersion: DH1_SCHEMA_VERSION + 1,
      divination: 'mutationWithout',
      divinationEffect: 'minorMutation',
    });
    const raw = JSON.stringify(future, null, 2);
    fs.writeFileSync(file, raw, 'utf8');

    const report = await normalizeAllCharacters();
    expect(report.updated).toBe(0);
    expect(report.issues.join(' ')).toContain('новее поддерживаемой');
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
  });
});
