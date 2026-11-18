import { describe, expect, it } from 'vitest';

import {
  resolveCharacterSystemId,
  resolveLegacySystemId,
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
  it.each([['1st'], ['hybrid'], [undefined]])(
    'Dark Heresy с edition=%s → dh1',
    (edition) => {
      expect(
        resolveCharacterSystemId({ gameSystem: 'Dark Heresy', edition }),
      ).toBe('dh1');
      expect(
        resolveLegacySystemId({ gameSystem: 'Dark Heresy', edition }),
      ).toBe('dh1');
    },
  );

  it('Legacy-лист DH без edition нормализуется в dh1', () => {
    expect(resolveCharacterSystemId(makeDhCharacter())).toBe('dh1');
  });
});
