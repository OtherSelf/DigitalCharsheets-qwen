// src/components/layout/update-banner.tsx

'use client';

/**
 * Плашка «приложение обновилось, сохраните изменения и обновите страницу».
 *
 * Намеренно без кнопки: перезагрузить вкладку за пользователя нельзя — в ней
 * может быть несохранённый ввод (мастер создания, редактор поля), а попытка
 * сделать это программно упирается в `beforeunload` и оставляет кнопку в
 * состоянии «обновляем» навсегда. Сообщаем факт и уводим к обычному F5.
 * z-40 ниже модальных окон Radix, чтобы не перекрывать диалоги.
 */
export function UpdateBanner({
  label,
  testId,
}: {
  label: string;
  testId: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className="bg-card fixed bottom-4 left-1/2 z-40 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg"
    >
      <span>{label}</span>
    </div>
  );
}
