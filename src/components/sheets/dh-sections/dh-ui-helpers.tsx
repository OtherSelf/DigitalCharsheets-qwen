// src/components/sheets/dh-sections/dh-ui-helpers.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Save, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean, onEdit: () => void, onSave: () => void }) => {
    return editing ? (
        <Button size="icon" onClick={onSave} className="h-7 w-7"><Save className="h-3.5 w-3.5" /></Button>
    ) : (
        <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-3.5 w-3.5" /></Button>
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
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between h-9 px-1 shrink-0">
      <div className="flex items-center gap-1 overflow-hidden">
        <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate uppercase">{title}</h4>
        {!hideNotes && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><Info className="h-3 w-3" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <Label className="text-xs mb-2 block">Notes for {title}</Label>
              <Textarea defaultValue={notes || ''} onBlur={(e) => onNoteChange(e.target.value)} placeholder="Add notes..." className="min-h-[100px] text-sm" />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="shrink-0 ml-1">
        {(showEditButtons || editing) && <EditSaveButton editing={editing} onEdit={onEdit} onSave={onSave} />}
      </div>
    </div>
    <div className={cn(
      "flex items-center justify-center rounded-lg border bg-background overflow-hidden",
      isCompactView ? "h-14" : "h-20"
    )}>
      {children}
    </div>
  </div>
);