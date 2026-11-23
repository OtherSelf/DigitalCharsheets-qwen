'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { Button } from './button';

export interface ChoiceDialogOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * ─── LANDMARK: CHOICE DIALOG ────────────────────────────────────────────────
 * Общий диалог выбора одного варианта. Радикс закрывает его по Esc и клику
 * мимо, а кнопка «Отмена» даёт явный выход — одинаково для всех «выберите
 * путь/ранг/опцию». Доменные подписи приходят от плагина, здесь только
 * раскладка и поведение.
 */
export function ChoiceDialog({
  open,
  onOpenChange,
  title,
  description,
  options,
  onSelect,
  cancelLabel,
  columns = 1,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  options: ChoiceDialogOption[];
  onSelect: (value: string) => void;
  cancelLabel: string;
  columns?: 1 | 2;
  testId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div
          className={cn('grid gap-2 py-2', columns === 2 && 'sm:grid-cols-2')}
        >
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              className="h-auto min-h-11 justify-start px-4 py-2 text-left whitespace-normal"
              onClick={() => {
                onSelect(option.value);
                onOpenChange(false);
              }}
              data-testid={`choice-${option.value}`}
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="text-muted-foreground text-xs">
                    {option.description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="choice-cancel"
          >
            {cancelLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
