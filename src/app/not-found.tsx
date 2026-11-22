'use client';

import { ErrorScreen } from '@/components/errors/error-screen';

/**
 * ─── LANDMARK: ROOT NOT FOUND (404) ────────────────────────────────────────
 * Раньше неизвестный путь отдавал английскую заглушку Next, а `notFound()` из
 * страницы документации — ту же самую. Теперь любой промах маршрута попадает
 * сюда и получает брендированный экран с кодом и выходом на главную.
 *
 * `'use client'` нужен ради `useTranslation`: язык сайта живёт в контексте, а
 * не в URL. Сам 404-статус выставляет App Router, а не этот компонент.
 */
export default function NotFoundPage() {
  return <ErrorScreen code={404} testId="not-found-page" />;
}
