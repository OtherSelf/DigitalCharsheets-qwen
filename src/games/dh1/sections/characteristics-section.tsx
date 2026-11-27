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
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import { statBonus, upgradeBonus } from '../dh-stats';
import {
  EMPTY_STAT_UPGRADE,
  pickAllowedStats,
  statRecord,
  type DarkHeresyStatKey,
} from '../stats';
import type {
  DH1Character as Character,
  DarkHeresyStatUpgrade,
  DH1Character,
} from '../types';
import { EditSaveButton } from './dh-ui-helpers';

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
  const { t } = useTranslation();
  const currentUpgrades = (
    Array.isArray(upgrades)
      ? [...upgrades, ...Array(4 - upgrades.length).fill(false)]
      : [false, false, false, false]
  ).slice(0, 4) as [boolean, boolean, boolean, boolean];
  const bonus = upgradeBonus(currentUpgrades);
  const displayValue = value + bonus;
  const isCheckboxDisabled = (index: number) => {
    if (editing) return true;
    if (!currentUpgrades[index] && index > 0 && !currentUpgrades[index - 1])
      return true;
    return false;
  };
  return (
    <div className="bg-background relative flex h-full min-h-[80px] flex-col justify-between rounded-lg border px-0.5 py-1 text-center">
      <div className="text-muted-foreground text-10px px-1 font-semibold tracking-wide uppercase">
        {isCompactView ? label : `${fullName} (${label})`}
      </div>
      {!hideNotes && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={notes ? 'secondary' : 'ghost'}
              size="icon"
              aria-label={`${label} - ${t('common.notes')}`}
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
              hideIndicator
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
  /** Телефонная подача: только она прячет блок перемещения. */
  isPhoneView: boolean;
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
      isPhoneView,
      isSkillsPanelCollapsed,
      isEquipmentPanelCollapsed,
      onEditingChange,
    },
    ref,
  ) => {
    const { updateCharacter, hideNotes, showEditButtons } =
      useCharacterContext();
    const { t, language } = useTranslation();
    const [isCharacteristicsEditing, setIsCharacteristicsEditing] =
      React.useState(false);
    // ─── LANDMARK: DH1 CHARACTERISTICS ───
    // У 1-й редакции девять характеристик: `influence` — поле 2e.
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

    // ─── LANDMARK: DH1 CHARACTERISTIC LIST ───
    const characteristics = [
      { key: 'weaponSkill' },
      { key: 'ballisticSkill' },
      { key: 'strength' },
      { key: 'toughness' },
      { key: 'agility' },
      { key: 'intelligence' },
      { key: 'perception' },
      { key: 'willpower' },
      { key: 'fellowship' },
    ] as const;
    // ─── END DH1 CHARACTERISTIC LIST ───

    const handleSaveCharacteristics = React.useCallback(() => {
      // Сохраняем только ключи редакции: старый файл с influence не должен
      // вернуть поле в данные dh1.
      updateCharacter(character.id, {
        stats: pickAllowedStats(editableStats),
        statUpgrades: pickAllowedStats(editableStatUpgrades),
      } as Partial<Character>);
      setIsCharacteristicsEditing(false);
    }, [character.id, editableStats, editableStatUpgrades, updateCharacter]);

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
              label={t(`dh1.${char.key}Abbr`)}
              // Полное имя — по ключу характеристики, а не по label: label может быть сокращён.
              fullName={t(`dh1.${char.key}`)}
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
                  statNotes: pickAllowedStats({
                    ...currentNotes,
                    [char.key]: note,
                  }),
                } as Partial<Character>);
              }}
              isCompactView={isCompactView}
              hideNotes={hideNotes}
              // Поповер заметок не знает про i18n: готовые строки передаёт родитель.
              notesForText={t('common.notesFor')}
              addNotesText={t('common.addNotes')}
            />
          ))}
        </CardContent>
        {/* Desktop Movement Display */}
        {!isPhoneView && (
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
                const agBonus = upgradeBonus(agUpgrades);
                const effectiveAg = character.stats.agility + agBonus;
                const agMod = statBonus(effectiveAg);
                return (
                  <>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-10px font-bold uppercase">
                        {t('dh1.halfMove')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-10px font-bold uppercase">
                        {t('dh1.move')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod * 2}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-10px font-bold uppercase">
                        {t('dh1.charge')}
                      </Label>
                      <div className="text-primary text-lg font-bold">
                        {agMod * 3}
                      </div>
                    </div>
                    <div className="bg-background rounded-lg border p-2 text-center">
                      <Label className="text-muted-foreground text-10px font-bold uppercase">
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
