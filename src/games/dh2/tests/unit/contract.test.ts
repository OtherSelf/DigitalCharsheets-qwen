import { describe, expect, it } from 'vitest';

import { dh2BulkEditor } from '@/games/dh2/bulk-editor';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { dh2History } from '@/games/dh2/history';
import { dh2CompactNav } from '@/games/dh2/slots/compact-nav';

/**
 * ─── LANDMARK: DH2 CONTRACT ────────────────────────────────────────────────
 * Договорённости редакции, которые нельзя увидеть в схеме: секции компактного
 * листа и их порядок, подписи истории, таблицы массового редактора и
 * осознанные отличия dh2 (Influence, пси-профиль, aptitudes/startingChoices,
 * wealth хранится, но в UI/экспорт не идёт).
 *
 * Раньше это был кросс-эдишн паритет-тест; теперь каждая редакция проверяет
 * свой контракт сама, чтобы удаление dh1 не ломало тесты dh2 (D16).
 */

describe('dh2: контракт редакции', () => {
  it('компактный лист: секции в том же порядке', () => {
    expect(dh2CompactNav({} as never).map((item) => item.id)).toEqual([
      'info-section',
      'progression-section',
      'skills-section',
      'talents-section',
      'equipment-section',
      'inventory-section',
    ]);
  });

  it('история: XP-журнал, броня/оружие и инвентарь подписаны', () => {
    expect(dh2History.labels?.experienceLog).toBeTruthy();
    expect(dh2History.labels?.totalExpSpent).toBeTruthy();
    expect(dh2History.labels?.['equipment.armor']).toBeTruthy();
    expect(dh2History.labels?.['equipment.weapons']).toBeTruthy();
    expect(dh2History.labels?.ap).toBeTruthy();
    expect(dh2History.labels?.damage).toBeTruthy();
    expect(dh2History.collections?.experienceLog).toBeTruthy();
  });

  it('bulk: статистика и жизненные показатели', () => {
    expect(dh2BulkEditor.map((table) => table.id)).toEqual([
      'dh2-stats',
      'dh2-vitals',
    ]);
  });

  it('Influence, пси-профиль, aptitudes и стартовые выборы есть; careerPath нет', () => {
    const dh2 = createDh2Defaults({});
    expect(dh2).not.toHaveProperty('careerPath');
    expect(dh2.stats.influence).toBe(30);
    expect(dh2.psy).toEqual({ rating: 0, disciplines: [], powers: [] });
    expect(dh2.aptitudes).toBeDefined();
    expect(dh2.startingChoices).toBeDefined();
  });

  it('история: знает Influence и пси', () => {
    expect(dh2History.labels?.['stats.influence']).toBe('dh2.influence');
    expect(dh2History.labels?.['psy.disciplines']).toBe('dh2.psyDisciplines');
    expect(dh2History.labels?.['psy.powers']).toBe('dh2.psyPowers');
  });

  it('деньги: wealth хранится, но в UI/экспорт его нет', () => {
    const dh2 = createDh2Defaults({});
    expect(dh2.wealth).toEqual({ throneGelt: 0, monthlyIncome: 0 });
    expect(dh2History.labels?.wealth).toBeTruthy();
  });
});
