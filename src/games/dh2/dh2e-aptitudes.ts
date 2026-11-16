/**
 * ─── LANDMARK: DH2E APTITUDES ──────────────────────────────────────────────
 * Вывод профиля аптитюд 2e из трёх источников: мир (1), бэкграунд (выбор из
 * двух), роль (5, часть с выбором). Повтор аптитюды не даётся: игрок берёт
 * другую характеристическую аптитюду (с. 79), поэтому дубли разрешаются
 * через `chosen`, а не выбрасываются.
 *
 * Невыбранный слот у нового листа остаётся неразрешённым (`unresolved`) и
 * показывается в UI как «выберите»; молча подставлять первый вариант нельзя.
 * Прежний детерминированный фолбэк (`fallbackToFirst`) сохранён для
 * legacy-листов и программного создания без формы (D11).
 */

import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from './dh2e-data';
import type { Dh2eAptitudeSlot } from './dh2e-types';

export interface Dh2eAptitudeSources {
  homeWorld: string;
  background: string;
  role: string;
}

export interface Dh2eAptitudeChoice {
  /** Ключ выбора в `aptitudes.chosen`. */
  key: string;
  of: readonly string[];
}

export interface Dh2eAptitudeResult {
  /** Итоговый профиль без дублей, в порядке получения. */
  profile: string[];
  /** Слоты выбора, которые игрок может переопределить. */
  choices: Dh2eAptitudeChoice[];
  /** Повторы, заменённые на выбранную характеристическую аптитюду. */
  duplicates: string[];
  /** Ключи слотов, для которых игрок ещё не сделал выбор. */
  unresolved: string[];
}

export interface Dh2eDeriveOptions {
  /**
   * Легаси/программное создание: невыбранный слот разрешается первым
   * вариантом (прежнее поведение). Форма создания передаёт `false`.
   */
  fallbackToFirst?: boolean;
}

/**
 * Девять характеристических аптитюд (с. 79): только они годятся в замену
 * дублю. Общие аптитюды (`offence`, `finesse`, …) в этот набор не входят,
 * хотя и привязаны к характеристикам в таблице покупок.
 */
const CHARACTERISTIC_APTITUDES = DH2E_APTITUDES.filter(
  (aptitude) => aptitude.group === 'characteristic',
).map((aptitude) => aptitude.id);

const APTITUDE_LABELS = new Map(
  DH2E_APTITUDES.map((aptitude) => [aptitude.id, aptitude.labelKey]),
);

export function aptitudeLabelKey(id: string): string {
  return APTITUDE_LABELS.get(id) ?? id;
}

/** Характеристические аптитюды: из них игрок выбирает замену дублю. */
export function characteristicAptitudes(): readonly string[] {
  return CHARACTERISTIC_APTITUDES;
}

function resolveSlot(
  slot: Dh2eAptitudeSlot,
  key: string,
  chosen: Readonly<Record<string, string>>,
  choices: Dh2eAptitudeChoice[],
  fallbackToFirst: boolean,
  unresolved: string[],
): string | undefined {
  if (typeof slot === 'string') return slot;
  const of = slot.of;
  // Единственный вариант — не выбор, а факт: спрашивать нечего.
  if (of.length === 1) return of[0];
  choices.push({ key, of });
  const picked = chosen[key];
  if (picked && of.includes(picked)) return picked;
  if (fallbackToFirst) return of[0];
  unresolved.push(key);
  return undefined;
}

/**
 * Собирает профиль: сначала мир, затем выбор бэкграунда, затем пять слотов
 * роли. Дубли заменяются выбранной характеристической аптитюдой, которой у
 * персонажа ещё нет; без выбора слот остаётся неразрешённым.
 */
export function deriveAptitudes(
  sources: Readonly<Dh2eAptitudeSources>,
  chosen: Readonly<Record<string, string>> = {},
  options: Dh2eDeriveOptions = {},
): Dh2eAptitudeResult {
  const fallbackToFirst = options.fallbackToFirst ?? false;
  const choices: Dh2eAptitudeChoice[] = [];
  const unresolved: string[] = [];
  const collected: string[] = [];

  const world = DH2E_HOMEWORLDS.find((item) => item.id === sources.homeWorld);
  if (world) collected.push(world.aptitudeId);

  const background = DH2E_BACKGROUNDS.find(
    (item) => item.id === sources.background,
  );
  if (background && background.aptitudeChoice.length > 0) {
    const picked = resolveSlot(
      { choose: 1, of: background.aptitudeChoice },
      'background',
      chosen,
      choices,
      fallbackToFirst,
      unresolved,
    );
    if (picked) collected.push(picked);
  }

  const role = DH2E_ROLES.find((item) => item.id === sources.role);
  if (role) {
    role.aptitudes.forEach((slot, index) => {
      const picked = resolveSlot(
        slot,
        `role.${index}`,
        chosen,
        choices,
        fallbackToFirst,
        unresolved,
      );
      if (picked) collected.push(picked);
    });
  }

  const duplicates: string[] = [];
  const profile: string[] = [];
  for (const aptitude of collected) {
    if (!profile.includes(aptitude)) {
      profile.push(aptitude);
      continue;
    }
    duplicates.push(aptitude);
    const key = `duplicate.${aptitude}`;
    const picked = chosen[key];
    if (
      picked &&
      CHARACTERISTIC_APTITUDES.includes(picked) &&
      !profile.includes(picked)
    ) {
      profile.push(picked);
      continue;
    }
    if (fallbackToFirst) {
      const replacement = CHARACTERISTIC_APTITUDES.find(
        (item) => !profile.includes(item),
      );
      if (replacement) {
        profile.push(replacement);
        continue;
      }
    }
    if (!unresolved.includes(key)) unresolved.push(key);
  }

  return { profile, choices, duplicates, unresolved };
}

/** Сколько совпадений у покупки: 2, 1 или 0 (таблицы 2-2/2-4/2-6). */
export function countAptitudeMatches(
  slots: readonly Dh2eAptitudeSlot[],
  profile: readonly string[],
  chosen: Readonly<Record<string, string>> = {},
): number {
  let matches = 0;
  slots.forEach((slot, index) => {
    if (typeof slot === 'string') {
      if (profile.includes(slot)) matches += 1;
      return;
    }
    const picked = chosen[`buy.${index}`];
    if (picked && profile.includes(picked)) matches += 1;
    else if (slot.of.some((option) => profile.includes(option))) matches += 1;
  });
  return Math.min(matches, 2);
}
