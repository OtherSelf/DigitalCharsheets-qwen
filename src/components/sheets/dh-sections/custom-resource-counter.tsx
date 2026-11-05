'use client';
import * as React from 'react';
import { type DarkHeresyCharacter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Trash2, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EditSaveButton } from './dh-ui-helpers';

type CustomResource = {
  id: string;
  description: string;
  current: number;
  max: number;
  notes?: string;
};

export function CustomResourceCounter({ character, isCompactView }: { character: DarkHeresyCharacter; isCompactView: boolean }) {
  const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
  const [resources, setResources] = React.useState<CustomResource[]>(character.customResources || []);
  const [isEditing, setIsEditing] = React.useState(false);
  const [newDesc, setNewDesc] = React.useState('');
  const [newMax, setNewMax] = React.useState(1);

  React.useEffect(() => {
    setResources(character.customResources || []);
  }, [character.customResources]);

  const handleSave = React.useCallback(() => {
    updateCharacter(character.id, { customResources: resources });
    setIsEditing(false);
  }, [character.id, resources, updateCharacter]);

  const handleChangeCurrent = (id: string, delta: number) => {
    const next = resources.map(r => r.id === id ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) } : r);
    setResources(next);
    updateCharacter(character.id, { customResources: next });
  };

  const handleFieldChange = (id: string, field: 'description' | 'max' | 'notes', value: string | number) => {
    setResources(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field === 'max') {
        const newMaxVal = Math.max(0, parseInt(String(value), 10) || 0);
        return { ...r, max: newMaxVal, current: Math.min(r.current, newMaxVal) };
      }
      return { ...r, [field]: value };
    }));
  };

  const addResource = () => {
    if (newDesc.trim()) {
      const next = [...resources, { id: `res-${Date.now()}`, description: newDesc.trim(), current: newMax, max: newMax, notes: '' }];
      setResources(next);
      setNewDesc('');
      setNewMax(1);
    }
  };

  const removeResource = (id: string) => { 
    const next = resources.filter(r => r.id !== id);
    setResources(next);
    updateCharacter(character.id, { customResources: next });
  };

  // ─── DESKTOP / TABLET UI ───
  if (!isCompactView) {
    return (
      <div className="pt-2 border-t">
        <div className="flex flex-row items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">Custom Resources</h4>
          {(showEditButtons || isEditing) && (
            <EditSaveButton editing={isEditing} onEdit={() => setIsEditing(true)} onSave={handleSave} />
          )}
        </div>
        <div className="space-y-2">
          {resources.length === 0 && !isEditing && (
            <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded-lg">No custom resources added.</p>
          )}
          {resources.map(res => (
            <div key={res.id} className="flex items-center justify-between p-2 bg-muted/10 rounded border border-muted/20">
              {isEditing ? (
                <div className="flex flex-col gap-1 flex-1 mr-2">
                  <Input value={res.description} onChange={e => handleFieldChange(res.id, 'description', e.target.value)} className="h-7 text-xs" placeholder="Resource Name" />
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground shrink-0">Max</span>
                    <Input type="number" value={res.max === 0 ? '' : res.max} onChange={e => handleFieldChange(res.id, 'max', e.target.value)} className="h-7 text-[10px] w-16 text-center" min={0} />
                    {!hideNotes && (
                      <Popover>
                        <PopoverTrigger asChild><Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><Info className="h-3 w-3" /></Button></PopoverTrigger>
                        <PopoverContent className="w-64">
                          <Label className="text-xs mb-2 block">Notes: {res.description}</Label>
                          <Textarea defaultValue={res.notes || ''} onChange={e => handleFieldChange(res.id, 'notes', e.target.value)} placeholder="Notes" className="mt-2 min-h-[100px] text-sm" />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {!hideNotes && (
                    <Popover>
                      <PopoverTrigger asChild><Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0"><Info className="h-3 w-3" /></Button></PopoverTrigger>
                      <PopoverContent className="w-64">
                        <Label className="text-xs mb-2 block">Notes: {res.description}</Label>
                        <Textarea defaultValue={res.notes || ''} onBlur={e => { const next = resources.map(r => r.id === res.id ? { ...r, notes: e.target.value } : r); setResources(next); updateCharacter(character.id, { customResources: next }); }} placeholder="Notes" className="mt-2 min-h-[100px] text-sm" />
                      </PopoverContent>
                    </Popover>
                  )}
                  <span className="text-xs font-bold break-words flex-1">{res.description}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleChangeCurrent(res.id, -1)} disabled={res.current <= 0}><Minus className="h-3 w-3" /></Button>
                <span className="text-sm font-black w-12 text-center">{res.current} / {res.max}</span>
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleChangeCurrent(res.id, 1)} disabled={res.current >= res.max}><Plus className="h-3 w-3" /></Button>
                {isEditing && ( <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeResource(res.id)}><Trash2 className="h-3 w-3" /></Button> )}
              </div>
            </div>
          ))}
          {isEditing && (
            <div className="flex gap-2 pt-2 border-t items-center">
              <Input placeholder="Resource Name" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="h-8 text-xs flex-1" />
              <Input type="number" value={newMax === 0 ? '' : newMax} onChange={e => setNewMax(parseInt(e.target.value) || 1)} className="h-8 text-xs w-16 text-center" min={1} />
              <Button size="sm" className="h-8" onClick={addResource}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── COMPACT / MOBILE UI ───
  return (
    <div className="col-span-2 mt-2">
      <Card className="mt-2">
        <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Custom Resources</CardTitle>
          {(showEditButtons || isEditing) && (
            <EditSaveButton editing={isEditing} onEdit={() => setIsEditing(true)} onSave={handleSave} />
          )}
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {resources.length === 0 && !isEditing && (
            <p className="text-[10px] text-muted-foreground italic text-center py-1 border border-dashed rounded">No custom resources</p>
          )}
          {resources.map(res => (
            <div key={res.id} className="flex items-center justify-between p-1.5 bg-muted/10 rounded border border-muted/20">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {!hideNotes && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-4 w-4 shrink-0">
                        <Info className="h-2.5 w-2.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <Label className="text-xs mb-2 block">Notes: {res.description}</Label>
                      <Textarea defaultValue={res.notes || ''} onBlur={e => { const next = resources.map(r => r.id === res.id ? { ...r, notes: e.target.value } : r); setResources(next); updateCharacter(character.id, { customResources: next }); }} placeholder="Notes" className="mt-2 min-h-[80px] text-xs" />
                    </PopoverContent>
                  </Popover>
                )}
                <span className="text-[10px] font-bold break-words flex-1">{res.description}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handleChangeCurrent(res.id, -1)} disabled={res.current <= 0}>
                  <Minus className="h-2.5 w-2.5" />
                </Button>
                <span className="text-xs font-black w-8 text-center">{res.current}/{res.max}</span>
                <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handleChangeCurrent(res.id, 1)} disabled={res.current >= res.max}>
                  <Plus className="h-2.5 w-2.5" />
                </Button>
                {isEditing && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeResource(res.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isEditing && (
            <div className="flex gap-1 pt-1 border-t items-center">
              <Input placeholder="Name" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="h-7 text-[10px] flex-1" />
              <Input type="number" value={newMax === 0 ? '' : newMax} onChange={e => setNewMax(parseInt(e.target.value) || 1)} className="h-7 text-[10px] w-12 text-center" min={1} />
              <Button size="sm" className="h-7 px-2" onClick={addResource}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}