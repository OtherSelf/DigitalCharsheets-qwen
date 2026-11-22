import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_PAGE_CODES, isErrorPageCode } from '@/lib/error-pages';

/**
 * ─── LANDMARK: ERROR STATUS PAGES (/error/<code>) ──────────────────────────
 * Информационные страницы статусов: их можно дать ссылкой в письме/логе, и
 * каждая объясняет, что случилось и что делать. Это не ответ сервера с этим
 * статусом — реальные 4xx/5xx по-прежнему отдают API и границы рендера;
 * маршрут существует, чтобы у кодов была одна страница, а не набор текстов
 * в разных местах.
 *
 * 404 остаётся исключением: `notFound()` отдаёт настоящий 404 и рисует
 * корневой `not-found.tsx`, поэтому `/error/404` ведёт себя как обычный
 * промах маршрута.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return ERROR_PAGE_CODES.filter((code) => code !== 404).map((code) => ({
    code: String(code),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `HTTP ${code} — Digital Character Sheets`,
  };
}

export default async function ErrorStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isErrorPageCode(code)) notFound();
  if (code === 404) notFound();

  return <ErrorScreen code={code} testId={`error-page-${code}`} />;
}
