/**
 * ─── LANDMARK: DND5E EPIC BOONS ────────────────────────────────────────────
 * Ключи эпических даров (уровень 20+ и «Divine Boons»). Раньше лежали в
 * `src/lib/epic-boons.ts` — то есть игровые данные в ядре; теперь это часть
 * модуля dnd5e, как и остальные данные редакции.
 */
export const EPIC_BOON_KEYS = [
  'dnd.boonCombatProwess',
  'dnd.boonDimensionalTravel',
  'dnd.boonFate',
  'dnd.boonFortitude',
  'dnd.boonHighMagic',
  'dnd.boonImmortality',
  'dnd.boonInvincibility',
  'dnd.boonIrresistibleOffense',
  'dnd.boonLuck',
  'dnd.boonMagicResistance',
  'dnd.boonPeerlessAim',
  'dnd.boonPerfectHealth',
  'dnd.boonPlanarTravel',
  'dnd.boonQuickCasting',
  'dnd.boonRecovery',
  'dnd.boonResilience',
  'dnd.boonSkillProficiency',
  'dnd.boonSpeed',
  'dnd.boonSpellMastery',
  'dnd.boonSpellRecall',
  'dnd.boonFireSoul',
  'dnd.boonNightSpirit',
  'dnd.boonStormborn',
  'dnd.boonUnfettered',
  'dnd.boonTruesight',
  'dnd.boonUndetectability',
] as const;

export type EpicBoonKey = (typeof EPIC_BOON_KEYS)[number];
