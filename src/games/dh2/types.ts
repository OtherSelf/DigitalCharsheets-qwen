import type {
  DarkHeresyBase,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStats,
  DarkHeresyCoreStatUpgrades,
  DarkHeresyStatUpgrade,
} from '../dh-shared/types';

/**
 * ─── LANDMARK: DH2 CHARACTER ───────────────────────────────────────────────
 * Лист Dark Heresy 2-й редакции. Только 2e-поля:
 *   • десять характеристик, включая `influence`;
 *   • усталость — `fatigue2nd` (`fatigue1st` не существует);
 *   • в навыках доступна тренировка `+30` (capability модуля);
 *   • `edition` отсутствует: редакция задаётся модулем/`systemId` (📌 D3).
 */
export type DH2Stats = DarkHeresyCoreStats & { influence: number };
export type DH2StatUpgrades = DarkHeresyCoreStatUpgrades & {
  influence: DarkHeresyStatUpgrade;
};
export type DH2StatNotes = DarkHeresyCoreStatNotes & { influence?: string };

export interface DH2Fatigue {
  current: number;
  notes?: string;
}

export interface DH2Character extends DarkHeresyBase {
  systemId?: 'dh2';
  stats: DH2Stats;
  statUpgrades: DH2StatUpgrades;
  statNotes?: DH2StatNotes;
  fatigue2nd: DH2Fatigue;
}
