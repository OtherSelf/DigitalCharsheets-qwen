import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dh1ExperienceRows } from '@/games/dh1/experience';
import dh1En from '@/games/dh1/i18n/en.json';
import dh1Ru from '@/games/dh1/i18n/ru.json';
import { dh2ExperienceRows } from '@/games/dh2/experience';
import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';

/**
 * ─── LANDMARK: EXPERIENCE LOG ADAPTERS ────────────────────────────────────
 * Журнал опыта открывается общим правым Sheet (D8). Подписи строк собирают
 * адаптеры редакций: DH1 уже хранит `label`, DH2 — `kind`+`ref`. Здесь же
 * закреплена подпись Судьбы на листе (D13): сам ярлык — из модуля, а не из
 * общего слоя.
 */
const translate = (key: string) =>
  ({
    'dh2.experienceKind.skill': 'Skill advance',
    'dh2.experienceKind.talent': 'Talent',
  })[key] ?? key;

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

describe('Судьба на листе (D13)', () => {
  it('подпись `fatePoints` — «Очки судьбы» в обеих редакциях', () => {
    expect(dh1Ru['dh1.fatePoints']).toBe('Очки судьбы');
    expect(dh1En['dh1.fatePoints']).toBe('Fate Points');
    expect(dh2Ru['dh2.fatePoints']).toBe('Очки судьбы');
    expect(dh2En['dh2.fatePoints']).toBe('Fate Points');
  });

  it('листы берут ярлык из `fatePoints`, а `fate` остаётся подсказкам', () => {
    for (const edition of ['dh1', 'dh2'] as const) {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'games', edition, 'sheet.tsx'),
        'utf8',
      );
      expect(source, `${edition}: ярлык счётчика`).toContain(
        `title={t('${edition}.fatePoints')}`,
      );
      expect(source, `${edition}: старый ярлык счётчика`).not.toContain(
        `title={t('${edition}.fate')}`,
      );
    }
  });
});
