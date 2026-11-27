import { describe, expect, it } from 'vitest';

import { CAREER_KEYS, STARTING_WEALTH } from '@/games/dh1/dark-heresy-data';
import {
  CAREER_RESTRICTIONS,
  careerRankGraph,
  rankForCharacter,
  rankStateForCharacter,
} from '@/games/dh1/dark-heresy-ranks';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { STARTING_PACKAGES } from '@/games/dh1/starting-packages';
import { DarkHeresyCareerPaths } from '@/games/dh1/types';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: ADEPTA SORORITAS ──────────────────────────────────────────
 * Девятая карьера — опциональная (Инквизиторский справочник, с. 42–43):
 * три ветки на 2000, сходимость на Superior 8000, Legatine 10000.
 * Ограничения книги проверяются здесь, а не только в форме создания.
 */

const CAREER = 'Adepta Sororitas';
const CONSTANTIA = 'dh1/core/rank/sororitas-constantia';
const HOSPITALLER = 'dh1/core/rank/sororitas-hospitaller';
const DIALOGOUS = 'dh1/core/rank/sororitas-diologous';
const MILITANT = 'dh1/core/rank/sororitas-militant';
const SUPERIOR = 'dh1/core/rank/sororitas-superior';

function nodes() {
  const graph = careerRankGraph(CAREER);
  expect(graph, 'нет графа Сороритас').not.toBeNull();
  return Object.values(graph!.nodes);
}

function node(name: string) {
  const found = nodes().find((item) => item.name === name);
  expect(found, `нет ранга ${name}`).toBeTruthy();
  return found!;
}

describe('Адепта Сороритас: карьера и данные книги', () => {
  it('карьера есть в списке и переведена в обеих локалях', () => {
    expect(DarkHeresyCareerPaths).toContain(CAREER);
    expect(CAREER_KEYS[CAREER]).toBe('dh1.careerAdeptaSororitas');
    for (const lang of ['en', 'ru'] as const) {
      expect(translations[lang]['dh1.careerAdeptaSororitas']).toBeTruthy();
    }
  });

  it('стартовый пакет и богатство — из книги', () => {
    expect(STARTING_WEALTH[CAREER]).toBe('70+2d10');
    const pkg = STARTING_PACKAGES[CAREER];
    expect(pkg.skills.flat()).toHaveLength(5);
    expect(pkg.talents.flat()).toHaveLength(4);
    // Дубинка/цеп/посох, лаз-пистолет, карапакс/латы, ожерелье, чётки,
    // облачение, свечи, писчий набор, Правило, Кольцо Дозволения.
    expect(pkg.gear).toHaveLength(10);
    for (const group of [...pkg.skills, ...pkg.talents, ...pkg.gear]) {
      for (const key of group) {
        for (const lang of ['en', 'ru'] as const) {
          expect(translations[lang][key], `${key} (${lang})`).toBeTruthy();
        }
      }
    }
  });

  it('ограничения создания совпадают с книгой', () => {
    expect(CAREER_RESTRICTIONS[CAREER]).toEqual({
      gender: 'female',
      homeWorlds: [
        'Feral World',
        'Imperial World',
        'Schola Progenium',
        'Noble Born',
      ],
      zeroInsanity: true,
      zeroCorruption: true,
      gmApproval: true,
    });
  });

  it('ранг при создании — Novice, класс — карьера', () => {
    const draft = createDh1Defaults({ careerPath: CAREER });
    expect(draft.rank).toBe('Novice');
    expect(draft.characterClass).toBe(CAREER);
  });
});

describe('Адепта Сороритас: граф', () => {
  it('14 рангов и стандартные пороги', () => {
    const base = nodes().filter((item) => !item.gmApproval);
    expect(base).toHaveLength(14);
    // Sister Oblatia — по одному узлу на каждую из трёх веток.
    expect(
      nodes().filter((item) => item.name === 'Sister Oblatia'),
    ).toHaveLength(3);
    const ladder = nodes()
      .filter((item) => item.kind === 'standard')
      .sort((a, b) => a.expFrom - b.expFrom);
    expect(ladder.map((item) => item.expFrom)).toEqual([
      0, 500, 1000, 8000, 10000,
    ]);
    expect(ladder.map((item) => item.name)).toEqual([
      'Novice',
      'Cantus',
      'Constantia',
      'Superior',
      'Legatine',
    ]);
  });

  it('на 2000 три обязательные ветки', () => {
    const constantia = node('Constantia');
    expect(constantia.next).toHaveLength(3);
    expect(constantia.next).toEqual([DIALOGOUS, HOSPITALLER, MILITANT]);
    for (const id of constantia.next) {
      const branch = careerRankGraph(CAREER)!.nodes[id];
      expect(branch.kind).toBe('branch');
      expect(branch.expFrom).toBe(2000);
    }
  });

  it('ветки сходятся на Superior 8000', () => {
    for (const name of ['Nunciate', 'Almoness', 'Celestian']) {
      expect(node(name).next).toEqual([SUPERIOR]);
    }
    expect(node('Superior').expFrom).toBe(8000);
    expect(node('Legatine').expFrom).toBe(10000);
  });

  it('ранг идёт по выбранной ветке и сходится на Superior', () => {
    const choices = { [CONSTANTIA]: HOSPITALLER };
    expect(
      rankForCharacter({
        careerPath: CAREER,
        totalExpSpent: 2500,
        rankChoices: choices,
      }),
    ).toBe('Hospitaller');
    expect(
      rankForCharacter({
        careerPath: CAREER,
        totalExpSpent: 3500,
        rankChoices: choices,
      }),
    ).toBe('Curia');
    expect(
      rankForCharacter({
        careerPath: CAREER,
        totalExpSpent: 6500,
        rankChoices: choices,
      }),
    ).toBe('Almoness');
    expect(
      rankForCharacter({
        careerPath: CAREER,
        totalExpSpent: 9000,
        rankChoices: choices,
      }),
    ).toBe('Superior');
    expect(
      rankForCharacter({
        careerPath: CAREER,
        totalExpSpent: 10000,
        rankChoices: choices,
      }),
    ).toBe('Legatine');
  });

  it('без выбора ранг ждёт развилку на Constantia', () => {
    const state = rankStateForCharacter({
      careerPath: CAREER,
      totalExpSpent: 2500,
    });
    expect(state.node?.name).toBe('Constantia');
    expect(state.pendingFork).toBe(CONSTANTIA);
    expect(state.options.map((item) => item.name).sort()).toEqual([
      'Diologous',
      'Hospitaller',
      'Militant',
    ]);
  });

  it('подписи узлов есть в обеих локалях, у Novice своя — «Неофитка»', () => {
    for (const item of nodes()) {
      for (const lang of ['en', 'ru'] as const) {
        expect(translations[lang][item.labelKey], item.id).toBeTruthy();
      }
    }
    expect(translations.ru['dh1.rank.sororitas-novice']).toBe('Неофитка');
    // У Cleric тот же EN-ранг переводится иначе — ключи разные.
    expect(translations.ru['dh1.rank.cleric-novice']).toBe('Неофит');
  });
});
