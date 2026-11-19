import type { GameHistoryConfig } from '../types';
import {
  aptitudeLabel,
  aptitudeLabels,
  backgroundLabel,
  divinationLabel,
  eliteAdvanceLabel,
  homeWorldLabel,
  roleLabel,
  skillLabel,
  talentLabel,
} from './dh2e-labels';
import { genderLabel } from './gender';

type Translate = (key: string) => string;

function conditionLabel(
  prefix: 'dh1' | 'dh2',
  field: 'kind' | 'source',
  value: string,
  t: Translate,
): string | undefined {
  if (!value) return undefined;
  const key = `${prefix}.conditions.${field}.${value}`;
  const text = t(key);
  return text === key ? value : text;
}

function armorEnumLabel(
  path: string,
  value: unknown,
  t: Translate,
): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const prefix = /^equipment\.armor\.[^.]+\.type$/.test(path)
    ? 'dh2.armorType'
    : /^equipment\.armor\.[^.]+\.quality$/.test(path)
      ? 'dh2.armorQuality'
      : undefined;
  if (!prefix) return undefined;
  const suffix = prefix === 'dh2.armorQuality' ? value.replace('-', '') : value;
  const key = `${prefix}${suffix}`;
  const text = t(key);
  return text === key ? value : text;
}

function trainingLabel(value: unknown, t: Translate): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  if (record.skilled) parts.push(t('dh2.skilled'));
  if (record.plus10) parts.push('+10');
  if (record.plus20) parts.push('+20');
  if (record.plus30) parts.push('+30');
  return parts.length > 0 ? parts.join(', ') : '—';
}

function statAdvanceLabel(value: unknown, t: Translate): string | undefined {
  if (Array.isArray(value)) {
    return `${value.filter(Boolean).length}/${value.length}`;
  }
  if (typeof value === 'boolean') {
    return t(value ? 'dh2.historyYes' : 'dh2.historyNo');
  }
  return undefined;
}

function labelList(
  values: unknown,
  label: (id: string, t: Translate) => string,
  t: Translate,
): string | undefined {
  if (!Array.isArray(values)) return undefined;
  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => label(item, t))
    .join(', ');
}

/**
 * Подписи полей Dark Heresy 2-й редакции для экрана истории.
 *
 * История хранит диффы вложенных структур генерации 2e: без точных путей
 * (`aptitudes.profile`, `psy.rating`) и сегментных подписей (`ap`, `damage`,
 * `gender`) экран показывал английские пути вместо названий полей.
 */
export const dh2History: GameHistoryConfig = {
  labels: {
    name: 'common.name',
    characterClass: 'common.class',
    homeWorld: 'dh2.homeWorld',
    background: 'dh2.background',
    role: 'dh2.role',
    divination: 'dh2.divination',
    aptitudes: 'dh2.aptitudes',
    'aptitudes.profile': 'dh2.aptitudes',
    'aptitudes.chosen': 'dh2.aptitudes',
    'aptitudes.extra': 'dh2.aptitudes',
    startingChoices: 'dh2.startingChoices',
    'startingChoices.roleTalent': 'dh2.roleTalent',
    'startingChoices.skills': 'dh2.startingSkillsChosen',
    'startingChoices.talents': 'dh2.startingTalentsChosen',
    eliteAdvances: 'dh2.eliteAdvances',
    psy: 'dh2.psy',
    'psy.rating': 'dh2.psyRating',
    'psy.disciplines': 'dh2.psyDisciplines',
    'psy.powers': 'dh2.psyPowers',
    experience: 'dh2.experience',
    totalExpSpent: 'dh2.totalExpSpent',
    experienceLog: 'dh2.experienceLog',
    wounds: 'dh2.wounds',
    fatePoints: 'dh2.fate',
    insanityPoints: 'dh2.insanity',
    corruptionPoints: 'dh2.corruption',
    wealth: 'dh2.wealth',
    equipment: 'dh2.equipment',
    'equipment.armor': 'dh2.equipment.armor',
    'equipment.weapons': 'dh2.equipment.weapons',
    statUpgrades: 'dh2.statUpgrades',
    statNotes: 'dh2.statNotes',
    inventory: 'common.inventory',
    'inventory.name': 'common.name',
    'inventory.notes': 'common.notes',
    'inventory.quantity': 'common.quantity',
    skills: 'dh2.skills',
    'skills.notes': 'common.notes',
    talents: 'dh2.talentsAndTraits',
    'talents.notes': 'common.notes',
    'talents.description': 'common.description',
    fatigue1st: 'dh2.fatigueFirstEdition',
    fatigue2nd: 'dh2.fatigue',
    height: 'common.height',
    weight: 'common.weight',
    age: 'common.age',
    skinColor: 'dh2.skinColor',
    hairColor: 'dh2.hairColor',
    eyeColor: 'dh2.eyeColor',
    movement: 'common.movement',
    current: 'common.current',
    max: 'common.max',
    total: 'common.total',
    walkHalf: 'dh2.halfMove',
    walkFull: 'dh2.moveFull',
    charge: 'dh2.charge',
    run: 'dh2.run',
    'movement.walkHalf': 'dh2.halfMove',
    'movement.walkFull': 'dh2.moveFull',
    'movement.charge': 'dh2.charge',
    'movement.run': 'dh2.run',
    throneGelt: 'dh2.throneGelt',
    monthlyIncome: 'dh2.monthlyIncome',
    // Сегменты характеристик для `statUpgrades` и `statNotes`.
    weaponSkill: 'dh2.weaponSkill',
    ballisticSkill: 'dh2.ballisticSkill',
    strength: 'dh2.strength',
    toughness: 'dh2.toughness',
    agility: 'dh2.agility',
    intelligence: 'dh2.intelligence',
    perception: 'dh2.perception',
    willpower: 'dh2.willpower',
    fellowship: 'dh2.fellowship',
    influence: 'dh2.influence',
    // Части брони и поля оружия.
    Head: 'dh2.armorHead',
    'Right arm': 'dh2.armorRightArm',
    'Left arm': 'dh2.armorLeftArm',
    Body: 'dh2.armorBody',
    'Right leg': 'dh2.armorRightLeg',
    'Left leg': 'dh2.armorLeftLeg',
    'equipment.weapons.melee.traits': 'dh2.weaponTraits',
    'equipment.weapons.ranged.traits': 'dh2.weaponTraits',
    criticalConditions: 'dh2.criticalConditions',
    'skills.training': 'dh2.historyTraining',
    // Общие поля журнала заданий.
    title: 'common.name',
    status: 'dh2.historyStatus',
    priority: 'dh2.historyPriority',
    objectives: 'common.questObjectives',
    rewards: 'common.questRewards',
    npcs: 'common.questNpcs',
    locations: 'common.questLocations',
    questLog: 'common.questJournal',
    notes: 'common.notes',
    backstory: 'common.backstory',
    'stats.weaponSkill': 'dh2.weaponSkill',
    'stats.ballisticSkill': 'dh2.ballisticSkill',
    'stats.strength': 'dh2.strength',
    'stats.intelligence': 'dh2.intelligence',
    'stats.perception': 'dh2.perception',
    'stats.willpower': 'dh2.willpower',
    'stats.toughness': 'dh2.toughness',
    'stats.agility': 'dh2.agility',
    'stats.fellowship': 'dh2.fellowship',
    'stats.influence': 'dh2.influence',
    customResources: 'common.statsTab',
    // сегменты вложенных структур (элементы брони и оружия)
    ap: 'dh2.armorAp',
    type: 'dh2.armorType',
    mods: 'dh2.armorMods',
    quality: 'dh2.armorQuality',
    range: 'dh2.weaponRange',
    damage: 'dh2.weaponDamage',
    penetration: 'dh2.weaponPenetration',
    rof: 'dh2.weaponRof',
    clip: 'dh2.weaponClip',
    clipSize: 'dh2.weaponClipSize',
    reload: 'dh2.weaponReload',
    equipped: 'dh2.equipped',
    gender: 'dh2.gender',
    'conditions.name': 'dh2.conditions.name',
    'conditions.kind': 'dh2.conditions.kind',
    'conditions.severity': 'dh2.conditions.severity',
    'conditions.effect': 'dh2.conditions.effect',
    'conditions.notes': 'dh2.conditions.notes',
    'conditions.source': 'dh2.conditions.source',
  },
  collections: {
    criticalConditions: 'dh2.criticalConditions',
    'equipment.weapons.melee': 'dh2.meleeWeapons',
    'equipment.weapons.ranged': 'dh2.rangedWeapons',
    inventory: 'common.inventory',
    skills: 'dh2.skills',
    talents: 'dh2.talentsAndTraits',
    eliteAdvances: 'dh2.eliteAdvances',
    experienceLog: 'dh2.experienceLog',
    questLog: 'common.questJournal',
    customResources: 'common.statsTab',
    conditions: 'dh2.conditions.title',
  },
  valueLabels: {
    // Пол в данных — код; игрок должен видеть подпись, а не `female`.
    gender: {
      male: 'dh2.genderMale',
      female: 'dh2.genderFemale',
      unspecified: 'dh2.genderUnspecified',
    },
  },
  itemLabelFields: ['name', 'title', 'description'],
  tokens: {
    yes: 'dh2.historyYes',
    no: 'dh2.historyNo',
    itemStatus: {
      default: 'dh2.itemStatusDefault',
      lost: 'dh2.itemStatusLost',
    },
    // Общие подписи журнала заданий ядра (разрешённый allowlist).
    questStatus: {
      active: 'common.questActive',
      completed: 'common.questDone',
    },
    questPriority: {
      main: 'common.mainQuest',
      side: 'common.sideQuest',
      personal: 'common.personalQuest',
    },
  },
  formatValue(path, value, t) {
    if (typeof value === 'string') {
      switch (path) {
        case 'homeWorld':
          return homeWorldLabel(value, t);
        case 'background':
          return backgroundLabel(value, t);
        case 'role':
          return roleLabel(value, t);
        case 'divination':
          return divinationLabel(value, t);
        case 'gender':
          return genderLabel(value, t) || undefined;
        case 'startingChoices.roleTalent':
          return talentLabel(value, t);
        case 'aptitudes.profile':
        case 'aptitudes.extra':
          return aptitudeLabel(value, t);
        case 'eliteAdvances':
          return eliteAdvanceLabel(value, t);
        case 'startingChoices.skills':
          return skillLabel(value, t);
        case 'startingChoices.talents':
          return talentLabel(value, t);
        case 'conditions.kind':
          return conditionLabel('dh2', 'kind', value, t);
        case 'conditions.source':
          return conditionLabel('dh2', 'source', value, t);
        case 'experienceLog.kind': {
          const key = `dh2.experienceKind.${value}`;
          const text = t(key);
          return text === key ? value : text;
        }
        default:
          break;
      }
      if (path.startsWith('aptitudes.chosen.')) {
        return aptitudeLabel(value, t);
      }
      return armorEnumLabel(path, value, t);
    }
    if (path === 'aptitudes.profile' || path === 'aptitudes.extra') {
      return labelList(value, aptitudeLabel, t);
    }
    if (path === 'aptitudes.chosen') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
      }
      const labels = Object.values(value as Record<string, unknown>)
        .filter((item): item is string => typeof item === 'string')
        .map((id) => aptitudeLabel(id, t));
      return labels.length > 0 ? labels.join(', ') : '—';
    }
    if (path === 'eliteAdvances') {
      return labelList(value, eliteAdvanceLabel, t);
    }
    if (path === 'startingChoices.skills') {
      return labelList(value, skillLabel, t);
    }
    if (path === 'startingChoices.talents') {
      return labelList(value, talentLabel, t);
    }
    if (path === 'skills.training') return trainingLabel(value, t);
    if (path.startsWith('statUpgrades.')) return statAdvanceLabel(value, t);
    return undefined;
  },
};
