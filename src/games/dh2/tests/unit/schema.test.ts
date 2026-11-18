import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import type { DH2Character } from '@/games/dh2/types';
import {
  normalizeAllCharacters,
  type NormalizeCharactersReport,
} from '@/lib/character-schema';
import {
  CHARACTER_SCHEMA_VERSION,
  normalizeCharacterRecord,
} from '@/lib/character-version';
import { parseExportPayload } from '@/lib/export-utils';

import { makeDndCharacter, removeDir, useTempDataDir } from '@tests/support';

/**
 * ─── LANDMARK: DH2 CHARACTER SCHEMA TESTS ────────────────────────────────
 * Character schema v1 для 2e: лист хранит `schemaVersion`, а пророчество —
 * стабильный id строки 2-9. Legacy DH1-значение переводится в строку таблицы
 * 2-9, незнакомое — уходит в `notes` с предупреждением. Проверяем чистую
 * нормализацию и startup-обход файлов.
 *
 * Проверки 2e живут рядом с редакцией (D16): паритет с dh1 здесь не
 * проверяется, свой лист редакция проверяет сама. Нормализация чужого
 * D&D-листа — поведение хоста, которым пользуются обе редакции, поэтому
 * проверка дублируется в dh1/dh2 (D16).
 */
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

/**
 * 2e-лист до миграции: структуры 2e уже есть, но пророчество записано
 * DH1-представлением (`painOfBullet`), как в старых файлах 2e.
 */
function legacyDh2(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...createDh2Defaults({ name: 'Legacy' }),
    id: 'dh2-legacy',
    userId: 'user-test',
    ...overrides,
  };
}

describe('character schema v1', () => {
  it('переводит legacy DH-пророчество в строку 2-9 и ставит версию', () => {
    const legacy = legacyDh2({
      divination: 'painOfBullet',
      divinationEffect: '+2 Insanity Points.',
    });

    const { character, changed, issues } = normalizeCharacterRecord(legacy);
    const dh = character as unknown as DH2Character;
    expect(changed).toBe(true);
    // Эффект 1e в листе 2e не хранится — миграция сообщает о переносе в notes.
    expect(issues.join(' ')).toContain('поля DH1 перенесены');
    expect(dh.notes).toContain('[migration v2]');
    expect(character.schemaVersion).toBe(DH2_SCHEMA_VERSION);
    expect(dh.divination).toBe('d100-10');
    expect(
      (character as unknown as Record<string, unknown>).divinationEffect,
    ).toBeUndefined();
  });

  it('идемпотентна: второй проход ничего не меняет', () => {
    const first = normalizeCharacterRecord(
      legacyDh2({ divination: 'darkDreams' }),
    );
    const second = normalizeCharacterRecord(
      first.character as unknown as Record<string, unknown>,
    );
    expect(second.changed).toBe(false);
    const dh = second.character as unknown as DH2Character;
    expect(dh.divination).toBe('d100-50');
  });

  it('сохраняет неизвестное кастомное пророчество и сообщает о нём', () => {
    const { character, issues } = normalizeCharacterRecord(
      legacyDh2({ divination: 'Knowledge is power, guard it well.' }),
    );
    const dh = character as unknown as DH2Character;
    // Таблицы 2-9 у такой строки нет: текст не теряется, а уходит в notes.
    expect(dh.divination).toBe('');
    expect(dh.notes).toContain(
      'пророчество DH1: Knowledge is power, guard it well.',
    );
    expect(character.schemaVersion).toBe(DH2_SCHEMA_VERSION);
    expect(issues.join(' ')).toContain('не сопоставлено');
  });

  it('импорт экспорта 2.0 мигрирует legacy-пророчество в строку 2-9', () => {
    const payload = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        format: 'dcs-export',
        version: '2.0',
        kind: 'character',
        exportDate: '2026-11-11T00:00:00.000Z',
        characterCount: 1,
      },
      character: legacyDh2({
        divination: 'trustYourFear',
        divinationEffect: '+2 Agility, +1 Fate Point.',
      }),
    };
    const parsed = parseExportPayload(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const imported = parsed.characters[0] as unknown as DH2Character;
    expect(imported.schemaVersion).toBe(DH2_SCHEMA_VERSION);
    expect(imported.divination).toBe('d100-02');
    expect(imported.notes).toContain(
      'эффект пророчества DH1: +2 Agility, +1 Fate Point.',
    );
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
    const uid = '33333333-3333-4333-8333-333333333333';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'dh-2.json');
    const draft: Record<string, unknown> = {
      ...legacyDh2({ divination: 'painOfBullet' }),
      divinationEffect: '+2 Insanity Points.',
    };
    // Старый файл 2e ещё без версии формата — её ставит нормализация.
    delete draft.schemaVersion;
    fs.writeFileSync(file, JSON.stringify(draft, null, 2), 'utf8');

    const first: NormalizeCharactersReport = normalizeAllCharacters();
    expect(first).toMatchObject({ total: 1, updated: 1 });
    expect(first.issues.join(' ')).toContain('поля DH1 перенесены');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.schemaVersion).toBe(DH2_SCHEMA_VERSION);
    expect(stored.divination).toBe('d100-10');
    expect(stored.divinationEffect).toBeUndefined();

    const second = normalizeAllCharacters();
    expect(second).toMatchObject({ total: 1, updated: 0, issues: [] });
  });

  it('не перезаписывает файл с более новой версией схемы', () => {
    const uid = '44444444-4444-4444-8444-444444444444';
    const charsDir = path.join(dataDir, 'users', uid, 'characters');
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'future.json');
    const future = legacyDh2({
      schemaVersion: DH2_SCHEMA_VERSION + 1,
      divination: 'd100-01',
    });
    const raw = JSON.stringify(future, null, 2);
    fs.writeFileSync(file, raw, 'utf8');

    const report = normalizeAllCharacters();
    expect(report.updated).toBe(0);
    expect(report.issues.join(' ')).toContain('новее поддерживаемой');
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
  });
});
