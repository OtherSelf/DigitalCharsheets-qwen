'use client';

import * as React from 'react';

import { Edit, Info, Plus, Save, Trash2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { type AttunementItem } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Textarea } from '../../ui/textarea';

const EditSaveButton = ({
  editing,
  onEdit,
  onSave,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
}) =>
  editing ? (
    <Button
      data-testid="save-button"
      size="icon"
      variant="ghost"
      onClick={onSave}
      className="h-7 w-7"
    >
      <Save className="h-4 w-4" />
    </Button>
  ) : (
    <Button
      data-testid="edit-button"
      size="icon"
      variant="outline"
      onClick={onEdit}
      className="h-7 w-7"
    >
      <Edit className="h-4 w-4" />
    </Button>
  );

interface AttunementSectionProps {
  /**
   * Префикс для `id`: нужен, когда секция рендерится ещё и в листе
   * компаньона — иначе на странице появляются дубли `id`, а на них
   * держатся `htmlFor`, `aria-*`, якоря и селекторы `#...` в тестах.
   */
  idPrefix?: string;
  characterId: string;
  initialItems: AttunementItem[];
}

export const DndAttunementSection = React.forwardRef<
  { saveAll: () => void },
  AttunementSectionProps
>(({ characterId, initialItems, idPrefix }, ref) => {
  const idp = idPrefix ? `${idPrefix}-` : '';
  const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [attunementItems, setAttunementItems] =
    React.useState<AttunementItem[]>(initialItems);
  const [isAttunementEditing, setIsAttunementEditing] = React.useState(false);
  const [newAttunementItem, setNewAttunementItem] = React.useState('');

  React.useEffect(() => {
    setAttunementItems(initialItems);
  }, [characterId]);

  const handleSaveAttunement = React.useCallback(() => {
    updateCharacter(characterId, { attunementItems });
    setIsAttunementEditing(false);
  }, [characterId, attunementItems, updateCharacter]);

  React.useImperativeHandle(
    ref,
    () => ({
      saveAll: () => {
        if (isAttunementEditing) handleSaveAttunement();
      },
    }),
    [isAttunementEditing, handleSaveAttunement],
  );

  const handleAttunedChange = (id: string, attuned: boolean) => {
    if (attuned) {
      const count = attunementItems.filter((i) => i.attuned).length;
      if (count >= 3) {
        toast({
          variant: 'destructive',
          title: 'Limit Reached',
          description: 'You can only attune up to 3 items.',
        });
        return;
      }
    }
    const next = attunementItems.map((i) =>
      i.id === id ? { ...i, attuned } : i,
    );
    setAttunementItems(next);
    if (!isAttunementEditing)
      updateCharacter(characterId, { attunementItems: next });
  };

  return (
    <Card id={`${idp}attunement-card`}>
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
          {t('attunement')}
        </CardTitle>
        {(showEditButtons || isAttunementEditing) && (
          <EditSaveButton
            editing={isAttunementEditing}
            onEdit={() => setIsAttunementEditing(true)}
            onSave={handleSaveAttunement}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {attunementItems.map((it) => (
          <div
            key={it.id}
            className="group flex items-center justify-between rounded bg-muted/10 p-1.5 text-[10px]"
          >
            <div className="flex flex-1 items-center gap-2">
              <Checkbox
                checked={it.attuned}
                onCheckedChange={(v) => handleAttunedChange(it.id, !!v)}
              />
              {isAttunementEditing ? (
                <Input
                  value={it.description}
                  onChange={(e) =>
                    setAttunementItems(
                      attunementItems.map((item) =>
                        item.id === it.id
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    )
                  }
                  className="h-6 flex-1 text-[10px]"
                />
              ) : (
                <span
                  className={cn(
                    'flex-1 truncate font-medium',
                    !it.attuned && 'opacity-50',
                  )}
                >
                  {it.description}
                  {it.attuned && (
                    <span className="ml-1 text-[8px] font-black uppercase text-primary">
                      (Attuned)
                    </span>
                  )}
                </span>
              )}

              {!hideNotes && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={it.notes ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      title="Notes"
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <Label className="mb-2 block text-xs">
                      Notes for {it.description || 'Item'}
                    </Label>
                    <Textarea
                      defaultValue={it.notes || ''}
                      onBlur={(e) => {
                        const next = attunementItems.map((item) =>
                          item.id === it.id
                            ? { ...item, notes: e.target.value }
                            : item,
                        );
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 h-5 w-5 text-destructive"
                  onClick={() =>
                    setAttunementItems(
                      attunementItems.filter((item) => item.id !== it.id),
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {isAttunementEditing && (
          <div className="flex gap-2 border-t pt-2">
            <Input
              placeholder="New..."
              value={newAttunementItem}
              onChange={(e) => setNewAttunementItem(e.target.value)}
              className="h-7 text-[10px]"
            />
            <Button
              size="sm"
              className="h-7"
              onClick={() => {
                if (newAttunementItem.trim()) {
                  setAttunementItems([
                    ...attunementItems,
                    {
                      id: `att-${Date.now()}`,
                      description: newAttunementItem.trim(),
                      attuned: false,
                    },
                  ]);
                  setNewAttunementItem('');
                }
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

DndAttunementSection.displayName = 'DndAttunementSection';
