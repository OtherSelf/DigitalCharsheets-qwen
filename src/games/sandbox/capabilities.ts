import type { ModuleCapabilities } from '@/games/types';

/**
 * ─── LANDMARK: SANDBOX CAPABILITIES ────────────────────────────────────────
 * Возможности эталонной игры в том же виде, в котором их объявляют боевые
 * плагины: необязательные флаги, по которым общий UI решает, что показывать.
 * Ядро читает их из `GameModule.capabilities`, а не из имени игры.
 *
 * Песочница обслуживает только себя, поэтому флаги — константы, а не
 * переключатель редакций.
 */
export const SANDBOX_CAPABILITIES = {
  edition: 'sandbox',
  maxStat: 99,
  companion: true,
} as const satisfies ModuleCapabilities;

/** Типизированный доступ для UI: ключи известны, значения не расширяются. */
export function getSandboxCapabilities(): typeof SANDBOX_CAPABILITIES {
  return SANDBOX_CAPABILITIES;
}
