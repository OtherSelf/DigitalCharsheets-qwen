'use client';

/**
 * Шим совместимости: форма D&D переехала в модуль
 * `src/games/dnd5e/create-form.tsx`. Старый путь сохраняется до этапа 7,
 * чтобы не переписывать все импорты одним коммитом (📌 D1).
 */
export { DndCharacterForm } from '@/games/dnd5e/create-form';
