// src/app/page.tsx

'use client';

import { CharacterCard } from '@/components/characters/character-card';
import { Header } from '@/components/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useCharacterContext } from '@/context/character-context';
import { cn } from '@/lib/utils';
import { PlusCircle, FileDown, Settings2 } from 'lucide-react';
import Loading from './loading';
import { useTranslation } from '@/context/language-context';
import Link from 'next/link';
import { useLocalAuth } from '@/context/local-auth-context';
import { ImportCharacterDialog } from '@/components/import-character-dialog';
import { DynamicFavicon } from '@/components/dynamic-favicon';

export default function DashboardPage() {
  const { characters, isLoaded, isCompactView } = useCharacterContext();
  const { user } = useLocalAuth();
  const { t } = useTranslation();

  if (!isLoaded) {
    return <Loading />;
  }

  return (
    <>
      <DynamicFavicon gameSystem="default" />
      <div className="flex flex-col h-dvh">
        {/* 🎯 LANDMARK: HEADER_WITH_MOBILE_ACTIONS */}
        <Header
          mobileActions={
            <>
              <DropdownMenuItem asChild>
                <Link href="/stats-editor" className="flex items-center cursor-pointer">
                  <Settings2 className="mr-2 h-4 w-4" />
                  <span>{t('statsEditor')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center cursor-pointer"
                disabled={!user}
                onClick={async () => {
                  if (!user) return;
                  const res = await fetch(`/api/export?userId=${user.uid}`);
                  const data = await res.json();
                  downloadJSON(data, `characters-backup-${new Date().toISOString().split('T')[0]}.json`);
                }}
              >
                <FileDown className="mr-2 h-4 w-4" />
                <span>{t('backupAll')}</span>
              </DropdownMenuItem>
            </>
          }
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 safe-area-bottom">
          <div className="mb-6 sm:mb-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl font-headline font-bold">
                {t('existingCharacters')}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                {t('companionText')}
              </p>
            </div>
            {/* 🎯 LANDMARK: DESKTOP_BUTTON_GROUP - Hidden on mobile, visible on sm+ */}
            <div className="hidden sm:flex flex-row gap-2 w-auto">
              <Button variant="outline" size="sm" asChild className="justify-start">
                <Link href="/stats-editor">
                  <Settings2 className="mr-2 h-4 w-4 shrink-0" />
                  {t('statsEditor')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!user}
                onClick={async () => {
                  if (!user) return;
                  const res = await fetch(`/api/export?userId=${user.uid}`);
                  const data = await res.json();
                  downloadJSON(data, `characters-backup-${new Date().toISOString().split('T')[0]}.json`);
                }}
                className="justify-start"
              >
                <FileDown className="mr-2 h-4 w-4 shrink-0" />
                {t('backupAll')}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('myCharacters')}</CardTitle>
              <CardDescription>
                {t('allHeroes')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'grid gap-4',
                  isCompactView
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}
              >
                {characters.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
                {isCompactView ? (
                  <Button variant="outline" asChild className="flex items-center justify-center w-full h-16 sm:h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                    <Link href="/new/manual">
                      <PlusCircle className="h-6 w-6 sm:h-8 sm:w-8 mr-3 sm:mr-4" />
                      <span className="font-semibold text-sm sm:text-base">{t('createNew')}</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" asChild className="flex flex-col items-center justify-center w-full h-full min-h-[180px] sm:min-h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                    <Link href="/new/manual">
                      <PlusCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-2" />
                      <span className="font-semibold text-sm sm:text-base">{t('createNew')}</span>
                    </Link>
                  </Button>
                )}
                <ImportCharacterDialog isCompactView={isCompactView} />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}