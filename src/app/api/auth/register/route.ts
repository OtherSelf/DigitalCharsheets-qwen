import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { getInstanceConfig } from '@/lib/config';
import { requiredDocuments } from '@/lib/legal/consent-gate';
import { appendConsent } from '@/lib/legal/consents';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { passwordPolicyError } from '@/lib/security/password';
import { readAuthJson } from '@/lib/security/payload';
import { phrasePolicyError } from '@/lib/security/phrase-policy';
import {
  getAuthRateLimiter,
  rateLimitKey,
  REGISTER_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import { registerUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';
import { readSiteSettingsCached } from '@/lib/site-settings';

/**
 * ─── LANDMARK: REGISTER ─────────────────────────────────────────────────────
 * POST /api/auth/register — явная регистрация (в отличие от входа):
 *   { username, password, displayName, recoveryPhrase }
 *
 * Аккаунт создаётся сразу с recovery-фразой, поэтому после ответа UI может
 * вести пользователя на дашборд без модалки «настройте фразу». Сессия
 * ставится той же httpOnly-cookie, что и при входе.
 *
 * Статусы: 400 — невалидные поля (в т.ч. пароль короче 12 символов);
 * 409 — логин уже занят; 429 — превышен лимит регистраций; 200 — аккаунт создан.
 */
export async function POST(request: Request) {
  try {
    // Админ может закрыть регистрацию на живом сайте: это не «мягкое»
    // скрытие кнопки, API тоже обязан отказать.
    const siteSettings = await readSiteSettingsCached();
    if (!siteSettings.registration.open) {
      return jsonError(403, 'Registration is closed.', 'registration_closed');
    }

    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const {
      username,
      password,
      displayName,
      recoveryPhrase,
      consent,
      privacyVersion,
      termsVersion,
    } = parsedBody.body as {
      username?: string;
      password?: string;
      displayName?: string;
      recoveryPhrase?: string;
      consent?: boolean;
      privacyVersion?: string;
      termsVersion?: string;
    };

    if (!username || !password) {
      return jsonError(400, 'Username/Email and password are required.');
    }

    // Инстанс «для своих» может выключить политику: тогда и чекбокса нет, и
    // требовать нечего. По умолчанию политика включена.
    const privacyEnabled = getInstanceConfig().legal.privacy.enabled;
    const required = requiredDocuments();
    if (privacyEnabled) {
      if (consent !== true) {
        return jsonError(
          400,
          'Accept the privacy policy to create an account.',
          'consent_required',
        );
      }
      if (privacyVersion !== PRIVACY_VERSION) {
        return jsonError(
          400,
          'The privacy policy has changed. Reload the page and try again.',
          'privacy_version_mismatch',
        );
      }
      if (required.termsVersion && termsVersion !== required.termsVersion) {
        return jsonError(
          400,
          'The terms of use have changed. Reload the page and try again.',
          'terms_version_mismatch',
        );
      }
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('register', request, String(username)),
      REGISTER_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many registrations. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    const policyError = passwordPolicyError(password);
    if (policyError) {
      return jsonError(400, policyError, 'invalid_input');
    }

    if (typeof recoveryPhrase !== 'string') {
      return jsonError(400, 'Recovery phrase is required.', 'invalid_phrase');
    }
    const phraseError = phrasePolicyError(recoveryPhrase);
    if (phraseError) {
      return jsonError(400, phraseError, 'invalid_phrase');
    }

    const result = await registerUser(
      username,
      password,
      displayName,
      recoveryPhrase,
    );

    if (!result.success || !result.user) {
      const status = result.reason === 'exists' ? 409 : 400;
      return jsonError(
        status,
        result.error || 'Registration failed.',
        result.reason,
      );
    }

    if (privacyEnabled) {
      try {
        await appendConsent({
          uid: result.user.uid,
          version: privacyVersion ?? PRIVACY_VERSION,
          ...(required.termsVersion
            ? { termsVersion: required.termsVersion }
            : {}),
          source: 'register',
        });
      } catch (error) {
        console.error('[dcs] consents.jsonl: запись не удалась', error);
      }
    }

    const response = NextResponse.json({
      success: true,
      isNewUser: true,
      user: result.user,
    });
    response.headers.set(
      'Set-Cookie',
      await sessionCookieHeader(result.user.uid),
    );
    return response;
  } catch {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
