// src/app/page.tsx

'use client';

import Link from 'next/link';

import { FileDown, PlusCircle, Scroll, Settings2 } from 'lucide-react';

import { CharacterCard } from '@/components/characters/character-card';
import { DemoLanding } from '@/components/demo-landing';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { ImportCharacterDialog } from '@/components/import-character-dialog';
import { GuestHeader } from '@/components/layout/guest-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { buildBackupExport, exportFileName } from '@/lib/export-utils';
import { type Character } from '@/lib/types';
import { cn } from '@/lib/utils';

import Loading from './loading';

// 🎯 LANDMARK: DEMO_LANDING_VIEW_COMPONENT
function DemoLandingView() {
  return (
    <>
      {/* 🎯 LANDMARK: DEMO_SCROLL_OVERRIDE - Override body height constraint */}
      <style jsx global>{`
        html,
        body {
          height: auto !important;
          overflow-y: auto !important;
        }
      `}</style>

      <div className="bg-background">
        {/* 🎯 LANDMARK: DEMO_HEADER → общая гостевая шапка с темой/языком/видом */}
        <GuestHeader showLoginLink />

        <main className="container mx-auto max-w-6xl px-4 py-8 pb-20">
          <DemoLanding createHref="/new/manual" />
        </main>
      </div>
    </>
  );
}

// 🎯 LANDMARK: MAIN_DASHBOARD_PAGE
export default function DashboardPage() {
  const {
    characters,
    isLoaded,
    isCompactView,
    pendingDraft,
    createPendingDraft,
    discardPendingDraft,
  } = useCharacterContext();
  const { user, isUserLoading } = useLocalAuth();
  const { t } = useTranslation();

  // «Backup All»: сервер отдаёт листы, клиент упаковывает их в стандартный
  // конверт и называет файл по шаблону dcs_characters_all_<логин>_<дата>.json.
  const handleBackupAll = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        console.error('Backup export failed:', res.status, await res.text());
        return;
      }
      const exported = await res.json();
      const backup = buildBackupExport(exported as Character[], user.username);
      downloadJSON(backup, exportFileName('backup', { login: user.username }));
    } catch (error) {
      console.error('Backup export failed:', error);
    }
  };

  if (!isLoaded || isUserLoading) {
    return <Loading />;
  }

  // 🎯 LANDMARK: UNREGISTERED_DEMO_VIEW_REDIRECT
  if (!user) {
    return <DemoLandingView />;
  }

  return (
    <>
      <DynamicFavicon gameSystem="default" />
      <div className="flex h-dvh flex-col">
        {/* 🎯 LANDMARK: HEADER_WITH_MOBILE_ACTIONS */}
        <Header
          mobileActions={
            <>
              <DropdownMenuItem asChild>
                <Link
                  href="/stats-editor"
                  className="flex cursor-pointer items-center"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  <span>{t('statsEditor')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex cursor-pointer items-center"
                disabled={!user}
                onClick={handleBackupAll}
              >
                <FileDown className="mr-2 h-4 w-4" />
                <span>{t('backupAll')}</span>
              </DropdownMenuItem>
            </>
          }
        />

        <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          {/* 🎯 LANDMARK: PENDING_DRAFT_BANNER
              Персонаж, начерченный гостем до входа, не создаётся автоматически
              в существующем аккаунте: он ждёт здесь явного решения. Иначе после
              входа список выглядел так, будто старые листы потерялись. */}
          {pendingDraft && (
            <Alert
              className="mb-6 border-primary/30 bg-primary/5"
              data-testid="pending-draft"
            >
              <Scroll className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {t('pendingDraftTitle')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('pendingDraftDesc').replace(
                      '{name}',
                      pendingDraft.name || '—',
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    onClick={createPendingDraft}
                    data-testid="pending-draft-create"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('pendingDraftCreate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={discardPendingDraft}
                    data-testid="pending-draft-discard"
                  >
                    {t('pendingDraftDiscard')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-6 flex flex-col gap-4 sm:mb-8">
            <div className="flex flex-col gap-2">
              <h1 className="font-headline text-2xl font-bold sm:text-3xl">
                {t('existingCharacters')}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t('companionText')}
              </p>
            </div>
            {/* 🎯 LANDMARK: DESKTOP_BUTTON_GROUP - Hidden on mobile, visible on sm+ */}
            <div className="hidden w-auto flex-row gap-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="justify-start"
              >
                <Link href="/stats-editor">
                  <Settings2 className="mr-2 h-4 w-4 shrink-0" />
                  {t('statsEditor')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!user}
                onClick={handleBackupAll}
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
              <CardDescription>{t('allHeroes')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'grid gap-4',
                  isCompactView
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                )}
              >
                {characters.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
                {isCompactView ? (
                  <Button
                    variant="outline"
                    asChild
                    className="flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-transparent p-0 text-muted-foreground transition-colors duration-200 hover:border-accent hover:bg-accent/10 hover:text-accent-foreground sm:h-20"
                  >
                    <Link href="/new/manual">
                      <PlusCircle className="mr-3 h-6 w-6 sm:mr-4 sm:h-8 sm:w-8" />
                      <span className="text-sm font-semibold sm:text-base">
                        {t('createNew')}
                      </span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    asChild
                    className="flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-transparent p-0 text-muted-foreground transition-colors duration-200 hover:border-accent hover:bg-accent/10 hover:text-accent-foreground sm:min-h-[200px]"
                  >
                    <Link href="/new/manual">
                      <PlusCircle className="mb-2 h-10 w-10 sm:h-12 sm:w-12" />
                      <span className="text-sm font-semibold sm:text-base">
                        {t('createNew')}
                      </span>
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
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
