'use client';

import { useEffect, useRef, useState } from 'react';

import { Eye, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/context/language-context';

import { NarrativeMarkdown } from './narrative-markdown';

type NarrativeMode = 'view' | 'edit';

/**
 * Пустое значение открывается в редактирование, непустое — в просмотр (D3).
 * Вынесено из компонента, чтобы поведение «умного режима» проверялось юнитом
 * без jsdom: UI-слой в проекте тестируется визуальными сценариями.
 */
export function narrativeInitialMode(value: string): NarrativeMode {
  return value.trim() ? 'view' : 'edit';
}

export interface NarrativeSheetProps {
  title: string;
  description: string;
  value: string;
  onSave: (next: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ─── LANDMARK: NARRATIVE SHEET ─────────────────────────────────────────────
 * Правый Sheet для `notes`/`backstory` (D2, D3): чтение markdown и
 * редактирование в одном месте. Общий UI без правил редакций — DH1, DH2 и
 * страничные «Заметки» используют один компонент.
 */
export function NarrativeSheet({
  title,
  description,
  value,
  onSave,
  open,
  onOpenChange,
}: NarrativeSheetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<NarrativeMode>(() =>
    narrativeInitialMode(value),
  );
  const [draft, setDraft] = useState(value);
  const [showPreview, setShowPreview] = useState(false);
  const wasOpen = useRef(false);

  // Каждое открытие стартует от значения листа: черновик прошлой сессии не
  // должен протекать в следующий просмотр.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMode(narrativeInitialMode(value));
      setDraft(value);
      setShowPreview(false);
    }
    wasOpen.current = open;
  }, [open, value]);

  const handleSave = () => {
    onSave(draft);
    setMode('view');
    setShowPreview(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setMode('view');
    setShowPreview(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {mode === 'view' ? (
          <ScrollArea className="flex-grow">
            <div className="px-6 py-4">
              {draft.trim() ? (
                <NarrativeMarkdown value={draft} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('narrative.empty')}
                </p>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-grow flex-col px-6 py-4">
            {showPreview ? (
              <ScrollArea className="bg-muted/30 min-h-[240px] flex-grow rounded-md border p-3">
                <NarrativeMarkdown value={draft} />
              </ScrollArea>
            ) : (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[240px] flex-grow resize-none"
                autoFocus
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
          {mode === 'view' ? (
            <Button
              type="button"
              onClick={() => setMode('edit')}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPreview((previous) => !previous)}
                className="gap-1.5"
              >
                <Eye className="h-4 w-4" />
                {t('narrative.preview')}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" onClick={handleSave}>
                  {t('common.save')}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
