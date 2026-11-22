import type { SandboxCharacter } from './types';

/**
 * ─── LANDMARK: SANDBOX DERIVE ──────────────────────────────────────────────
 * Производное поле `total` — сумма двух характеристик. Живёт одной чистой
 * функцией: её зовёт сервер при записи, клиент — для мгновенного отклика, а
 * `plugins-derive.test.ts` проверяет инварианты (без мутации входа,
 * идемпотентность, неизменный состав ключей и `schemaVersion`).
 */
export function deriveSandbox(character: SandboxCharacter): SandboxCharacter {
  return {
    ...character,
    total: character.stats.might + character.stats.wits,
  };
}
