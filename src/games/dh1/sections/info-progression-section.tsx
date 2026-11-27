'use client';

import * as React from 'react';

import { BookOpen, Lock, Minus, Plus, ScrollText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChoiceDialog } from '@/components/ui/choice-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ConditionsList,
  ExperienceLogSheet,
  NarrativeSheet,
  useCharacterContext,
  useTranslation,
  type ConditionsLabels,
} from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import {
  CAREER_KEYS,
  DarkHeresyCareerPaths,
  DIVINATIONS,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  RANK_KEYS,
  VARIANT_KEYS,
  WORLD_VARIANT_LABELS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from '../dark-heresy-data';
import {
  ADVANCED_RANK_THRESHOLD,
  AdvancedPathsByCareer,
  rankStateForCharacter,
} from '../dark-heresy-ranks';
import {
  divinationEffectLabel,
  divinationKey,
  divinationLabel,
} from '../divination-i18n';
import { dh1ExperienceRows } from '../experience';
import { isCreationFieldLocked } from '../field-policy';
import { genderLabel, genderOptions, toGenderCode } from '../gender';
import type { DH1Character } from '../types';
import { EditSaveButton } from './dh-ui-helpers';

// Наборы состояний объявляет редакция: компонент в ядре принимает их
// пропсами и не знает ни одного значения.
const CONDITION_KINDS = [
  'disorder',
  'corruption',
  'mutation',
  'rudiment',
  'implant',
  'blessing',
] as const;

/**
 * Положительные эффекты: бейдж подкрашивается иначе, чтобы список
 * «Состояний» не читался как сплошной список проблем. Сами типы объявляет
 * редакция, компонент в ядре только принимает список.
 */
const POSITIVE_CONDITION_KINDS = ['implant', 'blessing'] as const;

const CONDITION_SOURCES = ['manual', 'divination', 'legacy'] as const;

const DetailField = ({
  label,
  value,
  sample,
  editing,
  type = 'text',
  onChange,
  onBlur,
  isCompactView,
}: {
  label: string;
  value: string | number;
  /** Текст — образец, а не замороженная фраза игрока. */
  sample?: boolean;
  editing: boolean;
  type?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  isCompactView: boolean;
}) => {
  const id = React.useId();
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <Label
        htmlFor={editing ? id : undefined}
        className={cn(
          'text-muted-foreground text-xs',
          isCompactView && 'text-10px',
        )}
      >
        {label}
      </Label>
      {editing ? (
        <Input
          id={id}
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
          {sample && value ? (
            <span className="text-muted-foreground text-10px ml-1 uppercase">
              {t('common.sampleBadge')}
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
};

/**
 * Поле создания: пока пусто и идёт редактирование — Select; как только
 * значение задано — read-only с замком «выбрано при создании». Заполнение
 * только записывает поле, производные не пересчитываются.
 */
const CreationField = ({
  label,
  value,
  sample,
  selectedValue,
  placeholder,
  editing,
  locked,
  disabled,
  isCompactView,
  options,
  onSelect,
  lockHintKey,
}: {
  label: string;
  value: string;
  /** Текст — образец, а не замороженная фраза игрока. */
  sample?: boolean;
  /** Сырое значение для предвыбора в Select (не локализованная подпись). */
  selectedValue?: string;
  placeholder: string;
  editing: boolean;
  locked: boolean;
  disabled?: boolean;
  isCompactView: boolean;
  options: readonly { value: string; label: string }[];
  onSelect: (next: string) => void;
  /** Подсказка к замку; по умолчанию «выбрано при создании». */
  lockHintKey?: string;
}) => {
  const { t } = useTranslation();
  const lockHint = t(lockHintKey ?? 'dh1.chosenAtCreation');

  return (
    <div className="space-y-1">
      <Label
        className={cn(
          'text-muted-foreground text-xs',
          isCompactView && 'text-10px',
        )}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {locked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={lockHint}
                  data-testid="creation-lock"
                >
                  <Lock className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{lockHint}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </Label>
      {locked || !editing ? (
        <p
          className={cn(
            'text-sm font-medium break-words',
            !locked && !value && 'text-muted-foreground',
            isCompactView && 'text-xs',
          )}
        >
          {value || '-'}
          {sample && value ? (
            <span className="text-muted-foreground text-10px ml-1 uppercase">
              {t('common.sampleBadge')}
            </span>
          ) : null}
        </p>
      ) : (
        <Select
          value={selectedValue ?? ''}
          onValueChange={onSelect}
          disabled={disabled}
        >
          <SelectTrigger className="h-8" aria-label={label}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

/** Список свободных строк (черты, мутации, силы) ↔ строка через запятую. */
function formatNames(entries?: { name: string }[]): string {
  return (entries ?? []).map((entry) => entry.name).join(', ');
}

function parseNames(value: string) {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: `entry-${index + 1}`, name }));
}

/** Компактный блок полей листа: заголовок + сетка DetailField. */
const MetaBlock = ({
  title,
  action,
  children,
}: {
  title: string;
  /** Кнопка правки блока: у состояний она своя, отдельно от всей «Информации». */
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </h4>
      {action}
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
      {children}
    </div>
  </div>
);

interface SectionProps {
  character: DH1Character;
  isCompactView: boolean;
  /** Телефонная подача: только она прячет соседние секции (компакт — нет). */
  isPhoneView: boolean;
  activeCompactSection?: string;
  onEditingChange?: (val: boolean) => void;
  /** Импортированный лист проверяется: creation-замки временно открыты. */
  creationReview?: boolean;
}

export const InfoSection = ({
  character,
  isCompactView,
  isPhoneView,
  activeCompactSection,
  onEditingChange,
  creationReview,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t, language } = useTranslation();
  const [isInfoEditing, setIsInfoEditing] = React.useState(false);
  /**
   * Список состояний правится своей кнопкой: импланты, рудименты, мутации и
   * осквернения живут отдельной жизнью от паспортных полей листа, и включать
   * ради них правку всей «Информации» неудобно.
   */
  const [isConditionsEditing, setIsConditionsEditing] = React.useState(false);
  const [isBackstoryOpen, setIsBackstoryOpen] = React.useState(false);

  React.useEffect(() => {
    onEditingChange?.(isInfoEditing || isConditionsEditing);
  }, [isInfoEditing, isConditionsEditing, onEditingChange]);

  const conditionLabels: ConditionsLabels = React.useMemo(
    () => ({
      title: '',
      add: t('dh1.conditions.add'),
      empty: t('dh1.conditions.empty'),
      name: t('dh1.conditions.name'),
      kind: t('dh1.conditions.kind'),
      severity: t('dh1.conditions.severity'),
      effect: t('dh1.conditions.effect'),
      notes: t('dh1.conditions.notes'),
      source: t('dh1.conditions.source'),
      remove: t('dh1.conditions.remove'),
      kindLabels: {
        disorder: t('dh1.conditions.kind.disorder'),
        corruption: t('dh1.conditions.kind.corruption'),
        mutation: t('dh1.conditions.kind.mutation'),
        rudiment: t('dh1.conditions.kind.rudiment'),
        implant: t('dh1.conditions.kind.implant'),
        blessing: t('dh1.conditions.kind.blessing'),
      },
      sourceLabels: {
        manual: t('dh1.conditions.source.manual'),
        divination: t('dh1.conditions.source.divination'),
        legacy: t('dh1.conditions.source.legacy'),
      },
    }),
    [t],
  );

  const worldVariantLabel = React.useMemo(() => {
    if (!character.homeWorld) return t('dh1.waitingHomeWorld');
    const key = WORLD_VARIANT_LABELS[character.homeWorld];
    return key ? t(key) : t('dh1.worldVariant');
  }, [character.homeWorld, t]);

  const showInfo = !isPhoneView || activeCompactSection === 'info-section';
  if (!showInfo) return null;

  return (
    <Card>
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
        <TooltipProvider delayDuration={150}>
          <div className="space-y-5">
            <MetaBlock title={t('dh1.personalSection')}>
              <DetailField
                label={t('common.characterName')}
                value={character.name}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { name: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.quirk')}
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
                label={t('dh1.skinColor')}
                value={character.skinColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { skinColor: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.hairColor')}
                value={character.hairColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { hairColor: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.eyeColor')}
                value={character.eyeColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { eyeColor: e.target.value })
                }
                isCompactView={isCompactView}
              />

              <CreationField
                label={t('dh1.gender')}
                value={genderLabel(character.identity?.gender ?? '', t)}
                selectedValue={character.identity?.gender ?? ''}
                placeholder={t('dh1.selectGender')}
                editing={isInfoEditing}
                locked={
                  !creationReview &&
                  isCreationFieldLocked(character.identity?.gender)
                }
                lockHintKey="dh1.chosenGenderLocked"
                isCompactView={isCompactView}
                options={genderOptions(t)}
                onSelect={(next) =>
                  updateCharacter(character.id, {
                    identity: {
                      ...character.identity,
                      gender: toGenderCode(next),
                    },
                  })
                }
              />
              <DetailField
                label={t('dh1.build')}
                value={character.identity?.build ?? ''}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    identity: { ...character.identity, build: e.target.value },
                  })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.handedness')}
                value={character.identity?.handedness ?? ''}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    identity: {
                      ...character.identity,
                      handedness: e.target.value,
                    },
                  })
                }
                isCompactView={isCompactView}
              />
            </MetaBlock>

            <MetaBlock title={t('dh1.creationSection')}>
              <CreationField
                label={t('dh1.homeWorld')}
                value={
                  character.homeWorld
                    ? t(HOME_WORLD_KEYS[character.homeWorld] || 'dh1.homeWorld')
                    : ''
                }
                selectedValue={character.homeWorld}
                placeholder={t('dh1.waitingHomeWorld')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.homeWorld)
                }
                isCompactView={isCompactView}
                options={Object.keys(HOME_WORLD_KEYS).map((world) => ({
                  value: world,
                  label: t(HOME_WORLD_KEYS[world]),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { homeWorld: next })
                }
              />
              {/* LANDMARK: BIRTH_WORLD_IMMUTABLE
                            Мир и его вариант — выбор создания: заполнить можно, пока пусто,
                            но заданное не меняем. Смена мира ломает лор/варианты и
                            выглядит как подмена персонажа. */}
              <CreationField
                label={worldVariantLabel}
                value={
                  character.worldVariant
                    ? t(
                        VARIANT_KEYS[character.worldVariant] ||
                          character.worldVariant,
                      )
                    : ''
                }
                selectedValue={character.worldVariant}
                placeholder={t('dh1.waitingHomeWorld')}
                editing={isInfoEditing}
                locked={
                  !creationReview &&
                  isCreationFieldLocked(character.worldVariant)
                }
                disabled={!character.homeWorld}
                isCompactView={isCompactView}
                options={(
                  (character.homeWorld &&
                    WORLD_VARIANTS_BY_HOMEWORLD[character.homeWorld]) ||
                  []
                ).map((variant) => ({
                  value: variant,
                  label: t(VARIANT_KEYS[variant] ?? variant),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { worldVariant: next })
                }
              />
              <CreationField
                label={t('dh1.careerPath')}
                value={
                  character.careerPath
                    ? t(CAREER_KEYS[character.careerPath] || 'dh1.careerPath')
                    : ''
                }
                selectedValue={character.careerPath}
                placeholder={t('dh1.careerPath')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.careerPath)
                }
                isCompactView={isCompactView}
                options={DarkHeresyCareerPaths.map((career) => ({
                  value: career,
                  label: t(CAREER_KEYS[career] ?? career),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { careerPath: next })
                }
              />
              {creationReview || !character.divination ? (
                <CreationField
                  label={t('dh1.divination')}
                  value={divinationLabel(character.divination, t, 'dh1')}
                  selectedValue={character.divination}
                  placeholder={t('dh1.selectDivination')}
                  editing={isInfoEditing}
                  locked={
                    !creationReview &&
                    isCreationFieldLocked(character.divination)
                  }
                  isCompactView={isCompactView}
                  options={DIVINATIONS.map(({ id, roll }) => ({
                    value: id,
                    label: `${roll} · ${t(divinationKey(id, 'dh1'))}`,
                  }))}
                  onSelect={(next) =>
                    updateCharacter(character.id, {
                      divination: next,
                      divinationEffect:
                        DIVINATIONS.find((entry) => entry.id === next)
                          ?.effectId ?? '',
                      divinationText: {},
                    })
                  }
                />
              ) : (
                <DetailField
                  label={t('dh1.divination')}
                  value={
                    character.divinationText?.[language] ??
                    divinationLabel(character.divination, t, 'dh1')
                  }
                  sample={!character.divinationText?.[language]}
                  editing={isInfoEditing}
                  onBlur={(e) =>
                    updateCharacter(character.id, {
                      divinationText: {
                        ...(character.divinationText ?? {}),
                        [language]: e.target.value.trim(),
                      },
                    })
                  }
                  isCompactView={isCompactView}
                />
              )}
              <DetailField
                label={t('dh1.divinationEffect')}
                value={
                  character.divinationEffectText?.[language] ??
                  divinationEffectLabel(character.divinationEffect, t, 'dh1')
                }
                editing={false}
                isCompactView={isCompactView}
              />
            </MetaBlock>

            {/* Legacy-поля 1e («черты», элитные наборы, степень/модификатор
                Безумия, степень/тест Порчи) сюда не выводятся: миграция v6
                переносит значения во вкладку заметок «Наследие». */}
            <MetaBlock
              title={t('dh1.condition')}
              action={
                (showEditButtons || isConditionsEditing) && (
                  <EditSaveButton
                    editing={isConditionsEditing}
                    onEdit={() => setIsConditionsEditing(true)}
                    onSave={() => setIsConditionsEditing(false)}
                    testId="conditions"
                  />
                )
              }
            >
              <div className="col-span-2 space-y-2 md:col-span-3">
                <ConditionsList
                  conditions={character.conditions}
                  kinds={CONDITION_KINDS}
                  positiveKinds={POSITIVE_CONDITION_KINDS}
                  sources={CONDITION_SOURCES}
                  labels={conditionLabels}
                  editing={isConditionsEditing}
                  isCompactView={isCompactView}
                  onChange={(next) =>
                    updateCharacter(character.id, { conditions: next })
                  }
                />
              </div>
            </MetaBlock>
          </div>
        </TooltipProvider>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsBackstoryOpen(true)}
          >
            <BookOpen className="h-4 w-4" />
            {t('common.backstory')}
          </Button>
        </div>

        <NarrativeSheet
          open={isBackstoryOpen}
          onOpenChange={setIsBackstoryOpen}
          title={t('common.backstory')}
          description={t('common.backstory')}
          value={character.backstory ?? ''}
          onSave={(next) => updateCharacter(character.id, { backstory: next })}
        />

        <div className="mt-6 space-y-5">
          <MetaBlock title={t('dh1.carrySection')}>
            <DetailField
              label={t('dh1.totalCarriedWeight')}
              value={character.carry?.totalCarriedWeight ?? ''}
              editing={isInfoEditing}
              onBlur={(e) =>
                updateCharacter(character.id, {
                  carry: {
                    ...character.carry,
                    totalCarriedWeight: e.target.value,
                  },
                })
              }
              isCompactView={isCompactView}
            />
            <DetailField
              label={t('dh1.carryWeight')}
              value={character.carry?.carry ?? ''}
              editing={isInfoEditing}
              onBlur={(e) =>
                updateCharacter(character.id, {
                  carry: { ...character.carry, carry: e.target.value },
                })
              }
              isCompactView={isCompactView}
            />
            <DetailField
              label={t('dh1.liftWeight')}
              value={character.carry?.lift ?? ''}
              editing={isInfoEditing}
              onBlur={(e) =>
                updateCharacter(character.id, {
                  carry: { ...character.carry, lift: e.target.value },
                })
              }
              isCompactView={isCompactView}
            />
            <DetailField
              label={t('dh1.pushWeight')}
              value={character.carry?.push ?? ''}
              editing={isInfoEditing}
              onBlur={(e) =>
                updateCharacter(character.id, {
                  carry: { ...character.carry, push: e.target.value },
                })
              }
              isCompactView={isCompactView}
            />
            <DetailField
              label={t('dh1.armourWeight')}
              value={character.equipment.armorWeight ?? ''}
              editing={isInfoEditing}
              onBlur={(e) =>
                updateCharacter(character.id, {
                  equipment: {
                    ...character.equipment,
                    armorWeight: e.target.value,
                  },
                })
              }
              isCompactView={isCompactView}
            />
          </MetaBlock>
          {(character.psy || character.careerPath === 'Imperial Psyker') && (
            <MetaBlock title={t('dh1.psySection')}>
              <DetailField
                label={t('dh1.psyRating')}
                value={character.psy?.rating ?? ''}
                editing={isInfoEditing}
                type="number"
                onBlur={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  updateCharacter(character.id, {
                    psy: {
                      ...character.psy,
                      rating: Number.isFinite(parsed) ? parsed : undefined,
                    },
                  });
                }}
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.discipline')}
                value={character.psy?.discipline ?? ''}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    psy: { ...character.psy, discipline: e.target.value },
                  })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.psychicPowers')}
                value={formatNames(character.psy?.powers)}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    psy: {
                      ...character.psy,
                      powers: parseNames(e.target.value),
                    },
                  })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh1.testedAgainst')}
                value={character.psy?.testedAgainst ?? ''}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    psy: { ...character.psy, testedAgainst: e.target.value },
                  })
                }
                isCompactView={isCompactView}
              />
            </MetaBlock>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ProgressionSection = ({
  character,
  isCompactView,
  isPhoneView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t, language } = useTranslation();
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
  const [isSpendOpen, setIsSpendOpen] = React.useState(false);
  const [isJournalOpen, setIsJournalOpen] = React.useState(false);
  const [spendAmount, setSpendAmount] = React.useState(0);
  const [spendWhat, setSpendWhat] = React.useState('');
  const [isAwardOpen, setIsAwardOpen] = React.useState(false);
  // Строкой, а не числом: иначе нельзя ввести минус или промежуточное «-».
  const [awardAmount, setAwardAmount] = React.useState('100');
  const [awardWhat, setAwardWhat] = React.useState('');
  const expInputRef = React.useRef<HTMLInputElement>(null);
  const totalExpInputRef = React.useRef<HTMLInputElement>(null);

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

  // «Потрачено опыта» вне режима правки — текст, поэтому черновик обязан
  // догонять сохранённое значение: иначе ранг считался бы по старому числу
  // после правки из журнала опыта или из другой вкладки.
  React.useEffect(() => {
    if (
      typeof document !== 'undefined' &&
      document.activeElement === totalExpInputRef.current
    )
      return;
    setEditableTotalExpSpent(character.totalExpSpent ?? 0);
  }, [character.totalExpSpent]);

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
  // Ранг считается по графу: он знает сходимости и карьерно-зависимые
  // подписи, а старые таблицы остаются источником имён веток для диалогов.
  const currentRankNode = rankStateForCharacter({
    ...character,
    totalExpSpent: editableTotalExpSpent,
    advancedPath: editableAdvancedPath ?? character.advancedPath,
    alternatePath: editableAlternatePath ?? character.alternatePath,
  }).node;
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
    if (spendAmount <= 0) return;
    const label = spendWhat.trim() || t('dh1.manualPurchase');
    const newTotalExp = editableTotalExpSpent + spendAmount;
    setEditableTotalExpSpent(newTotalExp);
    if (newTotalExp < advancedPathThreshold) setEditableAdvancedPath(null);
    updateCharacter(character.id, {
      totalExpSpent: newTotalExp,
      experienceLog: [
        ...(character.experienceLog ?? []),
        {
          id: `xp:${Date.now()}`,
          label,
          cost: spendAmount,
          createdAt: new Date().toISOString(),
        },
      ],
      advancedPath:
        newTotalExp < advancedPathThreshold
          ? (editableAdvancedPath ?? null)
          : (editableAdvancedPath ?? character.advancedPath ?? null),
      alternatePath: editableAlternatePath ?? character.alternatePath ?? null,
    });
    setSpendAmount(0);
    setSpendWhat('');
    setIsSpendOpen(false);
  };

  const handleAwardExp = () => {
    const amount = Number.parseInt(awardAmount, 10) || 0;
    if (amount === 0) return;
    const label = awardWhat.trim() || t('dh1.experienceAward');
    updateCharacter(character.id, {
      experience: (character.experience ?? 0) + amount,
      experienceLog: [
        ...(character.experienceLog ?? []),
        {
          id: `xp-award:${Date.now()}`,
          label,
          cost: amount,
          createdAt: new Date().toISOString(),
          kind: 'award',
        },
      ],
    });
    setIsAwardOpen(false);
    setAwardAmount('100');
    setAwardWhat('');
  };

  const handleDeleteExperience = (entryId: string) => {
    const entry = (character.experienceLog ?? []).find(
      (item) => item.id === entryId,
    );
    if (!entry) return;
    if (entry.kind === 'award') {
      // Удаление начисления снимает ровно добавленное (штраф вернётся со
      // знаком: cost < 0 → experience += |cost|).
      updateCharacter(character.id, {
        experience: (character.experience ?? 0) - entry.cost,
        experienceLog: (character.experienceLog ?? []).filter(
          (item) => item.id !== entryId,
        ),
      });
      return;
    }
    const newTotalExp = Math.max(0, editableTotalExpSpent - entry.cost);
    setEditableTotalExpSpent(newTotalExp);
    updateCharacter(character.id, {
      totalExpSpent: newTotalExp,
      experienceLog: (character.experienceLog ?? []).filter(
        (item) => item.id !== entryId,
      ),
    });
  };

  // ─── LANDMARK: CURRENT_EXP_AUTOSAVE ───
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

  const availableExp = editableExperience - editableTotalExpSpent;

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
    !isPhoneView || activeCompactSection === 'progression-section';
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
            {t('dh1.experience')}
          </CardTitle>
          <TooltipProvider delayDuration={0}>
            <div className="flex items-center justify-end gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t('dh1.addExperience')}
                    onClick={() => {
                      setAwardAmount('100');
                      setAwardWhat('');
                      setIsAwardOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('dh1.addExperience')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t('dh1.spendExp')}
                    onClick={() => setIsSpendOpen(true)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('dh1.spendExp')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t('dh1.experienceLog')}
                    onClick={() => setIsJournalOpen(true)}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('dh1.experienceLog')}
                </TooltipContent>
              </Tooltip>
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
            </div>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <Label
                htmlFor={isProgressionEditing ? 'current-exp-edit' : undefined}
                className="text-muted-foreground text-xs"
              >
                {t('dh1.currentExp')}
              </Label>
              {isProgressionEditing ? (
                <Input
                  id="current-exp-edit"
                  ref={expInputRef}
                  type="number"
                  min={0}
                  value={editableExperience === 0 ? '' : editableExperience}
                  onChange={handleCurrentExpChange}
                  className="h-9"
                />
              ) : (
                <p
                  data-testid="current-exp-value"
                  className="text-sm font-medium"
                >
                  {editableExperience}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={isProgressionEditing ? 'total-exp-edit' : undefined}
                className="text-muted-foreground text-xs"
              >
                {t('dh1.totalExpSpent')}
              </Label>
              {isProgressionEditing ? (
                <Input
                  id="total-exp-edit"
                  ref={totalExpInputRef}
                  type="number"
                  value={
                    editableTotalExpSpent === 0 ? '' : editableTotalExpSpent
                  }
                  onChange={handleTotalExpChange}
                  onBlur={handleSaveTotalExp}
                  className="h-9"
                />
              ) : (
                <p
                  data-testid="total-exp-spent-value"
                  className="text-sm font-medium"
                >
                  {editableTotalExpSpent}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {t('dh1.availableExp')}
              </Label>
              <p
                data-testid="available-exp"
                className={cn(
                  'text-sm font-semibold',
                  availableExp < 0 ? 'text-destructive' : 'text-primary',
                )}
              >
                {availableExp}
              </p>
            </div>

            {/* ========== RANK DISPLAY SECTION START ========== */}
            <div className="space-y-1 border-t pt-2">
              <Label className="text-muted-foreground text-xs">
                {t('dh1.rank')}
              </Label>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium break-words">
                    {currentRankNode
                      ? t(currentRankNode.labelKey)
                      : t('dh1.unknownRank')}
                  </p>

                  {(editableAdvancedPath ?? character.advancedPath) ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        {t('dh1.advancedPath')}:{' '}
                      </span>
                      {t(
                        RANK_KEYS[
                          editableAdvancedPath ?? character.advancedPath!
                        ] ||
                          (editableAdvancedPath ?? character.advancedPath!),
                      )}
                    </p>
                  ) : (
                    isProgressionEditing &&
                    editableTotalExpSpent >= advancedPathThreshold && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setIsAdvancedPathModalOpen(true)}
                      >
                        {t('dh1.selectAdvancedPath')}
                      </Button>
                    )
                  )}

                  {(editableAlternatePath ?? character.alternatePath) && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        {t('dh1.alternatePath')}:{' '}
                      </span>
                      {t(
                        RANK_KEYS[
                          editableAlternatePath ?? character.alternatePath!
                        ] ||
                          (editableAlternatePath ?? character.alternatePath!),
                      )}
                    </p>
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
                        ? t('dh1.changeAlternateRank')
                        : t('dh1.selectAlternateRank')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {/* ========== RANK DISPLAY SECTION END ========== */}
          </div>
        </CardContent>
      </Card>

      <ChoiceDialog
        open={isAdvancedPathModalOpen}
        onOpenChange={setIsAdvancedPathModalOpen}
        title={t('dh1.selectAdvancedPathTitle')}
        description={t('dh1.selectAdvancedPathDesc')}
        cancelLabel={t('common.cancel')}
        testId="advanced-path-dialog"
        options={
          possibleAdvancedPaths
            ? Object.values(possibleAdvancedPaths).map((path) => ({
                value: path.name,
                label: `${t('dh1.choose')} ${t(RANK_KEYS[path.name] || path.name)}`,
              }))
            : []
        }
        onSelect={handleSelectAdvancedPath}
      />

      <ChoiceDialog
        open={isAlternateRankModalOpen}
        onOpenChange={setIsAlternateRankModalOpen}
        title={t('dh1.selectAlternateRankTitle')}
        description={t('dh1.selectAlternateRankDesc')}
        cancelLabel={t('common.cancel')}
        testId="alternate-rank-dialog"
        options={[
          {
            value: 'Inditor',
            label: `${t('dh1.choose')} ${t('dh1.rankInditor')}`,
          },
          {
            value: 'Chirurgeon',
            label: `${t('dh1.choose')} ${t('dh1.rankChirurgeon')}`,
          },
        ]}
        onSelect={(value) =>
          handleSelectAlternateRank(value === 'Inditor' ? null : value)
        }
      />

      <Dialog open={isSpendOpen} onOpenChange={setIsSpendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh1.spendExp')}</DialogTitle>
            <DialogDescription>{t('dh1.spendHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="spend-amount">{t('dh1.spendAmount')}</Label>
              <Input
                id="spend-amount"
                type="number"
                min={0}
                defaultValue={0}
                onChange={(e) =>
                  setSpendAmount(parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="spend-what">{t('dh1.spendWhat')}</Label>
              <Input
                id="spend-what"
                defaultValue=""
                onChange={(e) => setSpendWhat(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSpendExp}>
              {t('dh1.spendConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAwardOpen} onOpenChange={setIsAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh1.addExperience')}</DialogTitle>
            <DialogDescription>{t('dh1.addExperienceHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="award-amount">{t('dh1.spendAmount')}</Label>
              <Input
                id="award-amount"
                type="number"
                step={1}
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="award-what">{t('dh1.addExperienceWhat')}</Label>
              <Input
                id="award-what"
                value={awardWhat}
                onChange={(e) => setAwardWhat(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleAwardExp}>
              {t('dh1.addExperienceConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExperienceLogSheet
        open={isJournalOpen}
        onOpenChange={setIsJournalOpen}
        title={t('dh1.experienceLog')}
        description={t('dh1.experienceLogHint')}
        empty={t('dh1.experienceLogEmpty')}
        deleteLabel={t('dh1.deleteExperienceEntry')}
        language={language}
        rows={dh1ExperienceRows(character.experienceLog)}
        onDelete={handleDeleteExperience}
      />
    </>
  );
};
