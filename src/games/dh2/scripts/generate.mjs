#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/dh2e/generate.mjs — данные 2-й редакции для модуля dh2
 * ============================================================================
 *
 *  Эталон данных — внешний контент-каталог (`DCS_CONTENT_DIR`):
 *    catalog.json  (миры, бэкграунды, роли, пророчества, справочники)
 *    rules.json    (аптитюды, характеристики, таблицы XP, ступени)
 *
 *  Скрипт живёт в папке плагина (`src/games/dh2/scripts/`): данные 2-й
 *  редакции — его собственность, а не тулинг ядра. Генерирует в
 *  `src/games/dh2/`:
 *    dh2e-data.ts        миры, бэкграунды, роли, пророчества, аптитюды
 *    dh2e-reference.ts   навыки, таланты, дисциплины, силы, элитные продвижения
 *    dh2e-rules.ts       ступени, ранги навыков, таблицы 2-2/2-4/2-6
 *  и дописывает подписи в i18n/en.json, i18n/ru.json (только ключи `dh2.catalog.*`).
 *
 *  Runtime-зависимости от внешнего каталога нет: модуль читает только
 *  сгенерированные файлы. Пересборка — без флага, проверка дрейфа — `--check`; в `npm run
 *  verify` дрейф ловит unit-тест плагина (`tests/unit/dh2e-freshness.test.ts`),
 *  а не корневой скрипт.
 *
 *  Использование:
 *    node src/games/dh2/scripts/generate.mjs
 *    node src/games/dh2/scripts/generate.mjs --check
 *    DCS_CONTENT_DIR=/path/to/content/dh2 node src/games/dh2/scripts/generate.mjs
 * ============================================================================
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Корень репозитория: scripts → dh2 → games → src → корень. */
const ROOT = resolve(HERE, '../../../..');
const MODULE_DIR = resolve(HERE, '..');
const CONTENT_DIR = process.env.DCS_CONTENT_DIR ?? resolve(ROOT, 'content/dh2');

const CHECK = process.argv.includes('--check');
const I18N_PREFIX = 'dh2.catalog.';

/** Ключи `stats` листа ← смысловые id каталога. */
const STAT_IDS = {
  'weapon-skill': 'weaponSkill',
  'ballistic-skill': 'ballisticSkill',
  strength: 'strength',
  toughness: 'toughness',
  agility: 'agility',
  intelligence: 'intelligence',
  perception: 'perception',
  willpower: 'willpower',
  fellowship: 'fellowship',
  influence: 'influence',
};

const HEADER = `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Данные 2-й редакции из внешнего контент-каталога (DCS_CONTENT_DIR).
 * Пересобрать: node src/games/dh2/scripts/generate.mjs.
 * Проверить дрейф: тот же файл с --check (или unit-тест dh2e-freshness).
 */
`;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Пол, который бэкграунд фиксирует правилами (Адептус Сороритас — female). */
function genderLockOf(entity, value) {
  if (value !== 'female' && value !== 'male') {
    throw new Error(
      `${entity.id}: неизвестный genderLock ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function slugOf(id) {
  return String(id).split('/').pop();
}

function statId(id) {
  if (!(id in STAT_IDS)) {
    throw new Error(`неизвестная характеристика: ${id}`);
  }
  return STAT_IDS[id];
}

function convertDeltas(deltas) {
  if (!deltas) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(deltas)) {
    out[statId(key)] = value;
  }
  return out;
}

function convertChoices(choices) {
  if (!Array.isArray(choices)) return undefined;
  return choices.map((choice) => {
    const out = {};
    for (const [key, value] of Object.entries(choice)) {
      if (key === 'deltas' && value && typeof value === 'object') {
        out.deltas = convertDeltas(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

function convertGrants(grants) {
  if (!Array.isArray(grants)) return undefined;
  return grants.map((grant) => {
    const out = {};
    for (const [key, value] of Object.entries(grant)) {
      if ((key === 'talent' || key === 'skill') && typeof value === 'string') {
        out[key] = slugOf(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

function aptitudeSlot(value) {
  if (typeof value === 'string') return value;
  if (value && Array.isArray(value.anyOf)) {
    return { choose: 1, of: value.anyOf.map((item) => statAptitudeId(item)) };
  }
  throw new Error(`неподдерживаемая аптитюда: ${JSON.stringify(value)}`);
}

// Аптитюды в данных остаются смысловыми id (`weapon-skill`) — как в правилах.
function statAptitudeId(value) {
  return value;
}

function skillGrant(entry) {
  const base = {
    skillId: slugOf(entry.id),
    ...(entry.specialisation ? { specialisation: entry.specialisation } : {}),
  };
  return base;
}

function flattenSkillEntry(entry) {
  // `anyOf` может содержать как объекты {id, specialisation}, так и голые
  // ссылки на сущности (`dh2/core/skill/commerce`) — без этой ветки slugOf
  // получал undefined и в данные попадал литерал `skillId: 'undefined'`.
  if (typeof entry === 'string') {
    return [{ skillId: slugOf(entry) }];
  }
  if (Array.isArray(entry.anyOf)) {
    return [{ choose: 1, of: entry.anyOf.flatMap(flattenSkillEntry) }];
  }
  if (
    Array.isArray(entry.specialisations) &&
    entry.specialisations.length > 1
  ) {
    return entry.specialisations.map((specialisation) => ({
      ...skillGrant(entry),
      specialisation,
    }));
  }
  return [skillGrant(entry)];
}

function talentGrant(entry) {
  return {
    talentId: slugOf(entry.id),
    ...(entry.specialisation ? { specialisation: entry.specialisation } : {}),
    ...(entry.specialisations
      ? { specialisations: entry.specialisations }
      : {}),
  };
}

function flattenTalentEntry(entry) {
  if (Array.isArray(entry.anyOf)) {
    return [{ choose: 1, of: entry.anyOf.flatMap(flattenTalentEntry) }];
  }
  if (typeof entry === 'string') {
    return [{ talentId: slugOf(entry) }];
  }
  return [talentGrant(entry)];
}

function backgroundBonusKeys(entity, i18n) {
  const props = entity.props ?? {};
  const bonuses = props.bonuses ?? (props.bonus ? [props.bonus] : []);
  return bonuses.map((bonus, index) => {
    const key = `${I18N_PREFIX}background.${slugOf(entity.id)}.bonus.${index}`;
    i18n.en[key] = bonus.en;
    i18n.ru[key] = bonus.ru;
    return key;
  });
}

function ownBonusKey(entity, kind, i18n) {
  const bonus = entity.props?.bonus;
  const key = `${I18N_PREFIX}${kind}.${slugOf(entity.id)}.bonus`;
  i18n.en[key] = bonus.en;
  i18n.ru[key] = bonus.ru;
  return key;
}

function ownLabelKey(entity, kind, i18n) {
  const key = `${I18N_PREFIX}${kind}.${slugOf(entity.id)}`;
  i18n.en[key] = entity.label.en;
  i18n.ru[key] = entity.label.ru;
  return key;
}

function buildData(catalog, rules, i18n) {
  const entities = catalog.entities;
  const ofKind = (kind) => entities.filter((entity) => entity.kind === kind);

  const aptitudes = rules.aptitudes.map((aptitude) => {
    const key = `${I18N_PREFIX}aptitude.${aptitude.id}`;
    i18n.en[key] = aptitude.en;
    i18n.ru[key] = aptitude.ru;
    return { id: aptitude.id, labelKey: key, group: aptitude.group };
  });

  const characteristics = rules.characteristics.map((characteristic) => {
    const key = `${I18N_PREFIX}characteristic.${statId(characteristic.id)}`;
    i18n.en[key] = characteristic.en;
    i18n.ru[key] = characteristic.ru;
    return {
      id: statId(characteristic.id),
      labelKey: key,
      short: characteristic.short,
      purchasable: characteristic.purchasable,
      aptitudeIds: characteristic.aptitudes,
    };
  });

  const homeWorlds = ofKind('origin').map((entity) => {
    const props = entity.props;
    return {
      id: slugOf(entity.id),
      labelKey: ownLabelKey(entity, 'world', i18n),
      characteristicModifiers: {
        plus: (props.characteristicModifiers?.plus ?? []).map(statId),
        minus: (props.characteristicModifiers?.minus ?? []).map(statId),
      },
      fateThreshold: props.fateThreshold,
      emperorsBlessing: props.emperorsBlessing,
      wounds: props.wounds,
      aptitudeId: props.aptitude,
      bonusKey: ownBonusKey(entity, 'world', i18n),
      recommendedBackgroundIds: (props.recommendedBackgrounds ?? []).map(
        slugOf,
      ),
    };
  });

  const backgrounds = ofKind('background').map((entity) => {
    const props = entity.props;
    const traits = props.startingTraits;
    let startingTraits;
    if (traits?.of?.length) {
      startingTraits = {
        ...(traits.choose ? { choose: traits.choose } : {}),
        keys: traits.of.map((trait, index) => {
          const key = `${I18N_PREFIX}background.${slugOf(entity.id)}.trait.${index}`;
          i18n.en[key] = trait.en;
          i18n.ru[key] = trait.ru;
          return key;
        }),
      };
    }
    return {
      id: slugOf(entity.id),
      labelKey: ownLabelKey(entity, 'background', i18n),
      startingSkills: (props.startingSkills ?? []).flatMap(flattenSkillEntry),
      startingTalents: (props.startingTalents ?? []).flatMap(
        flattenTalentEntry,
      ),
      bonusKeys: backgroundBonusKeys(entity, i18n),
      aptitudeChoice: props.aptitudeChoice?.of ?? [],
      recommendedRoleIds: (props.recommendedRoles ?? []).map(slugOf),
      ...(startingTraits ? { startingTraits } : {}),
      ...(typeof props.startingCorruption === 'number'
        ? { startingCorruption: props.startingCorruption }
        : {}),
      ...(typeof props.startingMalignancy === 'number'
        ? { startingMalignancy: props.startingMalignancy }
        : {}),
      ...(props.genderLock
        ? { genderLock: genderLockOf(entity, props.genderLock) }
        : {}),
    };
  });

  const roles = ofKind('role').map((entity) => {
    const props = entity.props;
    const talentSlot = props.talent;
    const talentOf = Array.isArray(talentSlot?.anyOf)
      ? talentSlot.anyOf.map((item) =>
          typeof item === 'string' ? slugOf(item) : slugOf(item.id),
        )
      : [
          typeof talentSlot === 'string'
            ? slugOf(talentSlot)
            : slugOf(talentSlot.id),
        ];
    return {
      id: slugOf(entity.id),
      labelKey: ownLabelKey(entity, 'role', i18n),
      aptitudes: (props.aptitudes ?? []).map(aptitudeSlot),
      talentChoice: { choose: 1, of: talentOf },
      bonusKey: ownBonusKey(entity, 'role', i18n),
    };
  });

  const divinations = ofKind('divination')
    .map((entity) => {
      const props = entity.props;
      const labelKey = ownLabelKey(entity, 'divination', i18n);
      const effectKey = `${labelKey}.effect`;
      i18n.en[effectKey] = props.effectEn;
      i18n.ru[effectKey] = props.effectRu;
      return {
        id: slugOf(entity.id),
        from: props.roll.from,
        to: props.roll.to,
        textKey: labelKey,
        effectKey,
        ...(props.deltas ? { deltas: convertDeltas(props.deltas) } : {}),
        ...(props.deltasElse
          ? { deltasElse: convertDeltas(props.deltasElse) }
          : {}),
        ...(props.choices ? { choices: convertChoices(props.choices) } : {}),
        ...(props.fateThreshold ? { fateThreshold: props.fateThreshold } : {}),
        ...(props.corruptionFirst
          ? { corruptionFirst: props.corruptionFirst }
          : {}),
        ...(props.insanityFirst ? { insanityFirst: props.insanityFirst } : {}),
        ...(props.grants ? { grants: convertGrants(props.grants) } : {}),
      };
    })
    .sort((a, b) => a.from - b.from);

  return {
    aptitudes,
    characteristics,
    homeWorlds,
    backgrounds,
    roles,
    divinations,
  };
}

/**
 * Требования элитного продвижения (с. 86): характеристика с минимумом,
 * бэкграунд, пол и другое элитное. Ссылки проверяются по каталогу — опечатка
 * в id должна ронять генерацию, а не показывать пустое предупреждение.
 * `trait` переносится как есть: черты листа хранятся свободным текстом, и
 * приложение не может проверить их автоматически.
 */
function eliteRequirements(entity, ofKind) {
  const prereq = entity.props?.prereq;
  if (prereq === undefined || prereq === null) return undefined;
  if (!Array.isArray(prereq)) {
    throw new Error(`${entity.id}: prereq должен быть массивом`);
  }
  const backgroundIds = new Set(
    ofKind('background').map((item) => slugOf(item.id)),
  );
  const eliteIds = new Set(
    ofKind('elite-advance').map((item) => slugOf(item.id)),
  );

  return prereq.map((requirement) => {
    if (requirement.characteristic !== undefined) {
      if (typeof requirement.min !== 'number') {
        throw new Error(
          `${entity.id}: у требования "${requirement.characteristic}" нет min`,
        );
      }
      return {
        kind: 'characteristic',
        characteristic: statId(requirement.characteristic),
        min: requirement.min,
      };
    }
    if (requirement.background !== undefined) {
      const id = slugOf(requirement.background);
      if (!backgroundIds.has(id)) {
        throw new Error(
          `${entity.id}: неизвестный бэкграунд ${requirement.background}`,
        );
      }
      return { kind: 'background', backgroundId: id };
    }
    if (requirement.gender !== undefined) {
      if (requirement.gender !== 'female' && requirement.gender !== 'male') {
        throw new Error(
          `${entity.id}: неизвестный пол ${JSON.stringify(requirement.gender)}`,
        );
      }
      return { kind: 'gender', gender: requirement.gender };
    }
    if (requirement.elite !== undefined) {
      const id = slugOf(requirement.elite);
      if (!eliteIds.has(id)) {
        throw new Error(
          `${entity.id}: неизвестное элитное ${requirement.elite}`,
        );
      }
      return { kind: 'elite', eliteId: id };
    }
    if (requirement.notElite !== undefined) {
      const id = slugOf(requirement.notElite);
      if (!eliteIds.has(id)) {
        throw new Error(
          `${entity.id}: неизвестное элитное ${requirement.notElite}`,
        );
      }
      return { kind: 'notElite', eliteId: id };
    }
    if (requirement.trait !== undefined) {
      return { kind: 'trait', traitId: String(requirement.trait) };
    }
    throw new Error(
      `${entity.id}: неизвестное требование ${JSON.stringify(requirement)}`,
    );
  });
}

function buildReference(catalog, i18n) {
  const entities = catalog.entities;
  const ofKind = (kind) => entities.filter((entity) => entity.kind === kind);

  const skills = ofKind('skill').map((entity) => ({
    id: slugOf(entity.id),
    labelKey: ownLabelKey(entity, 'skill', i18n),
    aptitudeIds: entity.props.aptitudes,
    specialist: Boolean(entity.props.specialist),
  }));

  const talents = ofKind('talent').map((entity) => {
    const hint = entity.props.hint;
    let hintKey;
    if (hint?.en && hint?.ru) {
      hintKey = `${I18N_PREFIX}talent.${slugOf(entity.id)}.hint`;
      i18n.en[hintKey] = hint.en;
      i18n.ru[hintKey] = hint.ru;
    }
    return {
      id: slugOf(entity.id),
      labelKey: ownLabelKey(entity, 'talent', i18n),
      tier: entity.props.tier,
      aptitudeSlots: (entity.props.aptitudes ?? []).map(aptitudeSlot),
      ...(hintKey ? { hintKey } : {}),
      ...(entity.props.eliteAdvance
        ? { eliteAdvance: entity.props.eliteAdvance }
        : {}),
    };
  });

  const disciplines = ofKind('psychic-discipline').map((entity) => ({
    id: slugOf(entity.id),
    labelKey: ownLabelKey(entity, 'discipline', i18n),
    powerCount: entity.props.powerCount,
  }));

  const powers = ofKind('psychic-power').map((entity) => ({
    id: slugOf(entity.id),
    labelKey: ownLabelKey(entity, 'power', i18n),
    disciplineId: slugOf(entity.props.disciplineId),
    value: entity.props.value,
  }));

  const elites = ofKind('elite-advance').map((entity) => {
    const labelKey = ownLabelKey(entity, 'elite', i18n);
    const changeKeys = (entity.props.instantChanges ?? []).map(
      (change, index) => {
        const key = `${labelKey}.change.${index}`;
        i18n.en[key] = change.en;
        i18n.ru[key] = change.ru;
        return key;
      },
    );
    const requirements = eliteRequirements(entity, ofKind);
    return {
      id: slugOf(entity.id),
      labelKey,
      cost: entity.props.cost,
      changeKeys,
      ...(entity.props.prereqText
        ? { prereqText: entity.props.prereqText }
        : {}),
      ...(requirements && requirements.length > 0 ? { requirements } : {}),
    };
  });

  return { skills, talents, disciplines, powers, elites };
}

function buildRules(rules, i18n) {
  const statSteps = rules.statSteps.map((step) => {
    const key = `${I18N_PREFIX}stat-step.${step.id}`;
    i18n.en[key] = step.en;
    i18n.ru[key] = step.ru;
    return { id: step.id, order: step.order, labelKey: key, bonus: step.bonus };
  });

  const skillTiers = rules.skillTiers.map((tier) => {
    const key = `${I18N_PREFIX}skill-tier.${tier.id}`;
    i18n.en[key] = tier.en;
    i18n.ru[key] = tier.ru;
    return { id: tier.id, rank: tier.rank, labelKey: key, bonus: tier.bonus };
  });

  const talentTiers = rules.talentTiers.map((tier) => {
    const key = `${I18N_PREFIX}talent-tier.${tier.id}`;
    i18n.en[key] = tier.en;
    i18n.ru[key] = tier.ru;
    return { id: tier.id, labelKey: key };
  });

  const costTables = {
    characteristic: rules.xpCostTables.characteristic.rows,
    skill: rules.xpCostTables.skill.rows,
    talent: rules.xpCostTables.talent.rows,
  };

  const equipment = rules.equipment ?? {};
  const availabilityModifiers = (equipment.availabilityModifiers ?? []).map(
    (item) => {
      const key = `${I18N_PREFIX}availability.${item.id}`;
      i18n.en[key] = item.en;
      i18n.ru[key] = item.ru;
      return {
        id: item.id,
        labelKey: key,
        modifier: item.modifier ?? null,
        automatic: item.automatic === true,
      };
    },
  );
  const craftsmanshipModifiers = (equipment.craftsmanshipModifiers ?? []).map(
    (item) => {
      const key = `${I18N_PREFIX}craftsmanship.${item.id}`;
      i18n.en[key] = item.en;
      i18n.ru[key] = item.ru;
      return { id: item.id, labelKey: key, modifier: item.modifier };
    },
  );

  return {
    statSteps,
    skillTiers,
    talentTiers,
    costTables,
    startingXp: rules.startingXp,
    eliteCosts: rules.eliteAdvances.costs,
    psyRatingMultiplier: 200,
    availabilityModifiers,
    craftsmanshipModifiers,
  };
}

function mergeI18n(existing, generated) {
  const kept = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !key.startsWith(I18N_PREFIX)),
  );
  const additions = Object.fromEntries(
    Object.entries(generated).sort(([a], [b]) => a.localeCompare(b)),
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
  const rulesPath = join(CONTENT_DIR, 'rules.json');
  for (const path of [catalogPath, rulesPath]) {
    if (!existsSync(path)) {
      console.error(`нет файла каталога: ${path}`);
      console.error(
        'укажите DCS_CONTENT_DIR на каталог с catalog.json/rules.json',
      );
      process.exit(2);
    }
  }

  const catalog = readJson(catalogPath);
  const rules = readJson(rulesPath);
  const i18n = { en: {}, ru: {} };

  const data = buildData(catalog, rules, i18n);
  const reference = buildReference(catalog, i18n);
  const rulesData = buildRules(rules, i18n);

  const dataFile = join(MODULE_DIR, 'dh2e-data.ts');
  const referenceFile = join(MODULE_DIR, 'dh2e-reference.ts');
  const rulesFile = join(MODULE_DIR, 'dh2e-rules.ts');

  const dataSource = `${HEADER}
import type {
  Dh2eAptitude,
  Dh2eBackground,
  Dh2eCharacteristic,
  Dh2eDivination,
  Dh2eHomeWorld,
  Dh2eRole,
} from './dh2e-types';

export const DH2E_APTITUDES: readonly Dh2eAptitude[] = ${JSON.stringify(
    data.aptitudes,
    null,
    2,
  )};

export const DH2E_CHARACTERISTICS: readonly Dh2eCharacteristic[] = ${JSON.stringify(
    data.characteristics,
    null,
    2,
  )};

export const DH2E_HOMEWORLDS: readonly Dh2eHomeWorld[] = ${JSON.stringify(
    data.homeWorlds,
    null,
    2,
  )};

export const DH2E_BACKGROUNDS: readonly Dh2eBackground[] = ${JSON.stringify(
    data.backgrounds,
    null,
    2,
  )};

export const DH2E_ROLES: readonly Dh2eRole[] = ${JSON.stringify(
    data.roles,
    null,
    2,
  )};

export const DH2E_DIVINATIONS: readonly Dh2eDivination[] = ${JSON.stringify(
    data.divinations,
    null,
    2,
  )};
`;

  const referenceSource = `${HEADER}
import type {
  Dh2eDiscipline,
  Dh2eEliteAdvance,
  Dh2ePower,
  Dh2eSkill,
  Dh2eTalent,
} from './dh2e-types';

export const DH2E_SKILLS: readonly Dh2eSkill[] = ${JSON.stringify(
    reference.skills,
    null,
    2,
  )};

export const DH2E_TALENTS: readonly Dh2eTalent[] = ${JSON.stringify(
    reference.talents,
    null,
    2,
  )};

export const DH2E_DISCIPLINES: readonly Dh2eDiscipline[] = ${JSON.stringify(
    reference.disciplines,
    null,
    2,
  )};

export const DH2E_POWERS: readonly Dh2ePower[] = ${JSON.stringify(
    reference.powers,
    null,
    2,
  )};

export const DH2E_ELITES: readonly Dh2eEliteAdvance[] = ${JSON.stringify(
    reference.elites,
    null,
    2,
  )};
`;

  const rulesSource = `${HEADER}
import type {
  Dh2eAvailabilityModifier,
  Dh2eCostRow,
  Dh2eCraftsmanshipModifier,
  Dh2eSkillTier,
  Dh2eStatStep,
  Dh2eTalentTier,
} from './dh2e-types';

export const DH2E_STAT_STEPS: readonly Dh2eStatStep[] = ${JSON.stringify(
    rulesData.statSteps,
    null,
    2,
  )};

export const DH2E_SKILL_TIERS: readonly Dh2eSkillTier[] = ${JSON.stringify(
    rulesData.skillTiers,
    null,
    2,
  )};

export const DH2E_TALENT_TIERS: readonly Dh2eTalentTier[] = ${JSON.stringify(
    rulesData.talentTiers,
    null,
    2,
  )};

/**
 * Таблицы 2-2 (характеристики), 2-4 (навыки), 2-6 (таланты).
 * Строка — число совпавших аптитюд, колонки — ступени/ранги/уровни.
 */
export const DH2E_XP_COST_TABLES: Readonly<{
  characteristic: Dh2eCostRow;
  skill: Dh2eCostRow;
  talent: Dh2eCostRow;
}> = ${JSON.stringify(rulesData.costTables, null, 2)};

export const DH2E_STARTING_XP = ${rulesData.startingXp};

export const DH2E_ELITE_COSTS: Readonly<Record<string, number>> = ${JSON.stringify(
    rulesData.eliteCosts,
    null,
    2,
  )};

/** Стоимость повышения пси-рейтинга: 200 × новый рейтинг (с. 90). */
export const DH2E_PSY_RATING_MULTIPLIER = ${rulesData.psyRatingMultiplier};

/** Таблица 5-1: ступени доступности и модификатор Реквизиции. */
export const DH2E_AVAILABILITY: readonly Dh2eAvailabilityModifier[] = ${JSON.stringify(
    rulesData.availabilityModifiers,
    null,
    2,
  )};

/** Таблица 5-2: качество предмета и модификатор Реквизиции/ремонта. */
export const DH2E_CRAFTSMANSHIP: readonly Dh2eCraftsmanshipModifier[] = ${JSON.stringify(
    rulesData.craftsmanshipModifiers,
    null,
    2,
  )};
`;

  const enPath = join(MODULE_DIR, 'i18n/en.json');
  const ruPath = join(MODULE_DIR, 'i18n/ru.json');
  const enSource = JSON.stringify(
    mergeI18n(readJson(enPath), i18n.en),
    null,
    2,
  );
  const ruSource = JSON.stringify(
    mergeI18n(readJson(ruPath), i18n.ru),
    null,
    2,
  );

  const changed = [
    [dataFile, dataSource],
    [referenceFile, referenceSource],
    [rulesFile, rulesSource],
    [enPath, `${enSource}\n`],
    [ruPath, `${ruSource}\n`],
  ];
  let dirty = 0;
  for (const [path, source] of changed) {
    if (await emit(path, source)) dirty += 1;
  }

  const counts = [
    `миров ${data.homeWorlds.length}`,
    `бэкграундов ${data.backgrounds.length}`,
    `ролей ${data.roles.length}`,
    `аптитюд ${data.aptitudes.length}`,
    `пророчеств ${data.divinations.length}`,
    `навыков ${reference.skills.length}`,
    `талантов ${reference.talents.length}`,
    `сил ${reference.powers.length}`,
    `элитных ${reference.elites.length}`,
  ].join(', ');

  if (CHECK) {
    if (dirty > 0) {
      console.error(
        `dh2e: данные устарели (${dirty} файлов). Запустите node src/games/dh2/scripts/generate.mjs`,
      );
      process.exit(1);
    }
    console.log(`dh2e: ok (${counts})`);
    return;
  }

  console.log(`dh2e: записано ${dirty} файлов (${counts})`);
}

await main();
