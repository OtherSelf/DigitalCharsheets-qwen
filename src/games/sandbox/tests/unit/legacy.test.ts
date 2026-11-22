import { describe, expect, it } from 'vitest';

import { createSandboxDemo } from '../../demo';
import { sandboxFindEmbedded, sandboxUpdateEmbedded } from '../../embedded';
import {
  sandboxConvertLegacyImport,
  sandboxLegacyImportName,
  sandboxMatchesLegacyImport,
} from '../../legacy-import';
import { migrateV1toV2, migrateV2toV3 } from '../../migrations';
import type { SandboxCharacter } from '../../types';

/**
 * ─── LANDMARK: SANDBOX LEGACY / EMBEDDED ──────────────────────────────────
 * Необязательные ветки SDK, которые легко «объявить и не проверить»:
 * legacy-конвертер, цепочка миграций и вложенная сущность. Проверяем
 * поведение, а не наличие полей: конвертер даёт валидный лист, миграции
 * идемпотентны, спутник находится по виртуальному id и обновляется патчем.
 */
describe('sandbox: legacy-импорт и миграции', () => {
  it('узнаёт плоскую legacy-запись и даёт имя', () => {
    const raw = { might: 12, wits: 13, rank: 'Adept' };
    expect(sandboxMatchesLegacyImport(raw)).toBe(true);
    expect(sandboxMatchesLegacyImport({ name: 'Nothing' })).toBe(false);
    expect(sandboxLegacyImportName({ name: ' Old ' }, 0)).toBe('Old');
    expect(sandboxLegacyImportName({}, 2)).toBe('Sandbox 3');
  });

  it('конвертер заполняет stats/total и не теряет имя контекста', () => {
    const converted = sandboxConvertLegacyImport(
      { might: '12', wits: 13, rank: 'Adept', notes: 'from firestore' },
      {
        userId: 'user-1',
        name: 'Converted',
        createId: () => 'sandbox-id',
      },
    );
    expect(converted).toMatchObject({
      id: 'sandbox-id',
      userId: 'user-1',
      name: 'Converted',
      systemId: 'sandbox',
      schemaVersion: 3,
      rank: 'Adept',
      stats: { might: 12, wits: 13 },
      total: 25,
      notes: 'from firestore',
    });
  });

  it('миграции 1→2 и 2→3 идемпотентны и считают total', () => {
    const v1 = { stats: { might: 20, wits: 15 }, edition: 'sandbox' };
    const v2 = migrateV1toV2(v1);
    expect(v2).not.toHaveProperty('edition');
    const v3 = migrateV2toV3(v2);
    expect(v3.total).toBe(35);
    expect(migrateV2toV3(v3)).toEqual(v3);
  });
});

describe('sandbox: вложенный спутник', () => {
  const character = createSandboxDemo() as SandboxCharacter;

  it('находит спутник только по своему виртуальному id', () => {
    expect(
      sandboxFindEmbedded(character, 'companion-servo-skull'),
    ).toMatchObject({ id: 'servo-skull', name: 'Servo-skull' });
    expect(sandboxFindEmbedded(character, 'companion-missing')).toBeUndefined();
    expect(sandboxFindEmbedded(character, 'servo-skull')).toBeUndefined();
  });

  it('обновляет спутник, не мутируя лист, и возвращает патч', () => {
    const snapshot = structuredClone(character);
    const updated = sandboxUpdateEmbedded(character, 'companion-servo-skull', {
      name: 'Renamed',
      notes: 'new note',
    });
    expect(updated?.character.companion?.name).toBe('Renamed');
    expect(updated?.patch.companion?.id).toBe('servo-skull');
    expect(character).toEqual(snapshot);
    expect(
      sandboxUpdateEmbedded(character, 'companion-missing', {}),
    ).toBeUndefined();
  });
});
