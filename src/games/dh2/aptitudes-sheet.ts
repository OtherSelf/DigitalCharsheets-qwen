/**
 * ─── LANDMARK: DH2 APTITUDES ON SHEET ─────────────────────────────────────
 * Правка выбора аптитюды на листе: профиль пересобирается тем же
 * `deriveAptitudes`, что и при создании, но с легаси-фолбэком для слотов,
 * которые игрок не трогал (D11). Так старый лист можно починить, не теряя
 * остальные аптитюды.
 */

import { deriveAptitudes } from './dh2e-aptitudes';
import type { DH2Character } from './types';

export function applyAptitudeChoice(
  character: Pick<
    DH2Character,
    'homeWorld' | 'background' | 'role' | 'aptitudes'
  >,
  key: string,
  value: string,
): Pick<DH2Character, 'aptitudes'> {
  const chosen = { ...character.aptitudes.chosen, [key]: value };
  const result = deriveAptitudes(
    {
      homeWorld: character.homeWorld,
      background: character.background,
      role: character.role,
    },
    chosen,
    { fallbackToFirst: true },
  );
  return {
    aptitudes: {
      profile: result.profile,
      chosen,
      extra: character.aptitudes.extra,
    },
  };
}

/**
 * Замок склонности (D1): ключ выбора попал в `aptitudes.chosen` — значит,
 * решение уже принято (при создании или при дозаполнении пустого слота), и
 * переписать его из Info нельзя. Ключи: `background`, `role.<index>`,
 * `duplicate.<aptitude>`.
 */
export function isAptitudeLocked(
  character: Pick<DH2Character, 'aptitudes'>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    character.aptitudes?.chosen ?? {},
    key,
  );
}
