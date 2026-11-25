'use client';

import * as React from 'react';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { TableRow } from '@/components/ui/table';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

/**
 * ─── LANDMARK: SORTABLE SHEET ROWS ────────────────────────────────────────
 * Перестановка строк внутри листа (навыки, таланты, инвентарь, журнал).
 *
 * Почему не компонент на каждый список: таблицы и списки редакций свёрстаны
 * по-разному (`tr`, `li`, секция аккордеона), а сенсоры, клавиатура и анонсы
 * одинаковы. Поэтому здесь только обвязка dnd-kit, а разметку строки даёт
 * сама секция через render-prop с готовой ручкой.
 *
 * Ручка, как у карточек персонажей: тянем за неё, а не за строку, иначе
 * выделение текста и клики по полям превращаются в drag. На десктопе она
 * проявляется по наведению/фокусу, на телефоне видна всегда — hover там нет
 * (D12).
 */

type SortableAttributes = ReturnType<typeof useSortable>['attributes'];
type SortableListeners = ReturnType<typeof useSortable>['listeners'];
type ActivatorRef = ReturnType<typeof useSortable>['setActivatorNodeRef'];
type Transform = ReturnType<typeof useSortable>['transform'];
type Transition = ReturnType<typeof useSortable>['transition'];

function rowStyle(
  transform: Transform,
  transition: Transition,
  isDragging: boolean,
): React.CSSProperties {
  return {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 5 : undefined,
    position: isDragging ? 'relative' : undefined,
  };
}

/** Кнопка-ручка: единственный activator, за который начинается перетаскивание. */
function DragHandle({
  label,
  attributes,
  listeners,
  setActivatorNodeRef,
}: {
  label: string;
  attributes: SortableAttributes;
  listeners: SortableListeners;
  setActivatorNodeRef: ActivatorRef;
}) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={label}
      title={label}
      data-testid="reorder-handle"
      // `touch-none` обязателен: иначе на телефоне drag начинается вместе со
      // скроллом страницы. На телефоне цель не меньше 32 px (§9 AGENTS).
      // Ручка всегда видна и всегда в своей ячейке: скрытая «по наведению»
      // ручка не читалась как действие, а рамка задаёт границу строки.
      className="border-border/70 text-muted-foreground/80 hover:border-foreground/30 hover:text-foreground focus-visible:ring-ring flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border bg-transparent transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing max-sm:h-8 max-sm:w-8"
    >
      <GripVertical aria-hidden className="h-4 w-4" />
    </button>
  );
}

export interface SortableRowsProps {
  /** Порядок строк в списке: индексы в `onReorder` считаются по нему. */
  ids: readonly string[];
  /** Подписи для анонсов скринридера (id → имя строки). */
  labelById: Readonly<Record<string, string | undefined>>;
  onReorder: (from: number, to: number) => void;
  children: React.ReactNode;
}

/**
 * Общая обвязка списка: сенсоры, клавиатура и анонсы. Порог 8 px не даёт
 * случайному клику превратиться в перестановку.
 */
export function SortableRows({
  ids,
  labelById,
  onReorder,
  children,
}: SortableRowsProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('common.reorderPicked', {
        name: labelById[String(active.id)] ?? '',
      }),
    onDragOver: ({ over }) =>
      t('common.reorderOver', { name: labelById[String(over?.id)] ?? '' }),
    onDragEnd: () => t('common.reorderDropped'),
    onDragCancel: () => t('common.reorderCancelled'),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  const items = React.useMemo(() => [...ids], [ids]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t('common.reorderHint'),
        },
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Строка таблицы: `<tr>` с обработчиками drag и ручкой в render-prop. */
export function SortableRow({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <TableRow
      ref={setNodeRef}
      style={rowStyle(transform, transition, isDragging)}
      data-sortable-id={id}
      className={cn('group', className)}
    >
      {children(
        <DragHandle
          label={label}
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />,
      )}
    </TableRow>
  );
}

/** Элемент списка или блок: `li`/`div` с ручкой в render-prop. */
export function SortableItem({
  id,
  label,
  as = 'div',
  className,
  children,
}: {
  id: string;
  label: string;
  as?: 'div' | 'li';
  className?: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return React.createElement(
    as,
    {
      ref: setNodeRef,
      style: rowStyle(transform, transition, isDragging),
      'data-sortable-id': id,
      className: cn('group', className),
    },
    children(
      <DragHandle
        label={label}
        attributes={attributes}
        listeners={listeners}
        setActivatorNodeRef={setActivatorNodeRef}
      />,
    ),
  );
}
