'use client';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Баннер проверки выборов импортированного листа. Тексты приходят переводами
 * от вызывающей редакции: shared-слой не знает ни сайтовых ключей, ни правил
 * игры. `missing` — локализованные подписи обязательных пустых полей; пока
 * список не пуст, фиксация недоступна.
 */
export interface CreationReviewBannerProps {
  title: string;
  description: string;
  missingLabel: string;
  missing: readonly string[];
  confirmLabel: string;
  onConfirm: () => void;
}

export function CreationReviewBanner({
  title,
  description,
  missingLabel,
  missing,
  confirmLabel,
  onConfirm,
}: CreationReviewBannerProps) {
  return (
    <Alert
      className="border-primary/30 bg-primary/5 mb-4"
      data-testid="creation-review-banner"
    >
      <AlertCircle className="text-primary h-4 w-4" />
      <AlertDescription className="space-y-2">
        <p className="text-foreground font-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
        {missing.length > 0 && (
          <p
            className="text-muted-foreground"
            data-testid="creation-review-missing"
          >
            {missingLabel} {missing.join(', ')}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          data-testid="creation-review-confirm"
          disabled={missing.length > 0}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
