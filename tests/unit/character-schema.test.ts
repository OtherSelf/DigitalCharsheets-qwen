import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  normalizeAllCharacters,
  type NormalizeCharactersReport,
} from '@/lib/character-schema';
import {
  CHARACTER_SCHEMA_VERSION,
  normalizeCharacterRecord,
} from '@/lib/character-version';
import { parseExportPayload } from '@/lib/export-utils';
import type { DarkHeresyCharacter } from '@/lib/types';

import {
  makeDhCharacter,
  makeDndCharacter,
  removeDir,
  useTempDataDir,
} from './helpers';

/**
 * Character schema v1: legacy DH-пророчества были английскими фразами, теперь
 * в файле stable ID + schemaVersion. Проверяем чистую нормализацию и
 * startup-обход файлов.
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
  it('переводит legacy DH sentence → stable ID и ставит версию', () => {
    const legacy = makeDhCharacter({
      divination: 'Mutation without, corruption within.',
      divinationEffect: 'Minor Mutation.',
    });

    const { character, changed, issues } = normalizeCharacterRecord(legacy);
    const dh = character as DarkHeresyCharacter;
    expect(changed).toBe(true);
    expect(issues).toEqual([]);
    expect(character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(dh.divination).toBe('mutationWithout');
    expect(dh.divinationEffect).toBe('minorMutation');
  });

  it('идемпотентна: второй проход ничего не меняет', () => {
    const first = normalizeCharacterRecord(
      makeDhCharacter({
        divination: 'Dark dreams lie upon the heart.',
        divinationEffect: '+2 Insanity Points.',
      }),
    );
    const second = normalizeCharacterRecord(
      first.character as unknown as Record<string, unknown>,
    );
    expect(second.changed).toBe(false);
    const dh = second.character as DarkHeresyCharacter;
    expect(dh.divination).toBe('darkDreams');
    expect(dh.divinationEffect).toBe('insanity2');
  });

  it('сохраняет неизвестное кастомное пророчество и сообщает о нём', () => {
    const { character, issues } = normalizeCharacterRecord(
      makeDhCharacter({
        divination: 'Knowledge is power, guard it well.',
        divinationEffect: '+3 Intelligence.',
      }),
    );
    const dh = character as DarkHeresyCharacter;
    expect(dh.divination).toBe('Knowledge is power, guard it well.');
    expect(character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
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
      character: makeDhCharacter({
        divination: 'Trust in your fear.',
        divinationEffect: '+2 Agility, +1 Fate Point.',
      }),
    };
    const parsed = parseExportPayload(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const imported = parsed.characters[0] as DarkHeresyCharacter;
    expect(imported.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(imported.divination).toBe('trustYourFear');
    expect(imported.divinationEffect).toBe('agility2Fate1');
  });

  it('ставит версию D&D-листу без изменения полей', () => {
    const original = makeDndCharacter();
    const { character, changed } = normalizeCharacterRecord(original);
    expect(changed).toBe(true);
    expect(character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(character.name).toBe(original.name);
    expect(character.gameSystem).toBe('Dungeons & Dragons');
  });

  it('startup-обход переписывает legacy-файлы и второй проход идемпотентен', () => {
    const uid = '11111111-1111-4111-8111-111111111111';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'dh-1.json');
    fs.writeFileSync(
      file,
      JSON.stringify(
        makeDhCharacter({
          divination: 'Sins hidden in the heart turn all to decay.',
          divinationEffect: '+3 Corruption Points.',
        }),
        null,
        2,
      ),
      'utf8',
    );

    const first: NormalizeCharactersReport = normalizeAllCharacters();
    expect(first).toMatchObject({ total: 1, updated: 1, issues: [] });
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(stored.divination).toBe('sinsHidden');
    expect(stored.divinationEffect).toBe('corruption3');

    const second = normalizeAllCharacters();
    expect(second).toMatchObject({ total: 1, updated: 0, issues: [] });
  });

  it('не перезаписывает файл с более новой версией схемы', () => {
    const uid = '22222222-2222-4222-8222-222222222222';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'future.json');
    const future = makeDhCharacter({
      schemaVersion: CHARACTER_SCHEMA_VERSION + 1,
      divination: 'mutationWithout',
      divinationEffect: 'minorMutation',
    });
    const raw = JSON.stringify(future, null, 2);
    fs.writeFileSync(file, raw, 'utf8');

    const report = normalizeAllCharacters();
    expect(report.updated).toBe(0);
    expect(report.issues.join(' ')).toContain('новее поддерживаемой');
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
  });
});
