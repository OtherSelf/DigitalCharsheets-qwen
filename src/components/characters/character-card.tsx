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

// Mapping for DnD Classes to translation keys
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

// Mapping for Dark Heresy Careers to translation keys
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

  // Helper to get translated class/career
  const getTranslatedClass = () => {
    if (character.gameSystem === 'Dungeons & Dragons') {
      return t(CLASS_TRANSLATION_KEYS[character.characterClass] || character.characterClass);
    }
    return t(CAREER_TRANSLATION_KEYS[character.characterClass] || character.characterClass);
  };

  // Helper to get translated rank (Dark Heresy only)
  const getTranslatedRank = () => {
    if ('rank' in character) {
      return t(RANK_KEYS[character.rank as keyof typeof RANK_KEYS] || character.rank);
    }
    return '';
  };

  if (isCompactView) {
    return (
      <Card className="flex flex-row overflow-hidden hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-300 items-center p-2">
        <div className="flex-grow px-4">
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-md font-headline break-words">
              {character.name}
            </CardTitle>
            <CardDescription className="text-xs break-words">
              {character.gameSystem === 'Dungeons & Dragons' && `${t('lvl')} ${character.level} `}
              {character.gameSystem === 'Dark Heresy' && `${getTranslatedRank()} `}
              {getTranslatedClass()}
            </CardDescription>
          </div>
          <Badge variant={badgeVariant} className="mt-1 text-xs">
            {character.gameSystem === 'Dungeons & Dragons' ? t('dungeonsAndDragons') : t('darkHeresy')}
          </Badge>
        </div>
        <div className="flex items-center gap-2 p-2 ml-auto">
          <Button asChild size="sm">
            <Link href={`/${character.id}`}>{t('view')}</Link>
          </Button>
          
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExport} title={t('exportSheet')}>
            <FileDown className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="h-9 w-9">
                <Trash2 className="h-4 w-4" />
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
        <Badge variant={badgeVariant} className="mb-2">
          {character.gameSystem === 'Dungeons & Dragons' ? t('dungeonsAndDragons') : t('darkHeresy')}
        </Badge>
        <CardTitle className="text-lg font-headline mb-1">
          {character.name}
        </CardTitle>
        <CardDescription>
          {character.gameSystem === 'Dungeons & Dragons' && `${t('lvl')} ${character.level} `}
          {character.gameSystem === 'Dark Heresy' && `${getTranslatedRank()} `}
          {getTranslatedClass()}
        </CardDescription>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
        <Button asChild className="w-full">
          <Link href={`/${character.id}`}>{t('viewSheet')}</Link>
        </Button>
        
        <Button variant="outline" size="icon" onClick={handleExport} title={t('exportSheet')}>
          <FileDown className="h-4 w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
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