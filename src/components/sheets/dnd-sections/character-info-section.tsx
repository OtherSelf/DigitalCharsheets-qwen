'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

const DetailField = ({ label, value, editing, onChange }: { label: string; value: string | number; editing: boolean; onChange: (val: string) => void }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] text-muted-foreground uppercase font-bold">{label}</Label>
    {editing ? (
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs p-1" />
    ) : (
      <span className="text-sm font-semibold truncate">{value || '-'}</span>
    )}
  </div>
);

export interface HeaderData {
  background: string;
  race: string;
  alignment: string;
  age: string;
  eyes: string;
  skin: string;
  height: string;
  weight: string;
  hair: string;
  backstory: string;
  notes: string;
}

interface CharacterInfoSectionProps {
  characterId: string;
  initialName: string;
  initialHeaderData: HeaderData;
}

export const DndCharacterInfoSection = React.forwardRef<{ saveAll: () => void }, CharacterInfoSectionProps>(
  ({ characterId, initialName, initialHeaderData }, ref) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [name, setName] = React.useState(initialName);
    const [headerData, setHeaderData] = React.useState<HeaderData>(initialHeaderData);
    const [isHeaderEditing, setIsHeaderEditing] = React.useState(false);

    React.useEffect(() => {
      setName(initialName);
      setHeaderData(initialHeaderData);
    }, [characterId]);

    const handleSaveHeader = React.useCallback(() => {
      updateCharacter(characterId, { name, ...headerData });
      setIsHeaderEditing(false);
    }, [characterId, name, headerData, updateCharacter]);

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isHeaderEditing) handleSaveHeader();
      }
    }), [isHeaderEditing, handleSaveHeader]);

    return (
      <Accordion type="single" collapsible defaultValue="expanded" className="flex-1">
        <AccordionItem value="expanded" className="border-0">
          <Card className="flex flex-col border-2 overflow-hidden h-full">
            <CardHeader className="px-4 pt-2 pb-2 bg-muted/5 flex flex-row items-center justify-between">
              <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('characterInfo')}</Label></AccordionTrigger>
              {(showEditButtons || isHeaderEditing) && <EditSaveButton editing={isHeaderEditing} onEdit={() => setIsHeaderEditing(true)} onSave={handleSaveHeader} />}
            </CardHeader>
            <AccordionContent>
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailField label={t('race')} value={headerData.race} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, race: v })} />
                <DetailField label={t('background')} value={headerData.background} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, background: v })} />
                <DetailField label={t('alignment')} value={headerData.alignment} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, alignment: v })} />
                <DetailField label={t('age')} value={headerData.age} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, age: v })} />
                <DetailField label={t('eyes')} value={headerData.eyes} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, eyes: v })} />
                <DetailField label={t('skin')} value={headerData.skin} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, skin: v })} />
                <DetailField label={t('height')} value={headerData.height} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, height: v })} />
                <DetailField label={t('weight')} value={headerData.weight} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, weight: v })} />
                <DetailField label={t('hairFur')} value={headerData.hair} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, hair: v })} />
                <div className="col-span-2 md:col-span-3 mt-2 border-t pt-4">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="backstory" className="border-b-0">
                      <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('backstory')}</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        {isHeaderEditing ? (
                          <Textarea value={headerData.backstory} onChange={e => setHeaderData({ ...headerData, backstory: e.target.value })} placeholder="Your character's backstory..." className="min-h-[150px] text-sm" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.backstory || '-'}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="notes" className="border-b-0">
                      <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('notes')}</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        {isHeaderEditing ? (
                          <Textarea value={headerData.notes} onChange={e => setHeaderData({ ...headerData, notes: e.target.value })} placeholder="General notes about this character..." className="min-h-[100px] text-sm" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.notes || '-'}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    );
  }
);

DndCharacterInfoSection.displayName = 'DndCharacterInfoSection';