import type { DarkHeresyStatUpgrade } from '../dh-shared/types';
import { createDh1Demo } from '../dh1/demo';
import type { DH2CharacterDraft } from './defaults';

/**
 * Демо-персонаж Dark Heresy 2-й редакции: десятая характеристика
 * `influence` и `fatigue2nd`. Основа — тот же образ, что в dh1, но это
 * самостоятельный лист без полей 1-й редакции.
 */
export function createDh2Demo(): DH2CharacterDraft {
  const { fatigue1st: _fatigue1st, ...base } = createDh1Demo();

  return {
    ...base,
    systemId: 'dh2',
    name: 'Interrogator Vane',
    stats: { ...base.stats, influence: 30 },
    statUpgrades: {
      ...base.statUpgrades,
      influence: [false, false, false, false] as DarkHeresyStatUpgrade,
    },
    fatigue2nd: { current: 0 },
  };
}
