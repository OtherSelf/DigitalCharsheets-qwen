import { NextResponse } from 'next/server';

import { openApiDocument } from '@/lib/openapi';

/**
 * ─── LANDMARK: OPENAPI SPEC ENDPOINT ───────────────────────────────────────
 * GET /api/openapi.json — машиночитаемая спецификация для /api/docs и для
 * внешних клиентов (генерация типов, импорт в Postman и т.п.).
 *
 * Спека статическая, поэтому отдаём её как force-static с коротким кэшем:
 * после правок в src/lib/openapi.ts её нужно пересобрать, как и весь Next.
 */
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(openApiDocument, {
    headers: {
      // Документация меняется вместе с кодом, но не чаще раза в несколько
      // минут; кэш на прокси не должен держать её вечно.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
