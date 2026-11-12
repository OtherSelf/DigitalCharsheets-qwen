'use client';

import { AlertTriangle } from 'lucide-react';

import { Alert } from '@/components/ui/alert';

/**
 * ─── LANDMARK: SHEET STATE BANNER ─────────────────────────────────────────
 * Баннер состояния листа: «игра отключена» (read-only, D9) или «плагин не
 * установлен» (generic JSON). Данные пользователя при этом не теряются.
 */
export function SheetStateBanner({
  title,
  hint,
  testId,
}: {
  title: string;
  hint: string;
  testId: string;
}) {
  return (
    <Alert data-testid={testId} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
    </Alert>
  );
}
