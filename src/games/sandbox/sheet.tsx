'use client';

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import type { SheetHandle } from '@/games/types';
import { cn } from '@/lib/utils';

import styles from './sheet.module.css';
import type { SandboxCharacter } from './types';

/**
 * Лист песочницы — живой эталон контракта плагина.
 *
 * Он нарочно маленький, но использует всё, что ядро обязан отдавать игре:
 * свой CSS-модуль (раскладка ниже — из `sheet.module.css`, а не из
 * `globals.css`), токены темы из `plugin.json#ui.theme` (цвет заголовка и
 * акцент карточки), ленивый UI-слот в шапке, сохранение через `updateCharacter`
 * и `saveAll()` для кнопки «Сохранить» в шапке.
 */
export const SandboxSheet = React.forwardRef<
  SheetHandle,
  {
    character: SandboxCharacter;
    isCompactView: boolean;
    isPhoneView: boolean;
    activeCompactSection: string;
  }
>(({ character, isCompactView }, ref) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [notes, setNotes] = React.useState(character.notes);

  React.useImperativeHandle(ref, () => ({
    saveAll: () => updateCharacter(character.id, { notes }),
  }));

  return (
    <div
      id="info-section"
      className={cn(styles.sheet, isCompactView && styles.compact)}
      data-testid="sandbox-sheet"
    >
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="font-headline text-primary">
            {t('sandbox.sheetTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label
              htmlFor="sandbox-rank"
              className="text-muted-foreground text-sm"
            >
              {t('sandbox.rank')}
            </Label>
            <Input
              id="sandbox-rank"
              value={character.rank}
              readOnly={!showEditButtons}
              onChange={(event) =>
                updateCharacter(character.id, { rank: event.target.value })
              }
            />
          </div>
          <dl className={styles.stats}>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t('sandbox.stat.might')}
              </dt>
              <dd
                className="text-lg font-semibold"
                title={`${t('sandbox.stat.might')}: ${character.stats.might}`}
              >
                {character.stats.might}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t('sandbox.stat.wits')}
              </dt>
              <dd
                className="text-lg font-semibold"
                title={`${t('sandbox.stat.wits')}: ${character.stats.wits}`}
              >
                {character.stats.wits}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t('sandbox.total')}
              </dt>
              <dd
                className="text-primary text-lg font-semibold"
                data-testid="sandbox-total"
                title={`${t('sandbox.total')}: ${character.total}`}
              >
                {character.total}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {character.companion && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              {t('sandbox.companion')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{character.companion.name}</p>
            <p className="text-muted-foreground">
              {t('sandbox.companionKind')}: {character.companion.kind}
            </p>
            <p className="text-muted-foreground">{character.companion.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-base">
            {t('sandbox.notes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            readOnly={!showEditButtons}
            onChange={(event) => setNotes(event.target.value)}
            aria-label={t('sandbox.notes')}
          />
        </CardContent>
      </Card>
    </div>
  );
});

SandboxSheet.displayName = 'SandboxSheet';
