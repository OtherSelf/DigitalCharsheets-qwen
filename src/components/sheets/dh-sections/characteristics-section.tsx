// src/components/sheets/dh-sections/characteristics-section.tsx
'use client';

import * as React from 'react';
import { type DarkHeresyCharacter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from './dh-ui-helpers';

const defaultStatUpgrades = {
    weaponSkill: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    ballisticSkill: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    strength: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    toughness: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    agility: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    intelligence: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    perception: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    willpower: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    fellowship: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    influence: [false, false, false, false] as [boolean, boolean, boolean, boolean],
};

const characteristics = [
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

const CharacteristicStat = ({
    label, fullName, value, upgrades, editing,
    onValueChange, onUpgradeChange, notes, onNoteChange,
    isCompactView, hideNotes
}: {
    label: string; fullName: string; value: number; upgrades: boolean[];
    editing: boolean; onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUpgradeChange: (index: number, checked: boolean) => void;
    notes?: string; onNoteChange: (note: string) => void;
    isCompactView: boolean; hideNotes: boolean;
}) => {
    const currentUpgrades = (
        Array.isArray(upgrades) ? [...upgrades, ...Array(4 - upgrades.length).fill(false)] : [false, false, false, false]
    ).slice(0, 4) as [boolean, boolean, boolean, boolean];

    const bonus = currentUpgrades.filter(Boolean).length * 5;
    const displayValue = value + bonus;

    const isCheckboxDisabled = (index: number) => {
        if (editing) return true;
        if (!currentUpgrades[index] && index > 0 && !currentUpgrades[index - 1]) return true;
        return false;
    };

    return (
        <div className="py-1 rounded-lg bg-background border text-center relative px-0.5 h-full flex flex-col justify-between min-h-[80px]">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">{isCompactView ? label : fullName}</div>
            {!hideNotes && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 absolute top-0.5 right-0.5"><Info className="h-3 w-3" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                        <Label className="text-xs mb-2 block">Notes for {fullName}</Label>
                        <Textarea defaultValue={notes || ''} onBlur={(e) => onNoteChange(e.target.value)} placeholder="Add notes..." className="min-h-[100px] text-sm" />
                    </PopoverContent>
                </Popover>
            )}
            <div className="flex items-center justify-center gap-1 mb-1">
                {editing ? (
                    <Input type="number" value={value} onChange={onValueChange} className="text-base font-bold h-8 w-14 text-center" />
                ) : (
                    <div className="text-base font-bold text-primary w-10 text-center">{displayValue}</div>
                )}
                <div className="flex flex-col gap-1 pr-1">
                    {currentUpgrades.map((checked, index) => (
                        <Checkbox key={index} checked={checked} disabled={isCheckboxDisabled(index)} onCheckedChange={(c) => onUpgradeChange(index, !!c)} className="h-3 w-3" />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface CharacteristicsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    isSkillsPanelCollapsed: boolean;
    isEquipmentPanelCollapsed: boolean;
    onEditingChange?: (val: boolean) => void;
}

export const CharacteristicsSection = React.forwardRef<{ saveAll: () => void }, CharacteristicsSectionProps>(({ character, isCompactView, isSkillsPanelCollapsed, isEquipmentPanelCollapsed, onEditingChange }, ref) => {
    const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isCharacteristicsEditing, setIsCharacteristicsEditing] = React.useState(false);
    const [editableStats, setEditableStats] = React.useState(character.stats);
    const [editableStatUpgrades, setEditableStatUpgrades] = React.useState(character.statUpgrades ?? defaultStatUpgrades);

    const handleSaveCharacteristics = React.useCallback(() => {
        updateCharacter(character.id, { stats: editableStats, statUpgrades: editableStatUpgrades });
        setIsCharacteristicsEditing(false);
    }, [character.id, editableStats, editableStatUpgrades, updateCharacter]);
    
    const isAnyEditing = isCharacteristicsEditing;
    React.useEffect(() => { onEditingChange?.(isAnyEditing); }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(ref, () => ({
        saveAll: () => { if (isCharacteristicsEditing) handleSaveCharacteristics(); }
    }), [isCharacteristicsEditing, handleSaveCharacteristics]);

    const handleUpgradeChange = (statKey: keyof typeof defaultStatUpgrades, index: number, isChecked: boolean) => {
        if (isCharacteristicsEditing) {
            setEditableStatUpgrades(prev => {
                const next = { ...prev };
                const specific = [...(next[statKey] || [false, false, false, false])];
                specific[index] = isChecked;
                if (!isChecked) for (let i = index + 1; i < specific.length; i++) specific[i] = false;
                next[statKey] = specific as [boolean, boolean, boolean, boolean];
                return next;
            });
        } else {
            const next = { ...character.statUpgrades };
            const specific = [...(next[statKey] || [false, false, false, false])];
            specific[index] = isChecked;
            if (!isChecked) for (let i = index + 1; i < specific.length; i++) specific[i] = false;
            next[statKey] = specific as [boolean, boolean, boolean, boolean];
            updateCharacter(character.id, { statUpgrades: next });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-3 pb-6">
                <CardTitle className="font-headline">{t('characteristics')}</CardTitle>
                {(showEditButtons || isCharacteristicsEditing) && <EditSaveButton editing={isCharacteristicsEditing} onEdit={() => setIsCharacteristicsEditing(true)} onSave={handleSaveCharacteristics} />}
            </CardHeader>
            <CardContent className={cn("space-y-2", (isSkillsPanelCollapsed && isEquipmentPanelCollapsed) ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 !space-y-0" : "grid grid-cols-1 gap-2")}>
                {characteristics.map(char => (
                    <CharacteristicStat
                        key={char.key}
                        label={char.label}
                        fullName={char.fullName}
                        value={isCharacteristicsEditing ? editableStats[char.key] : character.stats[char.key]}
                        upgrades={isCharacteristicsEditing ? editableStatUpgrades[char.key] : (character.statUpgrades ? character.statUpgrades[char.key] : [false, false, false, false])}
                        editing={isCharacteristicsEditing}
                        onValueChange={e => setEditableStats(prev => ({ ...prev, [char.key]: parseInt(e.target.value, 10) || 0 }))}
                        onUpgradeChange={(index, checked) => handleUpgradeChange(char.key, index, checked)}
                        notes={character.statNotes?.[char.key]}
                        onNoteChange={(note) => { const next = { ...(character.statNotes || {}), [char.key]: note }; updateCharacter(character.id, { statNotes: next }); }}
                        isCompactView={isCompactView}
                        hideNotes={hideNotes}
                    />
                ))}
             </CardContent>
        </Card>
    );
});

CharacteristicsSection.displayName = 'CharacteristicsSection';