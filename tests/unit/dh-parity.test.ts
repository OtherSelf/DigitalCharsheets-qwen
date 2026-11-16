import { describe, expect, it } from 'vitest';

import { dh1BulkEditor } from '@/games/dh1/bulk-editor';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { dh1History } from '@/games/dh1/history';
import { dh1CompactNav } from '@/games/dh1/slots/compact-nav';
import { dh2BulkEditor } from '@/games/dh2/bulk-editor';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { dh2History } from '@/games/dh2/history';
import { dh2CompactNav } from '@/games/dh2/slots/compact-nav';

/**
 * ─── LANDMARK: DH1/DH2 PARITY TESTS ───────────────────────────────────────
 * Решения зеркалируются, но код не шарится (D10). Проверяем поведение, где
 * правила совпадают, и осознанные различия редакций (ранги/пути — 1e,
 * Influence/Requisition — 2e), чтобы они не «разъехались» молча.
 */

describe('одинаковое поведение обеих редакций', () => {
  it('компактный лист: те же секции в том же порядке', () => {
    const dh1 = dh1CompactNav({} as never).map((item) => item.id);
    const dh2 = dh2CompactNav({} as never).map((item) => item.id);
    expect(dh2).toEqual(dh1);
    expect(dh2).toContain('info-section');
    expect(dh2).toContain('progression-section');
  });

  it('общие каналы: XP-журнал, броня/оружие и инвентарь подписаны', () => {
    for (const history of [dh1History, dh2History]) {
      expect(history.labels?.experienceLog).toBeTruthy();
      expect(history.labels?.totalExpSpent).toBeTruthy();
      expect(history.labels?.['equipment.armor']).toBeTruthy();
      expect(history.labels?.['equipment.weapons']).toBeTruthy();
      expect(history.labels?.ap).toBeTruthy();
      expect(history.labels?.damage).toBeTruthy();
      expect(history.collections?.experienceLog).toBeTruthy();
    }
  });

  it('bulk: у обеих редакций статистика и жизненные показатели', () => {
    expect(dh1BulkEditor.map((table) => table.id)).toEqual([
      'dh1-stats',
      'dh1-vitals',
    ]);
    expect(dh2BulkEditor.map((table) => table.id)).toEqual([
      'dh2-stats',
      'dh2-vitals',
    ]);
  });
});

describe('осознанные различия редакций', () => {
  it('dh1: ранги/пути, нет influence; dh2: influence и психо-профиль', () => {
    const dh1 = createDh1Defaults({ careerPath: 'Adept' });
    const dh2 = createDh2Defaults({});

    expect(dh1).toHaveProperty('careerPath', 'Adept');
    expect(dh1.rank).toBeTruthy();
    expect('influence' in dh1.stats).toBe(false);

    expect(dh2).not.toHaveProperty('careerPath');
    expect(dh2.stats.influence).toBe(30);
    expect(dh2.psy).toEqual({ rating: 0, disciplines: [], powers: [] });
    expect(dh2.aptitudes).toBeDefined();
    expect(dh2.startingChoices).toBeDefined();
  });

  it('история: dh1 без имени игрока, dh2 знает influence и пси', () => {
    expect(dh1History.labels?.['identity.playerName']).toBeUndefined();
    expect(dh1History.labels?.['identity.gender']).toBe('dh1.gender');
    expect(dh1History.labels?.['stats.influence']).toBeUndefined();
    expect(dh1History.labels?.['psy.discipline']).toBe('dh1.discipline');

    expect(dh2History.labels?.['stats.influence']).toBe('dh2.influence');
    expect(dh2History.labels?.['psy.disciplines']).toBe('dh2.psyDisciplines');
    expect(dh2History.labels?.['psy.powers']).toBe('dh2.psyPowers');
  });

  it('деньги: dh2 хранит wealth, но в UI/экспорт его нет', () => {
    const dh2 = createDh2Defaults({});
    expect(dh2.wealth).toEqual({ throneGelt: 0, monthlyIncome: 0 });
    expect(dh2History.labels?.wealth).toBeTruthy();
  });
});
