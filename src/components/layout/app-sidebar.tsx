'use client';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Swords, Home, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <ScrollText className="w-8 h-8 text-primary" />
          <div className="flex flex-col">
            <h2 className="text-lg font-headline font-semibold">Digital Character Sheets</h2>
            <p className="text-xs text-muted-foreground">Character Manager</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/')}
              tooltip="Dashboard"
            >
              <Link href="/">
                <Home />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/new')}
              tooltip="New Character"
            >
              <Link href="/new/manual">
                <Swords />
                <span>New Character</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
