import { describe, expect, it } from 'vitest';

import { getGameModule } from '@/games/registry';
import { sanitizeCharacterPayload } from '@/lib/character-payload';

/**
 * ─── LANDMARK: CHARACTER PAYLOAD ALLOWLIST ────────────────────────────────
 * API отбрасывает поля, которых нет в zod-схеме редакции. Замороженный текст
 * пророчества обязан входить в схему, иначе правка из листа молча теряется
 * (поле есть в типах и в normalize, но не в shape).
 */

describe('sanitizeCharacterPayload: замороженный текст пророчества', () => {
  it('оставляет divinationText и divinationEffectText', () => {
    const gameModule = getGameModule('dh1');
    expect(gameModule).toBeDefined();

    const { data, dropped } = sanitizeCharacterPayload(gameModule!, {
      divinationText: { en: 'Sample', ru: 'Образец' },
      divinationEffectText: { en: 'Effect' },
      notAField: 1,
    });

    expect(data.divinationText).toEqual({ en: 'Sample', ru: 'Образец' });
    expect(data.divinationEffectText).toEqual({ en: 'Effect' });
    expect(dropped).toContain('notAField');
  });
});
