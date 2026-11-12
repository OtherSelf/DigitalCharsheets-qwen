// src/games/dh1/sections/characteristics-section.tsx
'use client';

import * as React from 'react';

import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import type { Character } from '@/lib/types';
import { cn } from '@/lib/utils';

import { getDarkHeresyCapabilities } from '../capabilities';
import {
  EMPTY_STAT_UPGRADE,
  pickAllowedStats,
  statRecord,
  type DarkHeresyStatKey,
} from '../stats';
import type { DarkHeresyStatUpgrade, DH1Character } from '../types';
import { EditSaveButton } from './dh-ui-helpers';

// LANDMARK 1: Added notesForText and addNotesText to the component props
const CharacteristicStat = ({
  label,
  fullName,
  value,
  upgrades,
  editing,
  onValueChange,
  onUpgradeChange,
  notes,
  onNoteChange,
  isCompactView,
  hideNotes,
  notesForText,
  addNotesText,
}: {
  label: string;
  fullName: string;
  value: number;
  upgrades: boolean[];
  editing: boolean;
  onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpgradeChange: (index: number, checked: boolean) => void;
  notes?: string;
  onNoteChange: (note: string) => void;
  isCompactView: boolean;
  hideNotes: boolean;
  notesForText: string;
  addNotesText: string;
}) => {
  const currentUpgrades = (
    Array.isArray(upgrades)
      ? [...upgrades, ...Array(4 - upgrades.length).fill(false)]
      : [false, false, false, false]
  ).slice(0, 4) as [boolean, boolean, boolean, boolean];
  const bonus = currentUpgrades.filter(Boolean).length * 5;
  const displayValue = value + bonus;
  const isCheckboxDisabled = (index: number) => {
    if (editing) return true;
    if (!currentUpgrades[index] && index > 0 && !currentUpgrades[index - 1])
      return true;
    return false;
  };
  return (
    <div className="bg-background relative flex h-full min-h-[80px] flex-col justify-between rounded-lg border px-0.5 py-1 text-center">
      <div className="text-muted-foreground px-1 text-[10px] font-semibold tracking-wide uppercase">
        {isCompactView ? label : fullName}
      </div>
      {!hideNotes && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={notes ? 'secondary' : 'ghost'}
              size="icon"
              className="absolute top-0.5 right-0.5 h-5 w-5"
            >
              <Info className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            {/* LANDMARK 2: Using translated strings inside the notes popover */}
            <Label className="mb-2 block text-xs">
              {notesForText} {fullName}
            </Label>
            <Textarea
              defaultValue={notes || ''}
              onBlur={(e) => onNoteChange(e.target.value)}
              placeholder={addNotesText}
              className="min-h-[100px] text-sm"
            />
          </PopoverContent>
        </Popover>
      )}
      <div className="mb-1 flex items-center justify-center gap-1">
        {editing ? (
          <Input
            type="number"
            value={value === 0 ? '' : value}
            onChange={onValueChange}
            className="h-8 w-14 [appearance:textfield] text-center text-base font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <div className="text-primary w-10 text-center text-base font-bold">
            {displayValue}
          </div>
        )}
        <div className="flex flex-col gap-1 pr-1">
          {currentUpgrades.map((checked, index) => (
            <Checkbox
              key={index}
              checked={checked}
              disabled={isCheckboxDisabled(index)}
              onCheckedChange={(c) => onUpgradeChange(index, !!c)}
              className="h-3 w-3"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface CharacteristicsSectionProps {
  character: DH1Character;
  isCompactView: boolean;
  isSkillsPanelCollapsed: boolean;
  isEquipmentPanelCollapsed: boolean;
  onEditingChange?: (val: boolean) => void;
}

export const CharacteristicsSection = React.forwardRef<
  { saveAll: () => void },
  CharacteristicsSectionProps
>(
  (
    {
      character,
      isCompactView,
      isSkillsPanelCollapsed,
      isEquipmentPanelCollapsed,
      onEditingChange,
    },
    ref,
  ) => {
    const { updateCharacter, hideNotes, showEditButtons } =
      useCharacterContext();
    const { t, language } = useTranslation();
    const capabilities = getDarkHeresyCapabilities(character);
    const [isCharacteristicsEditing, setIsCharacteristicsEditing] =
      React.useState(false);
    // ─── LANDMARK: EDITION-AGNOSTIC STAT VIEW ───
    // Характеристики приводятся к одному словарю (девять + influence).
    // Для dh1 ключ influence отфильтровывается при сохранении, поэтому
    // лишнего поля в данных не появляется.
    const [editableStats, setEditableStats] = React.useState(() =>
      statRecord<number>(character, 'stats', 0),
    );
    const [editableStatUpgrades, setEditableStatUpgrades] = React.useState(() =>
      statRecord<DarkHeresyStatUpgrade>(
        character,
        'statUpgrades',
        EMPTY_STAT_UPGRADE,
      ),
    );

    // ─── LANDMARK: SYNC EDITABLE STATE WITH CHARACTER DATA ───
    React.useEffect(() => {
      setEditableStats(statRecord<number>(character, 'stats', 0));
      setEditableStatUpgrades(
        statRecord<DarkHeresyStatUpgrade>(
          character,
          'statUpgrades',
          EMPTY_STAT_UPGRADE,
        ),
      );
    }, [character]);
    // ─── END SYNC EDITABLE STATE ───

    // ─── LANDMARK: DYNAMIC CHARACTERISTICS BASED ON CAPABILITIES ───
    const characteristics = React.useMemo(() => {
      const base = [
        { key: 'weaponSkill', label: 'WS', fullName: 'Weapon Skill' },
        { key: 'ballisticSkill', label: 'BS', fullName: 'Ballistic Skill' },
        { key: 'strength', label: 'S', fullName: 'Strength' },
        { key: 'toughness', label: 'T', fullName: 'Toughness' },
        { key: 'agility', label: 'Ag', fullName: 'Agility' },
        { key: 'intelligence', label: 'Int', fullName: 'Intelligence' },
        { key: 'perception', label: 'Per', fullName: 'Perception' },
        { key: 'willpower', label: 'WP', fullName: 'Willpower' },
        { key: 'fellowship', label: 'Fel', fullName: 'Fellowship' },
        { key: 'influence', label: 'Inf', fullName: 'Influence' },
      ] as const;

      if (!capabilities.influence) {
        return base.filter((char) => char.key !== 'influence');
      }
      return base;
    }, [capabilities.influence]);
    // ─── END DYNAMIC CHARACTERISTICS ───

    const handleSaveCharacteristics = React.useCallback(() => {
      // Сохраняем только ключи, которые существуют в редакции: dh1 не должен
      // получить influence, даже если он был в форме/старом файле.
      updateCharacter(character.id, {
        stats: pickAllowedStats(editableStats, capabilities.influence),
        statUpgrades: pickAllowedStats(
          editableStatUpgrades,
          capabilities.influence,
        ),
      } as Partial<Character>);
      setIsCharacteristicsEditing(false);
    }, [
      character.id,
      editableStats,
      editableStatUpgrades,
      updateCharacter,
      capabilities.influence,
    ]);

    const isAnyEditing = isCharacteristicsEditing;
    React.useEffect(() => {
      onEditingChange?.(isAnyEditing);
    }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        saveAll: () => {
          if (isCharacteristicsEditing) handleSaveCharacteristics();
        },
      }),
      [isCharacteristicsEditing, handleSaveCharacteristics],
    );

    const handleUpgradeChange = (
      statKey: DarkHeresyStatKey,
      index: number,
      isChecked: boolean,
    ) => {
      const apply = (
        upgrades: Record<DarkHeresyStatKey, DarkHeresyStatUpgrade>,
      ) => {
        const next = { ...upgrades };
        const specific = [...(next[statKey] || [false, false, false, false])];
        specific[index] = isChecked;
        if (!isChecked)
          for (let i = index + 1; i < specific.length; i++) specific[i] = false;
        next[statKey] = specific as DarkHeresyStatUpgrade;
        return next;
      };

      if (isCharacteristicsEditing) {
        setEditableStatUpgrades((prev) => apply(prev));
      } else {
        updateCharacter(character.id, {
          statUpgrades: pickAllowedStats(
            apply(
              statRecord<DarkHeresyStatUpgrade>(
                character,
                'statUpgrades',
                EMPTY_STAT_UPGRADE,
              ),
            ),
            capabilities.influence,
          ),
        } as Partial<Character>);
      }
    };

    const currentStats = statRecord<number>(character, 'stats', 0);
    const currentUpgrades = statRecord<DarkHeresyStatUpgrade>(
      character,
      'statUpgrades',
      EMPTY_STAT_UPGRADE,
    );
    const currentNotes = statRecord<string>(character, 'statNotes', '');

    return (
      <Card id="characteristics-card">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-3 pb-6">
          <CardTitle className="font-headline">
            {t('common.characteristics')}
          </CardTitle>
          {(showEditButtons || isCharacteristicsEditing) && (
            <EditSaveButton
              editing={isCharacteristicsEditing}
              onEdit={() => setIsCharacteristicsEditing(true)}
              onSave={handleSaveCharacteristics}
            />
          )}
        </CardHeader>
        <CardContent
          className={cn(
            'space-y-2',
            isSkillsPanelCollapsed && isEquipmentPanelCollapsed
              ? 'grid grid-cols-2 gap-2 !space-y-0 sm:grid-cols-3 md:grid-cols-5'
              : 'grid grid-cols-1 gap-2',
          )}
        >
          {characteristics.map((char) => (
            <CharacteristicStat
              key={char.key}
              label={char.label}
              // LANDMARK 3: Passing the translated full name using the char.key
              fullName={t(
                [
                  'weaponSkill',
                  'ballisticSkill',
                  'toughness',
                  'agility',
                  'fellowship',
                  'influence',
                ].includes(char.key)
                  ? `dh1.${char.key}`
                  : `common.${char.key}`,
              )}
              value={
                isCharacteristicsEditing
                  ? editableStats[char.key]
                  : currentStats[char.key]
              }
              upgrades={
                isCharacteristicsEditing
                  ? editableStatUpgrades[char.key]
                  : currentUpgrades[char.key]
              }
              editing={isCharacteristicsEditing}
              onValueChange={(e) =>
                setEditableStats((prev) => ({
                  ...prev,
                  [char.key]: parseInt(e.target.value, 10) || 0,
                }))
              }
              onUpgradeChange={(index, checked) =>
                handleUpgradeChange(char.key, index, checked)
              }
              notes={currentNotes[char.key] || undefined}
              onNoteChange={(note) => {
                updateCharacter(character.id, {
                  statNotes: pickAllowedStats(
                    { ...currentNotes, [char.key]: note },
                    capabilities.influence,
                  ),
                } as Partial<Character>);
              }}
              isCompactView={isCompactView}
              hideNotes={hideNotes}
              // LANDMARK 4: Passing translated strings for the notes popover
              notesForText={t('common.notesFor')}
              addNotesText={t('common.addNotes')}
            />
          ))}
        </CardContent>
        {/* Desktop Movement Display */}
        {!isCompactView && (
          <CardContent className="pt-0">
            <div
              className={cn(
                'grid gap-2',
                language === 'ru' ? 'grid-cols-2' : 'grid-cols-4',
              )}
            >
              {(() => {
                const agUpgrades = (character.statUpgrades?.agility || [
                  false,
                  false,
                  false,
                  false,
                ]) as boolean[];
                const agBonus = agUpgrades.filter(Boolean).length * 5;
                const effectiveAg = character.stats.agility + agBonus;
                const agMod = Math.floor(effectiveAg / 10);
                return (
                  <>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                        {t('dh1.halfMove')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                        {t('dh1.move')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod * 2}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                        {t('dh1.charge')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod * 3}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                        {t('dh1.run')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod * 6}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        )}
      </Card>
    );
  },
);
CharacteristicsSection.displayName = 'CharacteristicsSection';
