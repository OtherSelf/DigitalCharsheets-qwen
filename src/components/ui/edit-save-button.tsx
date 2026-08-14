'use client';

import { Button } from '@/components/ui/button';
import { Edit, Save } from 'lucide-react';

export const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean, onEdit: () => void, onSave: () => void }) => {
    return editing ? (
        <Button variant="default" size="icon" className="h-6 w-6 shrink-0" onClick={onSave}><Save className="h-3.5 w-3.5" /></Button>
    ) : (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
    );
};