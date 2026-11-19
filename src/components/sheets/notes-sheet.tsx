'use client';

import { NarrativeSheet } from '@/components/sheets/narrative-sheet';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { type Character } from '@/lib/types';

interface NotesSheetProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ─── LANDMARK: NOTES SHEET ─────────────────────────────────────────────────
 * Страничная кнопка «Заметки» (шапка и компакт-навигация) правит то же поле
 * `notes`, что и Info-блоки, поэтому использует тот же `NarrativeSheet`:
 * просмотр markdown и редактирование в одном правом Sheet, для всех
 * редакций включая dnd5e.
 */
export function NotesSheet({ character, open, onOpenChange }: NotesSheetProps) {
  const { updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const { toast } = useToast();
  // `Character` ядра не типизирует поля редакций: мусор в старых данных не
  // должен ломать Sheet, поэтому не-строка читается как пустое значение.
  const notes = typeof character.notes === 'string' ? character.notes : '';

  return (
    <NarrativeSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('common.characterNotes')}
      description={t('common.characterNotesDesc')}
      value={notes}
      onSave={(next) => {
        updateCharacter(character.id, { notes: next });
        toast({
          title: t('common.notesSaved'),
          description: t('common.notesUpdatedDesc'),
        });
      }}
    />
  );
}
