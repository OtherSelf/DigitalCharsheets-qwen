'use client';

import * as React from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';

import type { DnD5eCharacter } from '../types';

interface HouseRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
}

export function HouseRulesDialog({
  open,
  onOpenChange,
  characterId,
}: HouseRulesDialogProps) {
  const { getCharacter, updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const character = getCharacter(characterId) as DnD5eCharacter | undefined;

  const [allowInspiration, setAllowInspiration] = React.useState(false);
  const [allowDivineBoonsBefore20, setAllowDivineBoonsBefore20] =
    React.useState(false);
  const [customRules, setCustomRules] = React.useState<
    { name: string; description: string }[]
  >([]);

  const [newRuleName, setNewRuleName] = React.useState('');
  const [newRuleDesc, setNewRuleDesc] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'official' | 'custom'>(
    'official',
  );

  React.useEffect(() => {
    if (character) {
      setAllowInspiration(character.allowInspirationHomeRule || false);
      setAllowDivineBoonsBefore20(
        character.allowDivineBoonsBeforeLevel20 || false,
      );
      setCustomRules(character.customHouseRules || []);
    }
  }, [character, open]);

  const handleSave = () => {
    if (character) {
      updateCharacter(character.id, {
        allowInspirationHomeRule: allowInspiration,
        allowDivineBoonsBeforeLevel20: allowDivineBoonsBefore20,
        customHouseRules: customRules,
      });
    }
    onOpenChange(false);
  };

  const handleClose = () => {
    if (character) {
      setAllowInspiration(character.allowInspirationHomeRule || false);
      setAllowDivineBoonsBefore20(
        character.allowDivineBoonsBeforeLevel20 || false,
      );
      setCustomRules(character.customHouseRules || []);
    }
    setNewRuleName('');
    setNewRuleDesc('');
    onOpenChange(false);
  };

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

  if (!character || character.gameSystem !== 'Dungeons & Dragons') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('common.houseRulesTitle')}</DialogTitle>
          <DialogDescription>{t('common.houseRulesDesc')}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'official' | 'custom')}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">{t('dnd.officialRules')}</TabsTrigger>
            <TabsTrigger value="custom">{t('dnd.customRules')}</TabsTrigger>
          </TabsList>

          {/* OFFICIAL RULES TAB */}
          <TabsContent value="official" className="mt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="more-than-1-inspiration"
                checked={allowInspiration}
                onCheckedChange={(checked) =>
                  setAllowInspiration(checked as boolean)
                }
              />
              <Label
                htmlFor="more-than-1-inspiration"
                className="cursor-pointer"
              >
                {t('dnd.moreThanOneInspiration')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="divine-boons-before-20"
                checked={allowDivineBoonsBefore20}
                onCheckedChange={(checked) =>
                  setAllowDivineBoonsBefore20(checked as boolean)
                }
              />
              <Label
                htmlFor="divine-boons-before-20"
                className="cursor-pointer"
              >
                {t('dnd.divineBoonsBefore20')}
              </Label>
            </div>
          </TabsContent>

          {/* CUSTOM RULES TAB */}
          <TabsContent value="custom" className="mt-4 space-y-4">
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
                        <span className="text-sm font-semibold">
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
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

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
