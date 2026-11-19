import type { GameHistoryConfig } from '../types';
import {
  CAREER_KEYS,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  RANK_KEYS,
  VARIANT_KEYS,
} from './dark-heresy-data';
import { divinationEffectLabel, divinationLabel } from './divination-i18n';
import { genderLabel } from './gender';

type Translate = (key: string) => string;

function mappedLabel(
  map: Readonly<Record<string, string>>,
  value: unknown,
  t: Translate,
): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const key = map[value];
  return key ? t(key) : undefined;
}

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
    ? 'dh1.armorType'
    : /^equipment\.armor\.[^.]+\.quality$/.test(path)
      ? 'dh1.armorQuality'
      : undefined;
  if (!prefix) return undefined;
  const suffix = prefix === 'dh1.armorQuality' ? value.replace('-', '') : value;
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
  if (record.skilled) parts.push(t('dh1.skilled'));
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
    return t(value ? 'dh1.historyYes' : 'dh1.historyNo');
  }
  return undefined;
}

/**
 * Подписи полей Dark Heresy 1-й редакции для экрана истории.
 *
 * Точные пути (`identity.gender`, `psy.rating`) и подписи сегментов (`gender`,
 * `ap`, `damage`) нужны потому, что история хранит диффы вложенных структур:
 * без них строки показывали «identity · gender» вместо русского названия.
 * Сегментные ключи (`gender`, `type`, `ap`, …) подхватываются резолвером для
 * полей элементов коллекций.
 */
export const dh1History: GameHistoryConfig = {
  labels: {
    name: 'common.name',
    characterClass: 'common.class',
    careerPath: 'dh1.careerPath',
    homeWorld: 'dh1.homeWorld',
    worldVariant: 'dh1.worldVariant',
    rank: 'dh1.rank',
    divination: 'dh1.divination',
    divinationEffect: 'dh1.divinationEffect',
    quirk: 'dh1.quirk',
    experience: 'dh1.experience',
    experienceLog: 'dh1.experienceLog',
    totalExpSpent: 'dh1.totalExpSpent',
    alternatePath: 'dh1.alternatePath',
    advancedPath: 'dh1.advancedPath',
    wounds: 'dh1.wounds',
    fatePoints: 'dh1.fatePoints',
    insanityPoints: 'dh1.insanity',
    corruptionPoints: 'dh1.corruption',
    wealth: 'dh1.wealth',
    equipment: 'dh1.equipment',
    'equipment.armorWeight': 'dh1.armourWeight',
    'equipment.armor': 'dh1.equipment.armor',
    'equipment.weapons': 'dh1.equipment.weapons',
    'equipment.weapons.melee.traits': 'dh1.weaponTraits',
    'equipment.weapons.ranged.traits': 'dh1.weaponTraits',
    identity: 'dh1.identity',
    'identity.gender': 'dh1.gender',
    'identity.build': 'dh1.build',
    'identity.handedness': 'dh1.handedness',
    height: 'common.height',
    weight: 'common.weight',
    age: 'common.age',
    skinColor: 'dh1.skinColor',
    hairColor: 'dh1.hairColor',
    eyeColor: 'dh1.eyeColor',
    carry: 'dh1.carrySection',
    'carry.totalCarriedWeight': 'dh1.totalCarriedWeight',
    'carry.carry': 'dh1.carry',
    'carry.lift': 'dh1.lift',
    'carry.push': 'dh1.push',
    traits: 'dh1.traits',
    mutations: 'dh1.mutations',
    eliteAdvances: 'dh1.eliteAdvances',
    psy: 'dh1.psySection',
    'psy.rating': 'dh1.psyRating',
    'psy.discipline': 'dh1.discipline',
    'psy.powers': 'dh1.psychicPowers',
    'psy.testedAgainst': 'dh1.testedAgainst',
    insanityDetails: 'dh1.insanity',
    'insanityDetails.degree': 'dh1.insanityDegree',
    'insanityDetails.traumaModifier': 'dh1.traumaModifier',
    'insanityDetails.disorders': 'dh1.disorders',
    'insanityDetails.severity': 'dh1.severity',
    corruptionDetails: 'dh1.corruption',
    'corruptionDetails.degree': 'dh1.corruptionDegree',
    'corruptionDetails.test': 'dh1.corruptionTest',
    'corruptionDetails.defilements': 'dh1.defilements',
    statUpgrades: 'dh1.statUpgrades',
    statNotes: 'dh1.statNotes',
    inventory: 'common.inventory',
    'inventory.name': 'common.name',
    'inventory.notes': 'common.notes',
    'inventory.quantity': 'common.quantity',
    skills: 'common.skills',
    'skills.notes': 'common.notes',
    talents: 'dh1.talentsAndTraits',
    'talents.notes': 'common.notes',
    'talents.description': 'common.description',
    'skills.training': 'dh1.historyTraining',
    fatigue1st: 'dh1.fatigue',
    fatigue2nd: 'dh1.fatigueSecondEdition',
    criticalConditions: 'dh1.criticalConditions',
    movement: 'common.movement',
    current: 'common.current',
    max: 'common.max',
    total: 'common.total',
    walkHalf: 'dh1.halfMove',
    walkFull: 'dh1.moveFull',
    charge: 'dh1.charge',
    run: 'dh1.run',
    'movement.walkHalf': 'dh1.halfMove',
    'movement.walkFull': 'dh1.moveFull',
    'movement.charge': 'dh1.charge',
    'movement.run': 'dh1.run',
    throneGelt: 'dh1.throneGelt',
    monthlyIncome: 'dh1.monthlyIncome',
    // Сегменты характеристик для `statUpgrades` и `statNotes`.
    weaponSkill: 'dh1.weaponSkill',
    ballisticSkill: 'dh1.ballisticSkill',
    strength: 'dh1.strength',
    toughness: 'dh1.toughness',
    agility: 'dh1.agility',
    intelligence: 'dh1.intelligence',
    perception: 'dh1.perception',
    willpower: 'dh1.willpower',
    fellowship: 'dh1.fellowship',
    // Части брони, по которым история пишет `equipment.armor.<part>.ap`.
    Head: 'dh1.armorHead',
    'Right arm': 'dh1.armorRightArm',
    'Left arm': 'dh1.armorLeftArm',
    Body: 'dh1.armorBody',
    'Right leg': 'dh1.armorRightLeg',
    'Left leg': 'dh1.armorLeftLeg',
    // Общие поля журнала заданий.
    title: 'common.name',
    status: 'dh1.historyStatus',
    priority: 'dh1.historyPriority',
    objectives: 'common.questObjectives',
    rewards: 'common.questRewards',
    npcs: 'common.questNpcs',
    locations: 'common.questLocations',
    questLog: 'common.questJournal',
    notes: 'common.notes',
    backstory: 'common.backstory',
    'stats.weaponSkill': 'dh1.weaponSkill',
    'stats.ballisticSkill': 'dh1.ballisticSkill',
    'stats.strength': 'dh1.strength',
    'stats.intelligence': 'dh1.intelligence',
    'stats.perception': 'dh1.perception',
    'stats.willpower': 'dh1.willpower',
    'stats.toughness': 'dh1.toughness',
    'stats.agility': 'dh1.agility',
    'stats.fellowship': 'dh1.fellowship',
    customResources: 'common.statsTab',
    // сегменты вложенных структур (элементы брони и оружия)
    ap: 'dh1.armorAp',
    type: 'dh1.armorType',
    mods: 'dh1.armorMods',
    quality: 'dh1.armorQuality',
    range: 'dh1.weaponRange',
    damage: 'dh1.weaponDamage',
    penetration: 'dh1.weaponPenetration',
    rof: 'dh1.weaponRof',
    clip: 'dh1.weaponClip',
    clipSize: 'dh1.weaponClipSize',
    reload: 'dh1.weaponReload',
    equipped: 'dh1.equipped',
    'conditions.name': 'dh1.conditions.name',
    'conditions.kind': 'dh1.conditions.kind',
    'conditions.severity': 'dh1.conditions.severity',
    'conditions.effect': 'dh1.conditions.effect',
    'conditions.notes': 'dh1.conditions.notes',
    'conditions.source': 'dh1.conditions.source',
  },
  collections: {
    criticalConditions: 'dh1.criticalConditions',
    'equipment.weapons.melee': 'dh1.meleeWeapons',
    'equipment.weapons.ranged': 'dh1.rangedWeapons',
    inventory: 'common.inventory',
    skills: 'common.skills',
    talents: 'dh1.talentsAndTraits',
    traits: 'dh1.traits',
    mutations: 'dh1.mutations',
    eliteAdvances: 'dh1.eliteAdvances',
    questLog: 'common.questJournal',
    customResources: 'common.statsTab',
    experienceLog: 'dh1.experienceLog',
    conditions: 'dh1.conditions.title',
  },
  valueLabels: {
    // Пол в данных — код (D3); игрок должен видеть подпись, а не `female`.
    'identity.gender': {
      male: 'dh1.genderMale',
      female: 'dh1.genderFemale',
      unspecified: 'dh1.genderUnspecified',
    },
  },
  itemLabelFields: ['name', 'title', 'description'],
  tokens: {
    yes: 'dh1.historyYes',
    no: 'dh1.historyNo',
    itemStatus: {
      default: 'dh1.itemStatusDefault',
      lost: 'dh1.itemStatusLost',
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
          return mappedLabel(HOME_WORLD_KEYS, value, t);
        case 'worldVariant':
          return mappedLabel(VARIANT_KEYS, value, t);
        case 'careerPath':
        case 'characterClass':
          return mappedLabel(CAREER_KEYS, value, t);
        case 'rank':
        case 'advancedPath':
        case 'alternatePath':
          return mappedLabel(RANK_KEYS, value, t);
        case 'quirk':
          return mappedLabel(QUIRK_KEYS, value, t);
        case 'divination':
          return divinationLabel(value, t, 'dh1') || undefined;
        case 'divinationEffect':
          return divinationEffectLabel(value, t, 'dh1') || undefined;
        case 'identity.gender':
          return genderLabel(value, t) || undefined;
        case 'conditions.kind':
          return conditionLabel('dh1', 'kind', value, t);
        case 'conditions.source':
          return conditionLabel('dh1', 'source', value, t);
        case 'experienceLog.kind':
          return value === 'award' ? t('dh1.experienceAward') : undefined;
        default:
          break;
      }
      return armorEnumLabel(path, value, t);
    }
    if (path === 'skills.training') return trainingLabel(value, t);
    if (path.startsWith('statUpgrades.')) return statAdvanceLabel(value, t);
    return undefined;
  },
};
