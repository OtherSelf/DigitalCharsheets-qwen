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
import { useTranslation } from '@/context/language-context';
import type {
  AdminCharactersResponse,
  AdminCharacterSummary,
  AdminUserSummary,
} from '@/lib/admin-types';

import { adminCharacterLevelLabel, formatAdminDate } from './admin-helpers';

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
          setError(t('adminSheetsLoadFailed'));
          return;
        }
        setCharacters(data.characters);
      } catch {
        if (!cancelled) setError(t('adminSheetsLoadFailed'));
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
            {t('adminSheetsTitle').replace('{name}', user?.displayName ?? '')}
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
            {t('adminSheetsEmpty')}
          </p>
        ) : (
          <div className="max-h-[60vh] min-w-0 overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminColumnCharacter')}</TableHead>
                  <TableHead>{t('gameSystem')}</TableHead>
                  <TableHead>{t('class')}</TableHead>
                  <TableHead>{t('adminLevelOrRank')}</TableHead>
                  <TableHead>{t('adminUpdated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {characters.map((character) => (
                  <TableRow key={character.id}>
                    <TableCell className="font-medium">
                      {character.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          character.gameSystem === 'Dungeons & Dragons'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {character.gameSystem === 'Dungeons & Dragons'
                          ? 'D&D 5e'
                          : character.gameSystem}
                      </Badge>
                    </TableCell>
                    <TableCell>{character.characterClass || '—'}</TableCell>
                    <TableCell>
                      {adminCharacterLevelLabel(character, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatAdminDate(character.updatedAt, language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
