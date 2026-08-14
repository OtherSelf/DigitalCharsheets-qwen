'use client';

import * as XLSX from 'xlsx';
import { Character, DnD5eCharacter, DarkHeresyCharacter } from './types';

/**
 * Generates and downloads an Excel (.xlsx) file for a single character sheet.
 */
export const exportCharacterToExcel = (character: Character) => {
  const data: any[] = [];

  // Section 1: Header
  data.push(['DIGITAL CHARACTER SHEETS - CHARACTER SHEET']);
  data.push(['Generated on:', new Date().toLocaleDateString()]);
  data.push([]);

  // Section 2: Basic Info
  data.push(['BASIC INFORMATION']);
  data.push(['Name', character.name]);
  data.push(['System', character.gameSystem]);
  data.push(['Class/Path', character.characterClass]);
  
  if (character.gameSystem === 'Dark Heresy') {
    const dh = character as DarkHeresyCharacter;
    data.push(['Home World', dh.homeWorld]);
    data.push(['Rank', dh.rank]);
    data.push(['Divination', dh.divination]);
    data.push(['Divination Effect', dh.divinationEffect]);
  } else {
    const dnd = character as DnD5eCharacter;
    data.push(['Race', dnd.race]);
    data.push(['Background', dnd.background]);
    data.push(['Level', dnd.level]);
    data.push(['Alignment', dnd.alignment || 'N/A']);
    data.push(['Experience', dnd.experiencePoints || 0]);
  }
  data.push([]);

  // Section 3: Stats
  data.push(['CHARACTERISTICS / ABILITY SCORES']);
  Object.entries(character.stats).forEach(([key, val]) => {
    data.push([key.replace(/([A-Z])/g, ' $1').toUpperCase(), val]);
  });
  data.push([]);

  // Section 4: Equipment & Inventory
  data.push(['EQUIPMENT & INVENTORY']);
  if (character.gameSystem === 'Dungeons & Dragons') {
    const dnd = character as DnD5eCharacter;
    data.push(['Item Name', 'Notes']);
    dnd.equipment.forEach(item => data.push([item.name, item.notes || '']));
    dnd.inventory.forEach(item => data.push([item.name, item.notes || '']));
  } else {
    const dh = character as DarkHeresyCharacter;
    data.push(['Type', 'Details']);
    // Armor
    if (dh.equipment?.armor) {
      Object.entries(dh.equipment.armor).forEach(([part, piece]) => {
        if (piece) data.push([`Armor (${part})`, `AP: ${piece.ap}, Type: ${piece.type}, Quality: ${piece.quality}`]);
      });
    }
    // Weapons
    if (dh.equipment?.weapons) {
      dh.equipment.weapons.melee.forEach(w => data.push(['Melee Weapon', `${w.name} (Dmg: ${w.damage}, Pen: ${w.penetration}, Traits: ${w.traits})`]));
      dh.equipment.weapons.ranged.forEach(w => data.push(['Ranged Weapon', `${w.name} (Dmg: ${w.damage}, Range: ${w.range}, Clip: ${w.clipSize})`]));
    }
    // Inventory
    dh.inventory.forEach(item => data.push(['Inventory Item', `${item.name} (${item.notes || 'No notes'})`]));
  }
  data.push([]);

  // Section 5: Narrative
  data.push(['NARRATIVE']);
  data.push(['Backstory:']);
  data.push([character.backstory]);
  data.push([]);
  data.push(['Player Notes:']);
  data.push([character.notes]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set some basic column widths
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 60 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  
  XLSX.writeFile(workbook, `${character.name.replace(/\s+/g, '_')}_Sheet.xlsx`);
};
