'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  FileWarning,
  LogIn,
  RefreshCw,
  SearchX,
  ServerCrash,
  ShieldX,
  TimerOff,
  WifiOff,
} from 'lucide-react';

import { Header } from '@/components/header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { ERROR_PAGE_ACTIONS, type ErrorPageCode } from '@/lib/error-pages';

/**
 * ─── LANDMARK: ERROR SCREEN ────────────────────────────────────────────────
 * Один экран для всех статусов: 404 больше не отдаёт английскую заглушку
 * Next, 401/403 объясняют, что делать, а 429/503 не выглядят как падение
 * всего приложения. Код, заголовок и подсказка берутся из словаря
 * (`error.<code>.*`), поэтому экран одинаково выглядит на обеих локалях.
 *
 * `retry` — не перезагрузка: граница рендера перерисовывает сегмент и
 * сохраняет несохранённый ввод. `reload` нужен там, где состояние вкладки
 * уже разошлось с сервером (обновление сборки, конфликт версий).
 */
export function ErrorScreen({
  code,
  testId,
  digest,
  title,
  description,
  onRetry,
}: {
  code: ErrorPageCode;
  testId?: string;
  /** `digest` из Next error boundary: помогает найти ошибку в логах. */
  digest?: string;
  /** Переопределение текста (например, для конкретного экрана). */
  title?: string;
  description?: string;
  /** Повтор рендера сегмента; без него кнопка «Повторить» не показывается. */
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const actions = ERROR_PAGE_ACTIONS[code];

  const heading = title ?? t(`error.${code}.title`);
  const hint = description ?? t(`error.${code}.description`);

  return (
    <div className="flex h-dvh flex-col">
      <Header backHref="/" authAction={code === 401 ? 'login' : 'auto'} />
      <main className="flex flex-1 flex-col p-4 md:p-6 [&>*]:w-full [&>*]:min-w-0">
        <div className="flex flex-1 items-center justify-center">
          <Card
            className="w-full max-w-lg"
            data-testid={testId ?? `error-page-${code}`}
            data-error-code={code}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {errorIcon(code)}
                {heading}
              </CardTitle>
              <CardDescription className="space-y-2">
                <span className="block">{hint}</span>
                <span
                  className="text-muted-foreground/70 block font-mono text-xs"
                  aria-label={t('error.statusLabel')}
                >
                  {`HTTP ${code}`}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {actions.retry && onRetry && (
                <Button onClick={onRetry}>{t('common.retry')}</Button>
              )}
              {actions.reload && (
                <Button
                  variant={actions.retry && onRetry ? 'outline' : 'default'}
                  onClick={() => window.location.reload()}
                >
                  {t('common.reloadPage')}
                </Button>
              )}
              {actions.login && (
                <Button asChild>
                  <Link href="/login">{t('common.signIn')}</Link>
                </Button>
              )}
              {actions.home && (
                <Button variant="outline" asChild>
                  <Link href="/">{t('common.backToDashboard')}</Link>
                </Button>
              )}
              {actions.back && (
                <Button variant="ghost" onClick={() => router.back()}>
                  {t('common.back')}
                </Button>
              )}
            </CardContent>
            {digest && (
              <p className="text-muted-foreground/70 px-6 pb-4 font-mono text-xs">
                <span data-testid="error-digest">{`digest: ${digest}`}</span>
              </p>
            )}
          </Card>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}

/** Иконка по смыслу статуса; импорт статический — экран грузится только на ошибке. */
function errorIcon(code: ErrorPageCode) {
  const className = 'text-destructive h-5 w-5 shrink-0';
  switch (code) {
    case 401:
      return <LogIn className={className} />;
    case 403:
      return <ShieldX className={className} />;
    case 404:
      return <SearchX className={className} />;
    case 409:
      return <RefreshCw className={className} />;
    case 413:
      return <FileWarning className={className} />;
    case 429:
      return <TimerOff className={className} />;
    case 500:
      return <ServerCrash className={className} />;
    case 503:
      return <WifiOff className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
}
