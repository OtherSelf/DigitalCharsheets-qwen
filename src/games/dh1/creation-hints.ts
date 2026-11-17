import {
  CAREER_KEYS,
  fateRangeFromText,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  VARIANT_KEYS,
  WORLD_FEATURES,
  WORLD_STARTING_PROFILE,
  woundsRangeFromFormula,
} from './dark-heresy-data';
import { divinationEffectKey, divinationKey } from './divination-i18n';
import { STARTING_PACKAGES } from './starting-packages';

type Translate = (key: string) => string;

/** Порядок характеристик в подсказке стартового профиля (Таблица 1-3). */
const PROFILE_STATS = [
  'weaponSkill',
  'ballisticSkill',
  'strength',
  'toughness',
  'agility',
  'intelligence',
  'perception',
  'willpower',
  'fellowship',
] as const;

/**
 * ─── LANDMARK: DH1 CREATION HINTS ─────────────────────────────────────────
 * Markdown-памятка из выбранного на создании пакета: мир и его особенности,
 * стартовый профиль, диапазоны Ран/Судьбы, стартовый пакет карьеры,
 * пророчество и причуда. Строки идут в `notes` листа, игрок переносит их
 * вручную (D11); новых полей персонажа не появляется.
 */
export interface Dh1CreationHintsInput {
  readonly homeWorld: string;
  readonly worldVariant?: string;
  readonly careerPath: string;
  readonly divination?: string;
  readonly quirk?: string;
  readonly wounds?: number;
  readonly fatePoints?: number;
}

export function dh1CreationHintsMarkdown(
  input: Dh1CreationHintsInput,
  t: Translate,
): string {
  const lines: string[] = [
    `# ${t('dh1.creationHintsTitle')}`,
    '',
    t('dh1.creationHintsIntro'),
    '',
  ];

  const worldKey = HOME_WORLD_KEYS[input.homeWorld];
  if (worldKey) {
    lines.push(`## ${t('dh1.homeWorld')}: ${t(worldKey)}`);
    const variant = input.worldVariant
      ? VARIANT_KEYS[input.worldVariant]
      : undefined;
    if (variant && input.worldVariant) {
      lines.push(`- ${t('dh1.worldVariant')}: ${t(variant)}`);
    }
    const features = WORLD_FEATURES[input.homeWorld] ?? [];
    if (features.length > 0) {
      lines.push(`- ${t('dh1.worldFeatures')}:`);
      for (const feature of features) {
        lines.push(`  - ${t(feature.labelKey)} — ${t(feature.effectKey)}`);
      }
    }
    const profile = WORLD_STARTING_PROFILE[input.homeWorld];
    if (profile) {
      lines.push(`- ${t('dh1.startingProfile')}:`);
      lines.push(
        `  - ${PROFILE_STATS.map(
          (stat) => `${t(`dh1.${stat}Abbr`)} ${profile.characteristics[stat]}`,
        ).join(' · ')}`,
      );
      const wounds = woundsRangeFromFormula(profile.wounds);
      const fate = fateRangeFromText(profile.fate);
      lines.push(
        `- ${t('dh1.startingWounds')}: ${profile.wounds}${
          wounds ? ` → ${wounds.min}–${wounds.max}` : ''
        }${input.wounds !== undefined ? ` (${input.wounds})` : ''}`,
      );
      lines.push(
        `- ${t('dh1.fate')}: ${profile.fate}${
          fate ? ` → ${fate.min}–${fate.max}` : ''
        }${input.fatePoints !== undefined ? ` (${input.fatePoints})` : ''}`,
      );
    }
    lines.push('');
  }

  const careerKey = CAREER_KEYS[input.careerPath];
  if (careerKey) {
    lines.push(`## ${t('dh1.careerPath')}: ${t(careerKey)}`);
    const pack = STARTING_PACKAGES[input.careerPath];
    if (pack) {
      const groups: [keyof typeof pack, string][] = [
        ['skills', 'dh1.startingSkills'],
        ['talents', 'dh1.startingTalents'],
        ['gear', 'dh1.startingGear'],
        ['traits', 'dh1.startingTraits'],
      ];
      for (const [field, labelKey] of groups) {
        const items = pack[field];
        if (!items || items.length === 0) continue;
        lines.push(`- ${t(labelKey)}:`);
        for (const group of items) {
          lines.push(`  - ${group.map((key) => t(key)).join(' / ')}`);
        }
      }
    }
    lines.push('');
  }

  if (input.divination) {
    lines.push(
      `## ${t('dh1.divination')}`,
      '',
      `${t(divinationKey(input.divination, 'dh1'))}: ${t(
        divinationEffectKey(input.divination, 'dh1'),
      )}`,
      '',
    );
  }

  const quirkKey = input.quirk ? QUIRK_KEYS[input.quirk] : undefined;
  if (input.quirk && quirkKey) {
    lines.push(`## ${t('dh1.quirk')}`, '', t(quirkKey));
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
