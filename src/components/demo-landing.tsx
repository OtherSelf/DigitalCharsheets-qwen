// src/components/demo-landing.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Sparkles, Sword, UserPlus } from 'lucide-react';

import { CharacterSheet } from '@/components/sheets/character-sheet';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { getGameDefinition } from '@/games/games';
import { listGameModules } from '@/games/registry';
import { type SystemId } from '@/games/types';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: DEMO_LANDING ────────────────────────────────────────────────
 * Общий демо-лендинг: гостевая главная («/») и отдельный маршрут «/demo».
 * Раньше разметка дублировалась в двух страницах, теперь тексты берутся из
 * словарей (en/ru), а отличаются только ссылкой «Начать создание персонажа».
 */

interface DemoLandingProps {
  /** Куда ведёт «Начать создание персонажа» (по умолчанию общий маршрут /new). */
  createHref?: string;
}

export function DemoLanding({ createHref = '/new' }: DemoLandingProps) {
  const { t } = useTranslation();
  const [previewId, setPreviewId] = useState<SystemId | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);

  // Видимость редакций — из каталога (роль читается на сервере).
  useEffect(() => {
    let active = true;
    void fetch('/api/games', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as {
          games?: { editions?: { id: string }[] }[];
        } | null;
      })
      .then((data) => {
        if (!active) return;
        const ids = new Set(
          (data?.games ?? []).flatMap((game) =>
            (game.editions ?? []).map((edition) => edition.id),
          ),
        );
        setVisibleIds(ids);
      })
      .catch(() => {
        if (active) {
          setVisibleIds(
            new Set(
              listGameModules()
                .filter(
                  (gameModule) => gameModule.defaultStatus === 'published',
                )
                .map((gameModule) => gameModule.id),
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Один демо-персонаж на опубликованную редакцию; данные — из модулей.
  const demos = listGameModules()
    .filter((gameModule) =>
      visibleIds
        ? visibleIds.has(gameModule.id)
        : gameModule.defaultStatus === 'published',
    )
    .map((gameModule) => {
      const gameDefinition = getGameDefinition(gameModule.gameId);
      return {
        id: gameModule.id,
        label: gameDefinition
          ? `${t(gameDefinition.nameKey)} · ${t(gameModule.nameKey)}`
          : t(gameModule.nameKey),
        character: {
          ...(gameModule.createDemo() as unknown as Record<string, unknown>),
          id: `demo-${gameModule.id}`,
          userId: 'demo',
        } as unknown as Character,
      };
    });

  const activeCharacter =
    demos.find((demo) => demo.id === previewId)?.character ?? null;

  // Имя персонажа в переводе остаётся подстановкой внутри фразы.
  const [hintBeforeName, hintAfterName] = t('demo.modeHint').split('{name}');

  return (
    <>
      {/* LANDMARK: DEMO_HERO */}
      <div className="mb-10 space-y-4 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          {t('demo.heroTitle')}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          {t('demo.heroSubtitle')}
        </p>
      </div>

      {/* LANDMARK: DEMO_ACTION_CARDS */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary h-5 w-5" />
              {t('demo.createCardTitle')}
            </CardTitle>
            <CardDescription>{t('demo.createCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={createHref}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('demo.createCardAction')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword className="text-primary h-5 w-5" />
              {t('demo.exploreCardTitle')}
            </CardTitle>
            <CardDescription>{t('demo.exploreCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demos.map((demo) => (
              <Button
                key={demo.id}
                variant={previewId === demo.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setPreviewId(demo.id)}
              >
                {demo.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* LANDMARK: DEMO_SHEET_PREVIEW */}
      {activeCharacter && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4 duration-500">
          <div className="border-primary/20 bg-primary/10 flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-primary font-semibold">
                {t('demo.modeActive')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {hintBeforeName}
                <strong>{activeCharacter.name}</strong>
                {hintAfterName}
              </p>
            </div>
            <Button asChild variant="default" className="shrink-0">
              <Link href="/login">
                <UserPlus className="mr-2 h-4 w-4" />
                {t('demo.createAccountToSave')}
              </Link>
            </Button>
          </div>

          <div className="bg-card rounded-lg border p-4 md:p-6">
            <CharacterSheet
              character={activeCharacter}
              activeCompactSection="info-section"
            />
          </div>
        </div>
      )}
    </>
  );
}
