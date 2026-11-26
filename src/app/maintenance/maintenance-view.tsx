'use client';

import { Wrench } from 'lucide-react';

import { useTranslation } from '@/context/language-context';

/**
 * Экран обслуживания: только текст и иконка. Ни футера, ни меню — они тянут
 * `/api/version` и профиль, а при обслуживании это лишние запросы к серверу,
 * который в этот момент обновляют.
 */
export function MaintenanceView() {
  const { t } = useTranslation();

  return (
    <main className="safe-area-bottom flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
        <Wrench className="text-muted-foreground h-7 w-7" aria-hidden />
      </div>
      <h1 className="font-headline text-2xl font-bold tracking-tight text-balance">
        {t('maintenance.title')}
      </h1>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        {t('maintenance.body')}
      </p>
    </main>
  );
}
