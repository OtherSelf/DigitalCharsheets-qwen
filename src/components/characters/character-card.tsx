// src/components/characters/character-card.tsx

'use client';

import Link from 'next/link';

import { FileDown, FileJson, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from '@/components/ui/card';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import { getGameDefinition } from '@/games/games';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import {
  DEFAULT_EXPORT_CONFIG,
  exportCharacterToExcel,
  exportCharacterToJSON,
} from '@/lib/export-utils';
import { characterPath } from '@/lib/routes';
import { type Character } from '@/lib/types';

type CharacterCardProps = {
  character: Character;
};

export function CharacterCard({ character }: CharacterCardProps) {
  const { t } = useTranslation();
  const { deleteCharacter, isCompactView, toast } = useCharacterContext();

  const gameModule = getCharacterModule(character);
  const gameDefinition = gameModule
    ? getGameDefinition(gameModule.gameId)
    : undefined;
  // Подпись и цвет бейджа — слот плагина (этап 3); у ядра остаётся
  // нейтральный вариант, если слот не загрузился/не задан.
  const uiSlots = useGameUiSlots(resolveCharacterSystemId(character));
  const summary = uiSlots?.CardSummary?.(character, t);
  const summaryText = summary?.text ?? '';
  const badgeVariant = summary?.badgeVariant ?? 'secondary';
  // Бейдж «игра · редакция» целиком из реестра и i18n.
  const systemLabel =
    gameDefinition && gameModule
      ? `${t(gameDefinition.nameKey)} · ${t(gameModule.nameKey)}`
      : character.gameSystem;

  const handleDelete = () => {
    deleteCharacter(character.id);
  };

  const handleExportJSON = () => {
    const result = exportCharacterToJSON(character, DEFAULT_EXPORT_CONFIG);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: result.error || t('io.exportFailed'),
      });
    }
  };

  const handleExportExcel = () => {
    const result = exportCharacterToExcel(character, new Date(), t);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: result.error || t('io.exportFailed'),
      });
    }
  };

  if (isCompactView) {
    return (
      <Card className="compact-mobile-card hover:shadow-primary/10 flex flex-row items-stretch overflow-hidden p-2 transition-shadow duration-300 hover:shadow-lg sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3 sm:px-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <CardTitle className="sm:text-md font-headline line-clamp-1 text-sm break-words">
              {character.name}
            </CardTitle>
          </div>
          <CardDescription className="mt-0.5 line-clamp-1 text-xs break-words">
            {summaryText}
          </CardDescription>
          <Badge
            variant={badgeVariant}
            className="system-badge mt-2 w-fit max-w-full text-xs"
          >
            {systemLabel}
          </Badge>
        </div>
        <div className="actions-wrapper flex min-w-0 flex-1 items-center justify-end gap-1 p-2 sm:gap-2">
          <Button asChild size="sm" className="h-8 min-w-0 flex-1 px-2 sm:h-9">
            <Link
              href={characterPath(character.id)}
              className="block w-full truncate text-center"
            >
              {t('common.view')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
            onClick={handleExportJSON}
            title={t('io.exportJSON')}
          >
            <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
            onClick={handleExportExcel}
            title={t('io.exportSheet')}
          >
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('common.deleteWarning')}
                  {character.name}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-primary/10 flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lg">
      <CardContent className="flex-grow p-4">
        <Badge variant={badgeVariant} className="mb-2 text-xs sm:text-sm">
          {systemLabel}
        </Badge>
        <CardTitle className="font-headline mb-1 text-base break-words sm:text-lg">
          {character.name}
        </CardTitle>
        <CardDescription className="text-xs break-words sm:text-sm">
          {summaryText}
        </CardDescription>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 p-3 pt-0 sm:p-4">
        <Button asChild className="w-full text-xs sm:text-sm">
          <Link href={characterPath(character.id)}>
            {t('common.viewSheet')}
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
          onClick={handleExportJSON}
          title={t('io.exportJSON')}
        >
          <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
          onClick={handleExportExcel}
          title={t('io.exportSheet')}
        >
          <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('common.deleteWarning')}
                {character.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
