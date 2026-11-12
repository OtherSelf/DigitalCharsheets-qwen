import { describe, expect, it } from 'vitest';

import {
  CHARACTER_SCHEMA_VERSION,
  normalizeCharacterRecord,
} from '@/lib/character-version';

import { makeDhCharacter, makeDndCharacter } from './helpers';

/**
 * ─── LANDMARK: CHARACTER MIGRATION v2 TESTS ────────────────────────────────
 * Правила миграции (D3/D4/D8):
 *   • dnd5e / dh1 / dh2 по `systemId`, legacy — по `gameSystem` + `edition`;
 *   • dh1 без influence/fatigue2nd, dh2 без fatigue1st;
 *   • значения чужой редакции не теряются: hybrid/конфликты → notes;
 *   • повторный прогон идемпотентен, файлы новее v2 не трогаем.
 */

function normalize(raw: any) {
  return normalizeCharacterRecord(raw);
}

function dhWithStats(overrides: Record<string, unknown> = {}) {
  const base = makeDhCharacter(overrides);
  return base;
}

describe('миграция листа v2: редакции', () => {
  it('dnd5e: gameSystem → systemId, версия 2, поля не меняются', () => {
    const original = makeDndCharacter();
    const { character, changed, issues } = normalize(original);

    expect(changed).toBe(true);
    expect(issues).toEqual([]);
    expect(character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect((character as any).systemId).toBe('dnd5e');
    expect(character.name).toBe(original.name);
    expect(character.gameSystem).toBe('Dungeons & Dragons');
  });

  it('dh без edition → dh1; влияние по умолчанию не шумит в notes', () => {
    const legacy = dhWithStats({
      stats: { ...makeDhCharacter().stats, influence: 30 },
      statUpgrades: {
        ...makeDhCharacter().statUpgrades,
        influence: [false, false, false, false],
      },
    });
    const { character, issues } = normalize(legacy);
    const dh = character as any;

    expect(dh.systemId).toBe('dh1');
    expect(dh.edition).toBeUndefined();
    expect(dh.stats.influence).toBeUndefined();
    expect(dh.statUpgrades.influence).toBeUndefined();
    expect(dh.fatigue2nd).toBeUndefined();
    expect(dh.fatigue1st).toEqual({ current: 0 });
    expect(dh.notes ?? '').toBe('');
    expect(issues).toEqual([]);
  });

  it("dh edition '1st' → dh1, значения характеристик сохраняются", () => {
    const legacy = dhWithStats({ edition: '1st' });
    const { character } = normalize(legacy);
    const dh = character as any;

    expect(dh.systemId).toBe('dh1');
    expect(dh.stats.weaponSkill).toBe(legacy.stats.weaponSkill);
    expect(dh.stats.intelligence).toBe(legacy.stats.intelligence);
  });

  it("dh edition '2nd' → dh2: influence и fatigue2nd остаются", () => {
    const legacy = dhWithStats({
      edition: '2nd',
      fatigue2nd: { current: 2, notes: 'second edition' },
    });
    const { character } = normalize(legacy);
    const dh = character as any;

    expect(dh.systemId).toBe('dh2');
    expect(dh.stats.influence).toBe(legacy.stats.influence);
    expect(dh.statUpgrades.influence).toEqual(legacy.statUpgrades.influence);
    expect(dh.fatigue2nd).toEqual({ current: 2, notes: 'second edition' });
    expect(dh.fatigue1st).toBeUndefined();
  });

  it('dh2: значимая fatigue1st сохраняется в notes, поле удаляется', () => {
    const legacy = dhWithStats({
      edition: '2nd',
      fatigue1st: { current: 3, notes: 'first edition fatigue' },
    });
    const { character, issues } = normalize(legacy);
    const dh = character as any;

    expect(dh.fatigue1st).toBeUndefined();
    expect(dh.notes).toContain('[migration v2]');
    expect(dh.notes).toContain('усталость 1-й редакции');
    expect(issues.join(' ')).toContain('fatigue1st');
  });

  it('hybrid → dh1, конфликтующие 2e-значения уходят в notes и отчёт', () => {
    const legacy = dhWithStats({
      edition: 'hybrid',
      stats: { ...makeDhCharacter().stats, influence: 42 },
      statUpgrades: {
        ...makeDhCharacter().statUpgrades,
        influence: [true, false, false, false],
      },
      statNotes: { influence: 'peer of the Ordo' },
      fatigue2nd: { current: 4, notes: 'second edition' },
    });
    const { character, issues } = normalize(legacy);
    const dh = character as any;

    expect(dh.systemId).toBe('dh1');
    expect(dh.stats.influence).toBeUndefined();
    expect(dh.fatigue2nd).toBeUndefined();
    expect(dh.notes).toContain('[migration v2]');
    expect(dh.notes).toContain('influence=42');
    expect(dh.notes).toContain('fatigue2nd');
    expect(dh.notes).toContain('peer of the Ordo');
    expect(issues.join(' ')).toContain('dh1: поля 2e перенесены');
    // Общие поля сохраняются (приоритет 1e для общих значений).
    expect(dh.stats.toughness).toBe(legacy.stats.toughness);
  });

  it('явный systemId имеет приоритет над legacy gameSystem/edition', () => {
    const legacy = dhWithStats({
      systemId: 'dh2',
      edition: '1st',
    });
    const { character } = normalize(legacy);
    expect((character as any).systemId).toBe('dh2');
  });
});

describe('миграция листа v2: идемпотентность и границы', () => {
  it('второй прогон ничего не меняет и не дублирует notes', () => {
    const legacy = dhWithStats({
      edition: 'hybrid',
      stats: { ...makeDhCharacter().stats, influence: 42 },
      fatigue2nd: { current: 4 },
    });
    const first = normalize(legacy);
    const second = normalize(first.character as any);

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.issues).toEqual([]);
    const markerCount = (
      (second.character as any).notes.match(/\[migration v2\]/g) || []
    ).length;
    expect(markerCount).toBe(1);
  });

  it('уже v2-лист не меняется', () => {
    const first = normalize(makeDhCharacter({ edition: '2nd' }));
    const raw = first.character as any;
    const second = normalize(raw);
    expect(second.changed).toBe(false);
    expect(second.character).toEqual(raw);
  });

  it('файл новее поддерживаемой версии не трогаем', () => {
    const raw = makeDndCharacter({
      schemaVersion: CHARACTER_SCHEMA_VERSION + 1,
    });
    const result = normalize(raw);
    expect(result.changed).toBe(false);
    expect(result.issues.join(' ')).toContain('новее поддерживаемой');
    expect(result.character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION + 1);
  });

  it('неизвестная система не помечается v2', () => {
    const result = normalize({ id: 'x', name: 'X', gameSystem: 'Unknown' });
    expect(result.changed).toBe(false);
    expect(result.issues.join(' ')).toContain('не удалось определить редакцию');
  });

  it('навыкам DH добавляется обязательный plus30=false', () => {
    const legacy = dhWithStats({
      skills: [
        {
          id: 's1',
          name: 'Awareness',
          notes: '',
          type: 'basic',
          training: { skilled: true, plus10: false, plus20: false },
        },
      ],
    });
    const { character } = normalize(legacy);
    expect((character as any).skills[0].training).toEqual({
      skilled: true,
      plus10: false,
      plus20: false,
      plus30: false,
    });
  });
});
