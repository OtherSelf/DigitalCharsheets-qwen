import { NextResponse, type NextRequest } from 'next/server';

import { csrfOriginRejected } from '@/lib/security/csrf';
import { getSessionUid } from '@/lib/session';
import { readSiteSettingsCached } from '@/lib/site-settings';
import { readStoredUser } from '@/lib/user-schema';

/**
 * ─── LANDMARK: PROXY (CSRF + MAINTENANCE) ──────────────────────────────────
 * Next 16 переименовал middleware в proxy; файл выполняется до route handler
 * и видит те же заголовки, поэтому проверка Origin живёт в одной точке, а не
 * копируется в каждый мутирующий роут.
 *
 * Здесь же — режим обслуживания: страницы для всех, кроме админа, уходят на
 * `/maintenance`, API отвечает 503. Вход и `/api/auth/*` остаются открытыми,
 * иначе админ не смог бы авторизоваться и включённое обслуживание запирало бы
 * сайт навсегда.
 *
 * GET/HEAD/OPTIONS не проверяются на CSRF: это чтение, CSRF для него
 * бессмыслен.
 */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Пути, доступные при обслуживании: вход и сам экран обслуживания. */
const MAINTENANCE_OPEN_PATHS = new Set(['/login', '/maintenance']);

/** API, без которых не войти и не узнать версию сборки. */
const MAINTENANCE_OPEN_API = ['/api/auth/', '/api/version'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (MUTATION_METHODS.has(request.method)) {
    const rejected = guardCsrf(request);
    if (rejected) return rejected;
  }

  const maintenance = await maintenanceResponse(request);
  if (maintenance) return maintenance;

  return NextResponse.next();
}

function guardCsrf(request: NextRequest): NextResponse | null {
  const rejected = csrfOriginRejected({
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    host:
      request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
  });

  if (!rejected) return null;

  return NextResponse.json(
    {
      success: false,
      error: 'Cross-site request blocked.',
      reason: 'csrf_origin',
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Экран обслуживания для всех, кроме админа. Настройки читаются с секундным
 * кэшем: при выключенном режиме (обычное состояние) это единственная работа,
 * которую делает прокси.
 */
async function maintenanceResponse(
  request: NextRequest,
): Promise<NextResponse | null> {
  const settings = await readSiteSettingsCached();
  if (!settings.access.maintenance) return null;

  const { pathname } = request.nextUrl;
  if (MAINTENANCE_OPEN_PATHS.has(pathname)) return null;
  if (MAINTENANCE_OPEN_API.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // Админ проходит: иначе включённый режим нельзя выключить из UI.
  const uid = await getSessionUid(request);
  if (uid) {
    const user = await readStoredUser(uid);
    if (user?.role === 'admin') return null;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        success: false,
        error: 'The site is under maintenance.',
        reason: 'maintenance',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '120' },
      },
    );
  }

  return NextResponse.rewrite(new URL('/maintenance', request.url));
}

export const config = {
  matcher: [
    '/api/:path*',
    // Страницы: мимо статики, служебных ассетов и самого экрана обслуживания.
    '/((?!_next/static|_next/image|_next/data|favicon.ico|maintenance|api/).*)',
  ],
};
