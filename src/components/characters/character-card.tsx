'use client';

import Link from 'next/link';
import { type Character } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { useCharacterContext } from '@/context/character-context';

type CharacterCardProps = {
  character: Character;
};

export function CharacterCard({ character }: CharacterCardProps) {
  const { deleteCharacter, isCompactView } = useCharacterContext();
  const badgeVariant =
    character.gameSystem === 'Dungeons & Dragons' ? 'default' : 'secondary';
    
  const handleDelete = () => {
    deleteCharacter(character.id);
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
              {character.gameSystem === 'Dungeons & Dragons' && `Lvl ${character.level} `}
              {character.gameSystem === 'Dark Heresy' && `${character.rank} `}
              {character.characterClass}
            </CardDescription>
          </div>
          <Badge variant={badgeVariant} className="mt-1 text-xs">
            {character.gameSystem}
          </Badge>
        </div>
        <div className="flex items-center gap-2 p-2 ml-auto">
          <Button asChild size="sm">
            <Link href={`/${character.id}`}>View</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="h-9 w-9">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => { e.stopPropagation(); }}>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your
                  character sheet for {character.name}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
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
          {character.gameSystem}
        </Badge>
        <CardTitle className="text-lg font-headline mb-1">
          {character.name}
        </CardTitle>
        <CardDescription>
          {character.gameSystem === 'Dungeons & Dragons' && `Lvl ${character.level} `}
          {character.gameSystem === 'Dark Heresy' && `${character.rank} `}
          {character.characterClass}
        </CardDescription>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
        <Button asChild className="w-full">
          <Link href={`/${character.id}`}>View Sheet</Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => { e.stopPropagation(); }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                character sheet for {character.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
