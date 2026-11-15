import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { deriveAptitudes } from '@/games/dh2/dh2e-aptitudes';
import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from '@/games/dh2/dh2e-data';
import {
  characteristicStepCost,
  psyRatingCost,
  purchaseCharacteristicStep,
  skillRankCost,
  talentCost,
} from '@/games/dh2/dh2e-xp';
import type { DH2Character } from '@/games/dh2/types';

/**
 * ─── LANDMARK: DH2E RULES TESTS ───────────────────────────────────────────
 * Инварианты данных и цен 2e: состав генерации, покрытие таблицы 2-9,
 * стоимости 2-2/2-4/2-6 и вывод аптитюд. Числа сверены с каталогом
 * workspace (content/dh2/rules.json) — тем же, из которого генерируются
 * dh2e-data/rules.
 */
describe('данные генерации 2e', () => {
  it('шесть миров, семь бэкграундов, восемь ролей, 19 аптитюд', () => {
    expect(DH2E_HOMEWORLDS).toHaveLength(6);
    expect(DH2E_BACKGROUNDS).toHaveLength(7);
    expect(DH2E_ROLES).toHaveLength(8);
    expect(DH2E_APTITUDES).toHaveLength(19);
  });

  it('у каждой роли пять аптитюд, у мира — аптитюда и раны', () => {
    for (const role of DH2E_ROLES) {
      expect(role.aptitudes, role.id).toHaveLength(5);
    }
    for (const world of DH2E_HOMEWORLDS) {
      expect(world.aptitudeId, world.id).toBeTruthy();
      expect(world.wounds, world.id).toMatch(/^\d+\+1d5$/);
    }
  });

  it('таблица 2-9 покрывает d100 без пропусков и пересечений', () => {
    const rows = [...DH2E_DIVINATIONS].sort((a, b) => a.from - b.from);
    expect(rows).toHaveLength(25);
    expect(rows[0].from).toBe(1);
    expect(rows[rows.length - 1].to).toBe(100);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].from).toBe(rows[index - 1].to + 1);
    }
  });
});

describe('цены 2e', () => {
  it('таблица 2-2: две/одна/ноль совпавших аптитюд', () => {
    expect(characteristicStepCost(2, 0)).toBe(100);
    expect(characteristicStepCost(2, 4)).toBe(1250);
    expect(characteristicStepCost(1, 0)).toBe(250);
    expect(characteristicStepCost(1, 4)).toBe(1500);
    expect(characteristicStepCost(0, 0)).toBe(500);
    expect(characteristicStepCost(0, 4)).toBe(2500);
  });

  it('таблица 2-4: ранги навыков', () => {
    expect(skillRankCost(2, 0)).toBe(100);
    expect(skillRankCost(1, 3)).toBe(800);
    expect(skillRankCost(0, 3)).toBe(1200);
  });

  it('таблица 2-6: таланты по tier', () => {
    expect(talentCost(2, 1)).toBe(200);
    expect(talentCost(1, 2)).toBe(450);
    expect(talentCost(0, 3)).toBe(1200);
  });

  it('повышение пси-рейтинга: 200 × новый рейтинг', () => {
    expect(psyRatingCost(1)).toBe(200);
    expect(psyRatingCost(3)).toBe(600);
  });
});

describe('аптитюды 2e', () => {
  it('мир, бэкграунд и роль дают профиль без дублей', () => {
    const result = deriveAptitudes({
      homeWorld: 'feral-world',
      background: 'imperial-guard',
      role: 'warrior',
    });
    expect(result.profile).toContain('toughness');
    expect(result.profile).toContain('offence');
    expect(new Set(result.profile).size).toBe(result.profile.length);
    expect(result.profile.length).toBeGreaterThan(0);
  });

  it('дубль заменяется характеристической аптитюдой', () => {
    // Hive World даёт Perception, роль Seeker тоже — дубль разрешается.
    const result = deriveAptitudes({
      homeWorld: 'hive-world',
      background: 'adeptus-arbites',
      role: 'seeker',
    });
    expect(result.duplicates).toContain('perception');
    expect(new Set(result.profile).size).toBe(result.profile.length);
  });

  it('пустые источники не ломают профиль', () => {
    const result = deriveAptitudes({ homeWorld: '', background: '', role: '' });
    expect(result.profile).toEqual([]);
  });
});

describe('покупка опыта 2e', () => {
  function character(experience = 1000): DH2Character {
    return {
      ...createDh2Defaults({ name: 'Test', experience }),
      id: 'test-character',
    } as DH2Character;
  }

  it('ступень характеристики пишется в журнал и в потраченный опыт', () => {
    const base = character();
    const result = purchaseCharacteristicStep(base, 'strength');
    expect(result).not.toBeNull();
    expect(result?.patch.experienceLog).toHaveLength(1);
    expect(result?.patch.totalExpSpent).toBe(result?.cost);
    expect(result?.patch.statUpgrades?.strength[0]).toBe(true);
  });

  it('не хватает опыта — предупреждение, но покупка не блокируется', () => {
    const base = character(100);
    const result = purchaseCharacteristicStep(base, 'strength');
    expect(result?.warning).toBe('dh2.xpWarningNegative');
  });

  it('после пяти ступеней покупка недоступна', () => {
    const base = character(10000);
    let current = base;
    for (let index = 0; index < 5; index += 1) {
      const result = purchaseCharacteristicStep(current, 'agility');
      expect(result).not.toBeNull();
      current = { ...current, ...result!.patch } as DH2Character;
    }
    expect(purchaseCharacteristicStep(current, 'agility')).toBeNull();
  });
});
