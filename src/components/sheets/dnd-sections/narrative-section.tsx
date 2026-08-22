'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Plus, Trash2, Edit, Save } from 'lucide-react';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

export interface NarrativeData {
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  featuresAndTraits: string[];
}

interface NarrativeListCardProps {
  titleKey: string;
  items: string[];
  isEditing: boolean;
  newItem: string;
  onEdit: () => void;
  onSave: () => void;
  onItemsChange: (items: string[]) => void;
  onNewItemChange: (val: string) => void;
}

const NarrativeListCard = ({ titleKey, items, isEditing, newItem, onEdit, onSave, onItemsChange, onNewItemChange }: NarrativeListCardProps) => {
  const { showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t(titleKey)}</CardTitle>
        {(showEditButtons || isEditing) && <EditSaveButton editing={isEditing} onEdit={onEdit} onSave={onSave} />}
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
            {isEditing ? (
              <Input value={it} onChange={e => { const n = [...items]; n[i] = e.target.value; onItemsChange(n); }} className="h-6 text-[10px] flex-1 mr-2" />
            ) : (
              <span className="break-words font-medium">&bull; {it}</span>
            )}
            {isEditing && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => onItemsChange(items.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
            )}
          </div>
        ))}
        {isEditing && (
          <div className="flex gap-2 pt-2 border-t">
            <Input placeholder="New..." value={newItem} onChange={e => onNewItemChange(e.target.value)} className="h-7 text-[10px]" />
            <Button size="sm" className="h-7" onClick={() => { if (newItem.trim()) { onItemsChange([...items, newItem.trim()]); onNewItemChange(''); } }}><Plus className="h-3 w-3" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface NarrativeSectionProps {
  characterId: string;
  initialData: NarrativeData;
}

export const DndNarrativeSection = React.forwardRef<{ saveAll: () => void }, NarrativeSectionProps>(
  ({ characterId, initialData }, ref) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();
    const [narrativeData, setNarrativeData] = React.useState<NarrativeData>(initialData);
    const [isTraitEditing, setIsTraitEditing] = React.useState(false);
    const [isIdealEditing, setIsIdealEditing] = React.useState(false);
    const [isBondEditing, setIsBondEditing] = React.useState(false);
    const [isFlawEditing, setIsFlawEditing] = React.useState(false);
    const [isFeaturesEditing, setIsFeaturesEditing] = React.useState(false);
    const [newTraitItem, setNewTraitItem] = React.useState('');
    const [newIdealItem, setNewIdealItem] = React.useState('');
    const [newBondItem, setNewBondItem] = React.useState('');
    const [newFlawItem, setNewFlawItem] = React.useState('');
    const [newFeatureItem, setNewFeatureItem] = React.useState('');

    React.useEffect(() => {
      setNarrativeData(initialData);
    }, [characterId]);

    const handleSaveTraits = React.useCallback(() => { updateCharacter(characterId, { personalityTraits: narrativeData.personalityTraits }); setIsTraitEditing(false); }, [characterId, narrativeData.personalityTraits, updateCharacter]);
    const handleSaveIdeals = React.useCallback(() => { updateCharacter(characterId, { ideals: narrativeData.ideals }); setIsIdealEditing(false); }, [characterId, narrativeData.ideals, updateCharacter]);
    const handleSaveBonds = React.useCallback(() => { updateCharacter(characterId, { bonds: narrativeData.bonds }); setIsBondEditing(false); }, [characterId, narrativeData.bonds, updateCharacter]);
    const handleSaveFlaws = React.useCallback(() => { updateCharacter(characterId, { flaws: narrativeData.flaws }); setIsFlawEditing(false); }, [characterId, narrativeData.flaws, updateCharacter]);
    const handleSaveFeatures = React.useCallback(() => { updateCharacter(characterId, { featuresAndTraits: narrativeData.featuresAndTraits }); setIsFeaturesEditing(false); }, [characterId, narrativeData.featuresAndTraits, updateCharacter]);
   

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isTraitEditing) handleSaveTraits();
        if (isIdealEditing) handleSaveIdeals();
        if (isBondEditing) handleSaveBonds();
        if (isFlawEditing) handleSaveFlaws();
        if (isFeaturesEditing) handleSaveFeatures();
      }
    }), [isTraitEditing, isIdealEditing, isBondEditing, isFlawEditing, isFeaturesEditing, handleSaveTraits, handleSaveIdeals, handleSaveBonds, handleSaveFlaws, handleSaveFeatures]);

    

    return (
      <>
        <NarrativeListCard titleKey="personalityTraits" items={narrativeData.personalityTraits} isEditing={isTraitEditing} newItem={newTraitItem} onEdit={() => setIsTraitEditing(true)} onSave={handleSaveTraits} onItemsChange={(items) => setNarrativeData({ ...narrativeData, personalityTraits: items })} onNewItemChange={setNewTraitItem} />
        <NarrativeListCard titleKey="ideals" items={narrativeData.ideals} isEditing={isIdealEditing} newItem={newIdealItem} onEdit={() => setIsIdealEditing(true)} onSave={handleSaveIdeals} onItemsChange={(items) => setNarrativeData({ ...narrativeData, ideals: items })} onNewItemChange={setNewIdealItem} />
        <NarrativeListCard titleKey="bonds" items={narrativeData.bonds} isEditing={isBondEditing} newItem={newBondItem} onEdit={() => setIsBondEditing(true)} onSave={handleSaveBonds} onItemsChange={(items) => setNarrativeData({ ...narrativeData, bonds: items })} onNewItemChange={setNewBondItem} />
        <NarrativeListCard titleKey="flaws" items={narrativeData.flaws} isEditing={isFlawEditing} newItem={newFlawItem} onEdit={() => setIsFlawEditing(true)} onSave={handleSaveFlaws} onItemsChange={(items) => setNarrativeData({ ...narrativeData, flaws: items })} onNewItemChange={setNewFlawItem} />
        <NarrativeListCard titleKey="featuresAndTraits" items={narrativeData.featuresAndTraits} isEditing={isFeaturesEditing} newItem={newFeatureItem} onEdit={() => setIsFeaturesEditing(true)} onSave={handleSaveFeatures} onItemsChange={(items) => setNarrativeData({ ...narrativeData, featuresAndTraits: items })} onNewItemChange={setNewFeatureItem} />
      </>
    );
  }
);

DndNarrativeSection.displayName = 'DndNarrativeSection';