'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCharacterContext } from '@/context/character-context';
import { DnD5eCharacter } from '@/lib/types';

interface HouseRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
}

export function HouseRulesDialog({ open, onOpenChange, characterId }: HouseRulesDialogProps) {
  const { getCharacter, updateCharacter } = useCharacterContext();
  const character = getCharacter(characterId) as DnD5eCharacter | undefined;

  const [allowInspiration, setAllowInspiration] = React.useState(false);
  const [allowDivineBoonsBefore20, setAllowDivineBoonsBefore20] = React.useState(false);

  React.useEffect(() => {
    if (character) {
      setAllowInspiration(character.allowInspirationHomeRule || false);
      setAllowDivineBoonsBefore20(character.allowDivineBoonsBeforeLevel20 || false);
    }
  }, [character, open]);

  const handleSave = () => {
    if (character) {
      updateCharacter(character.id, {
        allowInspirationHomeRule: allowInspiration,
        allowDivineBoonsBeforeLevel20: allowDivineBoonsBefore20,
      });
    }
    onOpenChange(false);
  };

  const handleClose = () => {
    // Revert to current character state if closed without saving
    if (character) {
      setAllowInspiration(character.allowInspirationHomeRule || false);
      setAllowDivineBoonsBefore20(character.allowDivineBoonsBeforeLevel20 || false);
    }
    onOpenChange(false);
  };

  if (!character || character.gameSystem !== 'Dungeons & Dragons') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
            <DialogTitle>House Rules</DialogTitle>
            <DialogDescription>
                Configure optional house rules for this character sheet.
            </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="more-than-1-inspiration"
              checked={allowInspiration}
              onCheckedChange={(checked) => setAllowInspiration(checked as boolean)}
            />
            <Label htmlFor="more-than-1-inspiration" className="cursor-pointer">
              More than 1 Inspiration
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="divine-boons-before-20"
              checked={allowDivineBoonsBefore20}
              onCheckedChange={(checked) => setAllowDivineBoonsBefore20(checked as boolean)}
            />
            <Label htmlFor="divine-boons-before-20" className="cursor-pointer">
              Divine Boons before level 20
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}