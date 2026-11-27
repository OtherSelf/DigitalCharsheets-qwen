import { describe, expect, it } from 'vitest';

import {
  careerRankGraph,
  rankForCharacter,
  rankStateForCharacter,
} from '@/games/dh1/dark-heresy-ranks';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 ALTERNATE CAREER RANKS ────────────────────────────────
 * 15 альтернативных рангов из Таблицы 2-3 (Инквизиторский справочник).
 * Каждый прикреплён к узлу минимального ранга разрешённой карьеры как
 * необязательный выбор: стандарт действует по умолчанию, альтернатива
 * требует разрешения Мастера, после диапазона она больше не предлагается.
 *
 * Упрощение книги (зафиксировано в docs): выбор возможен только на
 * минимальном ранге, структурированных требований и способностей нет.
 */

const GUARD = 'dh1/core/rank/guardsman-guard';
const ARMSMAN = 'dh1/core/rank/guardsman-armsman';
const FERAL = 'dh1/ih/rank/alt-feral-warrior/guardsman-guard';
const CHALICED = 'dh1/ih/rank/alt-chaliced-commissariat/guardsman-guard';
const SELL_STEEL = 'dh1/core/rank/assassin-sell-steel';
const GUNSLINGER = 'dh1/ih/rank/alt-metallican-gunslinger/assassin-sell-steel';
const ASSASSIN = 'dh1/core/rank/assassin-assassin';
const MORITAT = 'dh1/ih/rank/alt-moritat-reaper/assassin-assassin';
const SORORITAS_HOSPITALLER = 'dh1/core/rank/sororitas-hospitaller';
const OBLATIA = 'dh1/ih/rank/alt-sister-oblatia/sororitas-hospitaller';

function altNodes(career: string) {
  const graph = careerRankGraph(career);
  expect(graph, `${career}: нет графа`).not.toBeNull();
  return Object.values(graph!.nodes).filter(
    (node) => node.kind === 'alternate' && node.gmApproval,
  );
}

function altNames(career: string): Set<string> {
  return new Set(altNodes(career).map((node) => node.name));
}

describe('DH1: альтернативные ранги', () => {
  it('все 15 присутствуют и требуют разрешения Мастера', () => {
    const names = new Set<string>();
    for (const career of [
      'Adept',
      'Arbitrator',
      'Assassin',
      'Cleric',
      'Guardsman',
      'Imperial Psyker',
      'Scum',
      'Tech-Priest',
      'Adepta Sororitas',
    ]) {
      for (const node of altNodes(career)) {
        names.add(node.name);
        expect(node.gmApproval, node.id).toBe(true);
      }
    }
    expect(names.size).toBe(15);
  });

  it('таблица карьер: Sister Oblatia только Сороритас, Tyrantine — без неё и Техножреца', () => {
    expect(altNames('Adepta Sororitas')).toEqual(new Set(['Sister Oblatia']));
    expect(altNames('Tech-Priest').has('Tyrantine Shadow Agent')).toBe(false);
    expect(altNames('Adepta Sororitas').has('Tyrantine Shadow Agent')).toBe(
      false,
    );
    for (const career of ['Adept', 'Scum', 'Guardsman', 'Imperial Psyker']) {
      expect(altNames(career).has('Tyrantine Shadow Agent')).toBe(true);
    }
  });

  it('у Guardsman на ранге 3 стандарт и две альтернативы', () => {
    const state = rankStateForCharacter({
      careerPath: 'Guardsman',
      totalExpSpent: 1500,
    });

    expect(state.node?.name).toBe('Armsman');
    expect(state.fork?.nodeId).toBe(GUARD);
    expect(state.fork?.required).toBe(false);
    expect(state.fork?.options.map((node) => node.name).sort()).toEqual([
      'Armsman',
      'Chaliced Commissariat',
      'Feral Warrior',
    ]);
  });

  it('выбранная альтернатива заменяет ранг и продолжает стандарт', () => {
    const choices = { [GUARD]: FERAL };
    expect(
      rankForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 1500,
        rankChoices: choices,
      }),
    ).toBe('Feral Warrior');
    expect(
      rankForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 2500,
        rankChoices: choices,
      }),
    ).toBe('Sergeant');
    // После диапазона альтернатива недоступна, идёт обычная лестница.
    expect(
      rankForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 3500,
        rankChoices: choices,
      }),
    ).toBe('Veteran');
    // На 3500 открывается развилка ранга 5 (Tyrantine и т.п.), но Feral
    // Warrior с диапазоном 1000–1999 больше не предлагается.
    expect(
      rankStateForCharacter({
        careerPath: 'Guardsman',
        totalExpSpent: 3500,
      }).fork?.options.some((node) => node.name === 'Feral Warrior'),
    ).toBe(false);
  });

  it('альтернатива первого ранга не подменяет стандарт без выбора', () => {
    const state = rankStateForCharacter({
      careerPath: 'Assassin',
      totalExpSpent: 0,
    });
    expect(state.node?.name).toBe('Sell-Steel');
    expect(state.fork?.nodeId).toBe(SELL_STEEL);
    expect(state.fork?.required).toBe(false);
    expect(state.fork?.options.map((node) => node.name)).toEqual([
      'Metallican Gunslinger',
    ]);
    expect(
      rankForCharacter({
        careerPath: 'Assassin',
        totalExpSpent: 0,
        rankChoices: { [SELL_STEEL]: GUNSLINGER },
      }),
    ).toBe('Metallican Gunslinger');
    // Опыт вырос — обычная лестница, выбор больше не предлагается.
    expect(
      rankForCharacter({ careerPath: 'Assassin', totalExpSpent: 600 }),
    ).toBe('Shadesman');
    expect(
      rankStateForCharacter({
        careerPath: 'Assassin',
        totalExpSpent: 600,
      }).fork,
    ).toBeNull();
  });

  it('у Scum на первом ранге две альтернативы', () => {
    const state = rankStateForCharacter({
      careerPath: 'Scum',
      totalExpSpent: 0,
    });
    expect(state.node?.name).toBe('Dreg');
    expect(state.fork?.options.map((node) => node.name).sort()).toEqual([
      'Metallican Gunslinger',
      'Reclaimator',
    ]);
  });

  it('альтернатива ранга 6 у Assassin переносит выбор ветки на 8000', () => {
    const state = rankStateForCharacter({
      careerPath: 'Assassin',
      totalExpSpent: 6500,
      rankChoices: { [ASSASSIN]: MORITAT },
    });
    expect(state.node?.name).toBe('Moritat Reaper');

    const later = rankStateForCharacter({
      careerPath: 'Assassin',
      totalExpSpent: 8500,
      rankChoices: { [ASSASSIN]: MORITAT },
    });
    expect(later.node?.name).toBe('Moritat Reaper');
    expect(later.pendingFork).not.toBeNull();
    expect(later.options.map((node) => node.name).sort()).toEqual([
      'Assassin at Marque',
      'Nihilator',
    ]);
  });

  it('Sister Oblatia продолжает свою ветку Сороритас', () => {
    const choices = {
      'dh1/core/rank/sororitas-constantia': SORORITAS_HOSPITALLER,
      [SORORITAS_HOSPITALLER]: OBLATIA,
    };
    expect(
      rankForCharacter({
        careerPath: 'Adepta Sororitas',
        totalExpSpent: 3500,
        rankChoices: choices,
      }),
    ).toBe('Sister Oblatia');
    expect(
      rankForCharacter({
        careerPath: 'Adepta Sororitas',
        totalExpSpent: 6500,
        rankChoices: choices,
      }),
    ).toBe('Almoness');
  });

  it('у Adept на 2000 пять вариантов, включая три альтернативы', () => {
    const state = rankStateForCharacter({
      careerPath: 'Adept',
      totalExpSpent: 2500,
    });
    expect(state.fork?.options.map((node) => node.name).sort()).toEqual([
      'Bonded Emissary',
      'Calixian Xeno-Arcanist',
      'Chirurgeon',
      'Inditor',
      'Legate Investigator',
    ]);
  });

  it('подписи альтернатив есть в обеих локалях', () => {
    for (const node of altNodes('Guardsman')) {
      for (const lang of ['en', 'ru'] as const) {
        expect(
          translations[lang][node.labelKey],
          `${node.labelKey} (${lang})`,
        ).toBeTruthy();
      }
    }
    expect(translations.ru['dh1.rank.alt-feral-warrior']).toBe('Воин-дикарь');
    expect(translations.ru['dh1.rank.alt-moritat-reaper']).toBe('Жнец Моритат');
    expect(translations.ru['dh1.rank.alt-sister-oblatia']).toBe(
      'Сестра Облатиа',
    );
  });
});
