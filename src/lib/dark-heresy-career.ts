import { DarkHeresyCareerPath } from '@/lib/types';
import { ADVANCED_RANK_THRESHOLD } from '@/lib/dark-heresy-ranks';

/**
 * Gets the experience threshold for unlocking advanced career paths.
 * Different career paths have different thresholds.
 */
export function getAdvancedPathThreshold(careerPath: DarkHeresyCareerPath | ''): number {
    if (careerPath === 'Tech-Priest') return 3000;
    if (careerPath === 'Imperial Psyker') return 2000;
    return ADVANCED_RANK_THRESHOLD;
}

/**
 * Checks if a character can choose an alternate rank (Adept only).
 * Adept can choose an alternate rank between 2000-2999 EXP.
 */
export function canChooseAlternateRank(careerPath: DarkHeresyCareerPath | '', totalExpSpent: number): boolean {
    return careerPath === 'Adept' && totalExpSpent >= 2000 && totalExpSpent < 3000;
}