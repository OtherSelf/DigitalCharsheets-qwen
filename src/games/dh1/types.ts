import type {
  DarkHeresyBase,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStats,
  DarkHeresyCoreStatUpgrades,
} from '../dh-shared/types';

/**
 * ─── LANDMARK: DH1 CHARACTER ───────────────────────────────────────────────
 * Лист Dark Heresy 1-й редакции. Только 1e-поля:
 *   • девять характеристик без `influence`;
 *   • усталость — `fatigue1st` (`fatigue2nd` не существует);
 *   • `+30` в навыках не используется;
 *   • `edition` отсутствует: редакция задаётся модулем/`systemId` (📌 D3).
 */
export interface DH1Fatigue {
  current: number;
  notes?: string;
}

export interface DH1Character extends DarkHeresyBase {
  systemId?: 'dh1';
  stats: DarkHeresyCoreStats;
  statUpgrades: DarkHeresyCoreStatUpgrades;
  statNotes?: DarkHeresyCoreStatNotes;
  fatigue1st: DH1Fatigue;
}
