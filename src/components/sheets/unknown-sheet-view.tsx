'use client';

import { useState } from 'react';

import { Check, Copy, FileJson } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import {
  DEFAULT_EXPORT_CONFIG,
  exportCharacterToJSON,
} from '@/lib/export-utils';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: UNKNOWN SHEET VIEW ─────────────────────────────────────────
 * Плагин листа удалён из сборки: рендерить нечем (D9). Показываем данные как
 * JSON и даём экспорт — лист не теряется и остаётся выгружаемым.
 */
export function UnknownSheetView({ character }: { character: Character }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(character, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard может быть недоступен — остаётся экспорт файла */
    }
  };

  return (
    <Card data-testid="unknown-sheet">
      <CardHeader>
        <CardTitle>{t('common.pluginNotInstalled')}</CardTitle>
        <CardDescription>{t('common.pluginNotInstalledHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="bg-muted max-h-[60vh] overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {json}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyJson()}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? t('common.jsonCopied') : t('common.copyJson')}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              exportCharacterToJSON(character, DEFAULT_EXPORT_CONFIG)
            }
          >
            <FileJson className="mr-2 h-4 w-4" />
            {t('io.exportJSON')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
