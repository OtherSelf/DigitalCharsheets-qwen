// src/components/characters/character-card.tsx

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { Archive, FileDown, FileJson } from 'lucide-react';

import { DeleteCharacterDialog } from '@/components/characters/delete-character-dialog';
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
import type { CardBadgeVariant } from '@/games/types';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import {
  DEFAULT_EXPORT_CONFIG,
  exportCharacterToExcel,
  exportCharacterToJSON,
} from '@/lib/export-utils';
import { characterPath } from '@/lib/routes';
import { type Character } from '@/lib/types';
import { cn } from '@/lib/utils';

type CharacterCardProps = {
  character: Character;
  /**
   * Ручка перетаскивания (drag-and-drop из дашборда). Карточка сама её не
   * создаёт: порядок и сенсоры живут в дашборде, а карточка только отводит
   * место слева, чтобы ручка не перекрывала бейдж и заголовок.
   */
  dragHandle?: ReactNode;
  /**
   * Красить карточку акцентом редакции: тонкая полоса слева и фон бейджа в
   * `--card-accent` (его объявляет `gameAccentCss` на `data-card-accent`).
   * `false` — админ включил «стили ядра» или у редакции нет темы.
   */
  accent?: boolean;
};

/** Бейдж «игра / редакция»: две строки, игра — жирным. */
function EditionBadge({
  game,
  edition,
  fallback,
  accent,
  variant,
  className,
}: {
  game?: string;
  edition?: string;
  fallback: string;
  accent?: boolean;
  variant: CardBadgeVariant;
  className?: string;
}) {
  return (
    <div
      data-testid="edition-badge"
      className={cn(
        'inline-flex max-w-full flex-col items-start rounded-lg border px-2.5 py-1 leading-tight',
        !accent &&
          (variant === 'secondary'
            ? 'bg-secondary text-secondary-foreground border-transparent'
            : 'border-border text-foreground'),
        className,
      )}
      // `hsl(var(--card-accent) …)` не генерируется Tailwind как utility (var
      // в произвольном значении), поэтому акцент задаём инлайном: переменная
      // наследуется от карточки с `data-card-accent`.
      style={
        accent
          ? {
              color: 'var(--card-accent-strong, hsl(var(--card-accent)))',
              backgroundColor: 'hsl(var(--card-accent) / 0.10)',
              borderColor: 'hsl(var(--card-accent) / 0.40)',
            }
          : undefined
      }
    >
      <span className="text-11px font-semibold sm:text-xs">
        {game ?? fallback}
      </span>
      {edition && (
        <span className="text-10px sm:text-11px font-normal">{edition}</span>
      )}
    </div>
  );
}

export function CharacterCard({
  character,
  dragHandle,
  accent = false,
}: CharacterCardProps) {
  const { t, tUnsafe } = useTranslation();
  const {
    archiveCharacter,
    deleteCharacter,
    isCompactView,
    isPhoneView,
    toast,
  } = useCharacterContext();
  // Плотный вид на планшете и десктопе — это обычная карточка, но с более
  // тесным низом: пять колонок по 16rem не вмещают прежние 44-пиксельные
  // кнопки, и корзина уезжала за край (карточка режет overflow).
  const isDense = isCompactView && !isPhoneView;

  const gameModule = getCharacterModule(character);
  const gameDefinition = gameModule
    ? getGameDefinition(gameModule.gameId)
    : undefined;
  // Подпись и цвет бейджа — слот плагина (этап 3); у ядра остаётся
  // нейтральный вариант, если слот не загрузился/не задан.
  const uiSlots = useGameUiSlots(resolveCharacterSystemId(character));
  const summary = uiSlots?.CardSummary?.(character, tUnsafe);
  const summaryText = summary?.text ?? '';
  const badgeVariant: CardBadgeVariant = summary?.badgeVariant ?? 'secondary';
  const systemId = resolveCharacterSystemId(character);
  // Бейдж «игра / редакция»: две строки, чтобы длинные названия не ломали
  // карточку; названия — из реестра и i18n, не из ядра.
  const gameLabel = gameDefinition
    ? tUnsafe(gameDefinition.nameKey)
    : undefined;
  const editionLabel = gameModule ? tUnsafe(gameModule.nameKey) : undefined;

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

  const handleExportExcel = async () => {
    const result = await exportCharacterToExcel(character, new Date(), tUnsafe);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: result.error || t('io.exportFailed'),
      });
    }
  };

  if (isPhoneView) {
    return (
      <Card
        className={cn(
          'compact-mobile-card hover:shadow-primary/10 group relative flex h-full flex-row items-stretch overflow-hidden p-2 transition-shadow duration-300 hover:shadow-lg sm:flex-row',
          accent && 'border-l-4',
        )}
        data-card-accent={accent ? systemId : undefined}
        style={
          accent ? { borderLeftColor: 'hsl(var(--card-accent))' } : undefined
        }
      >
        {dragHandle && (
          <div className="absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-center">
            {dragHandle}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center pr-3 pl-10 sm:pr-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <CardTitle className="sm:text-md font-headline line-clamp-1 text-sm break-words">
              {character.name}
            </CardTitle>
          </div>
          <CardDescription className="mt-0.5 line-clamp-1 text-xs break-words">
            {summaryText}
          </CardDescription>
          <EditionBadge
            game={gameLabel}
            edition={editionLabel}
            fallback={character.gameSystem ?? ''}
            accent={accent}
            variant={badgeVariant}
            className="system-badge mt-2 w-fit text-xs"
          />
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
          {/* Как на десктопе (ручка/архив в углу): архив — вторичное
              действие, поэтому ghost, а не такая же обводка, как у экспорта. */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-11 w-11 shrink-0 sm:h-9 sm:w-9',
              isDense && 'sm:h-8 sm:w-8',
            )}
            onClick={() => archiveCharacter(character.id)}
            title={t('common.archiveCharacter')}
            aria-label={t('common.archiveCharacter')}
            data-testid="archive-character"
          >
            <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-11 w-11 shrink-0 sm:h-9 sm:w-9',
              isDense && 'sm:h-8 sm:w-8',
            )}
            onClick={handleExportJSON}
            title={t('io.exportJSON')}
            aria-label={t('io.exportJSON')}
            data-testid="export-json"
          >
            <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-11 w-11 shrink-0 sm:h-9 sm:w-9',
              isDense && 'sm:h-8 sm:w-8',
            )}
            onClick={handleExportExcel}
            title={t('io.exportSheet')}
            aria-label={t('io.exportSheet')}
            data-testid="export-excel"
          >
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <DeleteCharacterDialog
            name={character.name}
            onDelete={handleDelete}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'hover:shadow-primary/10 group relative flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lg',
        accent && 'border-l-4 border-l-[hsl(var(--card-accent))]',
      )}
      data-card-accent={accent ? systemId : undefined}
    >
      {dragHandle && (
        <div className="absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-center">
          {dragHandle}
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'absolute top-2 right-2 z-10 h-11 w-11 sm:h-9 sm:w-9',
          isDense && 'sm:h-8 sm:w-8',
        )}
        onClick={() => archiveCharacter(character.id)}
        title={t('common.archiveCharacter')}
        aria-label={t('common.archiveCharacter')}
        data-testid="archive-character"
      >
        <Archive className="h-4 w-4" />
      </Button>
      <CardContent className="flex-grow py-4 pr-12 pl-10">
        <EditionBadge
          game={gameLabel}
          edition={editionLabel}
          fallback={character.gameSystem ?? ''}
          accent={accent}
          variant={badgeVariant}
          className="mb-2"
        />
        <CardTitle className="font-headline mb-1 text-base break-words sm:text-lg">
          {character.name}
        </CardTitle>
        <CardDescription className="text-xs break-words sm:text-sm">
          {summaryText}
        </CardDescription>
      </CardContent>
      <CardFooter
        className={cn(
          'flex items-center justify-between gap-2 p-3 pt-0 sm:p-4',
          isDense && 'gap-1 p-2 pt-0',
        )}
      >
        <Button
          asChild
          className={cn('w-full text-xs sm:text-sm', isDense && 'px-2')}
        >
          <Link href={characterPath(character.id)}>
            {t('common.viewSheet')}
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'h-11 w-11 shrink-0 sm:h-9 sm:w-9',
            isDense && 'sm:h-8 sm:w-8',
          )}
          onClick={handleExportJSON}
          title={t('io.exportJSON')}
          aria-label={t('io.exportJSON')}
          data-testid="export-json"
        >
          <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'h-11 w-11 shrink-0 sm:h-9 sm:w-9',
            isDense && 'sm:h-8 sm:w-8',
          )}
          onClick={handleExportExcel}
          title={t('io.exportSheet')}
          aria-label={t('io.exportSheet')}
          data-testid="export-excel"
        >
          <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <DeleteCharacterDialog
          name={character.name}
          onDelete={handleDelete}
          dense={isDense}
        />
      </CardFooter>
    </Card>
  );
}
