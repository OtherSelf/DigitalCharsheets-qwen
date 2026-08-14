import { DarkHeresyCharacter } from '@/lib/types';

export type StatUpgrades = DarkHeresyCharacter['statUpgrades'];
export type StatKey = keyof StatUpgrades;

/**
 * Calculates the new stat upgrades when a checkbox is toggled.
 * If a checkbox is unchecked, all subsequent checkboxes are also unchecked.
 */
export function calculateStatUpgrades(
    currentUpgrades: StatUpgrades,
    statKey: StatKey,
    index: number,
    isChecked: boolean
): StatUpgrades {
    const next = { ...currentUpgrades };
    const specific = [...(next[statKey] || [false, false, false, false])];
    specific[index] = isChecked;
    
    // If unchecking, also uncheck all subsequent checkboxes
    if (!isChecked) {
        for (let i = index + 1; i < specific.length; i++) {
            specific[i] = false;
        }
    }
    
    next[statKey] = specific as [boolean, boolean, boolean, boolean];
    return next;
}

/**
 * Calculates the bonus from stat upgrades.
 * Each checked checkbox adds +5 to the stat.
 */
export function calculateStatBonus(upgrades: boolean[]): number {
    return upgrades.filter(Boolean).length * 5;
}

/**
 * Calculates the display value of a stat (base value + bonus from upgrades).
 */
export function calculateDisplayValue(baseValue: number, upgrades: boolean[]): number {
    return baseValue + calculateStatBonus(upgrades);
}