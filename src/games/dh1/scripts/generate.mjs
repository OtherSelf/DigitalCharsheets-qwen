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

    assertReachable(career, startId, nodes);

    const careerName = labelOf(career, 'en');
    if (graphs[careerName]) {
      throw new Error(`карьера «${careerName}» уже есть в графе`);
    }
    graphs[careerName] = { careerId: career.id, start: startId, nodes };

    const ruleSet = restrictionsOf(career, byId);
    if (ruleSet) restrictions[careerName] = ruleSet;
  }

  return { graphs, i18n, restrictions, skipped, rankCount: seenLabels.size };
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
    zeroInsanity: rules.zeroInsanity === true,
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
  const { graphs, i18n, restrictions, skipped, rankCount } =
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
      readonly zeroInsanity: boolean;
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

  const counts = `карьер ${Object.keys(sortedGraphs).length}, рангов ${rankCount}, ограничений ${Object.keys(restrictions).length}`;
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
