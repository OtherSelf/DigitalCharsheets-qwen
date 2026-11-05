'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { useLocalAuth } from "@/context/local-auth-context";
import { CircleUserRound, Settings } from "lucide-react";
import { useTranslation } from '@/context/language-context';

export function UserNav() {
  const { user, isUserLoading, logout } = useLocalAuth();
  const { t } = useTranslation();

  if (isUserLoading) return <Skeleton className="h-9 w-9 rounded-full" />;
  if (!user) return <Button asChild><Link href="/login">{t('signIn') || 'Sign In'}</Link></Button>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* 🎯 LANDMARK: USER_NAV_TRIGGER_BUTTON */}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <CircleUserRound className="h-6 w-6" />
          <span className="sr-only">{t('openUserMenu') || 'Open user menu'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {/* Display Name (Username in UI) */}
            <p className="text-sm font-medium leading-none">{user.displayName || (t('user') || 'User')}</p>
            {/* Login (Email/Username used for auth) */}
            <p className="text-xs text-muted-foreground">{user.username}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* 🎯 LANDMARK: SETTINGS_MENU_ITEM */}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex w-full items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('settings') || 'Settings'}</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>{t('logout') || 'Log out'}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}