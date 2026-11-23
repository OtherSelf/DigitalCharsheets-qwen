'use client';

import { useEffect, useRef, useState } from 'react';

import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import type { NoteTab } from '@/games/shared/types';
import { useToast } from '@/hooks/use-toast';
import { type Character } from '@/lib/types';
import { cn } from '@/lib/utils';

import { NarrativeMarkdown } from './narrative-markdown';
import { narrativeInitialMode } from './narrative-sheet';

interface NotesSheetProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAIN_TAB = 'main';
const MAX_EXTRA_TABS = 10;

function readTabs(character: Character): NoteTab[] {
  const raw = character.noteTabs;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tab): tab is NoteTab => {
      if (!tab || typeof tab !== 'object') return false;
      const candidate = tab as Partial<NoteTab>;
      return (
        typeof candidate.id === 'string' &&
        candidate.id.trim() !== '' &&
        typeof candidate.title === 'string' &&
        typeof candidate.body === 'string'
      );
    })
    .slice(0, MAX_EXTRA_TABS);
}

function readMainNotes(character: Character): string {
  return typeof character.notes === 'string' ? character.notes : '';
}

/**
 * ─── LANDMARK: NOTES SHEET ─────────────────────────────────────────────────
 * «Заметки» с дополнительными вкладками. Первая вкладка — поле `notes`
 * (совместимость с экспортом, шарингом и историей); дополнительные живут в
 * `noteTabs` и не меняют `schemaVersion`. Один Sheet на все редакции.
 */
export function NotesSheet({ character, open, onOpenChange }: NotesSheetProps) {
  const { readOnly, updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const { toast } = useToast();

  const tabs = readTabs(character);
  const mainNotes = readMainNotes(character);

  const [activeId, setActiveId] = useState(MAIN_TAB);
  const [draft, setDraft] = useState(mainNotes);
  const [mode, setMode] = useState<'view' | 'edit'>(
    readOnly ? 'view' : narrativeInitialMode(mainNotes),
  );
  const [showPreview, setShowPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [tabToDelete, setTabToDelete] = useState<NoteTab | null>(null);
  const wasOpen = useRef(false);

  const activeTab =
    activeId === MAIN_TAB ? null : tabs.find((tab) => tab.id === activeId);

  const valueFor = (id: string): string =>
    id === MAIN_TAB
      ? mainNotes
      : (tabs.find((tab) => tab.id === id)?.body ?? '');

  useEffect(() => {
    if (open && !wasOpen.current) {
      setActiveId(MAIN_TAB);
      setDraft(mainNotes);
      setMode(readOnly ? 'view' : narrativeInitialMode(mainNotes));
      setShowPreview(false);
      setAdding(false);
      setNewTitle('');
      setRenaming(false);
    }
    wasOpen.current = open;
  }, [open, mainNotes, readOnly]);

  const dirty = draft !== valueFor(activeId);

  const applyTab = (id: string) => {
    setActiveId(id);
    setDraft(valueFor(id));
    setMode(readOnly ? 'view' : narrativeInitialMode(valueFor(id)));
    setShowPreview(false);
    setRenaming(false);
  };

  const switchTab = (id: string) => {
    if (id === activeId) return;
    if (dirty && !readOnly) {
      setPendingTab(id);
      return;
    }
    applyTab(id);
  };

  const save = () => {
    if (activeId === MAIN_TAB) {
      updateCharacter(character.id, { notes: draft });
    } else {
      updateCharacter(character.id, {
        noteTabs: tabs.map((tab) =>
          tab.id === activeId ? { ...tab, body: draft } : tab,
        ),
      });
    }
    setMode('view');
    setShowPreview(false);
    toast({
      title: t('common.notesSaved'),
      description: t('common.notesUpdatedDesc'),
    });
  };

  const cancel = () => {
    setDraft(valueFor(activeId));
    setMode('view');
    setShowPreview(false);
  };

  const addTab = () => {
    if (tabs.length >= MAX_EXTRA_TABS) return;
    const title =
      newTitle.trim() || `${t('common.noteTab')} ${String(tabs.length + 1)}`;
    const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    updateCharacter(character.id, {
      noteTabs: [...tabs, { id, title, body: '' }],
    });
    setActiveId(id);
    setDraft('');
    setMode(readOnly ? 'view' : 'edit');
    setShowPreview(false);
    setAdding(false);
    setNewTitle('');
  };

  const deleteTab = () => {
    if (!tabToDelete) return;
    updateCharacter(character.id, {
      noteTabs: tabs.filter((tab) => tab.id !== tabToDelete.id),
    });
    setTabToDelete(null);
    setActiveId(MAIN_TAB);
    setDraft(mainNotes);
    setMode(readOnly ? 'view' : narrativeInitialMode(mainNotes));
  };

  const startRename = () => {
    if (!activeTab) return;
    setRenameDraft(activeTab.title);
    setRenaming(true);
  };

  const commitRename = () => {
    if (!activeTab) return;
    const title = renameDraft.trim() || activeTab.title;
    updateCharacter(character.id, {
      noteTabs: tabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, title } : tab,
      ),
    });
    setRenaming(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <SheetTitle>{t('common.characterNotes')}</SheetTitle>
          <SheetDescription>{t('common.characterNotesDesc')}</SheetDescription>
        </SheetHeader>

        <div
          role="tablist"
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-4 py-2"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={activeId === MAIN_TAB}
            variant={activeId === MAIN_TAB ? 'secondary' : 'ghost'}
            size="sm"
            className="shrink-0"
            onClick={() => switchTab(MAIN_TAB)}
            data-testid="notes-tab-main"
          >
            {t('common.noteTabMain')}
          </Button>
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeId === tab.id}
              variant={activeId === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              className="max-w-[12rem] shrink-0"
              onClick={() => switchTab(tab.id)}
              data-testid={`notes-tab-${tab.id}`}
            >
              <span className="truncate">{tab.title}</span>
            </Button>
          ))}
          {!readOnly && tabs.length < MAX_EXTRA_TABS && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setAdding(true)}
              title={t('common.addNoteTab')}
              aria-label={t('common.addNoteTab')}
              data-testid="notes-tab-add"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {activeTab && !readOnly && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={startRename}
                title={t('common.renameNoteTab')}
                aria-label={t('common.renameNoteTab')}
                data-testid="notes-tab-rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8 shrink-0"
                onClick={() => setTabToDelete(activeTab)}
                title={t('common.deleteNoteTab')}
                aria-label={t('common.deleteNoteTab')}
                data-testid="notes-tab-delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {adding && (
          <div className="flex shrink-0 items-center gap-2 border-b px-6 py-3">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder={t('common.noteTabTitlePlaceholder')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTab();
                if (event.key === 'Escape') {
                  setAdding(false);
                  setNewTitle('');
                }
              }}
              autoFocus
              data-testid="notes-tab-title-input"
            />
            <Button type="button" size="sm" onClick={addTab}>
              {t('common.add')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setAdding(false);
                setNewTitle('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {renaming && activeTab && (
          <div className="flex shrink-0 items-center gap-2 border-b px-6 py-3">
            <Input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename();
                if (event.key === 'Escape') setRenaming(false);
              }}
              autoFocus
              data-testid="notes-tab-rename-input"
            />
            <Button type="button" size="sm" onClick={commitRename}>
              {t('common.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRenaming(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {mode === 'view' ? (
          <ScrollArea className="min-h-0 flex-grow">
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
          <div className="flex min-h-0 flex-grow flex-col px-6 py-4">
            {showPreview ? (
              <ScrollArea className="bg-muted/30 min-h-0 flex-grow rounded-md border p-3">
                <NarrativeMarkdown value={draft} />
              </ScrollArea>
            ) : (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[240px] flex-grow resize-none"
                autoFocus
                data-testid="notes-textarea"
              />
            )}
          </div>
        )}

        {readOnly ? null : (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-6 py-4">
            {mode === 'view' ? (
              <Button
                type="button"
                onClick={() => setMode('edit')}
                className="gap-1.5"
                data-testid="notes-edit"
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
                  <Button type="button" variant="outline" onClick={cancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={save}
                    disabled={!dirty}
                    data-testid="notes-save"
                  >
                    {t('common.save')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {tabs.length >= MAX_EXTRA_TABS && !readOnly && (
          <p className={cn('text-muted-foreground border-t px-6 py-2 text-xs')}>
            {t('common.noteTabLimit').replace(
              '{count}',
              String(MAX_EXTRA_TABS),
            )}
          </p>
        )}
      </SheetContent>

      <AlertDialog
        open={pendingTab !== null}
        onOpenChange={(next) => {
          if (!next) setPendingTab(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.discardChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.discardChangesDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTab) applyTab(pendingTab);
                setPendingTab(null);
              }}
            >
              {t('common.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={tabToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setTabToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('common.deleteNoteTabConfirm')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tabToDelete?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTab}
              data-testid="notes-tab-delete-confirm"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
