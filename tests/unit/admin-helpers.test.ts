import { describe, expect, it } from 'vitest';

import { adminGameBadge } from '@/components/admin/admin-helpers';
import { getGameModule } from '@/games/registry';

import { hasPlugin } from '@tests/support';

/**
 * ─── LANDMARK: ADMIN GAME BADGE ────────────────────────────────────────────
 * В «Списке чарлистов» админ должен видеть игру, а не только редакцию:
 * `nameKey` модуля — «2nd Edition», поэтому рядом с кодом нужен tooltip с
 * полным именем игры. Код локале-независим и не переводится.
 */
const translate = (key: string) =>
  ({
    'games.generated.darkHeresy.name': 'Dark Heresy',
    'games.generated.dnd.name': 'Dungeons & Dragons',
    'games.dh1.name': '1st Edition',
    'games.dh2.name': '2nd Edition',
    'games.dnd5e.name': '5th Edition',
  })[key] ?? key;

describe('бейдж игры в списке чарлистов', () => {
  it('показывает короткий код и полное имя игры с редакцией', () => {
    // Код — из модуля редакции, а не из литерала в тесте.
    if (hasPlugin('dh2')) {
      expect(
        adminGameBadge(
          { systemId: 'dh2', gameSystem: 'Dark Heresy' },
          translate,
        ),
      ).toEqual({
        code: getGameModule('dh2')?.shortCode,
        title: 'Dark Heresy · 2nd Edition',
      });
    }

    expect(
      adminGameBadge(
        { systemId: 'dnd5e', gameSystem: 'Dungeons & Dragons' },
        translate,
      ),
    ).toEqual({ code: 'dnd5e', title: 'Dungeons & Dragons · 5th Edition' });
  });

  it('не переводит короткий код: локаль меняет только tooltip', () => {
    const ruTranslate = (key: string) =>
      ({
        'games.generated.darkHeresy.name': 'Dark Heresy',
        'games.dh1.name': '1-я редакция',
      })[key] ?? key;

    expect(
      adminGameBadge(
        { systemId: 'dh1', gameSystem: 'Dark Heresy' },
        ruTranslate,
      ),
    ).toEqual({ code: 'dh1e', title: 'Dark Heresy · 1-я редакция' });
  });

  it('неустановленный плагин показывает сырой systemId без tooltip', () => {
    expect(
      adminGameBadge({ systemId: 'dh9', gameSystem: 'Dark Heresy' }, translate),
    ).toEqual({ code: 'dh9', title: null });
  });

  it('legacy-лист без systemId показывает gameSystem', () => {
    expect(
      adminGameBadge({ systemId: null, gameSystem: 'Dark Heresy' }, translate),
    ).toEqual({ code: 'Dark Heresy', title: null });
  });
});
