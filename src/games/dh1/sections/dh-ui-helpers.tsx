// src/games/dh1/sections/dh-ui-helpers.tsx
'use client';

import * as React from 'react';

import { Edit, Info, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

export const EditSaveButton = ({
  editing,
  onEdit,
  onSave,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
}) => {
  return editing ? (
    <Button
      data-testid="save-button"
      size="icon"
      onClick={onSave}
      className="h-7 w-7"
    >
      <Save className="h-3.5 w-3.5" />
    </Button>
  ) : (
    <Button
      data-testid="edit-button"
      size="icon"
      variant="outline"
      onClick={onEdit}
      className="h-7 w-7"
    >
      <Edit className="h-3.5 w-3.5" />
    </Button>
  );
};

export const MetricBox = ({
  title,
  notes,
  onNoteChange,
  isCompactView,
  editing,
  onEdit,
  onSave,
  hideNotes,
  showEditButtons,
  children,
}: {
  title: string;
  notes?: string;
  onNoteChange: (val: string) => void;
  isCompactView: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  hideNotes: boolean;
  showEditButtons: boolean;
  children: React.ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-1 overflow-hidden">
          <h4 className="text-muted-foreground truncate text-[10px] font-semibold uppercase sm:text-xs">
            {title}
          </h4>
          {!hideNotes && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={notes ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-6 w-6 shrink-0"
                >
                  <Info className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <Label className="mb-2 block text-xs">
                  {t('common.notesFor')} {title}
                </Label>
                <Textarea
                  defaultValue={notes || ''}
                  onBlur={(e) => onNoteChange(e.target.value)}
                  placeholder={`${t('common.addNotes')}...`}
                  className="min-h-[100px] text-sm"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="ml-1 shrink-0">
          {(showEditButtons || editing) && (
            <EditSaveButton editing={editing} onEdit={onEdit} onSave={onSave} />
          )}
        </div>
      </div>
      <div
        className={cn(
          'bg-background flex items-center justify-center overflow-hidden rounded-lg border',
          isCompactView ? 'h-14' : 'h-20',
        )}
      >
        {children}
      </div>
    </div>
  );
};
