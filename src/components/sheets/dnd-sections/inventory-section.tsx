'use client';

import * as React from 'react';
import { type InventoryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Plus, Trash2, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface InventorySectionProps {
  characterId: string;
  initialCurrency: { cp: number; sp: number; gp: number; pp: number; ep: number };
  initialEquipment: InventoryItem[];
}

export const DndInventorySection = React.forwardRef<{ saveAll: () => void }, InventorySectionProps>(
  ({ characterId, initialCurrency, initialEquipment }, ref) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [currency, setCurrency] = React.useState(initialCurrency);
    const [equipment, setEquipment] = React.useState<InventoryItem[]>(initialEquipment);
    const [isMoneyEditing, setIsMoneyEditing] = React.useState(false);
    const [isItemsEditing, setIsItemsEditing] = React.useState(false);
    const [newEquipmentItem, setNewEquipmentItem] = React.useState('');

    React.useEffect(() => {
      setCurrency(initialCurrency);
      setEquipment(initialEquipment);
    }, [characterId]);

    const handleSaveMoney = React.useCallback(() => {
      updateCharacter(characterId, { currency });
      setIsMoneyEditing(false);
    }, [characterId, currency, updateCharacter]);

    const handleSaveItems = React.useCallback(() => {
      updateCharacter(characterId, { equipment });
      setIsItemsEditing(false);
    }, [characterId, equipment, updateCharacter]);

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isMoneyEditing) handleSaveMoney();
        if (isItemsEditing) handleSaveItems();
      }
    }), [isMoneyEditing, isItemsEditing, handleSaveMoney, handleSaveItems]);

    return (
      <Card id="inventory-box">
        <CardHeader className="px-4 pt-2 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('inventory')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-6">
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-3 border-b pb-1">
              <Label className="text-[10px] uppercase font-bold">{t('money')}</Label>
              {(showEditButtons || isMoneyEditing) && <EditSaveButton editing={isMoneyEditing} onEdit={() => setIsMoneyEditing(true)} onSave={handleSaveMoney} />}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {['cp', 'sp', 'ep', 'gp', 'pp'].map(c => (
                <div key={c} className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase">{c}</span>
                  {isMoneyEditing ? (
                    <Input type="number" value={currency[c as keyof typeof currency]} onChange={e => setCurrency({...currency, [c]: parseInt(e.target.value) || 0})} className="h-6 p-0 text-center text-[10px]" />
                  ) : (
                    <div className="text-sm font-bold">{currency[c as keyof typeof currency]}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase font-bold">{t('items')}</Label>
              {(showEditButtons || isItemsEditing) && <EditSaveButton editing={isItemsEditing} onEdit={() => setIsItemsEditing(true)} onSave={handleSaveItems} />}
            </div>
            <ul className="space-y-1 text-xs">
              {equipment.map(it => (
                <li key={it.id} className="flex items-center justify-between group">
                  {isItemsEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox checked={it.status === 'lost'} onCheckedChange={v => setEquipment(equipment.map(i => i.id === it.id ? {...i, status: v ? 'lost' : 'default'} : i))} />
                      <Input value={it.name} onChange={e => setEquipment(equipment.map(i => i.id === it.id ? {...i, name: e.target.value} : i))} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setEquipment(equipment.filter(i => i.id !== it.id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <span className={cn(it.status === 'lost' && "line-through")}>&bull; {it.name}</span>
                  )}
                </li>
              ))}
              {isItemsEditing && (
                <div className="flex gap-2 pt-2 border-t">
                  <Input placeholder="New..." value={newEquipmentItem} onChange={e => setNewEquipmentItem(e.target.value)} className="h-8 text-xs" />
                  <Button size="sm" onClick={() => { if (newEquipmentItem.trim()) { setEquipment([...equipment, { id: `eq-${Date.now()}`, name: newEquipmentItem.trim(), status: 'default' }]); setNewEquipmentItem(''); } }}><Plus className="h-4 w-4" /></Button>
                </div>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }
);

DndInventorySection.displayName = 'DndInventorySection';