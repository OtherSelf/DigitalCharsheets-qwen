import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { normalizeAllCharacters } from '@/lib/character-schema';
import { getCharactersDir } from '@/lib/data-dir';
import {
  getCharacterFromServer,
  saveCharacterToServer,
  updateCharacterOnServer,
} from '@/lib/server-storage';

import {
  makeDndCharacter,
  readJson,
  removeDir,
  useTempDataDir,
} from '@tests/support';

/**
 * ─── LANDMARK: SERVER DERIVE ON WRITE ─────────────────────────────────────
 * Сервер авторитетен для производных значений: что бы ни прислал клиент, в
 * файле лежит согласованный лист. Лист старой версии схемы при чтении
 * пересчитывается, а startup-обход сохраняет это с `.bak` и маркером.
 */

// uid — UUID: startup-обход работает только с боевыми каталогами (`isUid`).
const uid = '3f1c9a52-5b4e-4d3a-9f6e-1c2b3a4d5e6f';
let dataDir: string;
let previousFlag: string | undefined;

beforeEach(() => {
  dataDir = useTempDataDir();
  previousFlag = process.env.DCS_SERVER_DERIVE;
  delete process.env.DCS_SERVER_DERIVE;
});

afterEach(() => {
  if (previousFlag === undefined) delete process.env.DCS_SERVER_DERIVE;
  else process.env.DCS_SERVER_DERIVE = previousFlag;
  removeDir(dataDir);
});

/** Согласованный по правилам лист: strength 20, level 5, мастерство +3. */
function sheet(overrides: Record<string, unknown> = {}) {
  return makeDndCharacter({
    id: 'char-derive',
    userId: uid,
    level: 5,
    proficiencyBonus: 99,
    stats: {
      strength: 20,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    savingThrows: [
      { name: 'Strength', proficient: true, value: 0 },
      { name: 'Dexterity', proficient: false, value: 0 },
    ],
    skills: [
      {
        name: 'athletics',
        label: 'Athletics (Str)',
        proficient: true,
        expertise: false,
        value: 0,
      },
    ],
    ...overrides,
  });
}

function savedSheet(id = 'char-derive'): Record<string, any> {
  return readJson(path.join(getCharactersDir(uid), `${id}.json`)) as Record<
    string,
    any
  >;
}

describe('пересчёт производных при записи', () => {
  it('сохраняет согласованный лист, даже если клиент прислал мусор', async () => {
    await saveCharacterToServer(uid, sheet());

    const stored = savedSheet();
    expect(stored.proficiencyBonus).toBe(3);
    expect(
      stored.savingThrows.find((save: any) => save.name === 'Strength').value,
    ).toBe(8);
    expect(
      stored.savingThrows.find((save: any) => save.name === 'Dexterity').value,
    ).toBe(0);
    expect(stored.skills[0].value).toBe(8);
  });

  it('пересчитывает лист при обновлении и возвращает согласованный документ', async () => {
    await saveCharacterToServer(uid, sheet());
    const updated = await updateCharacterOnServer(uid, 'char-derive', {
      level: 9,
    } as any);

    expect(updated?.proficiencyBonus).toBe(4);
    expect(savedSheet().proficiencyBonus).toBe(4);
  });

  it('аварийный тормоз сохраняет лист как есть', async () => {
    process.env.DCS_SERVER_DERIVE = '0';
    await saveCharacterToServer(uid, sheet());
    expect(savedSheet().proficiencyBonus).toBe(99);
  });
});

describe('лечение отставших версий схемы', () => {
  it('чтение пересчитывает лист старой версии, не трогая файл', async () => {
    await saveCharacterToServer(uid, sheet());
    const file = path.join(getCharactersDir(uid), 'char-derive.json');
    // Имитируем лист, сохранённый до пересчёта: старая версия и мусорные
    // производные.
    const raw = readJson(file) as Record<string, any>;
    raw.schemaVersion = 1;
    raw.proficiencyBonus = 77;
    fs.writeFileSync(file, JSON.stringify(raw), 'utf8');

    const healed = await getCharacterFromServer(uid, 'char-derive');
    expect(healed?.proficiencyBonus).toBe(3);
    expect((readJson(file) as Record<string, any>).proficiencyBonus).toBe(77);
  });

  it('startup-обход сохраняет пересчёт с .bak и без него не переписывает свежий лист', async () => {
    await saveCharacterToServer(uid, sheet());
    const file = path.join(getCharactersDir(uid), 'char-derive.json');
    const raw = readJson(file) as Record<string, any>;
    raw.schemaVersion = 1;
    raw.proficiencyBonus = 77;
    fs.writeFileSync(file, JSON.stringify(raw), 'utf8');

    const report = await normalizeAllCharacters();
    expect(report.derived).toBeGreaterThan(0);
    expect(fs.existsSync(`${file}.bak`)).toBe(true);
    expect((readJson(file) as Record<string, any>).proficiencyBonus).toBe(3);

    // Повторный прогон ничего не меняет: значение уже согласовано.
    const second = await normalizeAllCharacters();
    expect(second.derived).toBe(0);
  });
});
