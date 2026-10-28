// src/components/export-import-dialog.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Character } from '@/lib/types';
import {
  exportCharacterToJSON,
  importCharacterFromJSON,
  mergeImportedData,
  ExportConfig,
  DEFAULT_EXPORT_CONFIG,
  ExportData
} from '@/lib/export-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, FileDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from '@/context/language-context';
import { useCharacterContext } from '@/context/character-context';

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
    exportCharacterToJSON(character, config);
    setOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);
    setImportedData(null);

    const result = await importCharacterFromJSON(file);
    if (!result.success || !result.data) {
      setImportError(result.error || "Unknown error");
      return;
    }

    if (result.data.character.gameSystem !== character.gameSystem) {
      setImportError(`Game system mismatch: File is for ${result.data.character.gameSystem}, current character is ${character.gameSystem}`);
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
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── LANDMARK: GAME_SYSTEM_AWARE_CHECKBOXES ───
  const configOptions: { key: keyof ExportConfig; label: string }[] = [
    { key: 'includeBasicInfo', label: t('exportBasicInfo') },
    { key: 'includeStats', label: t('exportStats') },
    { key: 'includeCombat', label: t('exportCombat') },
    { key: 'includeEquipment', label: t('exportEquipment') },
    { key: 'includeInventory', label: t('exportInventory') },
    ...(character.gameSystem === 'Dungeons & Dragons' 
      ? [{ key: 'includeSpells' as keyof ExportConfig, label: t('exportSpells') }] 
      : []),
    { key: 'includeNarrative', label: t('exportNarrative') },
    { key: 'includeProgression', label: t('exportProgression') },
    ...(character.gameSystem === 'Dungeons & Dragons' 
      ? [{ key: 'includeCompanions' as keyof ExportConfig, label: t('exportCompanions') }] 
      : []),
    { key: 'includeQuestLog', label: t('exportQuestLog') },
    { key: 'includeCustomHouseRules', label: t('exportHouseRules') },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hidden h-8 sm:flex">
          <FileDown className="h-4 w-4 mr-2" />
          <span>{t('importExport')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'export' ? t('exportCharacter') : t('importCharacter')}</DialogTitle>
          <DialogDescription>
            {mode === 'export' ? t('exportDesc') : t('importDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button 
            variant={mode === 'export' ? 'default' : 'outline'} 
            className="flex-1"
            onClick={() => { setMode('export'); setImportedData(null); setImportError(null); }}
          >
            {t('exportCharacter').split(' ')[0]}
          </Button>
          <Button 
            variant={mode === 'import' ? 'default' : 'outline'} 
            className="flex-1"
            onClick={() => { setMode('import'); setImportedData(null); setImportError(null); }}
          >
            {t('importCharacter').split(' ')[0]}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {configOptions.map((opt) => (
              <div key={opt.key} className="flex items-center space-x-2">
                <Checkbox
                  id={opt.key}
                  checked={config[opt.key]}
                  onCheckedChange={() => toggleConfig(opt.key)}
                />
                <Label htmlFor={opt.key} className="text-sm font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>

          {mode === 'import' && (
            <div className="space-y-3 pt-2 border-t">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              
              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              {importSuccess && (
                <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{t('importSuccess')}</AlertDescription>
                </Alert>
              )}

              {importedData && !importError && !importSuccess && (
                <Alert>
                  <AlertDescription>
                    {t('readyToMerge')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          {mode === 'export' ? (
            <Button onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              {t('downloadJson')}
            </Button>
          ) : (
            <Button 
              onClick={handleApplyImport} 
              disabled={!importedData || !!importError}
            >
              <FileUp className="h-4 w-4 mr-2" />
              {t('applyImport')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}