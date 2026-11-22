'use client';

import { Link2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';

/**
 * Действия с активной гостевой ссылкой: перевыпуск и отзыв. Показываются и
 * сразу после создания (токен ещё на экране), и при повторном открытии
 * диалога — поэтому разметка живёт в одном месте.
 */
export function ShareActions({
  busy,
  onRegenerate,
  onRevoke,
}: {
  busy: boolean;
  onRegenerate: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onRegenerate}
        disabled={busy}
        data-testid="share-regenerate"
      >
        <Link2 className="mr-2 h-4 w-4" />
        {t('share.regenerate')}
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={onRevoke}
        disabled={busy}
        data-testid="share-revoke"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t('share.revoke')}
      </Button>
    </div>
  );
}
