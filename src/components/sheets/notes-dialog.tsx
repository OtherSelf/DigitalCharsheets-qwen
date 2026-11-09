'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { type Character } from '@/lib/types';

interface NotesDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotesDialog({
  character,
  open,
  onOpenChange,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(character.notes ?? '');
  const { updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNotes(character.notes ?? '');
    }
  }, [open, character.notes]);

  const handleSave = () => {
    updateCharacter(character.id, { notes });
    toast({
      title: t('notesSaved'),
      description: t('notesUpdatedDesc'),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('characterNotes')}</DialogTitle>
          <DialogDescription>{t('characterNotesDesc')}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('jotDownNotesPlaceholder')}
            className="min-h-[300px]"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>
            {t('saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
