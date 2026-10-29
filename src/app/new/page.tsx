'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
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
import { type GameSystem } from '@/lib/types';
import { DndCharacterForm } from '@/components/characters/forms/dnd-character-form';
import { DarkHeresyCharacterForm } from '@/components/characters/forms/dark-heresy-character-form';
import { useTranslation } from '@/context/language-context';

export default function ManualCharacterCreationPage() {
  const [gameSystem, setGameSystem] = useState<GameSystem | ''>('');
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-dvh">
      <Header />
      
      {/* 🎯 LANDMARK: MOBILE_PADDING_FIX - Reduced padding on mobile (p-3) */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 safe-area-bottom">
        
        {/* 🎯 LANDMARK: MOBILE_HEADER_LAYOUT - Stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">
              {t('createNew')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('buildCharacterDesc')}
            </p>
          </div>
          
          {/*  LANDMARK: HIDE_BACK_BUTTON_MOBILE 
              Wrapped in a div to guarantee it hides on mobile. 
              'asChild' sometimes swallows display classes like 'hidden'. */}
          <div className="hidden md:block">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t('backToDashboard')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/*  LANDMARK: MOBILE_CARD_PADDING - Reduced card padding on mobile */}
          <Card className="mb-4 sm:mb-8">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">{t('gameSystem')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('selectGameSystemDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <Select onValueChange={(value) => setGameSystem(value as GameSystem)} value={gameSystem}>
                <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue placeholder={t('selectGameSystemPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dungeons & Dragons">{t('dungeonsAndDragons')}</SelectItem>
                  <SelectItem value="Dark Heresy">{t('darkHeresy')}</SelectItem>
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