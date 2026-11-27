/**
 * ─── LANDMARK: DH1 DATA PACK ──────────────────────────────────────────────
 * Ранги 1-й редакции. Актуальный ранг и класс считает граф
 * (`rank-graph.ts`), данные которого приходят из контент-каталога
 * (`rank-graph.generated.ts`): развилки, сходимости и альтернативы описаны
 * узлами и переходами.
 *
 * Старые таблицы продвинутых путей остаются здесь для диалогов выбора путей:
 * они хранят имена веток, которые лист пишет в `advancedPath`. Когда выборы
 * переедут в `rankChoices`, таблицы уйдут.
 */
import { rankStateForCharacter, type RankInput } from './rank-graph';
import type { DarkHeresyCareerPath } from './types';

export { RANK_GRAPHS } from './rank-graph.generated';
export {
  careerRankGraph,
  rankNode,
  rankStateForCharacter,
  type CareerRankGraph,
  type RankInput,
  type RankNode,
  type RankNodeKind,
  type RankState,
} from './rank-graph';

// Порог опыта, после которого открываются продвинутые карьерные пути.
export const ADVANCED_RANK_THRESHOLD = 6000;

interface Rank {
  name: string;
  expThreshold: number;
}

export interface AdvancedPath {
  name: string;
  ranks: Rank[];
}

export const AdvancedPathsByCareer: Partial<
  Record<DarkHeresyCareerPath, Record<string, AdvancedPath>>
> = {
  Adept: {
    pathA: {
      name: 'Comptroller',
      ranks: [
        { name: 'Comptroller', expThreshold: 6000 },
        { name: 'Logister Comptroller', expThreshold: 8000 },
        { name: 'Sage Logister', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Lexographer',
      ranks: [
        { name: 'Lexographer', expThreshold: 6000 },
        { name: 'Loremaster Lexographer', expThreshold: 8000 },
        { name: 'Loremaster Magister', expThreshold: 10000 },
      ],
    },
  },
  Arbitrator: {
    pathA: {
      name: 'Proctor',
      ranks: [
        { name: 'Proctor', expThreshold: 6000 },
        { name: 'Marshal', expThreshold: 8000 },
        { name: 'Lord Marshal', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Intelligencer',
      ranks: [
        { name: 'Intelligencer', expThreshold: 6000 },
        { name: 'Magistrate', expThreshold: 8000 },
        { name: 'Justicar', expThreshold: 10000 },
      ],
    },
  },
  Assassin: {
    pathA: {
      name: 'Death Adept',
      ranks: [
        { name: 'Death Adept', expThreshold: 6000 },
        { name: 'Nihilator', expThreshold: 8000 },
        { name: 'Imperator-Mortis', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Freeblade',
      ranks: [
        { name: 'Freeblade', expThreshold: 6000 },
        { name: 'Assassin at Marque', expThreshold: 8000 },
        { name: 'Assassin Palatine', expThreshold: 10000 },
      ],
    },
  },
  Cleric: {
    pathA: {
      name: 'Exorcist',
      ranks: [
        { name: 'Exorcist', expThreshold: 6000 },
        { name: 'Zealot', expThreshold: 8000 },
        { name: 'Redemptionist', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Confessor',
      ranks: [
        { name: 'Confessor', expThreshold: 6000 },
        { name: 'Bishop', expThreshold: 8000 },
        { name: 'Hierophant', expThreshold: 10000 },
      ],
    },
  },
  Guardsman: {
    pathA: {
      name: 'Assault Veteran',
      ranks: [
        { name: 'Assault Veteran', expThreshold: 6000 },
        { name: 'Shocktrooper', expThreshold: 8000 },
        { name: 'Stormtrooper', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Lieutenant',
      ranks: [
        { name: 'Lieutenant', expThreshold: 6000 },
        { name: 'Captain', expThreshold: 8000 },
        { name: 'Commander', expThreshold: 10000 },
      ],
    },
    pathC: {
      name: 'Scout',
      ranks: [
        { name: 'Scout', expThreshold: 6000 },
        { name: 'Marksman', expThreshold: 8000 },
        { name: 'Sniper', expThreshold: 10000 },
      ],
    },
  },
  'Imperial Psyker': {
    pathA: {
      name: 'Savant Militant',
      ranks: [
        { name: 'Savant Militant', expThreshold: 2000 },
        { name: 'Warrant-Savant', expThreshold: 3000 },
        { name: 'Lieutenant-Savant', expThreshold: 6000 },
        { name: 'Savant Adjunct', expThreshold: 8000 },
        { name: 'Savant-Preceptor', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Scholar Materium',
      ranks: [
        { name: 'Scholar Materium', expThreshold: 2000 },
        { name: 'Scholar Medicae', expThreshold: 3000 },
        { name: 'Scholar Arcanum', expThreshold: 6000 },
        { name: 'Scholar Obscurus', expThreshold: 8000 },
        { name: 'Scholar Empyrean', expThreshold: 10000 },
      ],
    },
  },
  Scum: {
    pathA: {
      name: 'Fixer',
      ranks: [
        { name: 'Fixer', expThreshold: 6000 },
        { name: 'Shark', expThreshold: 8000 },
        { name: 'Charlatan', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Cutter',
      ranks: [
        { name: 'Cutter', expThreshold: 6000 },
        { name: 'Stubjack', expThreshold: 8000 },
        { name: 'Gang Lord', expThreshold: 10000 },
      ],
    },
  },
  'Tech-Priest': {
    pathA: {
      name: 'Tech-Priest',
      ranks: [
        { name: 'Technomancer', expThreshold: 6000 },
        { name: 'Cyber-Seer', expThreshold: 8000 },
        { name: 'Magos', expThreshold: 10000 },
      ],
    },
    pathB: {
      name: 'Heretek',
      ranks: [
        { name: 'Mech-Deacon', expThreshold: 6000 },
        { name: 'Omniprophet', expThreshold: 8000 },
        { name: 'Magos Errant', expThreshold: 10000 },
      ],
    },
  },
};

/**
 * Актуальный ранг по карьере, опыту и выбранным путям.
 *
 * Сохранённый `rank` — снимок момента создания листа: без пересчёта шапка,
 * карточка, экспорт и Excel отстают от потраченного опыта. Лист без известной
 * карьеры сохраняет своё значение: угадывать её нельзя, а legacy-ранг
 * («Acolyte») — единственное, что у него есть.
 */
export function rankForCharacter(
  character: RankInput | null | undefined,
): string {
  const state = rankStateForCharacter(character);
  return state.node?.name ?? character?.rank ?? '';
}

/**
 * Класс персонажа — это карьера. Старый `characterClass` остаётся у листов без
 * карьеры (legacy/импорт), где он и есть единственный источник подписи.
 */
export function resolveCharacterClass(
  character: RankInput | null | undefined,
): string {
  const careerPath = character?.careerPath;
  return careerPath ? careerPath : (character?.characterClass ?? '');
}
