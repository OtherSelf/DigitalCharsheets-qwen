'use client';

import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus } from 'lucide-react';
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
  const [customRules, setCustomRules] = React.useState<{ name: string; description: string }[]>([]);
  
  const [newRuleName, setNewRuleName] = React.useState('');
  const [newRuleDesc, setNewRuleDesc] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'official' | 'custom'>('official');

  React.useEffect(() => {
    if (character) {
      setAllowInspiration(character.allowInspirationHomeRule || false);
      setAllowDivineBoonsBefore20(character.allowDivineBoonsBeforeLevel20 || false);
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
      setAllowDivineBoonsBefore20(character.allowDivineBoonsBeforeLevel20 || false);
      setCustomRules(character.customHouseRules || []);
    }
    setNewRuleName('');
    setNewRuleDesc('');
    onOpenChange(false);
  };

  const handleAddCustomRule = () => {
    if (newRuleName.trim()) {
      setCustomRules([...customRules, { name: newRuleName.trim(), description: newRuleDesc.trim() }]);
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
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>House Rules</DialogTitle>
          <DialogDescription>
            Configure optional official house rules or add custom ones for this character sheet.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'official' | 'custom')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">Official Rules</TabsTrigger>
            <TabsTrigger value="custom">Custom Rules</TabsTrigger>
          </TabsList>

          {/* OFFICIAL RULES TAB */}
          <TabsContent value="official" className="space-y-4 mt-4">
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
          </TabsContent>

          {/* CUSTOM RULES TAB */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g., Critical Fumbles"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="Describe how this rule works..."
                  className="min-h-[80px]"
                />
              </div>
              <Button 
                onClick={handleAddCustomRule} 
                disabled={!newRuleName.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Rule
              </Button>
            </div>

            {customRules.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label>Active Custom Rules</Label>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {customRules.map((rule, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted border flex flex-col gap-1">
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-sm">{rule.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                          onClick={() => handleDeleteCustomRule(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
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
            Close
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}