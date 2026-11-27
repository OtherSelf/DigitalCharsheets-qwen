import { rankStateForCharacter, type RankInput } from './rank-graph';

export { RANK_GRAPHS } from './rank-graph.generated';
export {
  careerRankGraph,
  rankChoicesFromLegacy,
  rankNode,
  rankStateForCharacter,
  type CareerRankGraph,
  type RankFork,
  type RankInput,
  type RankNode,
  type RankNodeKind,
  type RankState,
} from './rank-graph';

/**
 * ─── LANDMARK: DH1 RANKS ─────────────────────────────────────────────────
 * Точка входа рангов 1-й редакции. Данные — граф из контент-каталога
 * (`rank-graph.generated.ts`), обход — `rank-graph.ts`, а здесь только
 * хелперы для листа и экспорта.
 *
 * Таблица «standard + alternates + advancedPaths» удалена: её заменили узлы и
 * переходы, которые умеют развилки, сходимости и многотировые ветки.
 */

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
