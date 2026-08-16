// src/components/sheets/dh-sections/dh-ui-helpers.tsx
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const DetailField = ({label, value, editing, type = "text", onChange, onBlur, isCompactView}: {label:string, value:string|number, editing:boolean, type?:string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void, isCompactView: boolean}) => (
    <div className="space-y-1">
        <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{label}</Label>
        {editing ? (
            <Input defaultValue={value} type={type} onChange={onChange} onBlur={onBlur} className="h-8"/>
        ) : (
            <p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{value || '-'}</p>
        )}
    </div>
);

export const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean, onEdit: () => void, onSave: () => void }) => (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={editing ? onSave : onEdit}>
        {editing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
        <span className="sr-only">{editing ? "Save" : "Edit"}</span>
    </Button>
);