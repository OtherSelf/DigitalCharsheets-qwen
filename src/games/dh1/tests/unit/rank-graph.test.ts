import { describe, expect, it } from 'vitest';

import {
  careerRankGraph,
  RANK_GRAPHS,
  rankForCharacter,
  rankStateForCharacter,
} from '@/games/dh1/dark-heresy-ranks';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 RANK GRAPH TESTS ──────────────────────────────────────
 * Граф обязан совпадать с книгой: лестницы карьер, развилки, сходимости и
 * подписи. Тест читает сгенерированный граф, а не старые таблицы, поэтому
 * дрейф каталога ловится здесь (плюс тест свежести генератора).
 *
 * Ключевые книжные факты:
 *   • у Adept на 2000 — Inditor или альтернативный Chirurgeon, который
 *     возвращается в Scholar на 3000 (сходимость);
 *   • у Adept на 6000 — две ветки, у Guardsman — три, у Psyker — две с 2000;
 *   • у остальных карьер по пять стандартных рангов 0/500/1000/2000/3000.
 */

const CAREERS = [
  'Adept',
  'Arbitrator',
  'Assassin',
  'Cleric',
  'Guardsman',
  'Imperial Psyker',
  'Scum',
  'Tech-Priest',
] as const;

/** Стандартные пороги из книги: 5 рангов у всех, кроме Psykера (3). */
const LADDERS: Record<(typeof CAREERS)[number], number[]> = {
  Adept: [0, 500, 1000, 2000, 3000],
  Arbitrator: [0, 500, 1000, 2000, 3000],
  Assassin: [0, 500, 1000, 2000, 3000],
  Cleric: [0, 500, 1000, 2000, 3000],
  Guardsman: [0, 500, 1000, 2000, 3000],
  'Imperial Psyker': [0, 500, 1000],
  Scum: [0, 500, 1000, 2000, 3000],
  'Tech-Priest': [0, 500, 1000, 2000, 3000],
};

function nodesOf(career: string) {
  const graph = careerRankGraph(career);
  expect(graph, `${career}: нет графа`).not.toBeNull();
  return Object.values(graph!.nodes);
}

function nodeByName(career: string, name: string) {
  const node = nodesOf(career).find((item) => item.name === name);
  expect(node, `${career}: нет ранга ${name}`).toBeTruthy();
  return node!;
}

describe('DH1: граф рангов core-8', () => {
  it('все восемь карьер и опциональная Сороритас описаны графом', () => {
    expect(Object.keys(RANK_GRAPHS).sort()).toEqual(
      [...CAREERS, 'Adepta Sororitas'].sort(),
    );
  });

  it.each(CAREERS)('%s: старт и стандартные пороги как в книге', (career) => {
    const graph = careerRankGraph(career)!;
    expect(graph.nodes[graph.start]).toBeTruthy();
    expect(graph.nodes[graph.start].expFrom).toBe(0);

    const ladder = nodesOf(career)
      .filter((node) => node.kind === 'standard')
      .sort((a, b) => a.expFrom - b.expFrom);
    expect(ladder.map((node) => node.expFrom)).toEqual(LADDERS[career]);
    expect(ladder[0].id).toBe(graph.start);
  });

  it('рёбра ведут внутрь своей карьеры и не убывают по опыту', () => {
    for (const career of CAREERS) {
      const graph = careerRankGraph(career)!;
      for (const node of Object.values(graph.nodes)) {
        expect(node.careerId).toBe(graph.careerId);
        for (const nextId of node.next) {
          const next = graph.nodes[nextId];
          expect(next, `${node.id} → ${nextId}`).toBeTruthy();
          expect(next.expFrom).toBeGreaterThanOrEqual(node.expFrom);
        }
      }
    }
  });

  it('Adept: на 2000 стандарт Inditor и альтернатива Chirurgeon', () => {
    const scribe = nodeByName('Adept', 'Scribe');
    const next = scribe.next.map((id) => careerRankGraph('Adept')!.nodes[id]);
    expect(next.map((node) => node.name).sort()).toEqual([
      'Chirurgeon',
      'Inditor',
    ]);
    expect(next.find((node) => node.name === 'Inditor')?.kind).toBe('standard');
    expect(next.find((node) => node.name === 'Chirurgeon')?.kind).toBe(
      'alternate',
    );
  });

  it('Adept: Chirurgeon сходится в Scholar на 3000', () => {
    const chirurgeon = nodeByName('Adept', 'Chirurgeon');
    expect(chirurgeon.next).toEqual(['dh1/core/rank/adept-scholar']);
  });

  it('Adept: на 6000 две ветки, Guardsman — три', () => {
    const adept = nodeByName('Adept', 'Scholar');
    expect(adept.next).toHaveLength(2);
    const guardsman = nodeByName('Guardsman', 'Veteran');
    expect(guardsman.next).toHaveLength(3);
    for (const id of guardsman.next) {
      expect(careerRankGraph('Guardsman')!.nodes[id].expFrom).toBe(6000);
    }
  });

  it('Psyker выбирает ветку уже на 2000 (стр. 100)', () => {
    const aspirant = nodeByName('Imperial Psyker', 'Aspirant');
    expect(aspirant.next).toHaveLength(2);
    for (const id of aspirant.next) {
      expect(careerRankGraph('Imperial Psyker')!.nodes[id].expFrom).toBe(2000);
    }
  });
});

describe('DH1: обход графа и развилки', () => {
  it('без выбора ранг остаётся на развилке до 6000', () => {
    const state = rankStateForCharacter({
      careerPath: 'Guardsman',
      totalExpSpent: 7000,
    });
    expect(state.node?.name).toBe('Veteran');
    expect(state.pendingFork).toBe('dh1/core/rank/guardsman-veteran');
    expect(state.options.map((node) => node.name).sort()).toEqual([
      'Assault Veteran',
      'Lieutenant',
      'Scout',
    ]);
  });

  it('выбранная ветка ведёт по своим рангам', () => {
    const scout = rankForCharacter({
      careerPath: 'Guardsman',
      totalExpSpent: 7000,
      advancedPath: 'Scout',
    });
    expect(scout).toBe('Scout');
    expect(
      rankForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 9000,
        advancedPath: 'Scout',
      }),
    ).toBe('Marksman');
    expect(
      rankForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 10000,
        advancedPath: 'Scout',
      }),
    ).toBe('Sniper');
  });

  it('альтернатива Chirurgeon активна только до 3000', () => {
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 2500,
        alternatePath: 'Chirurgeon',
      }),
    ).toBe('Chirurgeon');
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 3200,
        alternatePath: 'Chirurgeon',
      }),
    ).toBe('Scholar');
    // Без выбора действует стандартный путь.
    expect(rankForCharacter({ careerPath: 'Adept', totalExpSpent: 2500 })).toBe(
      'Inditor',
    );
  });

  it('Psyker: ветка выбирается на 2000 и ведёт дальше', () => {
    expect(
      rankForCharacter({
        careerPath: 'Imperial Psyker',
        totalExpSpent: 2500,
        advancedPath: 'Scholar Materium',
      }),
    ).toBe('Scholar Materium');
    expect(
      rankForCharacter({
        careerPath: 'Imperial Psyker',
        totalExpSpent: 6500,
        advancedPath: 'Scholar Materium',
      }),
    ).toBe('Scholar Arcanum');
    expect(
      rankForCharacter({
        careerPath: 'Imperial Psyker',
        totalExpSpent: 2500,
      }),
    ).toBe('Aspirant');
  });

  it('опыт ниже порога не открывает узел', () => {
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 1999,
        advancedPath: 'Comptroller',
      }),
    ).toBe('Scribe');
  });
});

describe('DH1: подписи узлов', () => {
  it('у каждого узла есть ключ и обе локали', () => {
    for (const career of CAREERS) {
      for (const node of nodesOf(career)) {
        expect(node.labelKey).toBe(`dh1.rank.${node.id.split('/').pop()}`);
        for (const lang of ['en', 'ru'] as const) {
          const label = translations[lang][node.labelKey];
          expect(label, `${node.id} (${lang})`).toBeTruthy();
          expect(label.trim()).not.toBe('');
        }
      }
    }
  });

  it('EN-имена Psyker и Guardsman совпадают с книгой', () => {
    const names = new Set(nodesOf('Imperial Psyker').map((n) => n.name));
    expect(names.has('Savant Warrant')).toBe(true);
    expect(names.has('Preceptor-Savant')).toBe(true);
    expect(names.has('Warrant-Savant')).toBe(false);
    expect(names.has('Savant-Preceptor')).toBe(false);

    const guardsman = nodesOf('Guardsman').map((n) => n.name);
    expect(guardsman).toContain('Shock Trooper');
    expect(guardsman).toContain('Storm Trooper');
    expect(guardsman).not.toContain('Shocktrooper');
    expect(guardsman).not.toContain('Stormtrooper');
  });

  it('RU-подписи не менялись при переводе EN на книжные', () => {
    expect(translations.ru['dh1.rank.imperial-psyker-warrant-savant']).toBe(
      'Савант-Уоррент',
    );
    expect(translations.ru['dh1.rank.imperial-psyker-savant-preceptor']).toBe(
      'Савант-Прецептор',
    );
    expect(translations.ru['dh1.rank.guardsman-shocktrooper']).toBe('Гренадер');
    expect(translations.ru['dh1.rank.guardsman-stormtrooper']).toBe(
      'Штурмовик',
    );
  });

  it('подпись узла карьерно-зависима, а не общая по EN-имени', () => {
    // Cleric Novice — «Неофит»; у Сороритас на этапе 4 появится свой узел
    // с «Неофиткой», поэтому ключ уже привязан к карьере.
    expect(translations.ru['dh1.rank.cleric-novice']).toBe('Неофит');
    expect(nodesOf('Cleric').find((n) => n.name === 'Novice')?.labelKey).toBe(
      'dh1.rank.cleric-novice',
    );
  });
});
