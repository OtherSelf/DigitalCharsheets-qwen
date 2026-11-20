import { describe, expect, it } from 'vitest';

import { dh1BulkEditor } from '@/games/dh1/bulk-editor';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { dh1History } from '@/games/dh1/history';
import { dh1CompactNav } from '@/games/dh1/slots/compact-nav';

/**
 * ─── LANDMARK: DH1 CONTRACT ────────────────────────────────────────────────
 * Договорённости редакции, которые нельзя увидеть в схеме: секции компактного
 * листа и их порядок, подписи истории, таблицы массового редактора и
 * осознанные отличия dh1 (ранги/пути, нет Influence и пси-профиля).
 *
 * Раньше это был кросс-эдишн паритет-тест; теперь каждая редакция проверяет
 * свой контракт сама, чтобы удаление dh2 не ломало тесты dh1.
 */

describe('dh1: контракт редакции', () => {
  it('компактный лист: секции в том же порядке', () => {
    expect(dh1CompactNav({} as never).map((item) => item.id)).toEqual([
      'info-section',
      'progression-section',
      'skills-section',
      'talents-section',
      'equipment-section',
      'inventory-section',
    ]);
  });

  it('история: XP-журнал, броня/оружие и инвентарь подписаны', () => {
    expect(dh1History.labels?.experienceLog).toBeTruthy();
    expect(dh1History.labels?.totalExpSpent).toBeTruthy();
    expect(dh1History.labels?.['equipment.armor']).toBeTruthy();
    expect(dh1History.labels?.['equipment.weapons']).toBeTruthy();
    expect(dh1History.labels?.ap).toBeTruthy();
    expect(dh1History.labels?.damage).toBeTruthy();
    expect(dh1History.collections?.experienceLog).toBeTruthy();
  });

  it('bulk: статистика и жизненные показатели', () => {
    expect(dh1BulkEditor.map((table) => table.id)).toEqual([
      'dh1-stats',
      'dh1-vitals',
    ]);
  });

  it('ранги/пути есть, Influence и пси-профиля нет', () => {
    const dh1 = createDh1Defaults({ careerPath: 'Adept' });
    expect(dh1).toHaveProperty('careerPath', 'Adept');
    expect(dh1.rank).toBeTruthy();
    expect('influence' in dh1.stats).toBe(false);
    expect(dh1).not.toHaveProperty('psy');
  });

  it('история: без имени игрока и Influence, свои ключи пола/дисциплины', () => {
    expect(dh1History.labels?.['identity.playerName']).toBeUndefined();
    expect(dh1History.labels?.['identity.gender']).toBe('dh1.gender');
    expect(dh1History.labels?.['stats.influence']).toBeUndefined();
    expect(dh1History.labels?.['psy.discipline']).toBe('dh1.discipline');
  });
});
