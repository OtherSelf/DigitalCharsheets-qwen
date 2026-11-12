'use client';

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import type { SheetHandle } from '@/games/types';

import type { ExampleCharacter } from './types';

/**
 * Кастомный React-лист эталонного плагина: ядро не знает, что здесь внутри,
 * ему важны только пропсы и `SheetHandle.saveAll()`.
 */
export const ExampleSheet = React.forwardRef<
  SheetHandle,
  {
    character: ExampleCharacter;
    isCompactView: boolean;
    activeCompactSection: string;
  }
>(({ character }, ref) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [notes, setNotes] = React.useState(character.notes);

  React.useImperativeHandle(ref, () => ({
    saveAll: () => updateCharacter(character.id, { notes }),
  }));

  return (
    <Card data-testid="example-sheet" className="space-y-4">
      <CardHeader>
        <CardTitle>{t('example.sheetTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {t('example.rank')}
          </span>
          <Input
            value={character.rank}
            readOnly={!showEditButtons}
            onChange={(event) =>
              updateCharacter(character.id, { rank: event.target.value })
            }
          />
        </div>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-label={t('example.notes')}
        />
      </CardContent>
    </Card>
  );
});

ExampleSheet.displayName = 'ExampleSheet';
