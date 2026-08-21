'use client';

import * as React from 'react';
import { type DnDSavingThrow, type DnDSkill } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Edit, Save } from 'lucide-react';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { type DnD5eCharacter } from '@/lib/types';

// Map each skill to its governing ability score
const SKILL_STAT_MAP: Record<string, keyof DnD5eCharacter['stats']> = {
  'Acrobatics': 'dexterity',
  'Animal Handling': 'wisdom',
  'Arcana': 'intelligence',
  'Athletics': 'strength',
  'Deception': 'charisma',
  'History': 'intelligence',
  'Insight': 'wisdom',
  'Intimidation': 'charisma',
  'Investigation': 'intelligence',
  'Medicine': 'wisdom',
  'Nature': 'intelligence',
  'Perception': 'wisdom',
  'Performance': 'charisma',
  'Persuasion': 'charisma',
  'Religion': 'intelligence',
  'Sleight of Hand': 'dexterity',
  'Stealth': 'dexterity',
  'Survival': 'wisdom',
};

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface SavesSkillsSectionProps {
  characterId: string;
  savingThrows: DnDSavingThrow[];
  setSavingThrows: React.Dispatch<React.SetStateAction<DnDSavingThrow[]>>;
  isSavesEditing: boolean;
  setIsSavesEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSaves: () => void;
  calculatedSavingThrows: DnDSavingThrow[];
  skills: DnDSkill[];
  setSkills: React.Dispatch<React.SetStateAction<DnDSkill[]>>;
  isSkillsEditing: boolean;
  setIsSkillsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSkills: () => void;
  calculatedSkills: DnDSkill[];
  isCompactView: boolean;
  activeCompactSection: string;
}

export function DndSavesSkillsSection({
  characterId,
  savingThrows, setSavingThrows, isSavesEditing, setIsSavesEditing, handleSaveSaves, calculatedSavingThrows,
  skills, setSkills, isSkillsEditing, setIsSkillsEditing, handleSaveSkills, calculatedSkills, isCompactView, activeCompactSection
}: SavesSkillsSectionProps) {
  const { showEditButtons, getCharacter, updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  // Get character data for auto-calculation
  const character = getCharacter(characterId) as DnD5eCharacter | undefined;
  const stats = character?.stats;
  const profBonus = character?.proficiencyBonus || 0;
    // Calculate skill value based on ability modifier + proficiency + expertise
  const calculateSkillValue = (skill: DnDSkill): number => {
    const statKey = SKILL_STAT_MAP[skill.name] || SKILL_STAT_MAP[skill.label];
    if (!statKey || !stats) return skill.value; // fallback to stored value
    const statValue = stats[statKey];
    const modifier = Math.floor((statValue - 10) / 2);
    return modifier + (skill.proficient ? profBonus : 0) + (skill.expertise ? profBonus : 0);
  };

  return (
    <div className={cn("md:col-span-3 space-y-4", isCompactView && activeCompactSection !== 'stats-section' && "hidden")}>
      <Card id="saving-throws-card">
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('savingThrows')}</CardTitle>{(showEditButtons || isSavesEditing) && <EditSaveButton editing={isSavesEditing} onEdit={() => setIsSavesEditing(true)} onSave={handleSaveSaves} />}</CardHeader>
        <CardContent className="p-4 pt-0 space-y-1">
          {calculatedSavingThrows.map((st, i) => (
            <div key={st.name} className="flex items-center gap-2 py-1 border-b last:border-0 border-muted">
              <Checkbox 
                checked={st.proficient} 
                onCheckedChange={v => {
                  const updated = savingThrows.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s);
                  setSavingThrows(updated);
                  updateCharacter(characterId, { savingThrows: updated });
                }} 
              />
              <span className="font-bold text-sm w-8">{st.value >= 0 ? '+' : ''}{st.value}</span>
              <span className="text-[10px] font-bold uppercase flex-1">{st.name}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card id="skills-card">
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('skills')}</CardTitle>
          {(showEditButtons || isSkillsEditing) && <EditSaveButton editing={isSkillsEditing} onEdit={() => setIsSkillsEditing(true)} onSave={handleSaveSkills} />}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-1">
          {calculatedSkills.map((sk, i) => {
            const calculatedValue = calculateSkillValue(sk);
            return (
              <div key={sk.name} className="flex items-center gap-1.5 py-1 border-b last:border-0 border-muted">
                {/* Proficient Checkbox */}
                <Checkbox 
                  checked={sk.proficient} 
                  onCheckedChange={v => {
                    const updated = skills.map((s, idx) => idx === i ? { ...s, proficient: !!v, expertise: !!v ? s.expertise : false } : s);
                    setSkills(updated);
                    updateCharacter(characterId, { skills: updated });
                  }} 
                />
                
                {/* Expertise Checkbox */}
                <Checkbox 
                  checked={sk.expertise || false} 
                  disabled={!sk.proficient} 
                  onCheckedChange={v => {
                    const updated = skills.map((s, idx) => idx === i ? { ...s, expertise: !!v } : s);
                    setSkills(updated);
                    updateCharacter(characterId, { skills: updated });
                  }}
                  className="border-primary/50 data-[state=checked]:bg-accent"
                />
                
                {/* Auto-Calculated Value (Read-Only) */}
                <div className="w-8 text-center">
                  <span className="font-black text-sm">{calculatedValue >= 0 ? '+' : ''}{calculatedValue}</span>
                </div>
                
                {/* Skill Label */}
                <span className="text-xs font-semibold flex-1">{sk.label}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}