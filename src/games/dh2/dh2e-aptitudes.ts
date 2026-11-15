/**
 * ─── LANDMARK: DH2E APTITUDES ──────────────────────────────────────────────
 * Вывод профиля аптитюд 2e из трёх источников: мир (1), бэкграунд (выбор из
 * двух), роль (5, часть с выбором). Повтор аптитюды не даётся: игрок берёт
 * другую характеристическую аптитюду (с. 79), поэтому дубли разрешаются
 * через `chosen`, а не выбрасываются.
 */

import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_CHARACTERISTICS,
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
}

const CHARACTERISTIC_APTITUDES = DH2E_CHARACTERISTICS.flatMap(
  (characteristic) => characteristic.aptitudeIds,
);

const APTITUDE_LABELS = new Map(
  DH2E_APTITUDES.map((aptitude) => [aptitude.id, aptitude.labelKey]),
);

export function aptitudeLabelKey(id: string): string {
  return APTITUDE_LABELS.get(id) ?? id;
}

function resolveSlot(
  slot: Dh2eAptitudeSlot,
  key: string,
  chosen: Readonly<Record<string, string>>,
  choices: Dh2eAptitudeChoice[],
): string {
  if (typeof slot === 'string') return slot;
  const of = slot.of;
  choices.push({ key, of });
  const picked = chosen[key];
  return picked && of.includes(picked) ? picked : of[0];
}

/**
 * Собирает профиль: сначала мир, затем выбор бэкграунда, затем пять слотов
 * роли. Дубли заменяются первой ещё не занятой характеристической аптитюдой
 * (или остаются, если запас исчерпан — валидатор покажет предупреждение).
 */
export function deriveAptitudes(
  sources: Readonly<Dh2eAptitudeSources>,
  chosen: Readonly<Record<string, string>> = {},
): Dh2eAptitudeResult {
  const choices: Dh2eAptitudeChoice[] = [];
  const collected: string[] = [];

  const world = DH2E_HOMEWORLDS.find((item) => item.id === sources.homeWorld);
  if (world) collected.push(world.aptitudeId);

  const background = DH2E_BACKGROUNDS.find(
    (item) => item.id === sources.background,
  );
  if (background && background.aptitudeChoice.length > 0) {
    collected.push(
      resolveSlot(
        { choose: 1, of: background.aptitudeChoice },
        'background',
        chosen,
        choices,
      ),
    );
  }

  const role = DH2E_ROLES.find((item) => item.id === sources.role);
  if (role) {
    role.aptitudes.forEach((slot, index) => {
      collected.push(resolveSlot(slot, `role.${index}`, chosen, choices));
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
    const replacement = profile.includes(picked)
      ? CHARACTERISTIC_APTITUDES.find((item) => !profile.includes(item))
      : picked;
    if (replacement && !profile.includes(replacement)) {
      profile.push(replacement);
    }
  }

  return { profile, choices, duplicates };
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
