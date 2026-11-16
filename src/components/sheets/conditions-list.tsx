'use client';

import * as React from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Форма записи состояния. Определения дублируются в типах редакций (D10):
 * компонент общий, но правила и словари остаются у модуля; структурная
 * совместимость проверяется компилятором на месте использования.
 */
export type ConditionKind = 'disorder' | 'corruption' | 'mutation' | 'rudiment';

export type ConditionSource = 'manual' | 'divination' | 'legacy';

export interface ConditionEntry {
  id: string;
  kind: ConditionKind;
  name: string;
  severity?: string;
  effect?: string;
  notes?: string;
  source?: ConditionSource;
}

const CONDITION_KINDS: readonly ConditionKind[] = [
  'disorder',
  'corruption',
  'mutation',
  'rudiment',
];

const CONDITION_SOURCES: readonly ConditionSource[] = [
  'manual',
  'divination',
  'legacy',
];

/**
 * Уникальный id записи. `crypto.randomUUID` есть и в браузере, и в Node 18+;
 * фолбэк нужен только для очень старых движков.
 */
function createConditionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `condition-${cryptoApi.randomUUID()}`;
  }
  return `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Подписи списка. Компонент общий, а строки — предметная область редакции,
 * поэтому их передаёт модуль из собственного словаря (`dh1.*`/`dh2.*`), как и
 * требует независимость плагинов.
 */
export interface ConditionsLabels {
  /** Заголовок блока; пустая строка — блок встраивается в чужую секцию. */
  title: string;
  add: string;
  empty: string;
  name: string;
  kind: string;
  severity: string;
  effect: string;
  notes: string;
  source: string;
  remove: string;
  kindLabels: Record<ConditionKind, string>;
  sourceLabels: Record<ConditionSource, string>;
}

export interface ConditionsListProps {
  /** Состояния листа; `undefined` трактуется как пустой список. */
  conditions: ConditionEntry[] | undefined;
  onChange: (next: ConditionEntry[]) => void;
  /** Добавление и правка доступны только в режиме редактирования секции. */
  editing: boolean;
  isCompactView?: boolean;
  labels: ConditionsLabels;
}

const ConditionField = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn('space-y-1', className)}>
    <Label className="text-muted-foreground text-xs">{label}</Label>
    {children}
  </div>
);

/**
 * ─── LANDMARK: CONDITIONS LIST ─────────────────────────────────────────────
 * Единый список состояний Безумия/Порчи для DH1 и DH2 (D7): тип, название,
 * степень, эффект, заметки и источник. Счётчики остаются отдельно, никаких
 * автоматических порогов и бросков нет. Компонент общий — правила редакций
 * живут в их модулях, а структура записи (`ConditionEntry`) — в
 * `@/games/shared/types`.
 */
export function ConditionsList({
  conditions,
  onChange,
  editing,
  isCompactView,
  labels,
}: ConditionsListProps) {
  const list = conditions ?? [];
  const visible = list.filter((condition) => condition.name.trim() !== '');

  const patch = (index: number, next: Partial<ConditionEntry>) => {
    onChange(
      list.map((condition, position) =>
        position === index ? { ...condition, ...next } : condition,
      ),
    );
  };

  const remove = (index: number) => {
    onChange(list.filter((_, position) => position !== index));
  };

  const add = () => {
    onChange([
      ...list,
      {
        id: createConditionId(),
        kind: 'disorder',
        name: '',
        source: 'manual',
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {labels.title ? (
          <h5
            className={cn(
              'text-muted-foreground text-xs font-medium tracking-wide uppercase',
              isCompactView && 'text-[10px]',
            )}
          >
            {labels.title}
          </h5>
        ) : (
          <span />
        )}
        {editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={add}
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.add}
          </Button>
        )}
      </div>

      {!editing ? (
        visible.length === 0 ? (
          <p className="text-muted-foreground text-xs">{labels.empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((condition) => (
              <li key={condition.id} className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {labels.kindLabels[condition.kind]}
                  </Badge>
                  <span
                    className={cn(
                      'text-sm font-medium break-words',
                      isCompactView && 'text-xs',
                    )}
                  >
                    {condition.name}
                  </span>
                  {condition.severity && (
                    <span className="text-muted-foreground text-xs">
                      {condition.severity}
                    </span>
                  )}
                </div>
                {(condition.effect || condition.notes) && (
                  <p className="text-muted-foreground text-xs break-words">
                    {[condition.effect, condition.notes]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-xs">{labels.empty}</p>
      ) : (
        <div className="space-y-2">
          {list.map((condition, index) => (
            <div
              key={condition.id}
              className="space-y-2 rounded-md border p-3"
              data-testid="condition-entry"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ConditionField label={labels.kind}>
                  <Select
                    value={condition.kind}
                    onValueChange={(value) =>
                      patch(index, { kind: value as ConditionKind })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {labels.kindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConditionField>
                <ConditionField label={labels.name}>
                  <Input
                    value={condition.name}
                    onChange={(event) =>
                      patch(index, { name: event.target.value })
                    }
                    className="h-8"
                  />
                </ConditionField>
                <ConditionField label={labels.severity}>
                  <Input
                    value={condition.severity ?? ''}
                    onChange={(event) =>
                      patch(index, { severity: event.target.value })
                    }
                    className="h-8"
                  />
                </ConditionField>
                <ConditionField label={labels.effect} className="sm:col-span-2">
                  <Input
                    value={condition.effect ?? ''}
                    onChange={(event) =>
                      patch(index, { effect: event.target.value })
                    }
                    className="h-8"
                  />
                </ConditionField>
                <ConditionField label={labels.source}>
                  <Select
                    value={condition.source ?? 'manual'}
                    onValueChange={(value) =>
                      patch(index, { source: value as ConditionSource })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {labels.sourceLabels[source]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConditionField>
              </div>
              <ConditionField label={labels.notes}>
                <Textarea
                  value={condition.notes ?? ''}
                  onChange={(event) =>
                    patch(index, { notes: event.target.value })
                  }
                  className="min-h-[56px] text-sm"
                />
              </ConditionField>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={labels.remove}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
