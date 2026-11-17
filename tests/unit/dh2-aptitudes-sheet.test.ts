import { describe, expect, it } from 'vitest';

import {
  applyAptitudeChoice,
  isAptitudeLocked,
} from '@/games/dh2/aptitudes-sheet';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { deriveAptitudes } from '@/games/dh2/dh2e-aptitudes';
import { dh2History } from '@/games/dh2/history';
import { normalizeDh2 } from '@/games/dh2/normalize';

/**
 * ─── LANDMARK: DH2 APTITUDES ON SHEET TESTS ───────────────────────────────
 * Лист должен показывать источники аптитюд и позволять выбрать замену дубля;
 * профиль пересобирается тем же derive, старые листы без `chosen` получают
 * детерминированный фолбэк и не теряют остальные аптитюды.
 */

const sources = {
  homeWorld: 'hive-world',
  background: 'adeptus-arbites',
  role: 'assassin',
} as const;

describe('выбор аптитюды на листе', () => {
  it('замена дубля пересобирает профиль без повторов', () => {
    const character = {
      ...createDh2Defaults(sources),
      aptitudes: {
        profile: ['perception', 'agility', 'fieldcraft', 'finesse'],
        chosen: {},
        extra: [],
      },
    };

    const patch = applyAptitudeChoice(
      character,
      'duplicate.perception',
      'strength',
    );
    expect(patch.aptitudes.chosen['duplicate.perception']).toBe('strength');
    expect(patch.aptitudes.profile).toContain('strength');
    expect(new Set(patch.aptitudes.profile).size).toBe(
      patch.aptitudes.profile.length,
    );
  });

  it('выбор бэкграунда и слота роли попадает в профиль', () => {
    const character = createDh2Defaults(sources);
    const withBackground = {
      ...character,
      ...applyAptitudeChoice(character, 'background', 'offence'),
    };
    expect(withBackground.aptitudes.profile).toContain('offence');

    const withRole = {
      ...withBackground,
      ...applyAptitudeChoice(withBackground, 'role.1', 'weapon-skill'),
    };
    expect(withRole.aptitudes.profile).toContain('weapon-skill');
    expect(new Set(withRole.aptitudes.profile).size, 'дубли не появились').toBe(
      withRole.aptitudes.profile.length,
    );
  });

  it('невыбранные слоты на листе используют легаси-фолбэк', () => {
    const character = createDh2Defaults(sources);
    const patch = applyAptitudeChoice(
      character,
      'duplicate.perception',
      'strength',
    );
    // Остальные слоты не потеряны: профиль полный и без повторов.
    expect(patch.aptitudes.profile).toContain('ballistic-skill');
    expect(patch.aptitudes.profile).toContain('offence');
    expect(patch.aptitudes.profile.length).toBeGreaterThanOrEqual(5);
  });
});

describe('замок выбранной склонности (D1)', () => {
  it('ключ из `chosen` заперт, пустой слот — нет', () => {
    const character = createDh2Defaults({
      ...sources,
      chosen: {},
      strictAptitudeChoices: true,
    });
    expect(isAptitudeLocked(character, 'background')).toBe(false);
    expect(isAptitudeLocked(character, 'role.1')).toBe(false);

    const withBackground = {
      ...character,
      ...applyAptitudeChoice(character, 'background', 'offence'),
    };
    expect(isAptitudeLocked(withBackground, 'background')).toBe(true);
    expect(isAptitudeLocked(withBackground, 'role.1')).toBe(false);
  });

  it('выбор при создании запирает слот и остаётся в профиле', () => {
    const character = createDh2Defaults({
      ...sources,
      chosen: { background: 'offence' },
      strictAptitudeChoices: true,
    });
    expect(isAptitudeLocked(character, 'background')).toBe(true);
    expect(character.aptitudes.profile).toContain('offence');
  });

  it('дозаполнение пустого слота запирает его в том же патче', () => {
    const character = createDh2Defaults({
      ...sources,
      chosen: {},
      strictAptitudeChoices: true,
    });
    const patch = applyAptitudeChoice(
      character,
      'duplicate.perception',
      'strength',
    );
    const next = { ...character, ...patch };
    expect(isAptitudeLocked(next, 'duplicate.perception')).toBe(true);
    expect(next.aptitudes.chosen['duplicate.perception']).toBe('strength');
  });
});

describe('история подписей', () => {
  it('aptitudes.chosen и experienceLog имеют подписи', () => {
    expect(dh2History.labels?.['aptitudes.chosen']).toBe('dh2.aptitudes');
    expect(dh2History.collections?.experienceLog).toBe('dh2.experienceLog');
  });
});

describe('миграция старых листов', () => {
  it('лист без chosen получает детерминированный профиль без дублей', () => {
    const { character } = normalizeDh2(
      {
        ...sources,
        aptitudes: { profile: [], chosen: {}, extra: [] },
      },
      { applyDefaults: true },
    );
    expect(character.aptitudes.profile).toContain('perception');
    expect(new Set(character.aptitudes.profile).size).toBe(
      character.aptitudes.profile.length,
    );
    expect(character.aptitudes.chosen).toEqual({});
  });

  it('derive с fallback совпадает с миграцией', () => {
    const legacy = deriveAptitudes(sources, {}, { fallbackToFirst: true });
    const { character } = normalizeDh2(
      {
        ...sources,
        aptitudes: { profile: [], chosen: {}, extra: [] },
      },
      { applyDefaults: true },
    );
    expect(character.aptitudes.profile).toEqual(legacy.profile);
  });
});
