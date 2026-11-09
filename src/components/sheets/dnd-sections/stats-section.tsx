'use client';

import * as React from 'react';

import { Edit, Info, Plus, Save, Trash2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Textarea } from '../../ui/textarea';

type DnDStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};
type DnDStatNotes = {
  strength?: string;
  dexterity?: string;
  constitution?: string;
  intelligence?: string;
  wisdom?: string;
  charisma?: string;
};

const StatBox = ({
  label,
  value,
  editing,
  onChange,
  isCompactView,
  notes,
  onNoteChange,
  hideNotes,
}: {
  label: string;
  value: number;
  editing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCompactView: boolean;
  notes?: string;
  onNoteChange: (val: string) => void;
  hideNotes: boolean;
}) => {
  const { t } = useTranslation();
  const modifier = Math.floor((value - 10) / 2);
  const displayModifier = modifier >= 0 ? `+${modifier}` : modifier.toString();
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border bg-background text-center',
        isCompactView ? 'p-1' : 'p-4',
      )}
    >
      {!hideNotes && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={notes ? 'secondary' : 'ghost'}
              size="icon"
              className="absolute right-1 top-1 h-5 w-5"
            >
              <Info className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <Label className="mb-2 block text-xs">
              {t('notesFor')} {label}
            </Label>
            <Textarea
              defaultValue={notes || ''}
              onBlur={(e) => onNoteChange(e.target.value)}
              placeholder={`${t('addNotes')}...`}
              className="min-h-[100px] text-sm"
            />
          </PopoverContent>
        </Popover>
      )}
      <div
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider text-muted-foreground',
          isCompactView && 'text-[8px]',
        )}
      >
        {label}
      </div>
      <div className="mt-1">
        {editing ? (
          <Input
            type="number"
            min={1}
            max={30}
            value={value === 0 ? '' : value}
            onChange={onChange}
            className={cn(
              'h-7 w-24 text-center text-base font-bold',
              isCompactView && 'h-6 w-16 text-sm',
            )}
          />
        ) : (
          <div
            className={cn(
              'text-base font-bold text-muted-foreground',
              isCompactView && 'text-sm',
            )}
          >
            {value}
          </div>
        )}
      </div>
      <div className="mt-2 w-full">
        <div className="mb-0.5 text-[8px] font-bold uppercase text-muted-foreground">
          {t('mod')}
        </div>
        <div
          className={cn(
            'rounded border border-border bg-background py-1 text-base font-bold text-foreground shadow-inner',
            isCompactView && 'py-0.5 text-sm',
          )}
        >
          {displayModifier}
        </div>
      </div>
    </div>
  );
};

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

interface StatsSectionProps {
  characterId: string;
  stats: DnDStats;
  setStats: React.Dispatch<React.SetStateAction<DnDStats>>;
  isStatsEditing: boolean;
  setIsStatsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveStats: () => void;
  statNotes?: DnDStatNotes;
  otherProficienciesAndLanguages: string[];
  setOtherProficienciesAndLanguages: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  isOtherProficienciesEditing: boolean;
  setIsOtherProficienciesEditing: React.Dispatch<React.SetStateAction<boolean>>;
  newProfItem: string;
  setNewProfItem: React.Dispatch<React.SetStateAction<string>>;
  handleSaveOtherProf: () => void;
  isCompactView: boolean;
  activeCompactSection: string;
  proficiencyBonus: number;
  passivePerception: number;
}

export function DndStatsSection({
  characterId,
  stats,
  setStats,
  isStatsEditing,
  setIsStatsEditing,
  handleSaveStats,
  statNotes,
  otherProficienciesAndLanguages,
  setOtherProficienciesAndLanguages,
  isOtherProficienciesEditing,
  setIsOtherProficienciesEditing,
  newProfItem,
  setNewProfItem,
  handleSaveOtherProf,
  isCompactView,
  activeCompactSection,
  proficiencyBonus,
  passivePerception,
}: StatsSectionProps) {
  const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
  const { t } = useTranslation();

  const wisdomMod = Math.floor((stats.wisdom - 10) / 2);

  return (
    <div
      className={cn(
        'space-y-4 md:col-span-2',
        isCompactView && activeCompactSection !== 'stats-section' && 'hidden',
      )}
    >
      {!isCompactView && (
        <Card id="stats-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              {t('characteristics')}
            </CardTitle>
            {(showEditButtons || isStatsEditing) && (
              <EditSaveButton
                editing={isStatsEditing}
                onEdit={() => setIsStatsEditing(true)}
                onSave={handleSaveStats}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {[
              'strength',
              'dexterity',
              'constitution',
              'intelligence',
              'wisdom',
              'charisma',
            ].map((key) => (
              <StatBox
                key={key}
                label={t(key)}
                value={stats[key as keyof DnDStats]}
                editing={isStatsEditing}
                onChange={(e) =>
                  setStats({ ...stats, [key]: parseInt(e.target.value) || 1 })
                }
                isCompactView={isCompactView}
                notes={statNotes?.[key as keyof DnDStatNotes]}
                onNoteChange={(v) =>
                  updateCharacter(characterId, {
                    statNotes: { ...(statNotes || {}), [key]: v },
                  })
                }
                hideNotes={hideNotes}
              />
            ))}

            <div className="mt-3 border-t pt-3">
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex flex-col">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                    {t('passivePerception')}
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    10 + {t('wisdomMod')}{' '}
                    {passivePerception > 10 + wisdomMod
                      ? `+ ${passivePerception - (10 + wisdomMod)}`
                      : ''}
                  </span>
                </div>
                <div className="text-2xl font-black text-primary">
                  {passivePerception}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isCompactView && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              {t('otherProficienciesAndLanguages')}
            </CardTitle>
            {(showEditButtons || isOtherProficienciesEditing) && (
              <EditSaveButton
                editing={isOtherProficienciesEditing}
                onEdit={() => setIsOtherProficienciesEditing(true)}
                onSave={handleSaveOtherProf}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {otherProficienciesAndLanguages.map((it, i) => (
              <div
                key={i}
                className="flex justify-between rounded bg-muted/10 p-1.5 text-[10px]"
              >
                {isOtherProficienciesEditing ? (
                  <Input
                    value={it}
                    onChange={(e) => {
                      const n = [...otherProficienciesAndLanguages];
                      n[i] = e.target.value;
                      setOtherProficienciesAndLanguages(n);
                    }}
                    className="mr-2 h-6 flex-1 text-[10px]"
                  />
                ) : (
                  <span className="break-words font-medium">&bull; {it}</span>
                )}
                {isOtherProficienciesEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive"
                    onClick={() =>
                      setOtherProficienciesAndLanguages(
                        otherProficienciesAndLanguages.filter(
                          (_, idx) => idx !== i,
                        ),
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {isOtherProficienciesEditing && (
              <div className="flex gap-2 border-t pt-2">
                <Input
                  placeholder={t('newItemPlaceholder')}
                  value={newProfItem}
                  onChange={(e) => setNewProfItem(e.target.value)}
                  className="h-7 text-[10px]"
                />
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    if (newProfItem.trim()) {
                      setOtherProficienciesAndLanguages([
                        ...otherProficienciesAndLanguages,
                        newProfItem.trim(),
                      ]);
                      setNewProfItem('');
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
