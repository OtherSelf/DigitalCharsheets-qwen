import { describe, expect, it } from 'vitest';

import {
  resolveCharacterSystemId,
  resolveLegacySystemId,
} from '@/games/character-system';

/**
 * ─── LANDMARK: DH2 LEGACY ALIASES ─────────────────────────────────────────
 * Legacy-поля 2-й редакции разрешает плагин своим `plugin.json#aliases`
 * (`{gameSystem: 'Dark Heresy', edition: '2nd'}`); ядро этих строк не знает.
 * Хостовый `tests/unit/character-system.test.ts` проверяет только общие
 * инварианты по обнаруженным модулям.
 */

describe('dh2: legacy-маппинг редакции', () => {
  it('Dark Heresy с edition=2nd → dh2', () => {
    expect(
      resolveCharacterSystemId({ gameSystem: 'Dark Heresy', edition: '2nd' }),
    ).toBe('dh2');
    expect(
      resolveLegacySystemId({ gameSystem: 'Dark Heresy', edition: '2nd' }),
    ).toBe('dh2');
  });

  it('Legacy-лист DH 2e нормализуется в dh2', () => {
    expect(
      resolveCharacterSystemId({
        gameSystem: 'Dark Heresy',
        edition: '2nd',
      }),
    ).toBe('dh2');
  });

  it('без edition 2-я редакция не угадывается', () => {
    expect(
      resolveCharacterSystemId({ gameSystem: 'Dark Heresy' }),
    ).toBeUndefined();
  });
});
