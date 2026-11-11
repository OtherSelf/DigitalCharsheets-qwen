import type {
  DarkHeresyBase,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStats,
  DarkHeresyCoreStatUpgrades,
  DarkHeresyStatUpgrade,
} from '@/games/dh-shared/types';

/**
 * ─── LANDMARK: LEGACY DH EXPORT VIEW (временный) ───────────────────────────
 * Экспорт/импорт пока монолитный (`export-utils.ts`, этап 5): он умеет
 * выгружать и 1e-, и 2e-поля сразу и ждёт `edition`/обе усталости. После
 * разделения листов таких полей в `Character` больше нет, поэтому здесь
 * описан временный «широкий» вид для кода экспорта.
 *
 * @deprecated Уйдёт вместе с переносом Excel/JSON-полей в адаптеры модулей
 * (этап 5). Новый код не должен импортировать этот тип.
 */
export interface LegacyDarkHeresyExport extends DarkHeresyBase {
  edition?: '1st' | '2nd' | 'hybrid';
  stats: DarkHeresyCoreStats & { influence?: number };
  statUpgrades: DarkHeresyCoreStatUpgrades & {
    influence?: DarkHeresyStatUpgrade;
  };
  statNotes?: DarkHeresyCoreStatNotes & { influence?: string };
  fatigue1st?: { current: number; notes?: string };
  fatigue2nd?: { current: number; notes?: string };
}
