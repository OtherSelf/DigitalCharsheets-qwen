// src/components/import-character-dialog.tsx
'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AlertCircle, CheckCircle2, FileUp } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { startCreationReview } from '@/games/shared/creation-review';
import {
  IMPORT_ERROR_I18N_KEYS,
  importCharacterFromJSON,
} from '@/lib/export-utils';
import { characterPath } from '@/lib/routes';
import { Character } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ImportCharacterDialogProps {
  isPhoneView: boolean;
}

export function ImportCharacterDialog({
  isPhoneView,
}: ImportCharacterDialogProps) {
  const { t, tUnsafe } = useTranslation();
  const { addCharacter } = useCharacterContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportError(null);
    setImportSuccess(false);
    setIsImporting(true);

    const result = await importCharacterFromJSON(file);

    if (!result.success) {
      const key = result.reason
        ? IMPORT_ERROR_I18N_KEYS[result.reason]
        : undefined;
      setImportError(key ? tUnsafe(key) : result.error || t('io.unknownError'));
      setIsImporting(false);
      return;
    }

    if (result.warnings && result.warnings.length > 0) {
      console.warn('[import]', ...result.warnings);
    }

    try {
      let lastCreatedCharId: string | undefined;
      let importedCount = 0;

      // LANDMARK: BATCH_IMPORT
      // Бэкап содержит много листов: каждый создаётся отдельным запросом,
      // иначе сервер отказал бы на частично невалидном наборе.
      if (result.batchData && result.batchData.length > 0) {
        for (const charData of result.batchData) {
          // Ядро не додумывает поля редакции: единственное, что оно вправе
          // поправить, — пустое имя (иначе лист не отличить в списке).
          const safeCharacterData = {
            ...charData,
            name: charData.name || t('io.importedCharacterName'),
          };
          const newChar = await addCharacter(
            safeCharacterData as Omit<Character, 'id' | 'userId'>,
          );
          if (newChar) {
            // Импортированные листы открываются в режиме проверки выборов:
            // замки снимаются до явной фиксации.
            startCreationReview(newChar.id);
            lastCreatedCharId = newChar.id;
            importedCount++;
          }
        }
      }
      // LANDMARK: SINGLE_IMPORT
      // Одиночный экспорт: один лист, без пакетной ветки.
      else if (result.data) {
        const { id: _id, ...characterData } = result.data.character;
        const safeCharacterData = {
          ...characterData,
          name: characterData.name || t('io.importedCharacterName'),
        };
        const newChar = await addCharacter(
          safeCharacterData as Omit<Character, 'id' | 'userId'>,
        );
        if (newChar) {
          startCreationReview(newChar.id);
          lastCreatedCharId = newChar.id;
          importedCount++;
        }
      }

      if (importedCount > 0) {
        setImportSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setImportSuccess(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setFileName('');
          if (lastCreatedCharId) {
            router.push(characterPath(lastCreatedCharId));
          }
        }, 1500);
      } else {
        setImportError(t('io.failedToCreateCharacter'));
      }
    } catch (err) {
      console.error(err);
      setImportError(t('io.failedToCreateCharacter'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setImportError(null);
      setImportSuccess(false);
      setFileName('');
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isPhoneView ? (
          <Button
            variant="outline"
            className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200"
          >
            <FileUp className="mr-4 h-8 w-8" />
            <span className="font-semibold">{t('io.importCharacter')}</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-full min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200"
          >
            <FileUp className="mb-2 h-12 w-12" />
            <span className="font-semibold">{t('io.importCharacter')}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('io.importCharacter')}</DialogTitle>
          <DialogDescription>{t('io.importDashboardDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <input
            id="import-character-file"
            type="file"
            accept=".json,application/json"
            ref={fileInputRef}
            onChange={handleFileSelect}
            disabled={isImporting}
            className="sr-only"
            data-testid="import-file-input"
          />
          <label
            htmlFor="import-character-file"
            data-testid="import-file-label"
            className={cn(
              'hover:border-primary hover:bg-accent/30 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              isImporting && 'pointer-events-none opacity-60',
            )}
          >
            <FileUp className="text-muted-foreground h-8 w-8" />
            <span className="text-sm font-medium">
              {t('io.chooseJsonFile')}
            </span>
            <span className="text-muted-foreground text-xs">
              {t('io.chooseJsonFileHint')}
            </span>
            {fileName && (
              <span className="text-muted-foreground max-w-full truncate text-xs">
                {t('io.selectedFile')}: {fileName}
              </span>
            )}
          </label>

          {importError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {importSuccess && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {t('io.importSuccessDashboard')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isImporting}
          >
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
