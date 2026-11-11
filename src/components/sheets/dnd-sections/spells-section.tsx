'use client';

import * as React from 'react';

import {
  ChevronDown,
  ChevronUp,
  Edit,
  Info,
  Minus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { type Spell, type SpellcastingEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

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

const DEFAULT_SLOTS = {
  1: { max: 0, current: 0 },
  2: { max: 0, current: 0 },
  3: { max: 0, current: 0 },
  4: { max: 0, current: 0 },
  5: { max: 0, current: 0 },
  6: { max: 0, current: 0 },
  7: { max: 0, current: 0 },
  8: { max: 0, current: 0 },
  9: { max: 0, current: 0 },
};

interface SpellsSectionProps {
  /**
   * Префикс для `id`: нужен, когда секция рендерится ещё и в листе
   * компаньона — иначе на странице появляются дубли `id`, а на них
   * держатся `htmlFor`, `aria-*`, якоря и селекторы `#...` в тестах.
   */
  idPrefix?: string;
  characterId: string;
  initialSpells: Spell[];
  initialSpellSlots?: Record<number, { max: number; current: number }>;
  isCompactView: boolean;
  activeCompactSection: string;
  initialSpellcastingEntries?: SpellcastingEntry[];
  stats?: Record<string, number>;
  proficiencyBonus?: number;
}

export function DndSpellsSection({
  characterId,
  initialSpells,
  initialSpellSlots,
  isCompactView,
  activeCompactSection,
  initialSpellcastingEntries,
  stats,
  proficiencyBonus,
  idPrefix,
}: SpellsSectionProps) {
  const idp = idPrefix ? `${idPrefix}-` : '';
  const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
  const { t } = useTranslation();
  const [isSpellsOpen, setIsSpellsOpen] = React.useState(true);
  const [spells, setSpells] = React.useState<Spell[]>(initialSpells);
  const [spellSlots, setSpellSlots] = React.useState<
    Record<number, { max: number; current: number }>
  >(initialSpellSlots || DEFAULT_SLOTS);
  const [editingLevel, setEditingLevel] = React.useState<number | null>(null);
  const [newSpellName, setNewSpellName] = React.useState('');

  const [spellcastingEntries, setSpellcastingEntries] = React.useState<
    SpellcastingEntry[]
  >(initialSpellcastingEntries || []);
  const [isSpellcastingEditing, setIsSpellcastingEditing] =
    React.useState(false);

  React.useEffect(() => {
    setSpells(initialSpells);
    setSpellSlots(initialSpellSlots || DEFAULT_SLOTS);
    setSpellcastingEntries(initialSpellcastingEntries || []);
  }, [
    characterId,
    initialSpells,
    initialSpellSlots,
    initialSpellcastingEntries,
  ]);

  const getSpellcastingMod = (ability: string) => {
    if (ability === 'none' || !ability || !stats) return 0;
    const statValue = stats[ability] || 10;
    return Math.floor((statValue - 10) / 2);
  };

  const calculateSpellAttack = (ability: string) => {
    const mod = getSpellcastingMod(ability);
    const total = mod + (proficiencyBonus || 0);
    return total >= 0 ? `+${total}` : `${total}`;
  };

  const calculateSpellSaveDC = (ability: string) => {
    return 8 + (proficiencyBonus || 0) + getSpellcastingMod(ability);
  };

  const handleSpellcastingFieldChange = (
    id: string,
    field: keyof SpellcastingEntry,
    value: string | number,
  ) => {
    setSpellcastingEntries((prev) => {
      const updated = prev.map((entry) => {
        if (entry.id !== id) return entry;
        const newEntry = { ...entry, [field]: value };
        if (field === 'ability' && typeof value === 'string') {
          newEntry.attackBonus = calculateSpellAttack(value);
          newEntry.saveDC = calculateSpellSaveDC(value);
        }
        return newEntry;
      });
      updateCharacter(characterId, { spellcastingEntries: updated });
      return updated;
    });
  };

  const addSpellcastingEntry = () => {
    const newEntry: SpellcastingEntry = {
      id: `spellcast-${Date.now()}`,
      ability: 'none',
      attackBonus: '+0',
      saveDC: 10,
    };
    const updated = [...spellcastingEntries, newEntry];
    setSpellcastingEntries(updated);
    updateCharacter(characterId, { spellcastingEntries: updated });
  };

  const removeSpellcastingEntry = (id: string) => {
    const updated = spellcastingEntries.filter((e) => e.id !== id);
    setSpellcastingEntries(updated);
    updateCharacter(characterId, { spellcastingEntries: updated });
  };

  const handleSaveSpellcasting = React.useCallback(() => {
    setIsSpellcastingEditing(false);
  }, []);

  const renderSpellBox = (level: number, title: string) => {
    const levelSpells = spells.filter((s) => s.level === level);
    const slots = spellSlots[level] || { max: 0, current: 0 };
    const isEditing = editingLevel === level;
    return (
      <Card
        key={level}
        className="flex h-full flex-col overflow-hidden border-2"
      >
        <CardHeader className="bg-muted/10 flex flex-col border-b px-4 pt-2 pb-2">
          <div className="mb-1 flex w-full flex-row items-center justify-between">
            <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
              {title}
            </CardTitle>
            {level > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                  {t('dnd.slots')}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-5 w-5"
                    onClick={() => {
                      const newMax = Math.max(0, slots.max - 1);
                      const n = {
                        ...spellSlots,
                        [level]: {
                          ...slots,
                          max: newMax,
                          current: Math.min(slots.current, newMax),
                        },
                      };
                      setSpellSlots(n);
                      updateCharacter(characterId, { spellSlots: n });
                    }}
                  >
                    <Minus className="h-2 w-2" />
                  </Button>
                  <span className="w-4 text-center text-xs font-black">
                    {slots.max}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-5 w-5"
                    onClick={() => {
                      const n = {
                        ...spellSlots,
                        [level]: {
                          ...slots,
                          max: slots.max + 1,
                          current: slots.current + 1,
                        },
                      };
                      setSpellSlots(n);
                      updateCharacter(characterId, { spellSlots: n });
                    }}
                  >
                    <Plus className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            )}
            {(showEditButtons || isEditing) && (
              <EditSaveButton
                editing={isEditing}
                onEdit={() => setEditingLevel(level)}
                onSave={() => {
                  updateCharacter(characterId, { spells, spellSlots });
                  setEditingLevel(null);
                }}
              />
            )}
          </div>
          {level > 0 && slots.max > 0 && (
            <div className="mt-1 flex items-center justify-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => {
                  const n = {
                    ...spellSlots,
                    [level]: {
                      ...slots,
                      current: Math.max(0, slots.current - 1),
                    },
                  };
                  setSpellSlots(n);
                  updateCharacter(characterId, { spellSlots: n });
                }}
                disabled={slots.current <= 0}
                title={t('common.damage')}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <Checkbox
                    key={i}
                    checked={i < slots.current}
                    disabled
                    className="h-3 w-3 disabled:opacity-100"
                  />
                ))}
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => {
                  const n = {
                    ...spellSlots,
                    [level]: {
                      ...slots,
                      current: Math.min(slots.max, slots.current + 1),
                    },
                  };
                  setSpellSlots(n);
                  updateCharacter(characterId, { spellSlots: n });
                }}
                disabled={slots.current >= slots.max}
                title={t('dnd.heal')}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 space-y-4 p-3">
          <ul className="space-y-1">
            {levelSpells.map((spell) => (
              <li
                key={spell.id}
                className="group relative flex items-center gap-1"
              >
                {!hideNotes && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={spell.notes ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-5 w-5 shrink-0"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <Label className="mb-2 block text-xs">
                        {t('common.notesFor')} {spell.name}
                      </Label>
                      <Textarea
                        defaultValue={spell.notes || ''}
                        onBlur={(e) =>
                          setSpells(
                            spells.map((s) =>
                              s.id === spell.id
                                ? { ...s, notes: e.target.value }
                                : s,
                            ),
                          )
                        }
                        placeholder={t('common.addNotes')}
                        className="mt-2 min-h-[100px] text-sm"
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {isEditing ? (
                  <div className="bg-muted/30 flex flex-1 items-start gap-1 rounded p-1">
                    <Input
                      value={spell.name}
                      onChange={(e) =>
                        setSpells(
                          spells.map((s) =>
                            s.id === spell.id
                              ? { ...s, name: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className="h-7 flex-1 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-7 w-7"
                      onClick={() =>
                        setSpells(spells.filter((s) => s.id !== spell.id))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-muted/50 hover:bg-muted/20 flex-1 cursor-default border-b py-1 text-xs font-medium transition-colors last:border-0">
                    &bull; {spell.name}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {isEditing && (
            <div className="space-y-2 border-t pt-2">
              <Input
                placeholder={t('dnd.spellNamePlaceholder')}
                value={newSpellName}
                onChange={(e) => setNewSpellName(e.target.value)}
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                className="h-7 w-full text-[10px]"
                onClick={() => {
                  if (newSpellName.trim()) {
                    setSpells([
                      ...spells,
                      {
                        id: `spell-${Date.now()}`,
                        name: newSpellName,
                        level,
                        notes: '',
                      },
                    ]);
                    setNewSpellName('');
                  }
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> {t('common.add')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Collapsible
      id={`${idp}spells-section`}
      open={isSpellsOpen}
      onOpenChange={setIsSpellsOpen}
      className={cn(
        'space-y-6',
        isCompactView && activeCompactSection !== 'spells-section' && 'hidden',
      )}
    >
      <div className="mb-4 flex items-center justify-center">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-auto items-center gap-2 p-0 hover:bg-transparent"
          >
            <h2 className="font-headline text-2xl font-bold">
              {t('dnd.spellList')}
            </h2>
            {isSpellsOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-6">
        {isCompactView && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
              <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
                {t('dnd.spellcastingStats')}
              </CardTitle>
              {(showEditButtons || isSpellcastingEditing) && (
                <EditSaveButton
                  editing={isSpellcastingEditing}
                  onEdit={() => setIsSpellcastingEditing(true)}
                  onSave={handleSaveSpellcasting}
                />
              )}
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {spellcastingEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-muted/20 bg-muted/10 grid grid-cols-12 items-center gap-2 rounded border p-2"
                >
                  <div className="col-span-6 w-full">
                    <div className="mb-1 flex items-center gap-1">
                      {!hideNotes && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={entry.notes ? 'secondary' : 'ghost'}
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              title={t('common.notes')}
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64">
                            <Label className="mb-2 block text-xs">
                              {t('common.notes')}:{' '}
                              {entry.ability === 'none'
                                ? t('dnd.spellcasting')
                                : t(entry.ability)}
                            </Label>
                            <Textarea
                              defaultValue={entry.notes || ''}
                              onBlur={(e) => {
                                const updated = spellcastingEntries.map((en) =>
                                  en.id === entry.id
                                    ? { ...en, notes: e.target.value }
                                    : en,
                                );
                                setSpellcastingEntries(updated);
                                updateCharacter(characterId, {
                                  spellcastingEntries: updated,
                                });
                              }}
                              placeholder={t('common.addNotes')}
                              className="mt-2 min-h-[100px] text-sm"
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                      <Label className="text-muted-foreground text-[9px] uppercase">
                        {t('dnd.ability')}
                      </Label>
                    </div>
                    {isSpellcastingEditing ? (
                      <Select
                        value={entry.ability}
                        onValueChange={(v) =>
                          handleSpellcastingFieldChange(entry.id, 'ability', v)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t('common.none')}
                          </SelectItem>
                          <SelectItem value="strength">
                            {t('common.strength')}
                          </SelectItem>
                          <SelectItem value="dexterity">
                            {t('common.dexterity')}
                          </SelectItem>
                          <SelectItem value="constitution">
                            {t('common.constitution')}
                          </SelectItem>
                          <SelectItem value="intelligence">
                            {t('common.intelligence')}
                          </SelectItem>
                          <SelectItem value="wisdom">
                            {t('common.wisdom')}
                          </SelectItem>
                          <SelectItem value="charisma">
                            {t('common.charisma')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs font-bold">
                        {entry.ability === 'none'
                          ? t('common.none')
                          : t(entry.ability)}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 w-full">
                    <Label className="text-muted-foreground mb-1 block text-[9px] uppercase">
                      {t('dnd.atkBonus')}
                    </Label>
                    {isSpellcastingEditing ? (
                      <Input
                        value={entry.attackBonus}
                        onChange={(e) =>
                          handleSpellcastingFieldChange(
                            entry.id,
                            'attackBonus',
                            e.target.value,
                          )
                        }
                        className="h-8 text-center text-xs"
                      />
                    ) : (
                      <span className="text-xs font-bold">
                        {entry.attackBonus || '-'}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 w-full">
                    <Label className="text-muted-foreground mb-1 block text-[9px] uppercase">
                      {t('dnd.spellSaveDC')}
                    </Label>
                    {isSpellcastingEditing ? (
                      <Input
                        type="number"
                        value={entry.saveDC}
                        onChange={(e) =>
                          handleSpellcastingFieldChange(
                            entry.id,
                            'saveDC',
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="h-8 text-center text-xs"
                      />
                    ) : (
                      <span className="text-xs font-bold">
                        {entry.saveDC || '-'}
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {isSpellcastingEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8 shrink-0"
                        onClick={() => removeSpellcastingEntry(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isSpellcastingEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 w-full text-[10px]"
                  onClick={addSpellcastingEntry}
                >
                  <Plus className="mr-1 h-3 w-3" />{' '}
                  {t('dnd.addSpellcastingEntry')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {renderSpellBox(0, t('dnd.cantrips'))}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) =>
            renderSpellBox(lvl, `${t('dnd.level')} ${lvl}`),
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
