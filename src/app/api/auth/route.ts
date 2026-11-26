import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { getInstanceConfig } from '@/lib/config';
import { languageCookieHeader } from '@/lib/language';
import { appendConsent, latestConsentVersion } from '@/lib/legal/consents';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { readAuthJson } from '@/lib/security/payload';
import {
  accountRateLimitKey,
  getAuthRateLimiter,
  LOGIN_RATE_LIMIT,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { authenticateUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';
import { readSiteSettingsCached } from '@/lib/site-settings';

/**
 * ─── LANDMARK: LOGIN (только существующие аккаунты) ─────────────────────────
 * POST /api/auth — вход. Свободный логин больше НЕ создаёт аккаунт: страница
 * /login сначала отдельно проверяет существование
 * (POST /api/auth/exists) и предлагает регистрацию
 * (POST /api/auth/register). Поэтому здесь `allowRegistration: false`.
 *
 * Статусы: 400 — не заполнены поля; 401 — «нет такого аккаунта» и «неверный
 * пароль» неразличимы; 403 — аккаунт заблокирован (виден только после верного
 * пароля) или не принята действующая редакция политики; 429 — превышен лимит
 * попыток; 200 — сессия в httpOnly-cookie.
 *
 * Длину пароля вход НЕ проверяет: политика (минимум 12) действует в момент
 * установки пароля, иначе аккаунты, созданные раньше, потеряли бы доступ.
 * Перебор ограничивает лимитер (10 попыток за 10 минут на IP+логин).
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const {
      username,
      password,
      displayName,
      totpCode,
      consent,
      privacyVersion,
    } = parsedBody.body as {
      username?: string;
      password?: string;
      displayName?: string;
      totpCode?: string;
      consent?: boolean;
      privacyVersion?: string;
    };

    if (!username || !password) {
      return jsonError(400, 'Username/Email and password are required.');
    }

    // Ключ окна — IP + логин. Считаются неудачные попытки: успешный вход
    // сбрасывает окно, иначе человек, который несколько раз переключался
    // между аккаунтами (или ждал в очереди с общим NAT), упирался бы в 429.
    const loginKey = rateLimitKey('login', request, String(username));
    const accountKey = accountRateLimitKey('login', String(username));
    const authLimiter = getAuthRateLimiter();
    const limiter = authLimiter.check(loginKey, LOGIN_RATE_LIMIT);
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many login attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }
    // Второй эшелон: лимит на аккаунт не зависит от IP и не обходится
    // распределённым перебором.
    const accountLimiter = authLimiter.check(accountKey, LOGIN_RATE_LIMIT);
    if (!accountLimiter.allowed) {
      return jsonError(
        429,
        'Too many login attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(accountLimiter.retryAfterSeconds) },
      );
    }

    const result = await authenticateUser(username, password, displayName, {
      allowRegistration: false,
      totpCode,
    });

    if (!result.success || !result.user) {
      // В журнал — только причина: логин и пароль в лог не попадают.
      console.warn(
        `[security] login rejected: reason=${result.reason ?? 'unknown'}`,
      );

      // «Нет аккаунта» и «неверный пароль» — один статус и один текст:
      // иначе логин становится оракулом перечисления аккаунтов (SEC-9).
      if (
        result.reason === 'no_account' ||
        result.reason === 'invalid_password'
      ) {
        return jsonError(
          401,
          'Invalid login or password.',
          'invalid_credentials',
        );
      }

      // Блокировка видна только после верного пароля, поэтому аккаунт не
      // выдаёт; ошибки валидации полей — 400.
      const status =
        result.reason === 'invalid_input'
          ? 400
          : result.reason === 'blocked'
            ? 403
            : result.reason === 'totp_unavailable'
              ? 503
              : 401;
      return jsonError(status, result.error || 'Login failed.', result.reason);
    }

    // Вход может быть временно закрыт для всех, кроме админов и тестеров.
    const siteSettings = await readSiteSettingsCached();
    if (
      siteSettings.access.loginRestrictedToStaff &&
      result.user.role !== 'admin' &&
      result.user.role !== 'tester'
    ) {
      return jsonError(
        403,
        'Sign-in is temporarily limited to administrators and testers.',
        'login_restricted',
      );
    }

    // Политика могла измениться, пока аккаунт жил: без принятой действующей
    // редакции сессию не выдаём. Аккаунты, созданные до появления лога
    // согласий, не имеют ни одной записи, поэтому проходят тот же путь.
    const privacyEnabled = getInstanceConfig().legal.privacy.enabled;
    const accepted = privacyEnabled
      ? await latestConsentVersion(result.user.uid)
      : PRIVACY_VERSION;
    if (privacyEnabled && accepted !== PRIVACY_VERSION) {
      if (consent !== true) {
        return jsonError(
          403,
          'Accept the privacy policy to sign in.',
          'privacy_consent_required',
        );
      }
      if (privacyVersion !== PRIVACY_VERSION) {
        return jsonError(
          400,
          'The privacy policy has changed. Reload the page and try again.',
          'privacy_version_mismatch',
        );
      }
      try {
        await appendConsent({
          uid: result.user.uid,
          version: privacyVersion,
          source: 'login',
        });
      } catch (error) {
        console.error('[dcs] consents.jsonl: запись не удалась', error);
      }
    }

    // Успешный вход обнуляет счётчик неудач и для пары IP+логин, и для
    // аккаунта.
    authLimiter.reset(loginKey);
    authLimiter.reset(accountKey);

    // Сессия — подписанная httpOnly-cookie; дальше uid берётся только из неё.
    const response = NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      user: result.user,
    });
    response.headers.append(
      'Set-Cookie',
      await sessionCookieHeader(result.user.uid),
    );
    /*
      Язык из профиля переносим в cookie: он выбран на другом устройстве, а
      первый HTML этого — cookie или `Accept-Language`. Профиль без языка
      (старый аккаунт) ничего не навязывает.
    */
    if (result.user.language) {
      response.headers.append(
        'Set-Cookie',
        languageCookieHeader(result.user.language),
      );
    }
    return response;
  } catch (error) {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
