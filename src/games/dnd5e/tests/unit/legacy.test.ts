import { describe, expect, it } from 'vitest';

import {
  resolveCharacterSystemId,
  resolveLegacySystemId,
} from '@/games/character-system';
import { createDnd5eDefaults } from '@/games/dnd5e/defaults';

/**
 * ─── LANDMARK: DND5E LEGACY ALIASES ───────────────────────────────────────
 * Legacy-поле `gameSystem: 'Dungeons & Dragons'` разрешает плагин своим
 * `plugin.json#aliases`; ядро этой строки не знает. Хостовый
 * `tests/unit/character-system.test.ts` проверяет только общие инварианты по
 * обнаруженным модулям.
 */

describe('dnd5e: legacy-маппинг редакции', () => {
  it('D&D 5e по legacy gameSystem', () => {
    expect(resolveCharacterSystemId({ gameSystem: 'Dungeons & Dragons' })).toBe(
      'dnd5e',
    );
    expect(resolveLegacySystemId({ gameSystem: 'Dungeons & Dragons' })).toBe(
      'dnd5e',
    );
  });

  it('Legacy-лист D&D нормализуется в dnd5e', () => {
    expect(resolveCharacterSystemId(createDnd5eDefaults())).toBe('dnd5e');
  });
});
