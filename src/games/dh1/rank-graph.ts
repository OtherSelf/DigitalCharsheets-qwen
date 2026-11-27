import { RANK_GRAPHS } from './rank-graph.generated';

/**
 * ─── LANDMARK: DH1 RANK GRAPH ─────────────────────────────────────────────
 * Карьерный путь 1-й редакции как граф: узел — ранг, рёбра — переходы.
 * Развилка там, где у узла больше одного `next`; выбор фиксируется в
 * `advancedPath`/`alternatePath` (позже — в `rankChoices`), а граф только
 * объясняет, куда этот выбор ведёт.
 *
 * Отличие от старых таблиц: сходимости и многотировые ветки. У Адепта
 * Chirurgeon возвращается в Scholar, у Сороритас три ветки сойдутся на
 * Superior — таблица «standard + alternates + advancedPaths» этого не
 * описывает.
 *
 * Данные графа генерируются из каталога (`rank-graph.generated.ts`), здесь
 * только обход. Модуль чистый: без React, без fs.
 */

/** Роль узла на входе в развилку. */
export type RankNodeKind = 'standard' | 'branch' | 'alternate';

export interface RankNode {
  /** ID каталога (`dh1/core/rank/adept-inditor`). */
  readonly id: string;
  readonly careerId: string;
  /** Ключ подписи `dh1.rank.<slug>`; карьерно-зависимые подписи живут здесь. */
  readonly labelKey: string;
  /** EN-имя ранга — то, что лежит в поле `rank` листа. */
  readonly name: string;
  readonly expFrom: number;
  readonly expTo: number;
  readonly next: readonly string[];
  readonly kind: RankNodeKind;
  /** Имя ветки для `advancedPath`/`alternatePath` (`Comptroller`, `Chirurgeon`). */
  readonly pathName?: string;
  /** Альтернативный ранг требует разрешения Мастера. */
  readonly gmApproval?: boolean;
}

export interface CareerRankGraph {
  readonly careerId: string;
  /** ID первого ранга карьеры. */
  readonly start: string;
  readonly nodes: Readonly<Record<string, RankNode>>;
}

/**
 * Поля листа, от которых зависит актуальный ранг. Намеренно структурный тип:
 * ранг нужен шапке, карточке, экспорту и Excel, и им достаточно этих полей.
 */
export interface RankInput {
  readonly careerPath?: string | null;
  readonly characterClass?: string | null;
  readonly rank?: string | null;
  readonly totalExpSpent?: number | null;
  readonly advancedPath?: string | null;
  readonly alternatePath?: string | null;
}

export interface RankState {
  /** Текущий узел ранга; `null` — карьеры нет или она неизвестна. */
  readonly node: RankNode | null;
  /** Узел-развилка, где опыт уже за порогом, а выбора нет; ранг остаётся на нём. */
  readonly pendingFork: string | null;
  /** Варианты на нерешённой развилке — их показывает диалог. */
  readonly options: readonly RankNode[];
}

export function careerRankGraph(
  careerPath: string | null | undefined,
): CareerRankGraph | null {
  if (!careerPath) return null;
  return RANK_GRAPHS[careerPath] ?? null;
}

export function rankNode(
  graph: CareerRankGraph,
  nodeId: string | null | undefined,
): RankNode | null {
  if (!nodeId) return null;
  return graph.nodes[nodeId] ?? null;
}

/**
 * Выбор следующего узла на развилке. Явный выбор игрока важнее стандартного
 * пути; если выбора нет и среди вариантов есть стандартный — идём по нему.
 * `null` означает «выбор обязателен и ещё не сделан».
 */
function pickNext(
  candidates: readonly RankNode[],
  advancedPath: string | null | undefined,
  alternatePath: string | null | undefined,
): RankNode | null {
  if (advancedPath) {
    const advanced = candidates.find((node) => node.pathName === advancedPath);
    if (advanced) return advanced;
  }
  if (alternatePath) {
    const alternate = candidates.find(
      (node) => node.kind === 'alternate' && node.pathName === alternatePath,
    );
    if (alternate) return alternate;
  }
  return candidates.find((node) => node.kind === 'standard') ?? null;
}

/**
 * Пройти граф по опыту и выбранным путям.
 *
 * Останавливаемся на узле, чьи следующие ранги ещё не открыты опытом, либо на
 * развилке без выбора — в обоих случаях ранг остаётся текущим. Циклов в
 * сгенерированных данных нет, счётчик шагов — страховка от испорченного
 * каталога.
 */
export function rankStateForCharacter(
  character: RankInput | null | undefined,
): RankState {
  const noRank: RankState = { node: null, pendingFork: null, options: [] };
  if (!character) return noRank;
  const graph = careerRankGraph(character.careerPath);
  if (!graph) return noRank;

  const spent = character.totalExpSpent ?? 0;
  let current = rankNode(graph, graph.start);
  if (!current) return noRank;

  for (let step = 0; step < Object.keys(graph.nodes).length + 1; step += 1) {
    const candidates = current.next
      .map((id) => rankNode(graph, id))
      .filter((node): node is RankNode => node !== null)
      .filter((node) => node.expFrom <= spent)
      .sort((a, b) => a.expFrom - b.expFrom);
    if (candidates.length === 0) break;

    if (candidates.length > 1) {
      const chosen = pickNext(
        candidates,
        character.advancedPath,
        character.alternatePath,
      );
      if (!chosen) {
        // Опыт уже за развилкой, но выбора нет: ранг остаётся на текущем узле.
        return { node: current, pendingFork: current.id, options: candidates };
      }
      current = chosen;
      continue;
    }

    current = candidates[0];
  }

  return { node: current, pendingFork: null, options: [] };
}
