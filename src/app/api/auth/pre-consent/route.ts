import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { buildBackupExport, exportFileName } from '@/lib/export-utils';
import { latestConsentVersion } from '@/lib/legal/consents';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { readAuthJson } from '@/lib/security/payload';
import {
  getAuthRateLimiter,
  LOGIN_RATE_LIMIT,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { authenticateUser, deleteUserAccount } from '@/lib/server-auth';
import { getCharactersFromServer } from '@/lib/server-storage';
import { sessionCookieName } from '@/lib/session';

/**
 * ─── LANDMARK: PRE-CONSENT DATA RIGHTS ─────────────────────────────────────
 * Права субъекта не зависят от принятия новой редакции политики. Кто не хочет
 * нажимать галочку, должен всё равно получить свои данные и удалить аккаунт —
 * иначе блокировка входа превращается в отказ в правах.
 *
 * Поэтому здесь отдельный вход по паролю (и TOTP, если включён) БЕЗ выдачи
 * сессии: `action: 'export'` отдаёт файл резервной копии, `action: 'delete'`
 * удаляет аккаунт. Эндпоинт работает только для аккаунта, который ещё не
 * принял действующую редакцию: у остальных есть обычный вход и обычный экспорт.
 *
 * Статусы: 400 — нет полей/неизвестное действие; 401 — неверный пароль или
 * нет аккаунта (неразличимо); 403 — аккаунт заблокирован; 409 — согласие уже
 * принято (используйте обычный вход); 429 — лимит попыток.
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }

    const { action, username, password, totpCode } = parsedBody.body as {
      action?: string;
      username?: string;
      password?: string;
      totpCode?: string;
    };

    if (action !== 'export' && action !== 'delete') {
      return jsonError(400, 'Unknown action.', 'invalid_input');
    }
    if (!username || !password) {
      return jsonError(400, 'Username/Email and password are required.');
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey(`pre-consent-${action}`, request, String(username)),
      LOGIN_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many attempts. Try again later.',
        'rate_limited',
        {
          'Retry-After': String(limiter.retryAfterSeconds),
        },
      );
    }

    const auth = await authenticateUser(username, password, undefined, {
      allowRegistration: false,
      totpCode,
    });

    if (!auth.success || !auth.user) {
      if (auth.reason === 'blocked') {
        return jsonError(403, 'Account is blocked.', 'blocked');
      }
      return jsonError(
        401,
        'Invalid login or password.',
        'invalid_credentials',
      );
    }

    // Сессии нет, поэтому состояние согласия проверяем здесь: у аккаунта с
    // принятой редакцией этот путь не нужен и не должен расширять поверхность.
    const accepted = await latestConsentVersion(auth.user.uid);
    if (accepted === PRIVACY_VERSION) {
      return jsonError(
        409,
        'The policy is already accepted.',
        'consent_not_required',
      );
    }

    if (action === 'delete') {
      const result = await deleteUserAccount(auth.user.uid, password);
      if (!result.success) {
        const status =
          result.reason === 'invalid_password'
            ? 403
            : result.reason === 'not_found'
              ? 404
              : 500;
        return jsonError(
          status,
          result.error || 'Failed to delete the account.',
          result.reason,
        );
      }
      const response = NextResponse.json({ success: true, deleted: true });
      // Старая cookie могла остаться в браузере: стираем на всякий случай.
      response.headers.append(
        'Set-Cookie',
        `${sessionCookieName()}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      );
      return response;
    }

    const characters = await getCharactersFromServer(auth.user.uid);
    const payload = buildBackupExport(characters, auth.user.username);
    const filename = exportFileName('backup', {
      login: auth.user.username ?? auth.user.uid,
      date: new Date(),
    });

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[dcs] pre-consent: непредвиденная ошибка', error);
    return jsonError(500, 'Unexpected error.', 'server_error');
  }
}
