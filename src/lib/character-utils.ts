import { DnD5eCharacter, DarkHeresyCharacter } from './types';

export interface PointsObject {
  current: number;
  max: number;
  notes?: string;
}

export interface SimplePointsObject {
  total: number;
  notes?: string;
}

export function getPointsObject(points: any): PointsObject {
  if (!points) {
    return { current: 0, max: 0, notes: '' };
  }
  if (typeof points === 'number') {
    return { current: points, max: points, notes: '' };
  }
  return {
    current: points.current || 0,
    max: points.max || 0,
    notes: points.notes || ''
  };
}

export function getSimplePointsObject(points: any): SimplePointsObject {
  if (!points) {
    return { total: 0, notes: '' };
  }
  if (typeof points === 'number') {
    return { total: points, notes: '' };
  }
  return {
    total: points.total || 0,
    notes: points.notes || ''
  };
}

export function formatCharacterName(character: DnD5eCharacter | DarkHeresyCharacter): string {
  return character.name || 'Unnamed Character';
}

export function calculateCharacterLevel(character: DarkHeresyCharacter): string {
  if (!character.careerPath) return 'N/A';
  return character.rank || 'Initiate';
}
