// src/app/page.tsx

'use client';

import Link from 'next/link';

import { FileDown, PlusCircle, Scroll, Settings2 } from 'lucide-react';

import { CharacterCard } from '@/components/characters/character-card';
import { DemoLandingView } from '@/components/demo-landing-view';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { ImportCharacterDialog } from '@/components/import-character-dialog';
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

// LANDMARK: MAIN_DASHBOARD_PAGE
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

  // LANDMARK: UNREGISTERED_DEMO_VIEW_REDIRECT
  if (!user) {
    return <DemoLandingView />;
  }

  return (
    <>
      <DynamicFavicon gameSystem="default" />
      <div className="flex h-dvh flex-col">
        {/* LANDMARK: HEADER_WITH_MOBILE_ACTIONS */}
        <Header
          mobileActions={
            <>
              <DropdownMenuItem asChild>
                <Link
                  href="/stats-editor"
                  className="flex cursor-pointer items-center"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  <span>{t('common.statsEditor')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex cursor-pointer items-center"
                disabled={!user}
                onClick={handleBackupAll}
              >
                <FileDown className="mr-2 h-4 w-4" />
                <span>{t('common.backupAll')}</span>
              </DropdownMenuItem>
            </>
          }
        />

        <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          {/* LANDMARK: PENDING_DRAFT_BANNER
              Персонаж, начерченный гостем до входа, не создаётся автоматически
              в существующем аккаунте: он ждёт здесь явного решения. Иначе после
              входа список выглядел так, будто старые листы потерялись. */}
          {pendingDraft && (
            <Alert
              className="border-primary/30 bg-primary/5 mb-6"
              data-testid="pending-draft"
            >
              <Scroll className="text-primary h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-foreground font-medium">
                    {t('common.pendingDraftTitle')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('common.pendingDraftDesc').replace(
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
                    {t('common.pendingDraftCreate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={discardPendingDraft}
                    data-testid="pending-draft-discard"
                  >
                    {t('common.pendingDraftDiscard')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-6 flex flex-col gap-4 sm:mb-8">
            <div className="flex flex-col gap-2">
              <h1 className="font-headline text-2xl font-bold sm:text-3xl">
                {t('common.existingCharacters')}
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
                {t('common.companionText')}
              </p>
            </div>
            {/* LANDMARK: DESKTOP_BUTTON_GROUP - Hidden on mobile, visible on sm+ */}
            <div className="hidden w-auto flex-row gap-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="justify-start"
              >
                <Link href="/stats-editor">
                  <Settings2 className="mr-2 h-4 w-4 shrink-0" />
                  {t('common.statsEditor')}
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
                {t('common.backupAll')}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('common.myCharacters')}</CardTitle>
              <CardDescription>{t('common.allHeroes')}</CardDescription>
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
                    className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200 sm:h-20"
                  >
                    <Link href="/new">
                      <PlusCircle className="mr-3 h-6 w-6 sm:mr-4 sm:h-8 sm:w-8" />
                      <span className="text-sm font-semibold sm:text-base">
                        {t('common.createNew')}
                      </span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    asChild
                    className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200 sm:min-h-[200px]"
                  >
                    <Link href="/new">
                      <PlusCircle className="mb-2 h-10 w-10 sm:h-12 sm:w-12" />
                      <span className="text-sm font-semibold sm:text-base">
                        {t('common.createNew')}
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
