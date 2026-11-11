'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ChevronLeft, Gamepad2, Layers, ScrollText } from 'lucide-react';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { listCatalog } from '@/games/character-system';
import { getGameDefinition } from '@/games/games';
import {
  getGameModule,
  listGameModules,
  listGameModulesForGame,
} from '@/games/registry';

/**
 * ─── LANDMARK: CREATE WIZARD ───────────────────────────────────────────────
 * Три шага: игра → редакция → форма модуля. Шаг редакции показывается всегда,
 * даже если у игры она одна: это единообразно и готово к появлению новых
 * редакций. Шаги адресуемые (`/new?game=…&edition=…`), поэтому кнопка «назад»
 * браузера работает ожидаемо.
 *
 * Список игр/редакций берётся из реестра; фильтрация по видимости роли
 * добавится на этапе 6.
 */

// Формы модулей грузятся лениво: в бандл попадает только выбранная редакция.
const FORM_COMPONENTS = new Map(
  listGameModules().map((gameModule) => [
    gameModule.id,
    dynamic(gameModule.components.loadCreateForm),
  ]),
);

type WizardStep = 1 | 2 | 3;

export default function ManualCharacterCreationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const editionParam = searchParams.get('edition');
  const gameParam = searchParams.get('game');

  const editionModule = editionParam ? getGameModule(editionParam) : undefined;
  const game = gameParam
    ? getGameDefinition(gameParam)
    : editionModule
      ? getGameDefinition(editionModule.gameId)
      : undefined;

  const editions = game ? listGameModulesForGame(game.id) : [];
  const selectedModule =
    editionModule && game && editionModule.gameId === game.id
      ? editionModule
      : undefined;

  const step: WizardStep = selectedModule ? 3 : game ? 2 : 1;
  const Form = selectedModule
    ? FORM_COMPONENTS.get(selectedModule.id)
    : undefined;

  const go = (query = '') => router.push(`/new${query}`);

  const steps: { number: WizardStep; label: string; icon: typeof Gamepad2 }[] =
    [
      { number: 1, label: t('games.stepGame'), icon: Gamepad2 },
      { number: 2, label: t('games.stepEdition'), icon: Layers },
      { number: 3, label: t('games.stepCharacter'), icon: ScrollText },
    ];

  return (
    <div className="flex h-dvh flex-col">
      <Header />

      <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h1 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">
              {t('common.createNew')}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t('common.buildCharacterDesc')}
            </p>
          </div>

          <div className="hidden md:block">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t('common.backToDashboard')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-4xl">
          {/* ─── LANDMARK: WIZARD_STEPS ─── */}
          <ol
            className="mb-6 flex flex-wrap items-center gap-2 text-sm"
            data-testid="create-wizard-steps"
          >
            {steps.map((item) => {
              const Icon = item.icon;
              const isActive = item.number === step;
              const isDone = item.number < step;
              return (
                <li key={item.number} className="flex items-center gap-2">
                  <span
                    className={
                      isActive
                        ? 'bg-primary text-primary-foreground flex h-7 items-center gap-1.5 rounded-full px-3 font-medium'
                        : isDone
                          ? 'bg-primary/15 text-primary flex h-7 items-center gap-1.5 rounded-full px-3'
                          : 'bg-muted text-muted-foreground flex h-7 items-center gap-1.5 rounded-full px-3'
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {step === 1 && (
            <Card data-testid="create-step-game">
              <CardHeader>
                <CardTitle>{t('games.chooseGame')}</CardTitle>
                <CardDescription>{t('games.chooseGameDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {listCatalog().map(({ game: catalogGame, editions: list }) => (
                  <button
                    key={catalogGame.id}
                    type="button"
                    onClick={() =>
                      go(`?game=${encodeURIComponent(catalogGame.id)}`)
                    }
                    className="hover:border-primary hover:bg-accent/40 focus-visible:ring-ring rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    data-testid={`create-game-${catalogGame.id}`}
                  >
                    <div className="font-semibold">
                      {t(catalogGame.nameKey)}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {t(catalogGame.descriptionKey)}
                    </p>
                    <p className="text-muted-foreground mt-3 text-xs">
                      {list.map((item) => t(item.nameKey)).join(' · ')}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {step === 2 && game && (
            <Card data-testid="create-step-edition">
              <CardHeader>
                <CardTitle>{t('games.chooseEdition')}</CardTitle>
                <CardDescription>
                  {t('games.chooseEditionDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {editions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        go(
                          `?game=${encodeURIComponent(game.id)}&edition=${encodeURIComponent(item.id)}`,
                        )
                      }
                      className="hover:border-primary hover:bg-accent/40 focus-visible:ring-ring rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      data-testid={`create-edition-${item.id}`}
                    >
                      <div className="font-semibold">{t(item.nameKey)}</div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {t(item.descriptionKey)}
                      </p>
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => go()}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t('games.backToGames')}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && game && selectedModule && (
            <div data-testid="create-step-form">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-xl font-semibold">
                    {t(game.nameKey)} · {t(selectedModule.nameKey)}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {t(selectedModule.descriptionKey)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => go(`?game=${encodeURIComponent(game.id)}`)}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t('games.backToEditions')}
                </Button>
              </div>
              {Form ? (
                <Form />
              ) : (
                <p className="text-destructive text-sm">{t('common.error')}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
