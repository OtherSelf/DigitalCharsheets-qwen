#!/usr/bin/env node
/**
 * ============================================================================
 *  src/games/dh1/scripts/generate.mjs — граф рангов 1-й редакции
 * ============================================================================
 *
 *  Эталон — внешний контент-каталог (`DCS_CONTENT_DIR`, по умолчанию
 *  `./content/dh1`): у rank-сущностей лежат `careerId`, `expFrom`/`expTo`,
 *  `path`, `next`, `kind`; у карьер — `startRankId`.
 *
 *  Скрипт живёт в папке плагина (данные 1e — его собственность, а не тулинг
 *  ядра) и генерирует в `src/games/dh1/`:
 *    rank-graph.generated.ts  узлы/переходы всех карьер и их подписи-ключи
 *  и дописывает подписи `dh1.rank.*` (en/ru) в `i18n/{en,ru}.json`.
 *
 *  Runtime-зависимости от каталога нет: модуль читает только сгенерированные
 *  файлы. Пересборка — без флага; проверка дрейфа — `--check`; в
 *  `npm run verify` дрейф ловит unit-тест плагина
 *  (`tests/unit/rank-graph-freshness.test.ts`), а не корневой скрипт.
 *
 *  Использование:
 *    node src/games/dh1/scripts/generate.mjs
 *    node src/games/dh1/scripts/generate.mjs --check
 *    DCS_CONTENT_DIR=/path/to/content/dh1 node src/games/dh1/scripts/generate.mjs
 * ============================================================================
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Корень репозитория: scripts → dh1 → games → src → корень. */
const ROOT = resolve(HERE, '../../../..');
const MODULE_DIR = resolve(HERE, '..');
const CONTENT_DIR = process.env.DCS_CONTENT_DIR ?? resolve(ROOT, 'content/dh1');

const CHECK = process.argv.includes('--check');
/** Генератор владеет только этим срезом словаря; остальные ключи ручные. */
const I18N_PREFIX = 'dh1.rank.';

const HEADER = `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ────────────────────────────────────
 * Граф рангов 1-й редакции из внешнего контент-каталога (DCS_CONTENT_DIR).
 * Пересобрать: node src/games/dh1/scripts/generate.mjs.
 * Проверить дрейф: тот же файл с --check (или unit-тест свежести).
 */
`;

const KINDS = new Set(['standard', 'branch', 'alternate']);

/** Номер ранга → начало его диапазона опыта (книжные ступени 1e). */
const RANK_TIER_XP = { 1: 0, 2: 500, 3: 1000, 4: 2000, 5: 3000, 6: 6000 };

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function slugOf(id) {
  return String(id).split('/').pop();
}

function labelOf(entity, lang) {
  const value = entity.label?.[lang];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${entity.id}: нет label.${lang}`);
  }
  return value.trim();
}

function buildGraph(catalog) {
  const careers = catalog.entities.filter((entity) => entity.kind === 'career');
  const ranks = catalog.entities.filter((entity) => entity.kind === 'rank');
  const byId = new Map(catalog.entities.map((entity) => [entity.id, entity]));

  const graphs = {};
  const careerKeys = new Map();
  const restrictions = {};
  const i18n = { en: {}, ru: {} };
  const seenLabels = new Set();
  const skipped = [];

  for (const career of careers) {
    const own = ranks.filter((rank) => rank.props?.careerId === career.id);
    if (own.length === 0) {
      skipped.push(career.label?.en ?? career.id);
      continue;
    }

    const startId = career.props?.startRankId;
    if (!startId) throw new Error(`${career.id}: нет props.startRankId`);
    if (!own.some((rank) => rank.id === startId)) {
      throw new Error(
        `${career.id}: startRankId ${startId} не ранг этой карьеры`,
      );
    }

    const nodes = {};
    for (const rank of own) {
      const props = rank.props ?? {};
      const expFrom = props.expFrom;
      const expTo = props.expTo;
      if (!Number.isInteger(expFrom) || !Number.isInteger(expTo)) {
        throw new Error(`${rank.id}: expFrom/expTo должны быть целыми`);
      }
      if (expTo < expFrom) throw new Error(`${rank.id}: expTo < expFrom`);
      if (!KINDS.has(props.kind)) {
        throw new Error(`${rank.id}: неизвестный kind ${props.kind}`);
      }
      if (!Array.isArray(props.next)) {
        throw new Error(`${rank.id}: нет props.next`);
      }
      const slug = slugOf(rank.id);
      if (seenLabels.has(slug)) {
        throw new Error(`${rank.id}: slug «${slug}» уже занят`);
      }
      seenLabels.add(slug);

      for (const nextId of props.next) {
        const next = byId.get(nextId);
        if (!next || next.kind !== 'rank') {
          throw new Error(`${rank.id}: next ${nextId} не rank`);
        }
        if (next.props?.careerId !== career.id) {
          throw new Error(`${rank.id}: next ${nextId} из другой карьеры`);
        }
        if (next.props.expFrom < expFrom) {
          throw new Error(`${rank.id} → ${nextId}: опыт уменьшается`);
        }
      }

      const pathName = props.pathName ?? undefined;
      if (props.kind !== 'standard' && !pathName) {
        throw new Error(`${rank.id}: нет props.pathName для ${props.kind}`);
      }

      const labelKey = `${I18N_PREFIX}${slug}`;
      nodes[rank.id] = {
        id: rank.id,
        careerId: career.id,
        labelKey,
        name: labelOf(rank, 'en'),
        expFrom,
        expTo,
        next: [...props.next],
        kind: props.kind,
        ...(pathName ? { pathName } : {}),
        ...(props.gmApproval ? { gmApproval: true } : {}),
      };
      i18n.en[labelKey] = labelOf(rank, 'en');
      i18n.ru[labelKey] = labelOf(rank, 'ru');
    }

    const careerName = labelOf(career, 'en');
    careerKeys.set(career.id, careerName);
    if (graphs[careerName]) {
      throw new Error(`карьера «${careerName}» уже есть в графе`);
    }
    graphs[careerName] = { careerId: career.id, start: startId, nodes };

    const ruleSet = restrictionsOf(career, byId);
    if (ruleSet) restrictions[careerName] = ruleSet;
  }

  const rankCount = seenLabels.size;
  const alternatives = ranks.filter((rank) => rank.props?.alternative === true);
  const altCount = attachAlternatives(
    alternatives,
    graphs,
    careerKeys,
    i18n,
    seenLabels,
  );

  for (const [careerName, graph] of Object.entries(graphs)) {
    assertReachable(
      { id: graph.careerId, label: { en: careerName } },
      graph.start,
      graph.nodes,
    );
  }

  return {
    graphs,
    i18n,
    restrictions,
    skipped,
    rankCount,
    altCount,
  };
}

/**
 * Прикрепить альтернативные ранги к графам разрешённых карьер.
 *
 * Узел вставляется как необязательный `next` к узлу предыдущей ступени: у
 * него тот же диапазон опыта, что у заменяемого ранга, а `next` ведёт туда же,
 * куда шёл заменяемый. Если ступень — развилка (Psyker 2000, Sororitas 3000),
 * альтернатива встаёт на её место, а следующий выбор ветки переносится на
 * следующую ступень. Ступень 1 — стартовый узел: альтернатива предлагается
 * сразу, стандартный ранг остаётся по умолчанию.
 */
function attachAlternatives(
  alternatives,
  graphs,
  careerKeys,
  i18n,
  seenLabels,
) {
  let count = 0;
  for (const alt of alternatives) {
    const props = alt.props ?? {};
    const minRank = props.minRank;
    if (!Number.isInteger(minRank) || !(minRank in RANK_TIER_XP)) {
      throw new Error(`${alt.id}: props.minRank должен быть 1…6`);
    }
    if (!Array.isArray(props.careerIds) || props.careerIds.length === 0) {
      throw new Error(`${alt.id}: нет props.careerIds`);
    }
    if (props.gmApproval !== true) {
      throw new Error(
        `${alt.id}: альтернативный ранг требует props.gmApproval`,
      );
    }
    const slug = slugOf(alt.id);
    const labelKey = `${I18N_PREFIX}${slug}`;
    i18n.en[labelKey] = labelOf(alt, 'en');
    i18n.ru[labelKey] = labelOf(alt, 'ru');

    for (const careerId of props.careerIds) {
      const careerName = careerKeys.get(careerId);
      if (!careerName) {
        throw new Error(`${alt.id}: careerIds ${careerId} не карьера каталога`);
      }
      const graph = graphs[careerName];
      attachToCareer(graph, alt, minRank, labelKey, slug);
      count += 1;
    }
    if (seenLabels.has(slug)) {
      throw new Error(`${alt.id}: slug «${slug}» уже занят`);
    }
    seenLabels.add(slug);
  }
  return count;
}

function attachToCareer(graph, alt, minRank, labelKey, slug) {
  const nodes = graph.nodes;
  const tierXp = RANK_TIER_XP[minRank];

  if (minRank === 1) {
    const start = nodes[graph.start];
    const altId = `${alt.id}/${slugOf(start.id)}`;
    const nextIds = [...start.next];
    nodes[altId] = {
      id: altId,
      careerId: graph.careerId,
      labelKey,
      name: labelOf(alt, 'en'),
      expFrom: 0,
      expTo: 499,
      next: nextIds,
      kind: 'alternate',
      pathName: labelOf(alt, 'en'),
      gmApproval: true,
    };
    start.next = [...nextIds, altId];
    return;
  }

  const entries = Object.values(nodes).filter(
    (node) => node.expFrom === tierXp && node.kind !== 'alternate',
  );
  if (entries.length === 0) {
    throw new Error(`${alt.id}: у ${graph.careerId} нет ступени ${minRank}`);
  }

  const parents = Object.values(nodes).filter(
    (node) =>
      node.kind !== 'alternate' &&
      node.next.some((id) => entries.some((e) => e.id === id)),
  );
  if (parents.length === 0) {
    throw new Error(
      `${alt.id}: у ${graph.careerId} нет узла перед ступенью ${minRank}`,
    );
  }

  for (const parent of parents) {
    const children = entries.filter((entry) => parent.next.includes(entry.id));
    if (children.length === 0) continue;
    const altId = `${alt.id}/${slugOf(parent.id)}`;
    const nextIds = [...new Set(children.flatMap((child) => child.next))];
    nodes[altId] = {
      id: altId,
      careerId: graph.careerId,
      labelKey,
      name: labelOf(alt, 'en'),
      expFrom: Math.min(...children.map((child) => child.expFrom)),
      expTo: Math.max(...children.map((child) => child.expTo)),
      next: nextIds,
      kind: 'alternate',
      pathName: labelOf(alt, 'en'),
      gmApproval: true,
    };
    parent.next = [...parent.next, altId];
  }
}

/**
 * Ограничения создания из каталога (`props.restrictions`): пол, родные миры
 * (их EN-имена, как в `DarkHeresyHomeWorlds`), нулевые Безумие/Порча и
 * обязательное разрешение Мастера.
 */
function restrictionsOf(career, byId) {
  const rules = career.props?.restrictions;
  if (!rules) return null;
  const gender = rules.gender;
  if (gender !== undefined && gender !== 'female' && gender !== 'male') {
    throw new Error(`${career.id}: неизвестный restrictions.gender`);
  }
  const originIds = rules.originIds ?? [];
  if (!Array.isArray(originIds) || originIds.length === 0) {
    throw new Error(
      `${career.id}: restrictions.originIds должен быть непустым`,
    );
  }
  const homeWorlds = originIds.map((originId) => {
    const origin = byId.get(originId);
    if (!origin || origin.kind !== 'origin') {
      throw new Error(
        `${career.id}: restrictions.originIds ${originId} не origin`,
      );
    }
    return labelOf(origin, 'en');
  });
  return {
    ...(gender ? { gender } : {}),
    homeWorlds,
    zeroCorruption: rules.zeroCorruption === true,
    gmApproval: rules.gmApproval === true,
  };
}

/** Все узлы обязаны быть достижимы из старта: иначе ребро забыто. */
function assertReachable(career, startId, nodes) {
  const seen = new Set();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id];
    if (!node) throw new Error(`${career.id}: next ведёт на неизвестный ${id}`);
    for (const nextId of node.next) stack.push(nextId);
  }
  for (const id of Object.keys(nodes)) {
    if (!seen.has(id)) {
      throw new Error(`${career.id}: узел ${id} недостижим из ${startId}`);
    }
  }
}

function mergeI18n(existing, generated) {
  const kept = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !key.startsWith(I18N_PREFIX)),
  );
  const additions = Object.fromEntries(
    Object.entries(generated).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  return { ...kept, ...additions };
}

async function format(source, filepath) {
  const config = await prettier.resolveConfig(filepath);
  return prettier.format(source, { ...config, filepath });
}

async function emit(path, source) {
  const next = await format(source, path);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === next) return false;
  if (!CHECK) writeFileSync(path, next, 'utf8');
  return true;
}

async function main() {
  const catalogPath = join(CONTENT_DIR, 'catalog.json');
  if (!existsSync(catalogPath)) {
    console.error(`нет файла каталога: ${catalogPath}`);
    console.error('укажите DCS_CONTENT_DIR на каталог с catalog.json');
    process.exit(2);
  }

  const catalog = readJson(catalogPath);
  const { graphs, i18n, restrictions, skipped, rankCount, altCount } =
    buildGraph(catalog);

  const sortedGraphs = {};
  for (const [career, graph] of Object.entries(graphs).sort(([a], [b]) =>
    a.localeCompare(b, 'en'),
  )) {
    const nodes = Object.fromEntries(
      Object.entries(graph.nodes).sort(([, a], [, b]) =>
        a.expFrom === b.expFrom
          ? a.id.localeCompare(b.id, 'en')
          : a.expFrom - b.expFrom,
      ),
    );
    sortedGraphs[career] = { ...graph, nodes };
  }

  const graphSource = `${HEADER}import type { CareerRankGraph } from './rank-graph';

export const RANK_GRAPHS: Readonly<Record<string, CareerRankGraph>> = ${JSON.stringify(
    sortedGraphs,
    null,
    2,
  )};

/** Ограничения создания карьер, у которых они есть в каталоге. */
export const CAREER_RESTRICTIONS: Readonly<
  Record<
    string,
    {
      readonly gender?: 'male' | 'female';
      readonly homeWorlds: readonly string[];
      readonly zeroCorruption: boolean;
      readonly gmApproval: boolean;
    }
  >
> = ${JSON.stringify(restrictions, null, 2)};
`;

  const enPath = join(MODULE_DIR, 'i18n/en.json');
  const ruPath = join(MODULE_DIR, 'i18n/ru.json');
  const enSource = `${JSON.stringify(mergeI18n(readJson(enPath), i18n.en), null, 2)}\n`;
  const ruSource = `${JSON.stringify(mergeI18n(readJson(ruPath), i18n.ru), null, 2)}\n`;

  const changed = [
    [join(MODULE_DIR, 'rank-graph.generated.ts'), graphSource],
    [enPath, enSource],
    [ruPath, ruSource],
  ];
  let dirty = 0;
  for (const [path, source] of changed) {
    if (await emit(path, source)) dirty += 1;
  }

  const counts = `карьер ${Object.keys(sortedGraphs).length}, рангов ${rankCount}, альтернатив ${altCount}, ограничений ${Object.keys(restrictions).length}`;
  const skipNote =
    skipped.length > 0 ? `; без рангов: ${skipped.join(', ')}` : '';

  if (CHECK) {
    if (dirty > 0) {
      console.error(
        `dh1: данные устарели (${dirty} файлов). Запустите node src/games/dh1/scripts/generate.mjs`,
      );
      process.exit(1);
    }
    console.log(`dh1: ok (${counts}${skipNote})`);
    return;
  }

  console.log(`dh1: записано ${dirty} файлов (${counts}${skipNote})`);
}

await main();
