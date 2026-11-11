// src/components/sheets/dh-sections/dh-house-rules-dialog.tsx
'use client';

import * as React from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { type DarkHeresyCharacter } from '@/lib/types';

interface DhHouseRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
}

type DhCustomRule = { name: string; description: string };

export function DhHouseRulesDialog({
  open,
  onOpenChange,
  characterId,
}: DhHouseRulesDialogProps) {
  const { getCharacter, updateCharacter } = useCharacterContext();
  const { t } = useTranslation();

  const character = getCharacter(characterId) as
    DarkHeresyCharacter | undefined;
  const isDarkHeresy = character?.gameSystem === 'Dark Heresy';

  const [customRules, setCustomRules] = React.useState<DhCustomRule[]>([]);
  const [newRuleName, setNewRuleName] = React.useState('');
  const [newRuleDesc, setNewRuleDesc] = React.useState('');

  // DH-HOUSE-RULES-RESET-ON-OPEN
  React.useEffect(() => {
    if (open && isDarkHeresy) {
      setCustomRules(character?.customHouseRules ?? []);
      setNewRuleName('');
      setNewRuleDesc('');
    }
  }, [open, isDarkHeresy, character?.customHouseRules]);

  const handleAddCustomRule = () => {
    if (newRuleName.trim()) {
      setCustomRules([
        ...customRules,
        { name: newRuleName.trim(), description: newRuleDesc.trim() },
      ]);
      setNewRuleName('');
      setNewRuleDesc('');
    }
  };

  const handleDeleteCustomRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (character && isDarkHeresy) {
      updateCharacter(character.id, {
        customHouseRules: customRules,
      });
    }
    onOpenChange(false);
  };

  const handleClose = () => {
    if (character && isDarkHeresy) {
      setCustomRules(character.customHouseRules ?? []);
    }
    setNewRuleName('');
    setNewRuleDesc('');
    onOpenChange(false);
  };

  // Hard guard: this dialog must NEVER render for a DnD character
  if (!character || !isDarkHeresy) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('common.houseRulesTitle')}</DialogTitle>
          <DialogDescription>{t('common.houseRulesDesc')}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('common.ruleName')}</Label>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder={t('common.ruleNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.ruleDescription')}</Label>
              <Textarea
                value={newRuleDesc}
                onChange={(e) => setNewRuleDesc(e.target.value)}
                placeholder={t('common.ruleDescriptionPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <Button
              onClick={handleAddCustomRule}
              disabled={!newRuleName.trim()}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('common.addCustomRule')}
            </Button>
          </div>

          {customRules.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label>{t('common.activeCustomRules')}</Label>
              <div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">
                {customRules.map((rule, index) => (
                  <div
                    key={index}
                    className="bg-muted flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold break-words">
                        {rule.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-6 w-6 shrink-0"
                        onClick={() => handleDeleteCustomRule(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {rule.description && (
                      <p className="text-muted-foreground text-xs leading-relaxed break-words">
                        {rule.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            {t('common.close')}
          </Button>
          <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DhHouseRulesDialog.displayName = 'DhHouseRulesDialog';
