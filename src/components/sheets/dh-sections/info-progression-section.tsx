'use client';

import * as React from 'react';

import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  CAREER_KEYS,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  RANK_KEYS,
  VARIANT_KEYS,
  WORLD_VARIANT_LABELS,
} from '@/lib/dark-heresy-data';
import {
  ADVANCED_RANK_THRESHOLD,
  AdvancedPathsByCareer,
  calculateRank,
  RanksByCareer,
  type AdvancedPath,
} from '@/lib/dark-heresy-ranks';
import { divinationEffectLabel, divinationLabel } from '@/lib/divination-i18n';
import {
  type DarkHeresyCareerPath,
  type DarkHeresyCharacter,
} from '@/lib/types';
import { cn } from '@/lib/utils';

import { EditSaveButton } from './dh-ui-helpers';

const DetailField = ({
  label,
  value,
  editing,
  type = 'text',
  onChange,
  onBlur,
  isCompactView,
}: {
  label: string;
  value: string | number;
  editing: boolean;
  type?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  isCompactView: boolean;
}) => (
  <div className="space-y-1">
    <Label
      className={cn(
        'text-muted-foreground text-xs',
        isCompactView && 'text-[10px]',
      )}
    >
      {label}
    </Label>
    {editing ? (
      <Input
        defaultValue={value}
        type={type}
        onChange={onChange}
        onBlur={onBlur}
        className="h-8"
      />
    ) : (
      <p
        className={cn(
          'text-sm font-medium break-words',
          isCompactView && 'text-xs',
        )}
      >
        {value || '-'}
      </p>
    )}
  </div>
);

interface SectionProps {
  character: DarkHeresyCharacter;
  isCompactView: boolean;
  activeCompactSection?: string;
  onEditingChange?: (val: boolean) => void;
}

export const InfoSection = ({
  character,
  isCompactView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [isInfoEditing, setIsInfoEditing] = React.useState(false);
  const [isBackstoryOpen, setIsBackstoryOpen] = React.useState(false);
  const [isNotesOpen, setIsNotesOpen] = React.useState(false);

  React.useEffect(() => {
    onEditingChange?.(isInfoEditing);
  }, [isInfoEditing, onEditingChange]);

  const worldVariantLabel = React.useMemo(() => {
    if (!character.homeWorld) return t('dh.waitingHomeWorld');
    const key = WORLD_VARIANT_LABELS[character.homeWorld];
    if (key === 'Tribal Taboos') return t('dh.tribalTaboos');
    if (key === 'Hive Class') return t('dh.hiveClass');
    if (key === 'Birth Planet') return t('dh.birthPlanet');
    if (key === 'Ship Tradition') return t('dh.shipTradition');
    if (key === 'Place of Birth') return t('dh.placeOfBirth');
    return t('dh.worldVariant');
  }, [character.homeWorld, t]);

  const showInfo = !isCompactView || activeCompactSection === 'info-section';
  if (!showInfo) return null;

  return (
    <Card id="info-section">
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between px-6 pt-3 pb-6',
          isCompactView && 'px-4 pt-2 pb-4',
        )}
      >
        <CardTitle
          className={cn(
            'font-headline',
            isCompactView ? 'text-lg' : 'text-2xl',
          )}
        >
          {t('common.info')}
        </CardTitle>
        {(showEditButtons || isInfoEditing) && (
          <EditSaveButton
            editing={isInfoEditing}
            onEdit={() => setIsInfoEditing(true)}
            onSave={() => setIsInfoEditing(false)}
          />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="dcs-info-grid grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
          <DetailField
            label={t('common.characterName')}
            value={character.name}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { name: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <div className="space-y-1">
            <Label
              className={cn(
                'text-muted-foreground text-xs',
                isCompactView && 'text-[10px]',
              )}
            >
              {t('dh.homeWorld')}
            </Label>
            <p
              className={cn(
                'text-sm font-medium break-words',
                isCompactView && 'text-xs',
              )}
            >
              {character.homeWorld
                ? t(HOME_WORLD_KEYS[character.homeWorld] || 'dh.homeWorld')
                : '-'}
            </p>
          </div>
          <div className="space-y-1">
            <Label
              className={cn(
                'text-muted-foreground text-xs',
                isCompactView && 'text-[10px]',
              )}
            >
              {worldVariantLabel}
            </Label>
            {/* LANDMARK: BIRTH_WORLD_IMMUTABLE
                Место рождения — выбор создания персонажа (как homeWorld и
                careerPath). После создания не редактируем: смена мира ломает
                лор/варианты и выглядит как подмена персонажа. Остальные
                текстовые поля Info остаются редактируемыми. */}
            <p
              className={cn(
                'text-sm font-medium break-words',
                isCompactView && 'text-xs',
              )}
            >
              {character.worldVariant
                ? t(
                    VARIANT_KEYS[character.worldVariant] ||
                      character.worldVariant,
                  )
                : '-'}
            </p>
          </div>
          <div className="space-y-1">
            <Label
              className={cn(
                'text-muted-foreground text-xs',
                isCompactView && 'text-[10px]',
              )}
            >
              {t('dh.careerPath')}
            </Label>
            <p
              className={cn(
                'text-sm font-medium break-words',
                isCompactView && 'text-xs',
              )}
            >
              {character.careerPath
                ? t(CAREER_KEYS[character.careerPath] || 'dh.careerPath')
                : '-'}
            </p>
          </div>

          {/* --- UPDATED DIVINATION FIELDS WITH TRANSLATION --- */}
          <DetailField
            label={t('dh.divination')}
            value={divinationLabel(character.divination, t)}
            editing={false}
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh.divinationEffect')}
            value={divinationEffectLabel(character.divinationEffect, t)}
            editing={false}
            isCompactView={isCompactView}
          />
          {/* --- END UPDATED DIVINATION FIELDS --- */}

          <DetailField
            label={t('dh.quirk')}
            value={
              character.quirk
                ? t(QUIRK_KEYS[character.quirk] || character.quirk)
                : ''
            }
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { quirk: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.height')}
            value={character.height}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { height: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.weight')}
            value={character.weight}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { weight: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.age')}
            value={character.age}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { age: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh.skinColor')}
            value={character.skinColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { skinColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh.hairColor')}
            value={character.hairColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { hairColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh.eyeColor')}
            value={character.eyeColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { eyeColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <Collapsible
            open={isBackstoryOpen}
            onOpenChange={setIsBackstoryOpen}
            className="w-full"
          >
            <div className="mb-2 flex flex-row items-center justify-between">
              <CollapsibleTrigger className="hover:bg-accent hover:text-accent-foreground -ml-2 flex w-full items-center gap-2 rounded-md px-2 py-1 transition-colors focus:outline-none">
                {isBackstoryOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Label
                  className={cn(
                    'text-muted-foreground cursor-pointer text-xs',
                    isCompactView && 'text-[10px]',
                  )}
                >
                  {t('common.backstory')}
                </Label>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="w-full space-y-1">
              {isInfoEditing ? (
                <Textarea
                  defaultValue={character.backstory}
                  className="min-h-[100px] resize-y"
                  onBlur={(e) =>
                    updateCharacter(character.id, { backstory: e.target.value })
                  }
                />
              ) : (
                <p
                  className={cn(
                    'px-2 text-sm font-medium break-words whitespace-pre-wrap',
                    isCompactView && 'text-xs',
                  )}
                >
                  {character.backstory || '-'}
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={isNotesOpen}
            onOpenChange={setIsNotesOpen}
            className="w-full"
          >
            <div className="mb-2 flex flex-row items-center justify-between">
              <CollapsibleTrigger className="hover:bg-accent hover:text-accent-foreground -ml-2 flex w-full items-center gap-2 rounded-md px-2 py-1 transition-colors focus:outline-none">
                {isNotesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Label
                  className={cn(
                    'text-muted-foreground cursor-pointer text-xs',
                    isCompactView && 'text-[10px]',
                  )}
                >
                  {t('common.notes')}
                </Label>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="w-full space-y-1">
              {isInfoEditing ? (
                <Textarea
                  defaultValue={character.notes}
                  className="min-h-[100px] resize-y"
                  onBlur={(e) =>
                    updateCharacter(character.id, { notes: e.target.value })
                  }
                />
              ) : (
                <p
                  className={cn(
                    'px-2 text-sm font-medium break-words whitespace-pre-wrap',
                    isCompactView && 'text-xs',
                  )}
                >
                  {character.notes || '-'}
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
};

export const ProgressionSection = ({
  character,
  isCompactView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);

  React.useEffect(() => {
    onEditingChange?.(isProgressionEditing);
  }, [isProgressionEditing, onEditingChange]);

  const [editableExperience, setEditableExperience] = React.useState(
    character.experience ?? 0,
  );
  const [editableTotalExpSpent, setEditableTotalExpSpent] = React.useState(
    character.totalExpSpent ?? 0,
  );
  const [editableAdvancedPath, setEditableAdvancedPath] = React.useState(
    character.advancedPath ?? null,
  );
  const [editableAlternatePath, setEditableAlternatePath] = React.useState(
    character.alternatePath ?? null,
  );
  const [amountToSpend, setAmountToSpend] = React.useState(0);
  const expInputRef = React.useRef<HTMLInputElement>(null);

  // ─── LANDMARK: SYNC CURRENT EXP ───
  // Черновик «Текущего опыта» раньше инициализировался один раз при монтировании
  // и никогда не сверялся с сохранённым значением. Если лист обновлялся извне
  // (импорт, статистика, вторая вкладка), поле продолжало показывать старый
  // номер, и следующая же правка записывала его обратно на сервер.
  // Синхронизируем, только когда в поле не печатают, чтобы не затереть ввод.
  React.useEffect(() => {
    if (
      typeof document !== 'undefined' &&
      document.activeElement === expInputRef.current
    )
      return;
    setEditableExperience(character.experience ?? 0);
  }, [character.experience]);

  const [isAdvancedPathModalOpen, setIsAdvancedPathModalOpen] =
    React.useState(false);
  const [isAlternateRankModalOpen, setIsAlternateRankModalOpen] =
    React.useState(false);

  // Псайкер выбирает ветвь уже на 2000 ОО (стр. 100: Савант-Милитант /
  // Схолар Материум). У остальных профессий продвинутые пути — с 6000 ОО.
  const advancedPathThreshold =
    character.careerPath === 'Imperial Psyker' ? 2000 : ADVANCED_RANK_THRESHOLD;

  const possibleAdvancedPaths =
    AdvancedPathsByCareer[
      character.careerPath as keyof typeof AdvancedPathsByCareer
    ];
  const careerProgression = character.careerPath
    ? RanksByCareer[character.careerPath as DarkHeresyCareerPath]
    : null;
  let chosenAdvancedPathData: AdvancedPath | null = null;
  if (
    (editableAdvancedPath ?? character.advancedPath) &&
    possibleAdvancedPaths
  ) {
    const paths = Object.values(possibleAdvancedPaths) as AdvancedPath[];
    chosenAdvancedPathData =
      paths.find(
        (p) => p.name === (editableAdvancedPath ?? character.advancedPath),
      ) || null;
  }
  const currentRankName = careerProgression
    ? calculateRank(
        careerProgression,
        editableTotalExpSpent,
        chosenAdvancedPathData,
        editableAlternatePath ?? character.alternatePath,
      )
    : 'N/A';
  const canChooseAlternateRank =
    character.careerPath === 'Adept' &&
    editableTotalExpSpent >= 2000 &&
    editableTotalExpSpent < 3000;

  const handleTotalExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTotalExp = parseInt(e.target.value, 10) || 0;
    setEditableTotalExpSpent(newTotalExp);
    if (newTotalExp < advancedPathThreshold) setEditableAdvancedPath(null);
    if (
      newTotalExp < 2000 &&
      (editableAlternatePath ?? character.alternatePath) === 'Chirurgeon'
    )
      setEditableAlternatePath(null);
  };

  const handleSaveTotalExp = () => {
    if (
      editableTotalExpSpent !== character.totalExpSpent ||
      (editableAdvancedPath ?? null) !== (character.advancedPath ?? null) ||
      (editableAlternatePath ?? null) !== (character.alternatePath ?? null)
    ) {
      updateCharacter(character.id, {
        totalExpSpent: editableTotalExpSpent,
        advancedPath: editableAdvancedPath ?? null,
        alternatePath: editableAlternatePath ?? null,
      });
    }
  };

  const handleSpendExp = () => {
    if (amountToSpend > 0 && amountToSpend <= editableExperience) {
      const newCurrentExp = editableExperience - amountToSpend;
      const newTotalExp = editableTotalExpSpent + amountToSpend;
      setEditableExperience(newCurrentExp);
      setEditableTotalExpSpent(newTotalExp);
      if (newTotalExp < advancedPathThreshold) setEditableAdvancedPath(null);
      updateCharacter(character.id, {
        experience: newCurrentExp,
        totalExpSpent: newTotalExp,
        advancedPath:
          newTotalExp < advancedPathThreshold
            ? (editableAdvancedPath ?? null)
            : (editableAdvancedPath ?? character.advancedPath ?? null),
        alternatePath: editableAlternatePath ?? character.alternatePath ?? null,
      });
      setAmountToSpend(0);
    }
  };

  // ─── LANDMARK: CURRENT EXP АВТОСОХРАНЕНИЕ ───
  // Раньше «Текущий опыт» уходил на сервер ТОЛЬКО по onBlur. Если после
  // ввода перезагрузить страницу / закрыть вкладку / перейти по ссылке,
  // blur не срабатывал и правка молча терялась. Теперь пишем на каждый
  // ввод: очередь в CharacterProvider склеивает «печатание» в один PUT,
  // а `__page`/`__seq` не дают запоздавшему запросу перетереть свежий.
  const handleCurrentExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Math.max(0, parseInt(e.target.value, 10) || 0);
    setEditableExperience(next);
    updateCharacter(character.id, { experience: next });
  };

  const handleSelectAdvancedPath = (pathName: string) => {
    updateCharacter(character.id, { advancedPath: pathName });
    setEditableAdvancedPath(pathName);
    setIsAdvancedPathModalOpen(false);
  };

  const handleSelectAlternateRank = (pathName: string | null) => {
    updateCharacter(character.id, { alternatePath: pathName });
    setEditableAlternatePath(pathName);
    setIsAlternateRankModalOpen(false);
  };

  const showProgression =
    !isCompactView || activeCompactSection === 'progression-section';
  if (!showProgression) return null;

  return (
    <>
      <Card id="progression-section">
        <CardHeader
          className={cn(
            'flex flex-row items-center justify-between px-6 pt-3 pb-6',
            isCompactView && 'px-4 pt-2 pb-4',
          )}
        >
          <CardTitle
            className={cn(
              'font-headline',
              isCompactView ? 'text-lg' : 'text-2xl',
            )}
          >
            {t('common.progression')}
          </CardTitle>
          {(showEditButtons || isProgressionEditing) && (
            <EditSaveButton
              editing={isProgressionEditing}
              onEdit={() => setIsProgressionEditing(true)}
              onSave={() => {
                handleSaveTotalExp();
                setIsProgressionEditing(false);
              }}
            />
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <Label
                htmlFor="current-exp-edit"
                className="text-muted-foreground text-xs"
              >
                {t('dh.currentExp')}
              </Label>
              <Input
                id="current-exp-edit"
                ref={expInputRef}
                type="number"
                min={0}
                value={editableExperience === 0 ? '' : editableExperience}
                onChange={handleCurrentExpChange}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spend-exp-amount">{t('dh.spendExp')}</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() =>
                    setAmountToSpend(Math.max(0, amountToSpend - 50))
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="spend-exp-amount"
                  type="number"
                  value={amountToSpend === 0 ? '' : amountToSpend}
                  onChange={(e) =>
                    setAmountToSpend(
                      Math.max(0, parseInt(e.target.value, 10) || 0),
                    )
                  }
                  className="h-9 text-center"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setAmountToSpend(amountToSpend + 50)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSpendExp}
              disabled={
                amountToSpend <= 0 || amountToSpend > editableExperience
              }
              className="w-full"
            >
              {t('dh.spendExp')}
            </Button>
            <div className="space-y-1">
              <Label
                htmlFor="total-exp-edit"
                className="text-muted-foreground text-xs"
              >
                {t('dh.totalExpSpent')}
              </Label>
              <Input
                id="total-exp-edit"
                type="number"
                value={editableTotalExpSpent === 0 ? '' : editableTotalExpSpent}
                onChange={handleTotalExpChange}
                onBlur={handleSaveTotalExp}
                disabled={!isProgressionEditing}
                className="h-9"
              />
            </div>

            {/* ========== RANK DISPLAY SECTION START ========== */}
            <div className="space-y-1 border-t pt-2">
              <Label className="text-muted-foreground text-xs">
                {t('dh.rank')}
              </Label>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium break-words">
                    {currentRankName === 'N/A' ||
                    currentRankName === 'Unknown Rank'
                      ? t('dh.unknownRank')
                      : t(RANK_KEYS[currentRankName] || currentRankName)}
                  </p>

                  {(editableAdvancedPath ?? character.advancedPath) ? (
                    <div className="flex items-center gap-2">
                      <span className="border-primary/20 bg-primary/10 text-primary rounded border px-2 py-0.5 text-[10px] font-semibold">
                        {t('dh.advancedPath')}:{' '}
                        {t(
                          RANK_KEYS[
                            editableAdvancedPath ?? character.advancedPath!
                          ] ||
                            (editableAdvancedPath ?? character.advancedPath!),
                        )}
                      </span>
                      {isProgressionEditing &&
                        editableTotalExpSpent >= advancedPathThreshold && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setIsAdvancedPathModalOpen(true)}
                          >
                            {t('dh.changeAdvancedPath')}
                          </Button>
                        )}
                    </div>
                  ) : (
                    isProgressionEditing &&
                    editableTotalExpSpent >= advancedPathThreshold && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setIsAdvancedPathModalOpen(true)}
                      >
                        {t('dh.selectAdvancedPath')}
                      </Button>
                    )
                  )}

                  {(editableAlternatePath ?? character.alternatePath) && (
                    <span className="border-secondary/20 bg-secondary/20 text-secondary-foreground rounded border px-2 py-0.5 text-[10px] font-semibold">
                      {t('dh.alternatePath')}:{' '}
                      {t(
                        RANK_KEYS[
                          editableAlternatePath ?? character.alternatePath!
                        ] ||
                          (editableAlternatePath ?? character.alternatePath!),
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex gap-2">
                  {isProgressionEditing && canChooseAlternateRank && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setIsAlternateRankModalOpen(true)}
                    >
                      {(editableAlternatePath ?? character.alternatePath)
                        ? t('dh.changeAlternateRank')
                        : t('dh.selectAlternateRank')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {/* ========== RANK DISPLAY SECTION END ========== */}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isAdvancedPathModalOpen}
        onOpenChange={setIsAdvancedPathModalOpen}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('dh.selectAdvancedPathTitle')}</DialogTitle>
            <DialogDescription>
              {t('dh.selectAdvancedPathDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            {possibleAdvancedPaths &&
              Object.values(possibleAdvancedPaths).map((path) => (
                <Button
                  key={path.name}
                  onClick={() => handleSelectAdvancedPath(path.name)}
                  className="h-12 text-base"
                >
                  {t('dh.choose')} {t(RANK_KEYS[path.name] || path.name)}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAlternateRankModalOpen}
        onOpenChange={setIsAlternateRankModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh.selectAlternateRankTitle')}</DialogTitle>
            <DialogDescription>
              {t('dh.selectAlternateRankDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button
              onClick={() => handleSelectAlternateRank(null)}
              className="h-12 text-base"
            >
              {t('dh.choose')} {t('dh.rankInditor')}
            </Button>
            <Button
              onClick={() => handleSelectAlternateRank('Chirurgeon')}
              className="h-12 text-base"
            >
              {t('dh.choose')} {t('dh.rankChirurgeon')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
