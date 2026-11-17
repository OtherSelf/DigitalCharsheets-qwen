/**
 * ─── LANDMARK: DH2 ELITE ADVANCES ─────────────────────────────────────────
 * Элитные продвижения 2e (с. 86): пререквизиты и разрешение ГМ показываем, но
 * автоматически применяем только то, что игрок вносит на лист вручную (D15).
 * Покупка пишется в журнал опыта; удаление не откатывает характеристики и
 * опыт — это осознанно (D1/D15).
 */

import { DH2E_ELITES } from './dh2e-reference';
import type { Dh2eEliteAdvance, Dh2eEliteRequirement } from './dh2e-types';
import { statTotal, type DarkHeresyStatKey } from './stats';
import type { DH2Character, DH2ExperienceEntry } from './types';

export function eliteById(id: string): Dh2eEliteAdvance | undefined {
  return DH2E_ELITES.find((elite) => elite.id === id);
}

/** Элитные, которых у персонажа ещё нет. */
export function availableEliteAdvances(
  taken: readonly string[],
): readonly Dh2eEliteAdvance[] {
  return DH2E_ELITES.filter((elite) => !taken.includes(elite.id));
}

/**
 * Код причины, по которой персонаж не проходит требование (D2). UI переводит
 * его в текст; покупка не блокируется — ГМ мог разрешить исключение.
 */
export type EliteRequirementCode =
  'background' | 'gender' | 'characteristic' | 'elite' | 'notElite' | 'trait';

export interface EliteRequirementIssue {
  readonly code: EliteRequirementCode;
  readonly requirement: Dh2eEliteRequirement;
}

type EliteRequirementSubject = Pick<
  DH2Character,
  'background' | 'gender' | 'stats' | 'statUpgrades' | 'eliteAdvances'
>;

/**
 * Требования, которые лист не выполняет. `trait` не проверяется: черты
 * хранятся свободным текстом, поэтому такая строка остаётся подсказкой в
 * `prereqText` (см. Dh2eEliteRequirement). Пустой массив — персонаж подходит.
 */
export function eliteRequirementIssues(
  character: EliteRequirementSubject,
  elite: Dh2eEliteAdvance,
): EliteRequirementIssue[] {
  const issues: EliteRequirementIssue[] = [];
  for (const requirement of elite.requirements ?? []) {
    if (
      requirement.kind === 'characteristic' &&
      statTotal(character, requirement.characteristic as DarkHeresyStatKey) <
        requirement.min
    ) {
      issues.push({ code: 'characteristic', requirement });
      continue;
    }
    if (
      requirement.kind === 'background' &&
      character.background !== requirement.backgroundId
    ) {
      issues.push({ code: 'background', requirement });
      continue;
    }
    if (
      requirement.kind === 'gender' &&
      character.gender !== requirement.gender
    ) {
      issues.push({ code: 'gender', requirement });
      continue;
    }
    if (
      requirement.kind === 'elite' &&
      !character.eliteAdvances.includes(requirement.eliteId)
    ) {
      issues.push({ code: 'elite', requirement });
      continue;
    }
    if (
      requirement.kind === 'notElite' &&
      character.eliteAdvances.includes(requirement.eliteId)
    ) {
      issues.push({ code: 'notElite', requirement });
    }
  }
  return issues;
}

export interface ElitePurchase {
  elite: Dh2eEliteAdvance;
  entry: DH2ExperienceEntry;
  patch: Pick<
    DH2Character,
    'eliteAdvances' | 'totalExpSpent' | 'experienceLog'
  >;
}

/**
 * Покупка элитного продвижения: id в `eliteAdvances`, цена в журнал.
 * Никаких правок характеристик/талантов — instant changes остаются памяткой.
 */
export function buyEliteAdvance(
  character: Pick<
    DH2Character,
    'eliteAdvances' | 'totalExpSpent' | 'experienceLog'
  >,
  eliteId: string,
  label: string,
  now: string = new Date().toISOString(),
): ElitePurchase | undefined {
  const elite = eliteById(eliteId);
  if (!elite || character.eliteAdvances.includes(eliteId)) return undefined;

  const entry: DH2ExperienceEntry = {
    id: `elite-advance:${now}:${eliteId}`,
    kind: 'elite-advance',
    ref: label,
    cost: elite.cost,
    createdAt: now,
  };
  return {
    elite,
    entry,
    patch: {
      eliteAdvances: [...character.eliteAdvances, eliteId],
      totalExpSpent: (character.totalExpSpent ?? 0) + elite.cost,
      experienceLog: [...(character.experienceLog ?? []), entry],
    },
  };
}

/** Патч удаления: профиль всегда, журнал и опыт — только если есть запись. */
export type EliteRemovalPatch = {
  eliteAdvances: string[];
  totalExpSpent?: number;
  experienceLog?: DH2ExperienceEntry[];
};

type EliteExperienceSubject = Pick<
  DH2Character,
  'eliteAdvances' | 'totalExpSpent' | 'experienceLog'
>;

const ELITE_ENTRY_PREFIX = 'elite-advance:';

/**
 * `eliteId` из строки журнала `elite-advance:<iso>:<eliteId>`. Разбираем по
 * последнему двоеточию: ISO-время само содержит `:`.
 */
export function eliteIdFromEntry(
  entry: Pick<DH2ExperienceEntry, 'id' | 'kind'>,
): string | undefined {
  if (entry.kind !== 'elite-advance') return undefined;
  if (!entry.id.startsWith(ELITE_ENTRY_PREFIX)) return undefined;
  const suffix = entry.id.slice(ELITE_ENTRY_PREFIX.length);
  const separator = suffix.lastIndexOf(':');
  if (separator === -1) return undefined;
  return suffix.slice(separator + 1) || undefined;
}

function eliteEntryFor(
  character: EliteExperienceSubject,
  eliteId: string,
): DH2ExperienceEntry | undefined {
  return (character.experienceLog ?? []).find(
    (entry) =>
      entry.kind === 'elite-advance' && eliteIdFromEntry(entry) === eliteId,
  );
}

/**
 * Удаление элитного из профиля: id уходит, связанная строка журнала — тоже,
 * её цена возвращается в свободный опыт (D7). Legacy-лист без строки журнала
 * теряет только id: возвращать нечего, опыт не трогаем.
 */
export function removeEliteAdvance(
  character: EliteExperienceSubject,
  eliteId: string,
): EliteRemovalPatch {
  const eliteAdvances = character.eliteAdvances.filter((id) => id !== eliteId);
  const entry = eliteEntryFor(character, eliteId);
  if (!entry) return { eliteAdvances };

  return {
    eliteAdvances,
    totalExpSpent: Math.max(0, (character.totalExpSpent ?? 0) - entry.cost),
    experienceLog: (character.experienceLog ?? []).filter(
      (item) => item.id !== entry.id,
    ),
  };
}

/**
 * Удаление строки журнала элитного: симметрично снимает id из профиля и
 * возвращает цену. Остальные виды записей обрабатывает сам лист.
 * `undefined` — это не элитное или строка уже удалена.
 */
export function removeEliteJournalEntry(
  character: EliteExperienceSubject,
  entryId: string,
): EliteRemovalPatch | undefined {
  const entry = (character.experienceLog ?? []).find(
    (item) => item.id === entryId,
  );
  if (!entry || entry.kind !== 'elite-advance') return undefined;
  const eliteId = eliteIdFromEntry(entry);

  return {
    eliteAdvances: eliteId
      ? character.eliteAdvances.filter((id) => id !== eliteId)
      : character.eliteAdvances,
    totalExpSpent: Math.max(0, (character.totalExpSpent ?? 0) - entry.cost),
    experienceLog: (character.experienceLog ?? []).filter(
      (item) => item.id !== entryId,
    ),
  };
}
