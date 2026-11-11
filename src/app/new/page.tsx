'use client';

import { useState } from 'react';
import Link from 'next/link';

import { ChevronLeft } from 'lucide-react';

import { DarkHeresyCharacterForm } from '@/components/characters/forms/dark-heresy-character-form';
import { DndCharacterForm } from '@/components/characters/forms/dnd-character-form';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/context/language-context';
import { type GameSystem } from '@/lib/types';

export default function ManualCharacterCreationPage() {
  const [gameSystem, setGameSystem] = useState<GameSystem | ''>('');
  const { t } = useTranslation();

  return (
    <div className="flex h-dvh flex-col">
      <Header />

      {/* LANDMARK: MOBILE_PADDING_FIX - Reduced padding on mobile (p-3) */}
      <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
        {/* LANDMARK: MOBILE_HEADER_LAYOUT - Stacked on mobile, side-by-side on desktop */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h1 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">
              {t('common.createNew')}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t('common.buildCharacterDesc')}
            </p>
          </div>

          {/*  LANDMARK: HIDE_BACK_BUTTON_MOBILE 
              Wrapped in a div to guarantee it hides on mobile. 
              'asChild' sometimes swallows display classes like 'hidden'. */}
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
          {/*  LANDMARK: MOBILE_CARD_PADDING - Reduced card padding on mobile */}
          <Card className="mb-4 sm:mb-8">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                {t('admin.gameSystem')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('common.selectGameSystemDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <Select
                onValueChange={(value) => setGameSystem(value as GameSystem)}
                value={gameSystem}
              >
                <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue
                    placeholder={t('common.selectGameSystemPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dungeons & Dragons">
                    {t('common.dungeonsAndDragons')}
                  </SelectItem>
                  <SelectItem value="Dark Heresy">
                    {t('common.darkHeresy')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {gameSystem === 'Dungeons & Dragons' && <DndCharacterForm />}
          {gameSystem === 'Dark Heresy' && <DarkHeresyCharacterForm />}
        </div>
      </main>
    </div>
  );
}
