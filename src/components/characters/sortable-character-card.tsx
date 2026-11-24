// src/components/characters/sortable-character-card.tsx

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { CharacterCard } from '@/components/characters/character-card';
import { useTranslation } from '@/context/language-context';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: SORTABLE CHARACTER CARD ────────────────────────────────────
 * Карточка, которую можно перетаскивать. Ручка — отдельная кнопка слева:
 * тащить за неё, а не за всю карточку, иначе клик «Просмотр листа» и
 * выделение текста конфликтуют с drag. Ручка видна при наведении/фокусе на
 * десктопе и всегда на телефоне (там hover нет); клавиатура работает через
 * неё же (Space/стрелки) — это даёт доступную перестановку без отдельного
 * режима «сортировка».
 */
export function SortableCharacterCard({ character }: { character: Character }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: character.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="character-card"
      data-character-id={character.id}
      className="relative min-w-0"
    >
      <CharacterCard
        character={character}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('common.reorder')}
            title={t('common.reorder')}
            // `touch-none` обязателен: иначе на телефоне драг начинается
            // вместе со скроллом страницы.
            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring flex h-full w-full cursor-grab touch-none items-center justify-center rounded-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:cursor-grabbing max-sm:opacity-100 sm:opacity-0"
          >
            <GripVertical aria-hidden className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}
