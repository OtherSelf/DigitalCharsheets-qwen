'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCharacterContext } from '@/context/character-context';

/** Строка журнала опыта, приведённая к общему виду адаптером редакции. */
export interface ExperienceLogRow {
  id: string;
  label: string;
  cost: number;
  createdAt: string;
  /** Локализованный вид покупки (DH2 `kind`); DH1 не использует. */
  kind?: string;
}

export interface ExperienceLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  empty: string;
  deleteLabel: string;
  language: 'en' | 'ru';
  rows: readonly ExperienceLogRow[];
  onDelete: (id: string) => void;
}

function formatEntryDate(iso: string, language: 'en' | 'ru'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB').format(
    date,
  );
}

/**
 * ─── LANDMARK: EXPERIENCE LOG SHEET ────────────────────────────────────────
 * Журнал опыта в правом Sheet — тот же паттерн, что у журнала заданий.
 * Компонент общий: строки приводят адаптеры редакций (`label/cost/createdAt`
 * у DH1, `kind/ref/cost/createdAt` у DH2), подписи приходят из словаря
 * плагина, поэтому в ядре нет ни названий покупок, ни форматов редакций.
 */
export function ExperienceLogSheet({
  open,
  onOpenChange,
  title,
  description,
  empty,
  deleteLabel,
  language,
  rows,
  onDelete,
}: ExperienceLogSheetProps) {
  const { readOnly } = useCharacterContext();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-grow">
          <div className="space-y-2 px-6 py-4">
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{empty}</p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  data-testid="experience-row"
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.kind ? `${row.kind} · ` : ''}
                      {formatEntryDate(row.createdAt, language)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-semibold">
                      {row.cost}
                    </span>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={deleteLabel}
                        onClick={() => onDelete(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
