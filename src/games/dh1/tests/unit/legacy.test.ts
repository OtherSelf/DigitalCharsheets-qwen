import { describe, expect, it } from 'vitest';

import {
  resolveCharacterSystemId,
  resolveLegacySystemId,
  resolveSheetReadOnly,
} from '@/games/character-system';

import { makeDhCharacter } from '@tests/support';

/**
 * ─── LANDMARK: DH1 LEGACY ALIASES ─────────────────────────────────────────
 * Legacy-поля 1-й редакции разрешает плагин своим `plugin.json#aliases`
 * (`{gameSystem: 'Dark Heresy'}`, `{... edition: '1st'}`); ядро этих строк
 * не знает. Хостовый `tests/unit/character-system.test.ts` проверяет только
 * общие инварианты по обнаруженным модулям.
 */

describe('dh1: legacy-маппинг редакции', () => {
  it("Dark Heresy с edition='1st' → dh1", () => {
    expect(
      resolveCharacterSystemId({ gameSystem: 'Dark Heresy', edition: '1st' }),
    ).toBe('dh1');
    expect(
      resolveLegacySystemId({ gameSystem: 'Dark Heresy', edition: '1st' }),
    ).toBe('dh1');
  });

  it('без edition редакция не угадывается: лист read-only (D13, ADR 0004)', () => {
    expect(resolveCharacterSystemId({ gameSystem: 'Dark Heresy' })).toBe(
      undefined,
    );
    expect(
      resolveCharacterSystemId(makeDhCharacter({ systemId: undefined })),
    ).toBe(undefined);
  });

  it('неизвестная редакция не превращается в dh1', () => {
    expect(
      resolveCharacterSystemId({
        gameSystem: 'Dark Heresy',
        edition: 'hybrid',
      }),
    ).toBeUndefined();
  });

  it('явный systemId работает и без legacy-полей', () => {
    expect(resolveCharacterSystemId(makeDhCharacter())).toBe('dh1');
  });

  it('лист без редакции открывается read-only с причиной plugin_missing', () => {
    const bare = { gameSystem: 'Dark Heresy' };
    expect(resolveSheetReadOnly(bare, [])).toEqual({
      readOnly: true,
      reason: 'plugin_missing',
    });
    // Явная редакция снимает ограничение.
    expect(resolveSheetReadOnly({ ...bare, systemId: 'dh1' }, [])).toEqual({
      readOnly: false,
      reason: null,
    });
  });
});
