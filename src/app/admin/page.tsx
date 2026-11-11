'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Ban,
  Loader2,
  Pencil,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { formatAdminDate } from '@/components/admin/admin-helpers';
import { AdminGamesSection } from '@/components/admin/games-section';
import { UserBlockDialog } from '@/components/admin/user-block-dialog';
import { UserCharactersDialog } from '@/components/admin/user-characters-dialog';
import { UserDeleteDialog } from '@/components/admin/user-delete-dialog';
import { UserEditDialog } from '@/components/admin/user-edit-dialog';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import type {
  AdminUsersResponse,
  AdminUsersStats,
  AdminUserSummary,
} from '@/lib/admin-types';

/**
 * ─── LANDMARK: ADMIN PAGE (/admin) ─────────────────────────────────────────
 * Отдельная страница администрирования. Доступ:
 *   • страница грузит `/api/admin/users` и реагирует на код ответа:
 *     401 → /login, 403 → / (обычный пользователь), 200 → рендер;
 *   • локальный снимок профиля (role) влияет только на видимость пункта меню,
 *     сами данные защищены серверной проверкой `user.json`.
 *
 * Возможности: поиск, список пользователей, роль, блокировка, смена пароля,
 * удаление, «список чарлистов» (только чтение) и сводные счётчики.
 */
export default function AdminPage() {
  const { t, language } = useTranslation();
  const { user, isUserLoading, updateUser } = useLocalAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminUsersStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [editTarget, setEditTarget] = useState<AdminUserSummary | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminUserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(
    null,
  );
  const [sheetsTarget, setSheetsTarget] = useState<AdminUserSummary | null>(
    null,
  );

  // `t` пересоздаётся LanguageProvider при каждом рендере. Держим ссылку,
  // чтобы `load` не зависел от функции и не запускался по кругу.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const requestedRef = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setError('');

      try {
        const res = await fetch('/api/admin/users', { cache: 'no-store' });

        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (res.status === 403) {
          router.replace('/');
          return;
        }

        const data = (await res
          .json()
          .catch(() => null)) as AdminUsersResponse | null;

        if (!res.ok || !data?.success) {
          setError(data?.error || tRef.current('admin.loadFailed'));
          return;
        }

        setUsers(data.users);
        setStats(data.stats);
      } catch {
        setError(tRef.current('admin.loadFailed'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (requestedRef.current) return;
    requestedRef.current = true;
    void load();
  }, [isUserLoading, user, load, router]);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((item) =>
      [item.username, item.displayName, item.uid].some((field) =>
        field.toLowerCase().includes(value),
      ),
    );
  }, [users, query]);

  const isFiltered = query.trim().length > 0;

  /**
   * ─── LANDMARK: ADMIN_STATS_FILTERED ─────────────────────────────────────
   * Пока поиск пуст, показываем глобальные счётчики с сервера. Как только
   * появляется фильтр — считаем статистику по видимым строкам: цифры в
   * карточках совпадают с таблицей, а не с «всеми аккаунтами», и снимок
   * /admin не зависит от числа воркерских аккаунтов.
   */
  const visibleStats = useMemo<AdminUsersStats>(() => {
    if (!isFiltered) {
      return (
        stats ?? { totalUsers: 0, admins: 0, blocked: 0, totalCharacters: 0 }
      );
    }
    return {
      totalUsers: filteredUsers.length,
      admins: filteredUsers.filter(
        (item) => item.role === 'admin' && !item.isBlocked,
      ).length,
      blocked: filteredUsers.filter((item) => item.isBlocked).length,
      totalCharacters: filteredUsers.reduce(
        (sum, item) => sum + item.characterCount,
        0,
      ),
    };
  }, [filteredUsers, isFiltered, stats]);

  const statCards: {
    key: string;
    label: string;
    value: number;
    icon: LucideIcon;
  }[] = [
    {
      key: 'total',
      label: t('admin.statsTotal'),
      value: visibleStats.totalUsers,
      icon: Users,
    },
    {
      key: 'admins',
      label: t('admin.statsAdmins'),
      value: visibleStats.admins,
      icon: ShieldCheck,
    },
    {
      key: 'blocked',
      label: t('admin.statsBlocked'),
      value: visibleStats.blocked,
      icon: Ban,
    },
    {
      key: 'characters',
      label: t('admin.statsCharacters'),
      value: visibleStats.totalCharacters,
      icon: ScrollText,
    },
  ];

  const handleSaved = (updated: AdminUserSummary) => {
    if (user && updated.uid === user.uid) {
      updateUser({
        ...user,
        username: updated.username,
        displayName: updated.displayName,
        role: updated.role,
        mustChangePassword: updated.mustChangePassword,
      });
      if (updated.role !== 'admin') {
        router.replace('/');
        return;
      }
    }
    setEditTarget(null);
    void load(true);
  };

  const handleBlockDone = () => {
    setBlockTarget(null);
    void load(true);
  };

  const handleDeleteDone = () => {
    setDeleteTarget(null);
    void load(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header title={t('admin.panel')} subtitle={t('admin.panelSubtitle')} />

      <main className="safe-area-bottom flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {error && (
            <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          {/*
            ─── LANDMARK: ADMIN_STATS_GRID ───
            Две колонки уже на телефоне: четыре карточки в столбик отжимали
            таблицу ниже первого экрана, а подписи и так обрезаются
            (`truncate`).
          */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.key}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
                        {card.label}
                      </p>
                      <p
                        className="mt-1 text-2xl font-bold tabular-nums"
                        data-testid="admin-stat-value"
                      >
                        {card.value}
                      </p>
                    </div>
                    <Icon
                      className="text-muted-foreground h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <AdminGamesSection />

          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>{t('admin.usersTitle')}</CardTitle>
                <CardDescription>
                  {isFiltered
                    ? t('admin.filteredDescription')
                    : t('admin.usersDescription')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('admin.searchPlaceholder')}
                    aria-label={t('admin.searchPlaceholder')}
                    className="pl-8"
                    data-testid="admin-search"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void load(true)}
                  disabled={isRefreshing}
                  aria-label={t('admin.refresh')}
                  title={t('admin.refresh')}
                >
                  <RefreshCw
                    className={
                      isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
                    }
                  />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {filteredUsers.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
                  <Users className="h-8 w-8" aria-hidden="true" />
                  <p>
                    {users.length === 0
                      ? t('admin.noUsers')
                      : t('admin.noSearchResults')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.columnUser')}</TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('admin.columnRole')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('admin.columnStatus')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('admin.columnSheets')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('admin.columnCreated')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('admin.columnLastLogin')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('admin.columnActions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((item) => {
                        const isSelf = user?.uid === item.uid;

                        const roleBadge = (
                          <Badge
                            variant={
                              item.role === 'admin'
                                ? 'default'
                                : item.role === 'tester'
                                  ? 'outline'
                                  : 'secondary'
                            }
                          >
                            {item.role === 'admin'
                              ? t('admin.roleAdmin')
                              : item.role === 'tester'
                                ? t('admin.roleTester')
                                : t('admin.roleUser')}
                          </Badge>
                        );
                        const statusBadge = (
                          <Badge
                            variant={item.isBlocked ? 'destructive' : 'outline'}
                          >
                            {item.isBlocked
                              ? t('admin.statusBlocked')
                              : t('admin.statusActive')}
                          </Badge>
                        );
                        const sheetsButton = (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2"
                            onClick={() => setSheetsTarget(item)}
                            aria-label={`${t('admin.viewSheets')}: ${item.displayName}`}
                            title={t('admin.viewSheets')}
                          >
                            <ScrollText
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span className="tabular-nums">
                              {item.characterCount}
                            </span>
                          </Button>
                        );

                        return (
                          <TableRow
                            key={item.uid}
                            data-uid={item.uid}
                            data-username={item.username}
                            data-testid="admin-user-row"
                          >
                            <TableCell>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {item.displayName}
                                  </span>
                                  {isSelf && (
                                    <Badge variant="outline">
                                      {t('admin.you')}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-muted-foreground truncate text-xs">
                                  @{item.username}
                                </p>
                                {/*
                                  ─── LANDMARK: ADMIN_MOBILE_ROW_SUMMARY ───
                                  На телефоне таблица не помещается целиком.
                                  Вместо горизонтальной прокрутки прячем
                                  второстепенные колонки (md:table-cell) и
                                  показываем роль/статус/листы под именем.
                                  Кнопки продублированы в DOM, но скрытая
                                  копия не попадает в accessibility tree.
                                */}
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                                  {roleBadge}
                                  {statusBadge}
                                  {sheetsButton}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {roleBadge}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {statusBadge}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {sheetsButton}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden text-xs whitespace-nowrap md:table-cell">
                              {formatAdminDate(item.createdAt, language)}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden text-xs whitespace-nowrap md:table-cell">
                              {formatAdminDate(item.lastLoginAt, language)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditTarget(item)}
                                  aria-label={`${t('admin.editUser')}: ${item.displayName}`}
                                  title={t('admin.editUser')}
                                >
                                  <Pencil
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </Button>
                                {!isSelf && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setBlockTarget(item)}
                                      aria-label={`${item.isBlocked ? t('admin.unblock') : t('admin.block')}: ${item.displayName}`}
                                      title={
                                        item.isBlocked
                                          ? t('admin.unblock')
                                          : t('admin.block')
                                      }
                                    >
                                      {item.isBlocked ? (
                                        <ShieldCheck
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <Ban
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive h-8 w-8"
                                      onClick={() => setDeleteTarget(item)}
                                      aria-label={`${t('common.delete')}: ${item.displayName}`}
                                      title={t('common.delete')}
                                    >
                                      <Trash2
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <UserEditDialog
        user={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={handleSaved}
      />
      <UserBlockDialog
        user={blockTarget}
        onOpenChange={(open) => {
          if (!open) setBlockTarget(null);
        }}
        onDone={handleBlockDone}
      />
      <UserDeleteDialog
        user={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDone={handleDeleteDone}
      />
      <UserCharactersDialog
        user={sheetsTarget}
        onOpenChange={(open) => {
          if (!open) setSheetsTarget(null);
        }}
      />
    </div>
  );
}
