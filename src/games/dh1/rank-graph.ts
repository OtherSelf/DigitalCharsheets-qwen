import { RANK_GRAPHS } from './rank-graph.generated';

/**
 * ─── LANDMARK: DH1 RANK GRAPH ─────────────────────────────────────────────
 * Карьерный путь 1-й редакции как граф: узел — ранг, рёбра — переходы.
 * Развилка там, где у узла больше одного `next`; выбор игрока лежит в
 * `rankChoices` (id узла-развилки → id выбранного узла), а граф объясняет,
 * куда этот выбор ведёт.
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
  readonly rankChoices?: Readonly<Record<string, string>> | null;
}

/** Нерешённая развилка: где выбирать и что предлагается. */
export interface RankFork {
  /** Узел, на котором происходит выбор. */
  readonly nodeId: string;
  readonly options: readonly RankNode[];
  /** Нет стандартного варианта: без выбора ранг дальше не идёт. */
  readonly required: boolean;
}

export interface RankState {
  /** Текущий узел ранга; `null` — карьеры нет или она неизвестна. */
  readonly node: RankNode | null;
  /** Нерешённая развилка (обязательная или альтернативная). */
  readonly fork: RankFork | null;
  /** ID обязательной развилки; `null`, если выбор не блокирует ранг. */
  readonly pendingFork: string | null;
  /** Варианты на развилке — их показывает диалог. */
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

/** Входной узел ветки по её имени: самый ранний из узлов этой ветки. */
function branchEntry(
  graph: CareerRankGraph,
  pathName: string,
  kind: RankNodeKind,
): RankNode | null {
  return (
    Object.values(graph.nodes)
      .filter((node) => node.kind === kind && node.pathName === pathName)
      .sort((a, b) => a.expFrom - b.expFrom)[0] ?? null
  );
}

/**
 * Перенос legacy-выборов в `rankChoices`: `advancedPath`/`alternatePath`
 * хранят имя ветки, а карта — id узла-развилки и выбранного узла.
 * Невалидное имя просто игнорируется: угадывать ветку нельзя.
 */
export function rankChoicesFromLegacy(character: {
  readonly careerPath?: string | null;
  readonly advancedPath?: string | null;
  readonly alternatePath?: string | null;
}): Record<string, string> {
  const graph = careerRankGraph(character.careerPath);
  if (!graph) return {};

  const choices: Record<string, string> = {};
  const attach = (pathName: string | null | undefined, kind: RankNodeKind) => {
    if (!pathName) return;
    const node = branchEntry(graph, pathName, kind);
    if (!node) return;
    const fork = Object.values(graph.nodes).find((candidate) =>
      candidate.next.includes(node.id),
    );
    if (!fork) return;
    choices[fork.id] = node.id;
  };

  attach(character.advancedPath, 'branch');
  attach(character.alternatePath, 'alternate');
  return choices;
}

/**
 * Выборы листа: `rankChoices` — источник истины; лист без поля (старый или
 * ещё не мигрированный документ) читается через legacy-пути.
 */
function choicesOf(character: RankInput): Readonly<Record<string, string>> {
  if (character.rankChoices) return character.rankChoices;
  return rankChoicesFromLegacy(character);
}

/**
 * Пройти граф по опыту и выбранным путям.
 *
 * Останавливаемся на узле, чьи следующие ранги ещё не открыты опытом, либо на
 * обязательной развилке без выбора — в обоих случаях ранг остаётся текущим.
 * Альтернативная развилка (есть стандартный ответ) не блокирует ранг: она
 * возвращается в `fork`, чтобы UI предложил выбор, но ранк идёт по стандарту.
 *
 * Циклов в сгенерированных данных нет, счётчик шагов — страховка от
 * испорченного каталога.
 */
export function rankStateForCharacter(
  character: RankInput | null | undefined,
): RankState {
  const noRank: RankState = {
    node: null,
    fork: null,
    pendingFork: null,
    options: [],
  };
  if (!character) return noRank;
  const graph = careerRankGraph(character.careerPath);
  if (!graph) return noRank;

  const spent = character.totalExpSpent ?? 0;
  const choices = choicesOf(character);
  const start = rankNode(graph, graph.start);
  if (!start) return noRank;
  let current: RankNode = start;

  let fork: RankFork | null = null;

  for (let step = 0; step <= Object.keys(graph.nodes).length; step += 1) {
    const from: RankNode = current;
    const candidates = from.next
      .map((id) => rankNode(graph, id))
      .filter((node): node is RankNode => node !== null)
      .filter((node) => node.expFrom <= spent)
      .sort((a, b) => a.expFrom - b.expFrom);
    if (candidates.length === 0) break;

    const chosenId = choices[from.id];
    if (chosenId) {
      const chosen = candidates.find((node) => node.id === chosenId);
      if (chosen) {
        current = chosen;
        continue;
      }
      // Выбор уже сделан, но его узел ещё не открыт опытом: ранг остаётся
      // прежним и переспрашивать нельзя — иначе падение опыта снова
      // открывало бы диалог поверх запертого выбора.
      if (from.next.includes(chosenId)) break;
    }

    if (candidates.length === 1) {
      const only = candidates[0];
      // Альтернатива первого ранга стоит на месте старта: стандартный ранг
      // действует по умолчанию, а выбор предлагается кнопкой.
      if (only.kind === 'alternate') {
        if (!fork) {
          fork = { nodeId: from.id, options: candidates, required: false };
        }
        break;
      }
      current = only;
      continue;
    }

    // Стандарт — узел `standard`; внутри выбранной ветки продолжение тоже
    // идёт по умолчанию, если оно одно. Несколько branch без standard — это
    // обязательная развилка (Guardsman 6000, Sororitas 2000).
    const branches = candidates.filter((node) => node.kind === 'branch');
    const standard =
      candidates.find((node) => node.kind === 'standard') ??
      (branches.length === 1 ? branches[0] : undefined);
    if (!standard && candidates.every((node) => node.kind === 'alternate')) {
      if (!fork) {
        fork = { nodeId: from.id, options: candidates, required: false };
      }
      break;
    }
    if (!standard) {
      const required: RankFork = {
        nodeId: from.id,
        options: candidates,
        required: true,
      };
      return {
        node: from,
        fork: required,
        pendingFork: from.id,
        options: candidates,
      };
    }

    // Альтернатива предлагается, пока её диапазон не закрыт; после него
    // стандартный путь действует молча.
    if (
      !fork &&
      candidates.some((node) => node.kind !== 'standard' && node.expTo >= spent)
    ) {
      fork = { nodeId: from.id, options: candidates, required: false };
    }
    current = standard;
  }

  return {
    node: current,
    fork,
    pendingFork: null,
    options: fork?.options ?? [],
  };
}
