'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { type Character } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface NotesDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotesDialog({ character, open, onOpenChange }: NotesDialogProps) {
  const [notes, setNotes] = useState(character.notes ?? '');
  const { updateCharacter } = useCharacterContext();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNotes(character.notes ?? '');
    }
  }, [open, character.notes]);

  const handleSave = () => {
    updateCharacter(character.id, { notes });
    toast({
      title: 'Notes Saved',
      description: 'Your notes have been updated.',
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
          <DialogTitle>Character Notes</DialogTitle>
          <DialogDescription>
            A place for your private thoughts, reminders, and scribbles.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down your notes here..."
            className="min-h-[300px]"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
