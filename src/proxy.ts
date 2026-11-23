import { NextResponse, type NextRequest } from 'next/server';

import { csrfOriginRejected } from '@/lib/security/csrf';

/**
 * ─── LANDMARK: PROXY (CSRF BOUNDARY) ───────────────────────────────────────
 * Next 16 переименовал middleware в proxy; файл выполняется до route handler
 * и видит те же заголовки, поэтому проверка Origin живёт в одной точке, а не
 * копируется в каждый мутирующий роут.
 *
 * GET/HEAD/OPTIONS не проверяются: это чтение, CSRF для него бессмыслен.
 */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function proxy(request: NextRequest): NextResponse {
  if (!MUTATION_METHODS.has(request.method)) return NextResponse.next();
  return guardCsrf(request);
}

function guardCsrf(request: NextRequest): NextResponse {
  const rejected = csrfOriginRejected({
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    host:
      request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
  });

  if (!rejected) return NextResponse.next();

  return NextResponse.json(
    {
      success: false,
      error: 'Cross-site request blocked.',
      reason: 'csrf_origin',
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

export const config = {
  matcher: ['/api/:path*'],
};
