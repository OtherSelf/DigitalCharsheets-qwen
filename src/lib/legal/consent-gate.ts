import { getInstanceConfig } from '@/lib/config';
import type { AcceptedDocuments } from '@/lib/legal/consents';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { TERMS_VERSION } from '@/lib/legal/terms';

/**
 * ─── LANDMARK: CONSENT GATE ────────────────────────────────────────────────
 * Какие редакции документов действуют на этом инстансе и достаточно ли того,
 * что аккаунт принял раньше. Одна точка правды для регистрации, входа и
 * проверки «можно ли уже выгружать данные без принятия».
 *
 * Соглашение может быть выключено (`legal.terms.enabled=false`, инстанс без
 * регистрации) — тогда гейт смотрит только на политику и не требует версию
 * соглашения.
 */
export interface RequiredDocuments {
  policyVersion: string;
  /** `null` — соглашение на инстансе выключено. */
  termsVersion: string | null;
}

export function requiredDocuments(): RequiredDocuments {
  const config = getInstanceConfig();
  return {
    policyVersion: PRIVACY_VERSION,
    termsVersion: config.legal.terms.enabled ? TERMS_VERSION : null,
  };
}

/** Принято ли всё действующее. `null` — нет ни одной записи. */
export function isConsentCurrent(
  accepted: AcceptedDocuments | null,
  required: RequiredDocuments = requiredDocuments(),
): boolean {
  if (!accepted) return false;
  if (accepted.policyVersion !== required.policyVersion) return false;
  if (!required.termsVersion) return true;
  return accepted.termsVersion === required.termsVersion;
}
