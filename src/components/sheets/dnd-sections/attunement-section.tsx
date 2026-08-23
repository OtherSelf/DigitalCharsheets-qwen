'use client';

import * as React from 'react';
import { type AttunementItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Plus, Trash2, Edit, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '../../ui/textarea';

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface AttunementSectionProps {
  characterId: string;
  initialItems: AttunementItem[];
}

export const DndAttunementSection = React.forwardRef<{ saveAll: () => void }, AttunementSectionProps>(
  ({ characterId, initialItems }, ref) => {
    const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
    const { t } = useTranslation();
    const { toast } = useToast();

    const [attunementItems, setAttunementItems] = React.useState<AttunementItem[]>(initialItems);
    const [isAttunementEditing, setIsAttunementEditing] = React.useState(false);
    const [newAttunementItem, setNewAttunementItem] = React.useState('');

    React.useEffect(() => {
      setAttunementItems(initialItems);
    }, [characterId]);

    const handleSaveAttunement = React.useCallback(() => {
      updateCharacter(characterId, { attunementItems });
      setIsAttunementEditing(false);
    }, [characterId, attunementItems, updateCharacter]);

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isAttunementEditing) handleSaveAttunement();
      }
    }), [isAttunementEditing, handleSaveAttunement]);

    const handleAttunedChange = (id: string, attuned: boolean) => {
      if (attuned) {
        const count = attunementItems.filter(i => i.attuned).length;
        if (count >= 3) {
          toast({
            variant: 'destructive',
            title: 'Limit Reached',
            description: 'You can only attune up to 3 items.',
          });
          return;
        }
      }
      const next = attunementItems.map(i => i.id === id ? { ...i, attuned } : i);
      setAttunementItems(next);
      if (!isAttunementEditing) updateCharacter(characterId, { attunementItems: next });
    };

    return (
      <Card id="attunement-card">
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('attunement')}</CardTitle>
          {(showEditButtons || isAttunementEditing) && <EditSaveButton editing={isAttunementEditing} onEdit={() => setIsAttunementEditing(true)} onSave={handleSaveAttunement} />}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {attunementItems.map((it) => (
            <div key={it.id} className="text-[10px] p-1.5 rounded bg-muted/10 flex items-center justify-between group">
                <div className="flex items-center gap-2 flex-1">
                  <Checkbox checked={it.attuned} onCheckedChange={v => handleAttunedChange(it.id, !!v)} />
                  {isAttunementEditing ? (
                    <Input value={it.description} onChange={e => setAttunementItems(attunementItems.map(item => item.id === it.id ? { ...item, description: e.target.value } : item))} className="h-6 text-[10px] flex-1" />
                  ) : (
                    <span className={cn("font-medium flex-1 truncate", !it.attuned && "opacity-50")}>
                      {it.description}{it.attuned && <span className="text-[8px] font-black uppercase text-primary ml-1">(Attuned)</span>}
                    </span>
                  )}
      
                  {!hideNotes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={it.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0" title="Notes">
                          <Info className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <Label className="text-xs mb-2 block">Notes for {it.description || 'Item'}</Label>
                        <Textarea
                          defaultValue={it.notes || ''}
                          onBlur={(e) => {
                            const next = attunementItems.map(item => item.id === it.id ? { ...item, notes: e.target.value } : item);
                            setAttunementItems(next);
                            updateCharacter(characterId, { attunementItems: next });
                          }}
                          placeholder="Add notes..."
                          className="mt-2 min-h-[100px] text-sm"
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {isAttunementEditing && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive ml-1" onClick={() => setAttunementItems(attunementItems.filter(item => item.id !== it.id))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          {isAttunementEditing && (
            <div className="flex gap-2 pt-2 border-t">
              <Input placeholder="New..." value={newAttunementItem} onChange={e => setNewAttunementItem(e.target.value)} className="h-7 text-[10px]" />
              <Button size="sm" className="h-7" onClick={() => { if (newAttunementItem.trim()) { setAttunementItems([...attunementItems, { id: `att-${Date.now()}`, description: newAttunementItem.trim(), attuned: false }]); setNewAttunementItem(''); } }}><Plus className="h-3 w-3" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DndAttunementSection.displayName = 'DndAttunementSection';