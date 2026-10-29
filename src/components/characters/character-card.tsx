'use client';

import Link from 'next/link';
import { type Character } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, FileDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCharacterContext } from '@/context/character-context';
import { exportCharacterToExcel } from '@/lib/export-utils';
import { useTranslation } from '@/context/language-context';
import { RANK_KEYS } from '@/lib/dark-heresy-data';

const CLASS_TRANSLATION_KEYS: Record<string, string> = {
  "Artificer": "classArtificer",
  "Barbarian": "classBarbarian",
  "Bard": "classBard",
  "Cleric": "classCleric",
  "Druid": "classDruid",
  "Fighter": "classFighter",
  "Monk": "classMonk",
  "Paladin": "classPaladin",
  "Ranger": "classRanger",
  "Rogue": "classRogue",
  "Sorcerer": "classSorcerer",
  "Warlock": "classWarlock",
  "Wizard": "classWizard",
};

const CAREER_TRANSLATION_KEYS: Record<string, string> = {
  "Adept": "careerAdept",
  "Arbitrator": "careerArbitrator",
  "Assassin": "careerAssassin",
  "Cleric": "careerCleric",
  "Guardsman": "careerGuardsman",
  "Imperial Psyker": "careerImperialPsyker",
  "Scum": "careerScum",
  "Tech-Priest": "careerTechPriest",
};

type CharacterCardProps = {
  character: Character;
};

export function CharacterCard({ character }: CharacterCardProps) {
  const { t } = useTranslation();
  const { deleteCharacter, isCompactView } = useCharacterContext();
  
  const badgeVariant = character.gameSystem === 'Dungeons & Dragons' ? 'default' : 'secondary';

  const handleDelete = () => {
    deleteCharacter(character.id);
  };

  const handleExport = () => {
    exportCharacterToExcel(character);
  };

  const getTranslatedClass = () => {
    if (character.gameSystem === 'Dungeons & Dragons') {
      return t(CLASS_TRANSLATION_KEYS[character.characterClass] || character.characterClass);
    }
    return t(CAREER_TRANSLATION_KEYS[character.characterClass] || character.characterClass);
  };

  const getTranslatedRank = () => {
    if ('rank' in character) {
      return t(RANK_KEYS[character.rank as keyof typeof RANK_KEYS] || character.rank);
    }
    return '';
  };

  if (isCompactView) {
    return (
      <Card className="compact-mobile-card flex flex-row sm:flex-row overflow-hidden hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-300 items-stretch p-2">
        {/* 🎯 LANDMARK: INFO_BLOCK - flex-1 ensures it takes half the space, min-w-0 allows text to wrap */}
        <div className="flex-1 min-w-0 px-3 sm:px-4 flex flex-col justify-center">
          <div className="flex items-baseline gap-2 flex-wrap">
            <CardTitle className="text-sm sm:text-md font-headline break-words line-clamp-1">
              {character.name}
            </CardTitle>
          </div>
          <CardDescription className="text-xs mt-0.5 break-words line-clamp-1">
            {character.gameSystem === 'Dungeons & Dragons' && `${t('lvl')} ${character.level} `}
            {character.gameSystem === 'Dark Heresy' && `${getTranslatedRank()} `}
            {getTranslatedClass()}
          </CardDescription>
          <Badge variant={badgeVariant} className="mt-2 text-xs system-badge max-w-full w-fit">
            {character.gameSystem === 'Dungeons & Dragons' ? t('dungeonsAndDragons') : t('darkHeresy')}
          </Badge>
        </div>
        
        {/* 🎯 LANDMARK: ACTION_BLOCK - Changed shrink-0 to flex-1 justify-end so it fills the right half */}
        <div className="actions-wrapper flex items-center gap-1 sm:gap-2 p-2 flex-1 justify-end min-w-0">
          <Button asChild size="sm" className="flex-1 min-w-0 h-8 sm:h-9 px-2">
            <Link href={`/${character.id}`} className="truncate block w-full text-center">
              {t('view')}
            </Link>
          </Button>
          
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={handleExport} title={t('exportSheet')}>
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => { e.stopPropagation(); }}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteWarning')} {character.name}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-300">
      <CardContent className="p-4 flex-grow">
        <Badge variant={badgeVariant} className="mb-2 text-xs sm:text-sm">
          {character.gameSystem === 'Dungeons & Dragons' ? t('dungeonsAndDragons') : t('darkHeresy')}
        </Badge>
        <CardTitle className="text-base sm:text-lg font-headline mb-1 break-words">
          {character.name}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm break-words">
          {character.gameSystem === 'Dungeons & Dragons' && `${t('lvl')} ${character.level} `}
          {character.gameSystem === 'Dark Heresy' && `${getTranslatedRank()} `}
          {getTranslatedClass()}
        </CardDescription>
      </CardContent>
      <CardFooter className="p-3 sm:p-4 pt-0 flex items-center justify-between gap-2">
        <Button asChild className="w-full text-xs sm:text-sm">
          <Link href={`/${character.id}`}>{t('viewSheet')}</Link>
        </Button>
        
        <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={handleExport} title={t('exportSheet')}>
          <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => { e.stopPropagation(); }}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteWarning')} {character.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}