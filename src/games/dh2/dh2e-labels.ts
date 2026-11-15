/**
 * ─── LANDMARK: DH2E LABELS ─────────────────────────────────────────────────
 * Подписи данных 2e: id → i18n-ключ → `t`. Отдельный файл, чтобы экран листа,
 * карточка, экспорт в Excel и история показывали одно и то же и не тянули
 * друг друга.
 */

import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from './dh2e-data';
import { DH2E_ELITES, DH2E_SKILLS, DH2E_TALENTS } from './dh2e-reference';

type Translate = (key: string) => string;

const APTITUDE_KEYS = new Map(
  DH2E_APTITUDES.map((item) => [item.id, item.labelKey]),
);
const HOME_WORLD_KEYS = new Map(
  DH2E_HOMEWORLDS.map((item) => [item.id, item.labelKey]),
);
const BACKGROUND_KEYS = new Map(
  DH2E_BACKGROUNDS.map((item) => [item.id, item.labelKey]),
);
const ROLE_KEYS = new Map(DH2E_ROLES.map((item) => [item.id, item.labelKey]));
const DIVINATION_KEYS = new Map(
  DH2E_DIVINATIONS.map((item) => [item.id, item.textKey]),
);
const DIVINATION_EFFECT_KEYS = new Map(
  DH2E_DIVINATIONS.map((item) => [item.id, item.effectKey]),
);
const ELITE_KEYS = new Map(DH2E_ELITES.map((item) => [item.id, item.labelKey]));
const SKILL_KEYS = new Map(DH2E_SKILLS.map((item) => [item.id, item.labelKey]));
const TALENT_KEYS = new Map(
  DH2E_TALENTS.map((item) => [item.id, item.labelKey]),
);

function label(
  keys: ReadonlyMap<string, string>,
  id: string,
  t: Translate,
): string {
  const key = keys.get(id);
  return key ? t(key) : id;
}

export function homeWorldLabel(id: string, t: Translate): string {
  return label(HOME_WORLD_KEYS, id, t);
}

export function backgroundLabel(id: string, t: Translate): string {
  return label(BACKGROUND_KEYS, id, t);
}

export function roleLabel(id: string, t: Translate): string {
  return label(ROLE_KEYS, id, t);
}

export function aptitudeLabel(id: string, t: Translate): string {
  return label(APTITUDE_KEYS, id, t);
}

export function aptitudeLabels(ids: readonly string[], t: Translate): string {
  return ids.map((id) => aptitudeLabel(id, t)).join(', ');
}

export function divinationLabel(id: string, t: Translate): string {
  return label(DIVINATION_KEYS, id, t);
}

export function divinationEffectLabel(id: string, t: Translate): string {
  return label(DIVINATION_EFFECT_KEYS, id, t);
}

export function eliteAdvanceLabel(id: string, t: Translate): string {
  return label(ELITE_KEYS, id, t);
}

export function skillLabel(id: string, t: Translate): string {
  return label(SKILL_KEYS, id, t);
}

export function talentLabel(id: string, t: Translate): string {
  return label(TALENT_KEYS, id, t);
}
