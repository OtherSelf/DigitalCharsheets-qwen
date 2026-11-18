import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dh1ExperienceRows } from '@/games/dh1/experience';
import dh1En from '@/games/dh1/i18n/en.json';
import dh1Ru from '@/games/dh1/i18n/ru.json';

/**
 * ─── LANDMARK: DH1 EXPERIENCE LOG ADAPTERS ───────────────────────────────
 * Журнал опыта открывается общим правым Sheet (D8). DH1 уже хранит `label`,
 * поэтому адаптер отдаёт строки как есть. Здесь же закреплена подпись Судьбы
 * на листе (D13): ярлык берётся из модуля, а не из общего слоя.
 *
 * Проверки 1e живут рядом с редакцией (D16): соседняя редакция в них не
 * упоминается и её удаление не ломает этот файл.
 */

describe('журнал опыта: адаптеры редакций', () => {
  it('DH1 отдаёт строки как есть', () => {
    expect(
      dh1ExperienceRows([
        {
          id: 'xp-1',
          label: 'Dodge',
          cost: 100,
          createdAt: '2026-01-02T10:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        id: 'xp-1',
        label: 'Dodge',
        cost: 100,
        createdAt: '2026-01-02T10:00:00.000Z',
      },
    ]);
    expect(dh1ExperienceRows(undefined)).toEqual([]);
  });
});

describe('Судьба на листе (D13)', () => {
  it('подпись `fatePoints` — «Очки судьбы» в DH1', () => {
    expect(dh1Ru['dh1.fatePoints']).toBe('Очки судьбы');
    expect(dh1En['dh1.fatePoints']).toBe('Fate Points');
  });

  it('лист DH1 берёт ярлык из `fatePoints`, а `fate` остаётся подсказкам', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'games', 'dh1', 'sheet.tsx'),
      'utf8',
    );
    expect(source, 'dh1: ярлык счётчика').toContain(
      `title={t('dh1.fatePoints')}`,
    );
    expect(source, 'dh1: старый ярлык счётчика').not.toContain(
      `title={t('dh1.fate')}`,
    );
  });
});
