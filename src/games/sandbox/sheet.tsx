'use client';

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import type { SheetHandle } from '@/games/types';

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
    <div className={styles.sheet} data-testid="sandbox-sheet">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-primary">
            {t('sandbox.sheetTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              {t('sandbox.rank')}
            </span>
            <Input
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
              <dd className="text-lg font-semibold">{character.stats.might}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t('sandbox.stat.wits')}
              </dt>
              <dd className="text-lg font-semibold">{character.stats.wits}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sandbox.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-label={t('sandbox.notes')}
          />
        </CardContent>
      </Card>
    </div>
  );
});

SandboxSheet.displayName = 'SandboxSheet';
