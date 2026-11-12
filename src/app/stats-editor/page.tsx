// src/app/stats-editor/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Check, Save } from 'lucide-react';

import { Header } from '@/components/header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { resolveCharacterSystemId } from '@/games/character-system';
import { listGameModules, type AnyGameModule } from '@/games/registry';
import type {
  BulkEditorTab,
  BulkEditorTable,
  BulkEditorValue,
} from '@/games/types';
import { useAllGameUiSlots } from '@/hooks/use-game-ui-slots';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: BULK EDITOR HOST ────────────────────────────────────────────
 * Массовый редактор. Ядро рисует оболочку (шапку, вкладки, кнопку «сохранить
 * всё», состояние сохранения) и общую таблицу, а колонки, значения, подписи и
 * сборку патча отдают плагины слотом `BulkEditor` (`ui.bulkEditor`, этап 3b).
 * Поэтому здесь нет игровых констант и ветвлений по системе.
 *
 * Вкладки собираются из плагинов: `stats` — общая (карточки идут отдельными
 * блоками), вкладки жизненных показателей — свои у каждой игры/редакции.
 */

interface TableEdit {
  values: Record<string, BulkEditorValue>;
  saved: boolean;
}

/** tableKey → characterId → правка. */
type EditsState = Record<string, Record<string, TableEdit>>;

interface BulkTableEntry {
  module: AnyGameModule;
  table: BulkEditorTable<any>;
}

function tableKey(module: AnyGameModule, table: BulkEditorTable<any>): string {
  return `${module.id}:${table.id}`;
}

function charactersFor(
  moduleId: string,
  characters: readonly Character[],
): Character[] {
  return characters.filter(
    (character) => resolveCharacterSystemId(character) === moduleId,
  );
}

function BulkTableCard({
  module,
  table,
  characters,
  edits,
  onChange,
  onSave,
}: {
  module: AnyGameModule;
  table: BulkEditorTable<any>;
  characters: readonly Character[];
  edits: Record<string, TableEdit>;
  onChange: (charId: string, columnKey: string, raw: string) => void;
  onSave: (charId: string) => void;
}) {
  const { t } = useTranslation();
  const editionName = table.editionNameKey
    ? t(table.editionNameKey)
    : undefined;
  const count = `(${characters.length})`;
  const title = editionName
    ? `${t(table.titleKey)} · ${editionName} ${count}`
    : `${t(table.titleKey)} ${count}`;
  const gapClass = table.gap === 2 ? 'gap-2' : 'gap-1';
  const gridTemplate =
    table.gridTemplate ?? `180px repeat(${table.columns.length}, 1fr) 60px`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t(table.descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="space-y-2" style={{ minWidth: table.minWidth }}>
          <div
            className={`text-muted-foreground grid items-center ${gapClass} border-b pb-2 text-xs font-semibold`}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span>{t('common.characterName')}</span>
            {table.columns.map((column) => (
              <span key={column.key} className="text-center">
                {t(column.labelKey)}
              </span>
            ))}
            <span></span>
          </div>

          {characters.map((character) => {
            const edit = edits[character.id];
            if (!edit) return null;
            return (
              <div
                key={character.id}
                className={`grid items-center ${gapClass}`}
                style={{ gridTemplateColumns: gridTemplate }}
                data-testid={`bulk-row-${module.id}-${table.id}`}
              >
                <span
                  className="truncate text-sm font-medium"
                  title={character.name}
                >
                  {character.name}
                </span>
                {table.columns.map((column) => (
                  <Input
                    key={column.key}
                    type={column.type ?? 'number'}
                    value={edit.values[column.key] ?? ''}
                    min={column.min}
                    max={column.max}
                    onChange={(event) =>
                      onChange(character.id, column.key, event.target.value)
                    }
                    className="h-8 text-center text-sm"
                  />
                ))}
                <Button
                  size="sm"
                  variant={edit.saved ? 'outline' : 'default'}
                  onClick={() => onSave(character.id)}
                  className="h-8"
                >
                  {edit.saved ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatsEditorPage() {
  const { user, isUserLoading } = useLocalAuth();
  const { characters, updateCharacter, isLoaded } = useCharacterContext();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('stats');
  const [edits, setEdits] = useState<EditsState>({});
  const [saveStatus, setSaveStatus] = useState('');

  const modules = listGameModules();
  const slotsById = useAllGameUiSlots();
  const tables = useMemo<BulkTableEntry[]>(
    () =>
      modules.flatMap((module) =>
        (slotsById[module.id]?.bulkEditor ?? []).map((table) => ({
          module,
          table,
        })),
      ),
    [modules, slotsById],
  );

  const tabs = useMemo<BulkEditorTab[]>(() => {
    const merged = new Map<string, BulkEditorTab>();
    for (const { table } of tables) {
      if (!merged.has(table.tab.id)) merged.set(table.tab.id, table.tab);
    }
    return [...merged.values()].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
  }, [tables]);

  useEffect(() => {
    if (!isLoaded) return;
    const next: EditsState = {};
    for (const { module, table } of tables) {
      const rows: Record<string, TableEdit> = {};
      for (const character of charactersFor(module.id, characters)) {
        const values: Record<string, BulkEditorValue> = {};
        for (const column of table.columns) {
          values[column.key] = column.value(character);
        }
        rows[character.id] = { values, saved: false };
      }
      next[tableKey(module, table)] = rows;
    }
    setEdits(next);
  }, [isLoaded, characters, tables]);

  const flashStatus = (message: string) => {
    setSaveStatus(message);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const tabCount = (tabId: string): number =>
    tables
      .filter(({ table }) => table.tab.id === tabId)
      .reduce(
        (total, { module }) =>
          total + charactersFor(module.id, characters).length,
        0,
      );

  const handleChange = (
    module: AnyGameModule,
    table: BulkEditorTable<any>,
    charId: string,
    columnKey: string,
    raw: string,
  ) => {
    const column = table.columns.find((item) => item.key === columnKey);
    const value: BulkEditorValue =
      column?.type === 'text' ? raw : parseInt(raw, 10) || 0;
    const key = tableKey(module, table);
    setEdits((previous) => {
      const rows = previous[key];
      const edit = rows?.[charId];
      if (!rows || !edit) return previous;
      return {
        ...previous,
        [key]: {
          ...rows,
          [charId]: {
            values: { ...edit.values, [columnKey]: value },
            saved: false,
          },
        },
      };
    });
  };

  const patchFor = (
    table: BulkEditorTable<any>,
    character: Character,
    edit: TableEdit,
  ) => table.apply(character, edit.values) as Record<string, unknown>;

  const handleSaveRow = (
    module: AnyGameModule,
    table: BulkEditorTable<any>,
    charId: string,
  ) => {
    const key = tableKey(module, table);
    const edit = edits[key]?.[charId];
    const character = characters.find((item) => item.id === charId);
    if (!edit || !character) return;
    updateCharacter(charId, patchFor(table, character, edit) as never);
    setEdits((previous) => ({
      ...previous,
      [key]: { ...previous[key], [charId]: { ...edit, saved: true } },
    }));
    flashStatus(`${t(table.saveOneKey)} "${character.name || 'Unnamed'}"`);
  };

  const handleSaveAll = (tab: BulkEditorTab) => {
    const next: EditsState = { ...edits };
    for (const { module, table } of tables) {
      if (table.tab.id !== tab.id) continue;
      const key = tableKey(module, table);
      const rows = edits[key] ?? {};
      for (const [charId, edit] of Object.entries(rows)) {
        const character = characters.find((item) => item.id === charId);
        if (!character) continue;
        updateCharacter(charId, patchFor(table, character, edit) as never);
        next[key] = { ...next[key], [charId]: { ...edit, saved: true } };
      }
    }
    setEdits(next);
    flashStatus(t(tab.saveAllDoneKey));
  };

  // isUserLoading: сессия читается из localStorage в useEffect, поэтому на
  // первом рендере user ещё null. Без этой проверки прямой заход на
  // /stats-editor (закладка, F5) всегда выкидывал на /login.
  if (!isUserLoading && !user) {
    router.push('/login');
    return null;
  }

  if (isUserLoading || !isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t('common.loadingCharacters')}</p>
      </div>
    );
  }

  const activeTabDescriptor =
    tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeTables = tables
    .filter(({ table }) => table.tab.id === activeTabDescriptor?.id)
    .sort(
      (a, b) =>
        a.table.order - b.table.order ||
        a.table.id.localeCompare(b.table.id, 'en'),
    );

  return (
    <div className="flex h-dvh flex-col">
      {/* LANDMARK: STATS_EDITOR_HEADER */}
      {/* Та же шапка, что на остальных страницах. Стрелка «назад» не нужна:
          бренд-ссылка ведёт домой, а редактор всегда открывается с дашборда. */}
      <Header
        title={t('common.bulkEditor')}
        subtitle={t('common.bulkEditorDesc')}
      />

      <main className="safe-area-bottom flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={
                  activeTabDescriptor?.id === tab.id ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.showCount
                  ? `${t(tab.labelKey)} (${tabCount(tab.id)})`
                  : t(tab.labelKey)}
              </Button>
            ))}
          </div>

          {saveStatus && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                {saveStatus}
              </AlertDescription>
            </Alert>
          )}

          {activeTabDescriptor && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => handleSaveAll(activeTabDescriptor)}>
                  <Save className="mr-2 h-4 w-4" />{' '}
                  {t(activeTabDescriptor.saveAllLabelKey)}
                </Button>
              </div>

              {tabCount(activeTabDescriptor.id) === 0 &&
              activeTabDescriptor.emptyKey ? (
                <Card>
                  <CardContent className="text-muted-foreground py-12 text-center">
                    {t(activeTabDescriptor.emptyKey)}
                  </CardContent>
                </Card>
              ) : (
                activeTables.map(({ module, table }) => {
                  const rows = charactersFor(module.id, characters);
                  if (rows.length === 0) return null;
                  return (
                    <BulkTableCard
                      key={tableKey(module, table)}
                      module={module}
                      table={table}
                      characters={rows}
                      edits={edits[tableKey(module, table)] ?? {}}
                      onChange={(charId, columnKey, raw) =>
                        handleChange(module, table, charId, columnKey, raw)
                      }
                      onSave={(charId) => handleSaveRow(module, table, charId)}
                    />
                  );
                })
              )}
            </div>
          )}

          {characters.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center">
                {t('common.noCharactersFound')}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
