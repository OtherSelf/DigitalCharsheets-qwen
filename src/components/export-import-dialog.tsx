// src/components/export-import-dialog.tsx
'use client';

import React, { useRef, useState } from 'react';

import { AlertCircle, CheckCircle2, FileDown, FileUp } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  DEFAULT_EXPORT_CONFIG,
  exportCharacterToJSON,
  ExportConfig,
  ExportData,
  importCharacterFromJSON,
  mergeImportedData,
} from '@/lib/export-utils';
import { Character } from '@/lib/types';

interface ExportImportDialogProps {
  character: Character;
}

export function ExportImportDialog({ character }: ExportImportDialogProps) {
  const { t } = useTranslation();
  const { updateCharacter } = useCharacterContext();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [importedData, setImportedData] = useState<ExportData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const result = exportCharacterToJSON(character, config);
    if (!result.success) {
      setImportError(result.error || 'Export failed.');
      return;
    }
    setOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);
    setImportedData(null);

    const result = await importCharacterFromJSON(file);
    if (!result.success) {
      setImportError(result.error || 'Unknown error');
      return;
    }
    if (result.kind === 'backup') {
      setImportError(
        `Файл содержит ${result.batchData?.length ?? 0} персонажей — это бэкап. ` +
          `Импортируйте его через «Import» на дашборде.`,
      );
      return;
    }
    if (!result.data) {
      setImportError('В файле нет данных персонажа.');
      return;
    }

    if (result.data.character.gameSystem !== character.gameSystem) {
      setImportError(
        `Game system mismatch: File is for ${result.data.character.gameSystem}, current character is ${character.gameSystem}`,
      );
      return;
    }

    setImportedData(result.data);
    setConfig(result.data.metadata.config || DEFAULT_EXPORT_CONFIG);
  };

  const handleApplyImport = () => {
    if (!importedData) return;

    const mergedCharacter = mergeImportedData(character, importedData, config);
    const { id, gameSystem, ...updateData } = mergedCharacter;

    updateCharacter(character.id, updateData);

    setImportSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setImportSuccess(false);
      setImportedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1500);
  };

  const toggleConfig = (key: keyof ExportConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── LANDMARK: GAME_SYSTEM_AWARE_CHECKBOXES ───
  const configOptions: { key: keyof ExportConfig; label: string }[] = [
    { key: 'includeBasicInfo', label: t('exportBasicInfo') },
    { key: 'includeStats', label: t('exportStats') },
    { key: 'includeCombat', label: t('exportCombat') },
    { key: 'includeEquipment', label: t('exportEquipment') },
    { key: 'includeInventory', label: t('exportInventory') },
    ...(character.gameSystem === 'Dungeons & Dragons'
      ? [
          {
            key: 'includeSpells' as keyof ExportConfig,
            label: t('exportSpells'),
          },
        ]
      : []),
    { key: 'includeNarrative', label: t('exportNarrative') },
    { key: 'includeProgression', label: t('exportProgression') },
    ...(character.gameSystem === 'Dungeons & Dragons'
      ? [
          {
            key: 'includeCompanions' as keyof ExportConfig,
            label: t('exportCompanions'),
          },
        ]
      : []),
    { key: 'includeQuestLog', label: t('exportQuestLog') },
    { key: 'includeCustomHouseRules', label: t('exportHouseRules') },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hidden h-8 sm:flex">
          <FileDown className="mr-2 h-4 w-4" />
          <span>{t('importExport')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'export' ? t('exportCharacter') : t('importCharacter')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'export' ? t('exportDesc') : t('importDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          <Button
            variant={mode === 'export' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setMode('export');
              setImportedData(null);
              setImportError(null);
            }}
          >
            {t('exportCharacter').split(' ')[0]}
          </Button>
          <Button
            variant={mode === 'import' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setMode('import');
              setImportedData(null);
              setImportError(null);
            }}
          >
            {t('importCharacter').split(' ')[0]}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {configOptions.map((opt) => (
              <div key={opt.key} className="flex items-center space-x-2">
                <Checkbox
                  id={opt.key}
                  checked={config[opt.key]}
                  onCheckedChange={() => toggleConfig(opt.key)}
                />
                <Label
                  htmlFor={opt.key}
                  className="cursor-pointer text-sm font-normal"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>

          {mode === 'import' && (
            <div className="space-y-3 border-t pt-2">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
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
                  <AlertDescription>{t('importSuccess')}</AlertDescription>
                </Alert>
              )}

              {importedData && !importError && !importSuccess && (
                <Alert>
                  <AlertDescription>{t('readyToMerge')}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          {mode === 'export' ? (
            <Button onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              {t('downloadJson')}
            </Button>
          ) : (
            <Button
              onClick={handleApplyImport}
              disabled={!importedData || !!importError}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {t('applyImport')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
