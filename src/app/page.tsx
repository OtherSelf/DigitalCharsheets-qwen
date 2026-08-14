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
import { useCharacterContext } from '@/context/character-context';
import { cn } from '@/lib/utils';
import { PlusCircle, RefreshCcw, FileSpreadsheet } from 'lucide-react';
import Loading from './loading';
import { useTranslation } from '@/context/language-context';
import { useUser } from '@/firebase';
import * as XLSX from 'xlsx';
import { DnD5eCharacter, DarkHeresyCharacter } from '@/lib/types';
import Link from 'next/link';
export default function DashboardPage() {
  const { characters, isLoaded, isCompactView } = useCharacterContext();
  const { t } = useTranslation();
  const { user } = useUser();

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');

  const handleExportXlsx = () => {
    if (characters.length === 0) return;

    const exportData = characters.map(char => {
      const base = {
        Name: char.name,
        System: char.gameSystem,
        Class: char.characterClass,
        Notes: char.notes || '',
        Backstory: char.backstory || ''
      };
      
      if (char.gameSystem === 'Dungeons & Dragons') {
        const dnd = char as DnD5eCharacter;
        return {
          ...base,
          Race: dnd.race || '',
          Background: dnd.background || '',
          Alignment: dnd.alignment || '',
          Level: dnd.level,
          HP: `${dnd.hitPoints.current}/${dnd.hitPoints.max}`,
          AC: dnd.armorClass,
          Speed: dnd.speed,
          Stats: `S:${dnd.stats.strength} D:${dnd.stats.dexterity} C:${dnd.stats.constitution} I:${dnd.stats.intelligence} W:${dnd.stats.wisdom} Ch:${dnd.stats.charisma}`
        };
      } else {
        const dh = char as DarkHeresyCharacter;
        return {
          ...base,
          Rank: dh.rank,
          Wounds: `${dh.wounds.current}/${dh.wounds.max}`,
          Fate: `${dh.fatePoints.current}/${dh.fatePoints.max}`,
          Insanity: dh.insanityPoints.total,
          Corruption: dh.corruptionPoints.total,
          Stats: `WS:${dh.stats.weaponSkill} BS:${dh.stats.ballisticSkill} S:${dh.stats.strength} T:${dh.stats.toughness} Ag:${dh.stats.agility} Int:${dh.stats.intelligence} Per:${dh.stats.perception} WP:${dh.stats.willpower} Fel:${dh.stats.fellowship} Inf:${dh.stats.influence}`
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Characters");
    XLSX.writeFile(workbook, "DigitalCharacterSheets_Characters.xlsx");
  };

  if (!isLoaded) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-headline font-bold">
              {t('existingCharacters')}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              {t('companionText')}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="shrink-0"
              onClick={handleExportXlsx}
              disabled={characters.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t('exportCharacters')}
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
                <Button variant="outline" asChild className="flex items-center justify-center w-full h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                  <Link href="/new/manual">
                    <PlusCircle className="h-8 w-8 mr-4" />
                    <span className="font-semibold">{t('createNew')}</span>
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" asChild className="flex flex-col items-center justify-center w-full h-full min-h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                  <Link href="/new/manual">
                    <PlusCircle className="h-12 w-12 mb-2" />
                    <span className="font-semibold">{t('createNew')}</span>
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


