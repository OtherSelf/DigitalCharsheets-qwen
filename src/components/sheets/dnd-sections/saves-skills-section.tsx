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

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface SavesSkillsSectionProps {
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
}

export function DndSavesSkillsSection({
  savingThrows, setSavingThrows, isSavesEditing, setIsSavesEditing, handleSaveSaves, calculatedSavingThrows,
  skills, setSkills, isSkillsEditing, setIsSkillsEditing, handleSaveSkills, calculatedSkills
}: SavesSkillsSectionProps) {
  const { showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  return (
    <div className="md:col-span-3 space-y-4">
      <Card id="saving-throws-card">
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('savingThrows')}</CardTitle>{(showEditButtons || isSavesEditing) && <EditSaveButton editing={isSavesEditing} onEdit={() => setIsSavesEditing(true)} onSave={handleSaveSaves} />}</CardHeader>
        <CardContent className="p-4 pt-0 space-y-1">
          {calculatedSavingThrows.map((st, i) => (
            <div key={st.name} className="flex items-center gap-2 py-1 border-b last:border-0 border-muted">
              <Checkbox checked={st.proficient} disabled={!isSavesEditing} onCheckedChange={v => setSavingThrows(savingThrows.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s))} />
              <span className="font-bold text-sm w-8">{st.value >= 0 ? '+' : ''}{st.value}</span>
              <span className="text-[10px] font-bold uppercase flex-1">{st.name}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card id="skills-card">
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('skills')}</CardTitle>{(showEditButtons || isSkillsEditing) && <EditSaveButton editing={isSkillsEditing} onEdit={() => setIsSkillsEditing(true)} onSave={handleSaveSkills} />}</CardHeader>
        <CardContent className="p-4 pt-0 space-y-1">
          {calculatedSkills.map((sk, i) => (
            <div key={sk.name} className="flex items-center gap-2 py-1 border-b last:border-0 border-muted">
              <Checkbox checked={sk.proficient} disabled={!isSkillsEditing} onCheckedChange={v => setSkills(skills.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s))} />
              <div className="w-8 text-center">
                {isSkillsEditing ? (
                  <Input type="number" value={sk.value} onChange={e => { const n = [...skills]; n[i] = { ...sk, value: parseInt(e.target.value) || 0 }; setSkills(n); }} className="h-6 w-8 text-[10px] p-0 text-center font-bold" />
                ) : (<span className="font-black text-sm">{sk.value >= 0 ? '+' : ''}{sk.value}</span>)}
              </div>
              <span className="text-xs font-semibold flex-1">{sk.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}