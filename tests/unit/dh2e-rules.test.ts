import { describe, expect, it } from 'vitest';

import { deriveAptitudes } from '@/games/dh2/dh2e-aptitudes';
import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from '@/games/dh2/dh2e-data';
import { DH2E_SKILLS, DH2E_TALENTS } from '@/games/dh2/dh2e-reference';
import { DH2E_XP_COST_TABLES } from '@/games/dh2/dh2e-rules';

/**
 * ─── LANDMARK: DH2E RULES TESTS ───────────────────────────────────────────
 * Инварианты данных 2e: состав генерации, покрытие таблицы 2-9, форма
 * таблиц стоимости (2-2/2-4/2-6) и вывод аптитюд. Цены в UI не считаются:
 * опыт ведёт игрок с ГМ (D10), но таблицы остаются эталоном в данных.
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

  it('таблицы стоимости 2-2/2-4/2-6 заданы для 2/1/0 совпадений', () => {
    expect(DH2E_XP_COST_TABLES.characteristic.two).toEqual([
      100, 250, 500, 750, 1250,
    ]);
    expect(DH2E_XP_COST_TABLES.characteristic.one[0]).toBe(250);
    expect(DH2E_XP_COST_TABLES.characteristic.zero[4]).toBe(2500);
    expect(DH2E_XP_COST_TABLES.skill.two).toEqual([100, 200, 300, 400]);
    expect(DH2E_XP_COST_TABLES.skill.zero[3]).toBe(1200);
    expect(DH2E_XP_COST_TABLES.talent.two).toEqual([200, 300, 400]);
    expect(DH2E_XP_COST_TABLES.talent.zero[2]).toBe(1200);
  });
});

describe('целостность стартовых пакетов', () => {
  interface SkillSlot {
    skillId?: string;
    talentId?: string;
    choose?: number;
    of?: readonly SkillSlot[];
  }

  const skillIds = new Set(DH2E_SKILLS.map((item) => item.id));
  const talentIds = new Set(DH2E_TALENTS.map((item) => item.id));

  const checkSlot = (slot: SkillSlot): void => {
    if (slot.choose && slot.of) {
      slot.of.forEach(checkSlot);
      return;
    }
    if (slot.skillId) {
      expect(skillIds.has(slot.skillId), slot.skillId).toBe(true);
    }
    if (slot.talentId) {
      expect(talentIds.has(slot.talentId), slot.talentId).toBe(true);
    }
    expect(JSON.stringify(slot)).not.toContain('undefined');
  };

  it('навыки/таланты бэкграундов и ролей ссылаются на справочник', () => {
    for (const background of DH2E_BACKGROUNDS) {
      for (const slot of background.startingSkills as SkillSlot[]) {
        checkSlot(slot);
      }
      for (const slot of background.startingTalents as SkillSlot[]) {
        checkSlot(slot);
      }
    }
    for (const role of DH2E_ROLES) {
      for (const id of role.talentChoice.of as readonly string[]) {
        expect(talentIds.has(id), `${role.id}: ${id}`).toBe(true);
      }
    }
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
