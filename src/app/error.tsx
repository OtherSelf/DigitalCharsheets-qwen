'use client';

import { ErrorScreen } from '@/components/errors/error-screen';
import { isChunkLoadError } from '@/lib/chunk-error';

/**
 * ─── LANDMARK: APP ERROR BOUNDARY ───────────────────────────────────────────
 * Ошибка сегмента (страница не отрендерилась) не должна превращаться в белую
 * страницу Next с английским текстом. Корневой layout остаётся смонтированным,
 * поэтому провайдеры и i18n здесь доступны.
 *
 * Ошибка загрузки чанка — отдельный статус (503): сборка на сервере уже
 * заменилась, и «повторить» без перезагрузки не поможет. Обычный сбой рендера
 * — 500, где retry перерисовывает сегмент и не теряет несохранённый ввод.
 * Автоматически не перезагружаем: в листе может быть несохранённый ввод.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkLoadError(error);
  const code = chunk ? 503 : 500;

  return (
    <ErrorScreen
      code={code}
      testId={chunk ? 'app-update-error' : 'app-error'}
      onRetry={chunk ? undefined : reset}
      digest={error.digest}
    />
  );
}
