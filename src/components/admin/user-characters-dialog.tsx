'use client';

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/context/language-context';
import type { CharacterRecord } from '@/games/types';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import type {
  AdminCharactersResponse,
  AdminCharacterSummary,
  AdminUserSummary,
} from '@/lib/admin-types';

import { adminGameBadge, formatAdminDate } from './admin-helpers';

/**
 * Подпись листа в таблице: её собирает плагин слотом `CardSummary`. Ядро
 * передаёт только сырой лист и переводчик, поэтому не знает ни уровня, ни
 * ранга (D7).
 */
function AdminCharacterDetails({
  character,
}: {
  character: AdminCharacterSummary;
}) {
  const { t } = useTranslation();
  const slots = useGameUiSlots(character.systemId ?? undefined);
  const summary = slots?.CardSummary?.(
    character.sheet as unknown as CharacterRecord,
    t,
  );
  return (
    <TableCell data-testid="admin-sheet-details">
      {summary?.text || '—'}
    </TableCell>
  );
}

interface UserCharactersDialogProps {
  user: AdminUserSummary | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * ─── LANDMARK: ADMIN_USER_SHEETS ────────────────────────────────────────────
 * «Список чарлистов» по кнопке: только чтение и только сводка. Админ видит,
 * что есть у пользователя, но не открывает и не правит чужой лист.
 */
export function UserCharactersDialog({
  user,
  onOpenChange,
}: UserCharactersDialogProps) {
  const { t, language } = useTranslation();

  const [characters, setCharacters] = useState<AdminCharacterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setCharacters([]);
    setError('');
    setIsLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.uid}/characters`);
        const data = (await res
          .json()
          .catch(() => null)) as AdminCharactersResponse | null;
        if (cancelled) return;

        if (!res.ok || !data?.success) {
          setError(t('admin.sheetsLoadFailed'));
          return;
        }
        setCharacters(data.characters);
      } catch {
        if (!cancelled) setError(t('admin.sheetsLoadFailed'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // t меняется каждый рендер LanguageProvider — зависимость не добавляем,
    // иначе эффект перезапускается бесконечно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="admin-sheets-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('admin.sheetsTitle').replace('{name}', user?.displayName ?? '')}
          </DialogTitle>
          <DialogDescription>
            {user ? `@${user.username} · ${user.characterCount}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : characters.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t('admin.sheetsEmpty')}
          </p>
        ) : (
          <div className="max-h-[60vh] min-w-0 overflow-x-auto overflow-y-auto">
            <TooltipProvider delayDuration={150}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.columnCharacter')}</TableHead>
                    <TableHead>{t('admin.gameSystem')}</TableHead>
                    <TableHead>{t('admin.details')}</TableHead>
                    <TableHead>{t('admin.updated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {characters.map((character) => {
                    const gameBadge = adminGameBadge(character, t);
                    return (
                      <TableRow key={character.id}>
                        <TableCell className="font-medium">
                          {character.name}
                        </TableCell>
                        <TableCell>
                          {gameBadge.title ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" tabIndex={0}>
                                  {gameBadge.code}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {gameBadge.title}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="secondary">{gameBadge.code}</Badge>
                          )}
                        </TableCell>
                        <AdminCharacterDetails character={character} />
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatAdminDate(character.updatedAt, language)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
