import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import {
  characteristicAptitudes,
  deriveAptitudes,
} from '@/games/dh2/dh2e-aptitudes';
import { DH2E_BACKGROUNDS, DH2E_ROLES } from '@/games/dh2/dh2e-data';
import {
  backgroundGrantChoices,
  readStartingChoices,
  startingChoiceLabels,
} from '@/games/dh2/dh2e-grants';
import { buildDh2ExcelSections } from '@/games/dh2/excel';
import { buildDh2PortableJson } from '@/games/dh2/export';
import { dh2History } from '@/games/dh2/history';
import { normalizeDh2 } from '@/games/dh2/normalize';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH2E STARTING CHOICES TESTS ────────────────────────────────
 * Выборы при создании не решаются молча: невыбранный слот остаётся
 * `unresolved`, аптитюда дубля берётся только из характеристических, а
 * выбранные «одно из» пакета сохраняются в `startingChoices` и доходят до
 * листа, истории, JSON и Excel.
 */

const hiveArbitesAssassin = {
  homeWorld: 'hive-world',
  background: 'adeptus-arbites',
  role: 'assassin',
} as const;

const translate = (key: string) => key;

describe('deriveAptitudes: выбор игрока, а не of[0]', () => {
  it('невыбранные слоты бэкграунда и роли остаются unresolved', () => {
    const result = deriveAptitudes(hiveArbitesAssassin);

    expect(result.unresolved).toContain('background');
    expect(result.unresolved).toContain('role.1');
    // Первый вариант бэкграунда и роли молча не подставляется.
    expect(result.profile).not.toContain('offence');
    expect(result.profile).not.toContain('ballistic-skill');
    // Мир и обязательные слоты роли при этом на месте.
    expect(result.profile).toContain('perception');
    expect(result.profile).toContain('agility');
  });

  it('выбранные значения попадают в профиль, дубль разрешается выбором', () => {
    const result = deriveAptitudes(hiveArbitesAssassin, {
      background: 'offence',
      'role.1': 'weapon-skill',
      'duplicate.perception': 'strength',
    });

    expect(result.unresolved).toEqual([]);
    expect(result.profile).toContain('offence');
    expect(result.profile).toContain('weapon-skill');
    expect(result.profile).toContain('strength');
    expect(result.profile).not.toContain('ballistic-skill');
    expect(new Set(result.profile).size).toBe(result.profile.length);
  });

  it('замена дубля — только характеристическая аптитюда', () => {
    const result = deriveAptitudes(hiveArbitesAssassin, {
      'duplicate.perception': 'finesse',
    });
    expect(result.unresolved).toContain('duplicate.perception');
    expect(result.profile.filter((id) => id === 'perception')).toHaveLength(1);
  });

  it('легаси-фолбэк сохраняет прежнее детерминированное поведение', () => {
    const result = deriveAptitudes(
      hiveArbitesAssassin,
      {},
      {
        fallbackToFirst: true,
      },
    );

    expect(result.unresolved).toEqual([]);
    expect(result.profile).toContain('offence');
    expect(result.profile).toContain('ballistic-skill');
    expect(new Set(result.profile).size).toBe(result.profile.length);
  });
});

describe('createDh2Defaults: выборы сохраняются в персонаже', () => {
  it('strict-режим пишет chosen и startingChoices', () => {
    const draft = createDh2Defaults({
      ...hiveArbitesAssassin,
      chosen: {
        background: 'offence',
        'role.1': 'weapon-skill',
        'duplicate.perception': 'strength',
      },
      strictAptitudeChoices: true,
      startingChoices: {
        roleTalent: 'jaded',
        skills: ['inquiry'],
        talents: [],
      },
    });

    expect(draft.aptitudes.chosen).toEqual({
      background: 'offence',
      'role.1': 'weapon-skill',
      'duplicate.perception': 'strength',
    });
    expect(draft.aptitudes.profile).toContain('offence');
    expect(draft.aptitudes.profile).toContain('strength');
    expect(draft.startingChoices).toEqual({
      roleTalent: 'jaded',
      skills: ['inquiry'],
      talents: [],
    });
  });

  it('мусорные значения и чужие слоты отбрасываются', () => {
    const draft = createDh2Defaults({
      ...hiveArbitesAssassin,
      chosen: {
        background: 'not-an-aptitude',
        'role.1': 'finesse',
        'role.0': 'agility',
        'duplicate.perception': 'offence',
      },
      strictAptitudeChoices: true,
      startingChoices: {
        roleTalent: 'not-a-talent',
        skills: ['inquiry', 'interrogation'],
        talents: ['jaded'],
      },
    });

    expect(draft.aptitudes.chosen).toEqual({});
    expect(draft.startingChoices).toEqual({
      skills: ['inquiry'],
      talents: [],
    });
  });

  it('программное создание без формы сохраняет фолбэк', () => {
    const draft = createDh2Defaults(hiveArbitesAssassin);
    expect(draft.aptitudes.profile).toContain('offence');
    expect(draft.aptitudes.chosen).toEqual({});
  });

  it('в наборе замены есть свободные характеристические аптитюды', () => {
    expect(characteristicAptitudes().length).toBeGreaterThan(5);
    expect(characteristicAptitudes()).toContain('strength');
  });
});

describe('стартовый пакет: ключи вариантов и подписи', () => {
  const ministorum = DH2E_BACKGROUNDS.find(
    (item) => item.id === 'adeptus-ministorum',
  );
  const arbites = DH2E_BACKGROUNDS.find(
    (item) => item.id === 'adeptus-arbites',
  );

  it('оба варианта Ministorum различаются специализацией таланта', () => {
    expect(ministorum).toBeDefined();
    const choices = backgroundGrantChoices(ministorum!);
    const talent = choices.find((choice) => choice.kind === 'talent');
    expect(talent?.options.map((option) => option.key)).toEqual([
      'weapon-training:flame',
      'weapon-training:low-tech+solid-projectile',
    ]);
    expect(
      startingChoiceLabels(
        ministorum!,
        'talent',
        ['weapon-training:flame'],
        translate,
      ),
    ).toEqual(['dh2.catalog.talent.weapon-training (flame)']);
  });

  it('навыки бэкграунда и роль без выбора используют одинаковые подписи', () => {
    expect(arbites).toBeDefined();
    const skill = backgroundGrantChoices(arbites!).find(
      (choice) => choice.kind === 'skill',
    );
    expect(skill?.options.map((option) => option.key)).toEqual([
      'inquiry',
      'interrogation',
    ]);
    expect(
      startingChoiceLabels(arbites!, 'skill', ['interrogation'], translate),
    ).toEqual(['dh2.catalog.skill.interrogation']);
  });

  it('readStartingChoices отбрасывает значения не из пакета', () => {
    const role = DH2E_ROLES.find((item) => item.id === 'assassin');
    expect(
      readStartingChoices(
        {
          roleTalent: 'jaded',
          skills: ['inquiry', 'nonsense'],
          talents: [],
        },
        arbites,
        role,
      ),
    ).toEqual({ roleTalent: 'jaded', skills: ['inquiry'], talents: [] });

    expect(
      readStartingChoices(
        { roleTalent: 'nonsense', skills: ['interrogation'] },
        arbites,
        role,
      ),
    ).toEqual({ skills: ['interrogation'], talents: [] });
  });
});

describe('каналы листа: normalize, JSON, Excel, история', () => {
  const config: GameExportConfig = {
    includeBasicInfo: true,
    includeStats: true,
    includeCombat: false,
    includeEquipment: false,
    includeInventory: false,
    includeSpells: false,
    includeNarrative: false,
    includeProgression: false,
    includeCompanions: false,
    includeQuestLog: false,
    includeCustomHouseRules: false,
  };

  it('легаси-лист получает детерминированный профиль и пустые выборы', () => {
    const { character } = normalizeDh2(
      {
        homeWorld: 'hive-world',
        background: 'adeptus-arbites',
        role: 'assassin',
        aptitudes: { profile: [], chosen: {}, extra: [] },
      },
      { applyDefaults: true },
    );

    expect(character.aptitudes.profile).toContain('offence');
    expect(character.aptitudes.profile).toContain('ballistic-skill');
    // Слот выбора навыка у бэкграунда есть, но он ещё не выбран.
    expect(character.startingChoices).toEqual({ skills: [''], talents: [] });
    // Повторный прогон не меняет результат.
    const second = normalizeDh2(
      character as unknown as Record<string, unknown>,
      { applyDefaults: true },
    );
    expect(second.character.aptitudes.profile).toEqual(
      character.aptitudes.profile,
    );
    expect(second.character.startingChoices).toEqual(character.startingChoices);
  });

  it('портируемый JSON и Excel не теряют startingChoices', () => {
    const draft = createDh2Defaults({
      ...hiveArbitesAssassin,
      strictAptitudeChoices: true,
      chosen: { background: 'offence', 'role.1': 'weapon-skill' },
      startingChoices: {
        roleTalent: 'jaded',
        skills: ['inquiry'],
        talents: [],
      },
    });
    const character = { ...draft, id: 'test-id' };

    const portable = buildDh2PortableJson(character, config);
    expect(portable.startingChoices).toEqual({
      roleTalent: 'jaded',
      skills: ['inquiry'],
      talents: [],
    });

    const sections = buildDh2ExcelSections(character, config, translate);
    const labels = sections
      .flatMap((section) => section.rows.flatMap((row) => row))
      .filter((cell): cell is string => typeof cell === 'string')
      .map((cell) => cell.trim());
    expect(labels).toContain('dh2.roleTalent');
    expect(labels).toContain('dh2.startingSkillsChosen');
  });

  it('история знает точные пути новых выборов', () => {
    expect(dh2History.labels?.['startingChoices.roleTalent']).toBe(
      'dh2.roleTalent',
    );
    expect(dh2History.labels?.['startingChoices.skills']).toBe(
      'dh2.startingSkillsChosen',
    );
    expect(dh2History.labels?.['startingChoices.talents']).toBe(
      'dh2.startingTalentsChosen',
    );
  });
});
