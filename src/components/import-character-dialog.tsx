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
import { importCharacterFromJSON } from '@/lib/export-utils';

interface ImportCharacterDialogProps {
  isCompactView: boolean;
}

export function ImportCharacterDialog({
  isCompactView,
}: ImportCharacterDialogProps) {
  const { t } = useTranslation();
  const { addCharacter } = useCharacterContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);
    setIsImporting(true);

    const result = await importCharacterFromJSON(file);

    if (!result.success) {
      setImportError(result.error || 'Unknown error');
      setIsImporting(false);
      return;
    }

    if (result.warnings && result.warnings.length > 0) {
      console.warn('[import]', ...result.warnings);
    }

    try {
      let lastCreatedCharId: string | undefined;
      let importedCount = 0;

      // [LANDMARK: BATCH IMPORT SUPPORT]
      if (result.batchData && result.batchData.length > 0) {
        for (const charData of result.batchData) {
          const safeCharacterData = {
            name: charData.name || 'Imported Character',
            gameSystem: charData.gameSystem || 'Dungeons & Dragons',
            characterClass: charData.characterClass || 'Unknown',
            backstory: charData.backstory || '',
            notes: charData.notes || '',
            questLog: charData.questLog || [],
            ...charData,
          };
          const newChar = await addCharacter(safeCharacterData as any);
          if (newChar) {
            lastCreatedCharId = newChar.id;
            importedCount++;
          }
        }
      }
      // [LANDMARK: SINGLE IMPORT FALLBACK]
      else if (result.data) {
        const { id, gameSystem, ...characterData } = result.data.character;
        const safeCharacterData = {
          name: characterData.name || 'Imported Character',
          gameSystem: gameSystem || 'Dungeons & Dragons',
          characterClass: characterData.characterClass || 'Unknown',
          backstory: characterData.backstory || '',
          notes: characterData.notes || '',
          questLog: characterData.questLog || [],
          ...characterData,
        };
        const newChar = await addCharacter(safeCharacterData as any);
        if (newChar) {
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
          if (lastCreatedCharId) {
            router.push(`/${lastCreatedCharId}`);
          }
        }, 1500);
      } else {
        setImportError(
          t('failedToCreateCharacter') || 'Failed to create character',
        );
      }
    } catch (err) {
      console.error(err);
      setImportError(
        t('failedToCreateCharacter') || 'Failed to create character',
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isCompactView ? (
          <Button
            variant="outline"
            className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200"
          >
            <FileUp className="mr-4 h-8 w-8" />
            <span className="font-semibold">{t('importCharacter')}</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-full min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200"
          >
            <FileUp className="mb-2 h-12 w-12" />
            <span className="font-semibold">{t('importCharacter')}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('importCharacter')}</DialogTitle>
          <DialogDescription>{t('importDashboardDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileSelect}
            disabled={isImporting}
            className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold disabled:opacity-50"
          />

          {importError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {importSuccess && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{t('importSuccessDashboard')}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isImporting}
          >
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
