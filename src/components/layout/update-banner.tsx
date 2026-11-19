// src/components/layout/update-banner.tsx

'use client';

import { Button } from '@/components/ui/button';

/**
 * Плашка «нужно обновить вкладку»: один вид для новой сборки и для ошибки
 * загрузки чанка. Живёт внизу по центру и на `z-40`, чтобы модальные окна
 * Radix (их оверлей выше) перекрывали её, а не наоборот.
 */
export function UpdateBanner({
  label,
  action,
  onAction,
  testId,
}: {
  label: string;
  action: string;
  onAction: () => void;
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
      <Button size="sm" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
