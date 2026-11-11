// src/components/layout/user-nav.tsx

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CircleUserRound, Settings, Shield, Type } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';

import { Skeleton } from '../ui/skeleton';
import { AppVersion } from './app-version';
import { DisplaySettingsModal } from './display-settings-modal';

export function UserNav() {
  const { user, isUserLoading, logout } = useLocalAuth();
  const { t } = useTranslation();
  const pathname = usePathname();

  // LANDMARK: DISPLAY_SETTINGS_MODAL_STATE
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  // LANDMARK: DISPLAY_SETTINGS_RETURN_FOCUS
  // Пункт меню «Display Settings» исчезает вместе с меню, поэтому Radix
  // не может вернуть на него фокус и «уронит» его на body. Возвращаем
  // фокус на кнопку профиля — она никуда не девается.
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  if (isUserLoading) return <Skeleton className="h-9 w-9 rounded-full" />;
  if (!user)
    return (
      <Button asChild>
        <Link href="/login">{t('common.signIn') || 'Sign In'}</Link>
      </Button>
    );

  // ─── LANDMARK: SETTINGS_BACK_TARGET ───
  // С дашборда возврат и так ведёт на «/», поэтому `from` не нужен: URL
  // остаётся чистым (/settings). С листа персонажа параметр сохраняем, чтобы
  // стрелка «назад» вернула именно туда. Слэш в query не кодируем — строка
  // читается как /settings?from=/<id>, без %2F. На самой /settings повторный
  // переход из меню не должен делать `from=/settings`.
  const settingsHref =
    pathname && pathname !== '/' && pathname !== '/settings'
      ? `/settings?from=${pathname}`
      : '/settings';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* LANDMARK: USER_NAV_TRIGGER_BUTTON */}
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
          >
            <CircleUserRound className="h-6 w-6" />
            <span className="sr-only">
              {t('common.openUserMenu') || 'Open user menu'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">
                {user.displayName || t('admin.user') || 'User'}
              </p>
              <p className="text-muted-foreground text-xs">{user.username}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* LANDMARK: DISPLAY_SETTINGS_MENU_ITEM */}
          <DropdownMenuItem
            onClick={() => {
              // FIX: Defer opening the dialog by 50ms.
              // This allows the DropdownMenu to fully close and release its focus
              // trap before the Dialog tries to establish its own, preventing the
              // Radix UI aria-hidden/focus race condition that freezes the page.
              setTimeout(() => {
                setIsDisplaySettingsOpen(true);
              }, 50);
            }}
            className="flex w-full cursor-pointer items-center"
          >
            <Type className="mr-2 h-4 w-4" />
            <span>{t('settings.displaySettings') || 'Display Settings'}</span>
          </DropdownMenuItem>

          {/* LANDMARK: SETTINGS_MENU_ITEM */}
          <DropdownMenuItem asChild>
            <Link
              href={settingsHref}
              className="flex w-full cursor-pointer items-center"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('settings.title') || 'Settings'}</span>
            </Link>
          </DropdownMenuItem>

          {/*
            ─── LANDMARK: ADMIN_MENU_ITEM ───
            Ссылка видна только по снимку роли из localStorage. Это лишь UX:
            саму /admin и её API сервер проверяет по user.json, поэтому
            подделанный localStorage откроет страницу, но не данные.
          */}
          {user.role === 'admin' && (
            <DropdownMenuItem asChild>
              <Link
                href="/admin"
                className="flex w-full cursor-pointer items-center"
              >
                <Shield className="mr-2 h-4 w-4" />
                <span>{t('admin.panel') || 'Administration'}</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/*
            ─── LANDMARK: APP_VERSION_FOOTER ───
            Версия и короткий commit над «Выйти»: моноширинно, мелко и
            полупрозрачно — подпись читается при взгляде, но не спорит с
            пунктами меню. Пока /api/version не ответил (или упал), компонент
            не рендерит ничего, и separator остаётся последним разделителем,
            как раньше.
          */}
          <AppVersion />

          <DropdownMenuItem onClick={logout}>
            {t('common.logout') || 'Log out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* LANDMARK: DISPLAY_SETTINGS_MODAL_RENDER */}
      <DisplaySettingsModal
        open={isDisplaySettingsOpen}
        onOpenChange={setIsDisplaySettingsOpen}
        returnFocusRef={menuTriggerRef}
      />
    </>
  );
}
