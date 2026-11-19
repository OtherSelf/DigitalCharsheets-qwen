import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dh2ExperienceRows } from '@/games/dh2/experience';
import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';

/**
 * ─── LANDMARK: DH2 EXPERIENCE LOG ADAPTERS ───────────────────────────────
 * Журнал опыта открывается общим правым Sheet. DH2 хранит `kind`+`ref`,
 * поэтому адаптер собирает подпись из словаря редакции, а уточнение ставит
 * главной строкой. Здесь же закреплена подпись Судьбы на листе: ярлык
 * берётся из модуля, а не из общего слоя.
 *
 * Проверки 2e живут рядом с редакцией: соседняя редакция в них не
 * упоминается и её удаление не ломает этот файл.
 */

const translate = (key: string) =>
  ({
    'dh2.experienceKind.skill': 'Skill advance',
    'dh2.experienceKind.talent': 'Talent',
  })[key] ?? key;

describe('журнал опыта: адаптеры редакций', () => {
  it('DH2 ставит уточнение главной строкой, вид — подписью', () => {
    const rows = dh2ExperienceRows(
      [
        {
          id: 'xp-2',
          kind: 'skill',
          ref: 'Dodge',
          cost: 100,
          createdAt: '2026-01-02T10:00:00.000Z',
        },
        {
          id: 'xp-3',
          kind: 'talent',
          ref: '',
          cost: 200,
          createdAt: '2026-01-03T10:00:00.000Z',
        },
      ],
      translate,
    );

    expect(rows.map((row) => row.label)).toEqual(['Dodge', 'Talent']);
    expect(rows.map((row) => row.kind)).toEqual(['Skill advance', 'Talent']);
    expect(rows.map((row) => row.cost)).toEqual([100, 200]);
  });
});

describe('Судьба на листе', () => {
  it('подпись `fatePoints` — «Очки судьбы» в DH2', () => {
    expect(dh2Ru['dh2.fatePoints']).toBe('Очки судьбы');
    expect(dh2En['dh2.fatePoints']).toBe('Fate Points');
  });

  it('лист DH2 берёт ярлык из `fatePoints`, а `fate` остаётся подсказкам', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'games', 'dh2', 'sheet.tsx'),
      'utf8',
    );
    expect(source, 'dh2: ярлык счётчика').toContain(
      `title={t('dh2.fatePoints')}`,
    );
    expect(source, 'dh2: старый ярлык счётчика').not.toContain(
      `title={t('dh2.fate')}`,
    );
  });
});
