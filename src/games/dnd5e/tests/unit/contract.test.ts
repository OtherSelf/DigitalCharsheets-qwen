import { describe, expect, it } from 'vitest';

import { dnd5eModule } from '@/games/dnd5e';
import { dnd5eBulkEditor } from '@/games/dnd5e/bulk-editor';
import { dnd5eCompactNav } from '@/games/dnd5e/slots/compact-nav';
import type { DnD5eCharacter } from '@/games/dnd5e/types';
import { uiSlots } from '@/games/dnd5e/ui';

import rawManifest from '../../plugin.json';

/**
 * ─── LANDMARK: DND5E CONTRACT ─────────────────────────────────────────────
 * Договорённости 5e, которые не видны в схеме: объявленные слоты совпадают с
 * реализованными, компактная навигация меняется на 20 уровне, а массовый
 * редактор содержит обе вкладки. Это зеркало `contract.test.ts` у DH-редакций:
 * одинаковая структура проверок у всех плагинов — часть стандарта раскладки.
 */
describe('dnd5e: контракт редакции', () => {
  it('объявленные UI-слоты совпадают с реализованными', () => {
    const declared = [...(rawManifest.ui?.slots ?? [])].sort();
    const implemented = Object.entries(uiSlots)
      .filter(([name, value]) => value !== undefined && name !== 'favicon')
      .map(([name]) => name)
      .sort();
    expect(implemented).toEqual(declared);
    expect(uiSlots.favicon).toContain('/games/dnd5e/assets/');
  });

  it('компактная навигация: эпические дары только на 20 уровне', () => {
    const base = dnd5eModule.createDefaults() as DnD5eCharacter;
    const level1 = dnd5eCompactNav({ ...base, level: 1 });
    const level20 = dnd5eCompactNav({ ...base, level: 20 });

    expect(level1.map((item) => item.id)).not.toContain('divine-boons-section');
    expect(level20.map((item) => item.id)).toContain('divine-boons-section');
  });

  it('массовый редактор: общая вкладка stats и вкладка жизненных показателей', () => {
    expect(dnd5eBulkEditor.map((table) => table.id)).toEqual([
      'dnd5e-stats',
      'dnd5e-vitals',
    ]);
    expect(dnd5eBulkEditor.map((table) => table.tab.id)).toContain('stats');
  });
});
