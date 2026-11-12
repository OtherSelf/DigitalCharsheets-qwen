'use client';

import * as React from 'react';

import { Info, Minus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';

import type { DH2Character } from '../types';
import { EditSaveButton } from './dh-ui-helpers';

type CustomResource = {
  id: string;
  description: string;
  current: number;
  max: number;
  notes?: string;
};

export function CustomResourceCounter({
  character,
  isCompactView,
}: {
  character: DH2Character;
  isCompactView: boolean;
}) {
  const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [resources, setResources] = React.useState<CustomResource[]>(
    character.customResources || [],
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [newDesc, setNewDesc] = React.useState('');
  const [newMax, setNewMax] = React.useState(1);

  React.useEffect(() => {
    setResources(character.customResources || []);
  }, [character.customResources]);

  const handleSave = React.useCallback(() => {
    updateCharacter(character.id, { customResources: resources });
    setIsEditing(false);
  }, [character.id, resources, updateCharacter]);

  const handleChangeCurrent = (id: string, delta: number) => {
    const next = resources.map((r) =>
      r.id === id
        ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) }
        : r,
    );
    setResources(next);
    updateCharacter(character.id, { customResources: next });
  };

  const handleFieldChange = (
    id: string,
    field: 'description' | 'max' | 'notes',
    value: string | number,
  ) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'max') {
          const newMaxVal = Math.max(0, parseInt(String(value), 10) || 0);
          return {
            ...r,
            max: newMaxVal,
            current: Math.min(r.current, newMaxVal),
          };
        }
        return { ...r, [field]: value };
      }),
    );
  };

  const addResource = () => {
    if (newDesc.trim()) {
      const next = [
        ...resources,
        {
          id: `res-${Date.now()}`,
          description: newDesc.trim(),
          current: newMax,
          max: newMax,
          notes: '',
        },
      ];
      setResources(next);
      setNewDesc('');
      setNewMax(1);
    }
  };

  const removeResource = (id: string) => {
    const next = resources.filter((r) => r.id !== id);
    setResources(next);
    updateCharacter(character.id, { customResources: next });
  };

  // ─── DESKTOP / TABLET UI ───
  if (!isCompactView) {
    return (
      <div className="border-t pt-2">
        <div className="mb-2 flex flex-row items-center justify-between">
          <h4 className="text-sm font-semibold">{t('dh2.customResources')}</h4>
          {(showEditButtons || isEditing) && (
            <EditSaveButton
              editing={isEditing}
              onEdit={() => setIsEditing(true)}
              onSave={handleSave}
            />
          )}
        </div>
        <div className="space-y-2">
          {resources.length === 0 && !isEditing && (
            <p className="text-muted-foreground rounded-lg border border-dashed py-2 text-center text-xs italic">
              {t('dh2.noCustomResourcesAdded')}
            </p>
          )}
          {resources.map((res) => (
            <div
              key={res.id}
              className="border-muted/20 bg-muted/10 flex items-center justify-between rounded border p-2"
            >
              {isEditing ? (
                <div className="mr-2 flex flex-1 flex-col gap-1">
                  <Input
                    value={res.description}
                    onChange={(e) =>
                      handleFieldChange(res.id, 'description', e.target.value)
                    }
                    className="h-7 text-xs"
                    placeholder={t('common.resourceName')}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground shrink-0 text-[9px] font-bold uppercase">
                      {t('common.max')}
                    </span>
                    <Input
                      type="number"
                      value={res.max === 0 ? '' : res.max}
                      onChange={(e) =>
                        handleFieldChange(res.id, 'max', e.target.value)
                      }
                      className="h-7 w-16 text-center text-[10px]"
                      min={0}
                    />
                    {!hideNotes && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={res.notes ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-6 w-6 shrink-0"
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <Label className="mb-2 block text-xs">
                            {t('common.notes')}: {res.description}
                          </Label>
                          <Textarea
                            defaultValue={res.notes || ''}
                            onChange={(e) =>
                              handleFieldChange(res.id, 'notes', e.target.value)
                            }
                            placeholder={t('common.notes')}
                            className="mt-2 min-h-[100px] text-sm"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {!hideNotes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={res.notes ? 'secondary' : 'ghost'}
                          size="icon"
                          className="h-5 w-5 shrink-0"
                        >
                          <Info className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <Label className="mb-2 block text-xs">
                          {t('common.notes')}: {res.description}
                        </Label>
                        <Textarea
                          defaultValue={res.notes || ''}
                          onBlur={(e) => {
                            const next = resources.map((r) =>
                              r.id === res.id
                                ? { ...r, notes: e.target.value }
                                : r,
                            );
                            setResources(next);
                            updateCharacter(character.id, {
                              customResources: next,
                            });
                          }}
                          placeholder={t('common.notes')}
                          className="mt-2 min-h-[100px] text-sm"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  <span className="flex-1 text-xs font-bold break-words">
                    {res.description}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => handleChangeCurrent(res.id, -1)}
                  disabled={res.current <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-12 text-center text-sm font-black">
                  {res.current} / {res.max}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => handleChangeCurrent(res.id, 1)}
                  disabled={res.current >= res.max}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-6 w-6"
                    onClick={() => removeResource(res.id)}
                    aria-label={t('dh2.removeResource')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isEditing && (
            <div className="flex items-center gap-2 border-t pt-2">
              <Input
                placeholder={t('common.resourceName')}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="h-8 flex-1 text-xs"
              />
              <Input
                type="number"
                value={newMax === 0 ? '' : newMax}
                onChange={(e) => setNewMax(parseInt(e.target.value) || 1)}
                className="h-8 w-16 text-center text-xs"
                min={1}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={addResource}
                aria-label={t('dh2.addResource')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── COMPACT / MOBILE UI ───
  return (
    <div className="col-span-2 mt-2">
      <Card className="mt-2">
        <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
          <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {t('dh2.customResources')}
          </CardTitle>
          {(showEditButtons || isEditing) && (
            <EditSaveButton
              editing={isEditing}
              onEdit={() => setIsEditing(true)}
              onSave={handleSave}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {resources.length === 0 && !isEditing && (
            <p className="text-muted-foreground rounded border border-dashed py-1 text-center text-[10px] italic">
              {t('dh2.noCustomResources')}
            </p>
          )}
          {resources.map((res) => (
            <div
              key={res.id}
              className="border-muted/20 bg-muted/10 flex items-center justify-between rounded border p-1.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {!hideNotes && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={res.notes ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-4 w-4 shrink-0"
                      >
                        <Info className="h-2.5 w-2.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <Label className="mb-2 block text-xs">
                        {t('common.notes')}: {res.description}
                      </Label>
                      <Textarea
                        defaultValue={res.notes || ''}
                        onBlur={(e) => {
                          const next = resources.map((r) =>
                            r.id === res.id
                              ? { ...r, notes: e.target.value }
                              : r,
                          );
                          setResources(next);
                          updateCharacter(character.id, {
                            customResources: next,
                          });
                        }}
                        placeholder={t('common.notes')}
                        className="mt-2 min-h-[80px] text-xs"
                      />
                    </PopoverContent>
                  </Popover>
                )}
                <span className="flex-1 text-[10px] font-bold break-words">
                  {res.description}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5"
                  onClick={() => handleChangeCurrent(res.id, -1)}
                  disabled={res.current <= 0}
                >
                  <Minus className="h-2.5 w-2.5" />
                </Button>
                <span className="w-8 text-center text-xs font-black">
                  {res.current}/{res.max}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5"
                  onClick={() => handleChangeCurrent(res.id, 1)}
                  disabled={res.current >= res.max}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-5 w-5"
                    onClick={() => removeResource(res.id)}
                    aria-label={t('dh2.removeResource')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isEditing && (
            <div className="flex items-center gap-1 border-t pt-1">
              <Input
                placeholder={t('common.name')}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="h-7 flex-1 text-[10px]"
              />
              <Input
                type="number"
                value={newMax === 0 ? '' : newMax}
                onChange={(e) => setNewMax(parseInt(e.target.value) || 1)}
                className="h-7 w-12 text-center text-[10px]"
                min={1}
              />
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={addResource}
                aria-label={t('dh2.addResource')}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
