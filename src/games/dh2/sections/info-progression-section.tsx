'use client';

import * as React from 'react';

import { BookOpen, Lock, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

import { applyAptitudeChoice, isAptitudeLocked } from '../aptitudes-sheet';
import { characteristicAptitudes, deriveAptitudes } from '../dh2e-aptitudes';
import {
  DH2E_BACKGROUNDS,
  DH2E_CHARACTERISTICS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from '../dh2e-data';
import { startingChoiceLabels } from '../dh2e-grants';
import {
  aptitudeLabel,
  aptitudeLabels,
  backgroundLabel,
  divinationEffectLabel,
  divinationLabel,
  eliteAdvanceLabel,
  homeWorldLabel,
  roleLabel,
  talentLabel,
} from '../dh2e-labels';
import type { Dh2eEliteAdvance, Dh2eEliteRequirement } from '../dh2e-types';
import {
  availableEliteAdvances,
  buyEliteAdvance,
  eliteById,
  eliteRequirementIssues,
  removeEliteAdvance,
  removeEliteJournalEntry,
} from '../elite';
import { dh2ExperienceRows } from '../experience';
import { isCreationFieldLocked } from '../field-policy';
import { genderLabel, genderOptions, toGenderCode } from '../gender';
import {
  buyPsyRating,
  formatPsyList,
  parsePsyList,
  psyRatingCost,
} from '../psy';
import { statTotal } from '../stats';
import type { DH2Character } from '../types';
import { EditSaveButton } from './dh-ui-helpers';

interface SectionProps {
  character: DH2Character;
  isCompactView: boolean;
  activeCompactSection?: string;
  onEditingChange?: (val: boolean) => void;
  /** Импортированный лист проверяется: creation-замки временно открыты. */
  creationReview?: boolean;
}

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
  editing,
  onChange,
  onBlur,
  isCompactView,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  isCompactView: boolean;
}) => {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <Label
        htmlFor={editing ? id : undefined}
        className={cn(
          'text-muted-foreground text-xs',
          isCompactView && 'text-[10px]',
        )}
      >
        {label}
      </Label>
      {editing ? (
        <Input
          id={id}
          defaultValue={value}
          onChange={onChange}
          onBlur={onBlur}
          className={cn('h-8', isCompactView && 'h-7 text-xs')}
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
};

const ReadOnlyField = ({
  label,
  value,
  isCompactView,
}: {
  label: string;
  value: string;
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
    <p
      className={cn(
        'text-sm font-medium break-words',
        isCompactView && 'text-xs',
      )}
    >
      {value || '-'}
    </p>
  </div>
);

/**
 * Поле создания: пока пусто и идёт редактирование — Select; заданное
 * значение read-only с замком «выбрано при создании». Производные (aptitudes,
 * starting choices) при дозаполнении не пересчитываются.
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
  const lockHint = t(lockHintKey ?? 'dh2.chosenAtCreation');
  const id = React.useId();

  return (
    <div className="space-y-1">
      <Label
        htmlFor={locked || !editing ? undefined : id}
        className={cn(
          'text-muted-foreground text-xs',
          isCompactView && 'text-[10px]',
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
            <span className="text-muted-foreground ml-1 text-[10px] uppercase">
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
          <SelectTrigger id={id} className="h-8">
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

/** Компактный блок полей листа: заголовок + сетка полей. */
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

export const InfoSection = ({
  character,
  isCompactView,
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
      add: t('dh2.conditions.add'),
      empty: t('dh2.conditions.empty'),
      name: t('dh2.conditions.name'),
      kind: t('dh2.conditions.kind'),
      severity: t('dh2.conditions.severity'),
      effect: t('dh2.conditions.effect'),
      notes: t('dh2.conditions.notes'),
      source: t('dh2.conditions.source'),
      remove: t('dh2.conditions.remove'),
      kindLabels: {
        disorder: t('dh2.conditions.kind.disorder'),
        corruption: t('dh2.conditions.kind.corruption'),
        mutation: t('dh2.conditions.kind.mutation'),
        rudiment: t('dh2.conditions.kind.rudiment'),
        implant: t('dh2.conditions.kind.implant'),
        blessing: t('dh2.conditions.kind.blessing'),
      },
      sourceLabels: {
        manual: t('dh2.conditions.source.manual'),
        divination: t('dh2.conditions.source.divination'),
        legacy: t('dh2.conditions.source.legacy'),
      },
    }),
    [t],
  );

  const showInfo = !isCompactView || activeCompactSection === 'info-section';
  if (!showInfo) return null;

  const backgroundEntry = DH2E_BACKGROUNDS.find(
    (item) => item.id === character.background,
  );
  const roleTalent = character.startingChoices?.roleTalent
    ? talentLabel(character.startingChoices.roleTalent, t)
    : '';
  const chosenSkills = startingChoiceLabels(
    backgroundEntry,
    'skill',
    character.startingChoices?.skills,
    t,
  );
  const chosenTalents = startingChoiceLabels(
    backgroundEntry,
    'talent',
    character.startingChoices?.talents,
    t,
  );

  const worldEntry = DH2E_HOMEWORLDS.find(
    (item) => item.id === character.homeWorld,
  );
  const roleEntry = DH2E_ROLES.find((item) => item.id === character.role);
  const chosenMap = character.aptitudes.chosen ?? {};
  const derivedAptitudes = deriveAptitudes(
    {
      homeWorld: character.homeWorld,
      background: character.background,
      role: character.role,
    },
    chosenMap,
    { fallbackToFirst: true },
  );
  const backgroundValue =
    backgroundEntry && backgroundEntry.aptitudeChoice.length > 0
      ? backgroundEntry.aptitudeChoice.includes(chosenMap.background)
        ? chosenMap.background
        : backgroundEntry.aptitudeChoice[0]
      : undefined;
  const roleSlots = (roleEntry?.aptitudes ?? []).map((slot, index) => {
    if (typeof slot === 'string') {
      return {
        index,
        key: '',
        value: slot,
        options: [] as readonly string[],
        choice: false,
      };
    }
    const key = `role.${index}`;
    const value =
      chosenMap[key] && slot.of.includes(chosenMap[key])
        ? chosenMap[key]
        : slot.of[0];
    return { index, key, value, options: slot.of, choice: slot.of.length > 1 };
  });
  const duplicateAptitudes = [...new Set(derivedAptitudes.duplicates)];

  const applyAptitude = (key: string, value: string) => {
    updateCharacter(character.id, applyAptitudeChoice(character, key, value));
  };

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
            <MetaBlock title={t('dh2.personalSection')}>
              <DetailField
                label={t('common.characterName')}
                value={character.name}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { name: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <CreationField
                label={t('dh2.gender')}
                value={genderLabel(character.gender, t)}
                selectedValue={character.gender}
                placeholder={t('dh2.selectGender')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.gender)
                }
                isCompactView={isCompactView}
                options={genderOptions(t)}
                onSelect={(next) =>
                  updateCharacter(character.id, { gender: toGenderCode(next) })
                }
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
                label={t('dh2.skinColor')}
                value={character.skinColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { skinColor: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh2.hairColor')}
                value={character.hairColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { hairColor: e.target.value })
                }
                isCompactView={isCompactView}
              />
              <DetailField
                label={t('dh2.eyeColor')}
                value={character.eyeColor}
                editing={isInfoEditing}
                onBlur={(e) =>
                  updateCharacter(character.id, { eyeColor: e.target.value })
                }
                isCompactView={isCompactView}
              />
            </MetaBlock>

            <MetaBlock title={t('dh2.creationSection')}>
              <CreationField
                label={t('dh2.homeWorld')}
                value={
                  character.homeWorld
                    ? homeWorldLabel(character.homeWorld, t)
                    : ''
                }
                selectedValue={character.homeWorld}
                placeholder={t('dh2.waitingHomeWorld')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.homeWorld)
                }
                isCompactView={isCompactView}
                options={DH2E_HOMEWORLDS.map((world) => ({
                  value: world.id,
                  label: homeWorldLabel(world.id, t),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { homeWorld: next })
                }
              />
              <CreationField
                label={t('dh2.background')}
                value={
                  character.background
                    ? backgroundLabel(character.background, t)
                    : ''
                }
                selectedValue={character.background}
                placeholder={t('dh2.background')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.background)
                }
                isCompactView={isCompactView}
                options={DH2E_BACKGROUNDS.map((background) => ({
                  value: background.id,
                  label: backgroundLabel(background.id, t),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { background: next })
                }
              />
              <CreationField
                label={t('dh2.role')}
                value={character.role ? roleLabel(character.role, t) : ''}
                selectedValue={character.role}
                placeholder={t('dh2.role')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.role)
                }
                isCompactView={isCompactView}
                options={DH2E_ROLES.map((role) => ({
                  value: role.id,
                  label: roleLabel(role.id, t),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { role: next })
                }
              />
              <ReadOnlyField
                label={t('dh2.aptitudes')}
                value={aptitudeLabels(character.aptitudes.profile, t)}
                isCompactView={isCompactView}
              />
              {roleTalent && (
                <ReadOnlyField
                  label={t('dh2.roleTalent')}
                  value={roleTalent}
                  isCompactView={isCompactView}
                />
              )}
              {chosenSkills.length > 0 && (
                <ReadOnlyField
                  label={t('dh2.startingSkillsChosen')}
                  value={chosenSkills.join(', ')}
                  isCompactView={isCompactView}
                />
              )}
              {chosenTalents.length > 0 && (
                <ReadOnlyField
                  label={t('dh2.startingTalentsChosen')}
                  value={chosenTalents.join(', ')}
                  isCompactView={isCompactView}
                />
              )}
              <ReadOnlyField
                label={t('dh2.eliteAdvances')}
                value={character.eliteAdvances
                  .map((id) => eliteAdvanceLabel(id, t))
                  .join(', ')}
                isCompactView={isCompactView}
              />
              <CreationField
                label={t('dh2.divination')}
                value={
                  character.divinationText?.[language] ??
                  divinationLabel(character.divination, t)
                }
                sample={!character.divinationText?.[language]}
                selectedValue={character.divination}
                placeholder={t('dh2.selectDivination')}
                editing={isInfoEditing}
                locked={
                  !creationReview && isCreationFieldLocked(character.divination)
                }
                isCompactView={isCompactView}
                options={DH2E_DIVINATIONS.map((divination) => ({
                  value: divination.id,
                  label: divinationLabel(divination.id, t),
                }))}
                onSelect={(next) =>
                  updateCharacter(character.id, { divination: next })
                }
              />
              <DetailField
                label={t('dh2.divinationText')}
                value={character.divinationText?.[language] ?? ''}
                editing={isInfoEditing}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  const current = character.divinationText ?? {};
                  updateCharacter(character.id, {
                    divinationText: next
                      ? { ...current, [language]: next }
                      : current,
                  });
                }}
                isCompactView={isCompactView}
              />
              <ReadOnlyField
                label={t('dh2.divinationEffect')}
                value={
                  character.divinationEffectText?.[language] ??
                  divinationEffectLabel(character.divination, t)
                }
                isCompactView={isCompactView}
              />
              <div className="col-span-2 space-y-2 md:col-span-3">
                <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
                  <h4 className="text-sm font-medium">{t('dh2.aptitudes')}</h4>
                  <p className="text-sm font-medium break-words">
                    {aptitudeLabels(character.aptitudes.profile, t) || '-'}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {worldEntry && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('dh2.homeWorld')}:{' '}
                        </span>
                        {homeWorldLabel(worldEntry.id, t)} —{' '}
                        {aptitudeLabel(worldEntry.aptitudeId, t)}
                      </li>
                    )}
                    {backgroundEntry && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('dh2.background')}:{' '}
                        </span>
                        {backgroundLabel(backgroundEntry.id, t)} —{' '}
                        {backgroundValue
                          ? aptitudeLabel(backgroundValue, t)
                          : '-'}
                      </li>
                    )}
                    {roleEntry && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('dh2.role')}:{' '}
                        </span>
                        {roleLabel(roleEntry.id, t)}
                      </li>
                    )}
                  </ul>

                  {backgroundEntry &&
                    backgroundEntry.aptitudeChoice.length > 1 && (
                      <CreationField
                        label={t('dh2.backgroundAptitude')}
                        value={
                          backgroundValue
                            ? aptitudeLabel(backgroundValue, t)
                            : ''
                        }
                        selectedValue={backgroundValue}
                        placeholder={t('dh2.choosePrompt')}
                        editing={isInfoEditing}
                        locked={
                          !creationReview &&
                          isAptitudeLocked(character, 'background')
                        }
                        lockHintKey="dh2.chosenAptitudeLocked"
                        isCompactView={isCompactView}
                        options={backgroundEntry.aptitudeChoice.map((id) => ({
                          value: id,
                          label: aptitudeLabel(id, t),
                        }))}
                        onSelect={(value) => applyAptitude('background', value)}
                      />
                    )}

                  {roleSlots.some((slot) => slot.choice) && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        {t('dh2.roleAptitudes')}
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {roleSlots
                          .filter((slot) => slot.choice)
                          .map((slot) => (
                            <CreationField
                              key={slot.key}
                              label={`${t('dh2.roleAptitude')} ${slot.index + 1}`}
                              value={aptitudeLabel(slot.value, t)}
                              selectedValue={slot.value}
                              placeholder={t('dh2.choosePrompt')}
                              editing={isInfoEditing}
                              locked={
                                !creationReview &&
                                isAptitudeLocked(character, slot.key)
                              }
                              lockHintKey="dh2.chosenAptitudeLocked"
                              isCompactView={isCompactView}
                              options={slot.options.map((id) => ({
                                value: id,
                                label: aptitudeLabel(id, t),
                              }))}
                              onSelect={(value) =>
                                applyAptitude(slot.key, value)
                              }
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {duplicateAptitudes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-destructive text-xs">
                        {t('dh2.duplicates')}:{' '}
                        {duplicateAptitudes
                          .map((id) => aptitudeLabel(id, t))
                          .join(', ')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t('dh2.duplicatesHint')}
                      </p>
                      {duplicateAptitudes.map((duplicate) => {
                        const key = `duplicate.${duplicate}`;
                        const current = chosenMap[key];
                        const locked =
                          !creationReview && isAptitudeLocked(character, key);
                        // Выбранную замену видно и в режиме чтения (с замком),
                        // пустую предлагаем только при редактировании.
                        if (!isInfoEditing && !locked) return null;
                        const options = characteristicAptitudes().filter(
                          (id) =>
                            !derivedAptitudes.profile.includes(id) ||
                            id === current,
                        );
                        return options.length > 0 ? (
                          <CreationField
                            key={key}
                            label={`${t('dh2.duplicateAptitude')}: ${aptitudeLabel(duplicate, t)}`}
                            value={current ? aptitudeLabel(current, t) : ''}
                            selectedValue={current}
                            placeholder={t('dh2.chooseReplacement')}
                            editing={isInfoEditing}
                            locked={locked}
                            lockHintKey="dh2.chosenAptitudeLocked"
                            isCompactView={isCompactView}
                            options={options.map((id) => ({
                              value: id,
                              label: aptitudeLabel(id, t),
                            }))}
                            onSelect={(value) => applyAptitude(key, value)}
                          />
                        ) : (
                          <p key={key} className="text-destructive text-xs">
                            {t('dh2.noFreeAptitudes')}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </MetaBlock>

            <MetaBlock
              title={t('dh2.condition')}
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
              <div className="col-span-2 md:col-span-3">
                <div className="mt-4">
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
      </CardContent>

      <NarrativeSheet
        open={isBackstoryOpen}
        onOpenChange={setIsBackstoryOpen}
        title={t('common.backstory')}
        description={t('common.backstory')}
        value={character.backstory ?? ''}
        onSave={(next) => updateCharacter(character.id, { backstory: next })}
      />
    </Card>
  );
};

/** Текст одной причины: подпись требования из каталога, не сырой код. */
function eliteIssueText(
  requirement: Dh2eEliteRequirement,
  t: (key: string) => string,
): string {
  switch (requirement.kind) {
    case 'background':
      return `${t('dh2.eliteIssueBackground')}: ${backgroundLabel(
        requirement.backgroundId,
        t,
      )}`;
    case 'gender':
      return `${t('dh2.eliteIssueGender')}: ${genderLabel(requirement.gender, t)}`;
    case 'characteristic': {
      const characteristic = DH2E_CHARACTERISTICS.find(
        (item) => item.id === requirement.characteristic,
      );
      const label = characteristic
        ? t(characteristic.labelKey)
        : requirement.characteristic;
      return `${t('dh2.eliteIssueCharacteristic')}: ${label} ${requirement.min}`;
    }
    case 'elite':
      return `${t('dh2.eliteIssueElite')}: ${eliteAdvanceLabel(
        requirement.eliteId,
        t,
      )}`;
    case 'notElite':
      return `${t('dh2.eliteIssueConflict')}: ${eliteAdvanceLabel(
        requirement.eliteId,
        t,
      )}`;
    case 'trait':
      return `${t('dh2.eliteIssueTrait')}: ${requirement.traitId}`;
  }
}

/**
 * Красные причины конфликта с бэкграундом/полом/характеристиками/другим
 * элитным. Покупку не блокируют: ГМ мог разрешить исключение.
 */
const EliteRequirementWarnings = ({
  character,
  elite,
}: {
  character: DH2Character;
  elite: Dh2eEliteAdvance;
}) => {
  const { t } = useTranslation();
  const issues = eliteRequirementIssues(character, elite);
  if (issues.length === 0) return null;

  return (
    <div
      className="text-destructive space-y-1 text-xs"
      data-testid="elite-warning"
    >
      <p className="font-medium">{t('dh2.eliteWarningTitle')}</p>
      <ul className="space-y-0.5">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            • {eliteIssueText(issue.requirement, t)}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">{t('dh2.eliteWarningBuyAnyway')}</p>
    </div>
  );
};

export const ProgressionSection = ({
  character,
  isCompactView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t, language } = useTranslation();
  const psyFieldId = React.useId();
  const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
  const [isSpendOpen, setIsSpendOpen] = React.useState(false);
  const [isJournalOpen, setIsJournalOpen] = React.useState(false);
  const [spendAmount, setSpendAmount] = React.useState(0);
  const [spendWhat, setSpendWhat] = React.useState('');
  const [isAwardOpen, setIsAwardOpen] = React.useState(false);
  // Строкой, а не числом: иначе нельзя ввести минус или промежуточное «-».
  const [awardAmount, setAwardAmount] = React.useState('100');
  const [awardWhat, setAwardWhat] = React.useState('');
  const [eliteToAdd, setEliteToAdd] = React.useState('');

  React.useEffect(() => {
    onEditingChange?.(isProgressionEditing);
  }, [isProgressionEditing, onEditingChange]);

  const available =
    (character.experience ?? 0) - (character.totalExpSpent ?? 0);

  const handleAwardExp = () => {
    const amount = Number.parseInt(awardAmount, 10) || 0;
    if (amount === 0) return;
    const note = awardWhat.trim() || t('dh2.experienceKind.award');
    updateCharacter(character.id, {
      experience: (character.experience ?? 0) + amount,
      experienceLog: [
        ...character.experienceLog,
        {
          id: `award:${Date.now()}`,
          kind: 'award',
          ref: note,
          cost: amount,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setIsAwardOpen(false);
    setAwardAmount('100');
    setAwardWhat('');
  };

  const handleDeleteExperience = (entryId: string) => {
    const entry = character.experienceLog.find((item) => item.id === entryId);
    if (!entry) return;
    if (entry.kind === 'award') {
      // Удаление начисления снимает ровно добавленное (штраф вернётся со
      // знаком: cost < 0 → experience += |cost|).
      updateCharacter(character.id, {
        experience: (character.experience ?? 0) - entry.cost,
        experienceLog: character.experienceLog.filter(
          (item) => item.id !== entryId,
        ),
      });
      return;
    }
    if (entry.kind === 'elite-advance') {
      // Второй путь удаления элитного: без снятия id профиль и журнал
      // разошлись бы.
      const removal = removeEliteJournalEntry(character, entryId);
      if (removal) updateCharacter(character.id, removal);
      return;
    }
    updateCharacter(character.id, {
      totalExpSpent: Math.max(0, character.totalExpSpent - entry.cost),
      experienceLog: character.experienceLog.filter(
        (item) => item.id !== entryId,
      ),
    });
  };

  const handleSpend = () => {
    if (spendAmount <= 0) return;
    const note = spendWhat.trim();
    updateCharacter(character.id, {
      totalExpSpent: character.totalExpSpent + spendAmount,
      experienceLog: [
        ...character.experienceLog,
        {
          id: `manual:${Date.now()}`,
          kind: 'other',
          ref: note || t('dh2.experienceKind.other'),
          cost: spendAmount,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setSpendAmount(0);
    setSpendWhat('');
    setIsSpendOpen(false);
  };

  // Следующая ступень пси-рейтинга: цена — подсказка, списание — в журнал.
  // Доступный опыт не блокирует покупку: это решает стол.
  const nextPsyRating = (character.psy?.rating ?? 0) + 1;
  const nextPsyCost = psyRatingCost(nextPsyRating);
  const willpowerTotal = statTotal(character, 'willpower');

  const handleRaisePsyRating = () => {
    const purchase = buyPsyRating(character, t('dh2.psyRating'));
    updateCharacter(character.id, purchase.patch);
  };

  const savePsyList = (field: 'disciplines' | 'powers', raw: string): void => {
    updateCharacter(character.id, {
      psy: { ...character.psy, [field]: parsePsyList(raw) },
    });
  };

  const availableElites = availableEliteAdvances(character.eliteAdvances);
  const selectedElite = eliteToAdd ? eliteById(eliteToAdd) : undefined;

  const handleAddElite = () => {
    if (!selectedElite) return;
    const purchase = buyEliteAdvance(
      character,
      selectedElite.id,
      t(selectedElite.labelKey),
    );
    if (!purchase) return;
    updateCharacter(character.id, purchase.patch);
    setEliteToAdd('');
  };

  const handleRemoveElite = (eliteId: string) => {
    updateCharacter(character.id, removeEliteAdvance(character, eliteId));
  };

  const showProgression =
    !isCompactView || activeCompactSection === 'progression-section';
  if (!showProgression) return null;

  return (
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
          {t('dh2.experience')}
        </CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAwardAmount('100');
              setAwardWhat('');
              setIsAwardOpen(true);
            }}
          >
            {t('dh2.addExperience')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSpendOpen(true)}
          >
            {t('dh2.spendExp')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsJournalOpen(true)}
          >
            {t('dh2.experienceLog')}
          </Button>
          {(showEditButtons || isProgressionEditing) && (
            <EditSaveButton
              editing={isProgressionEditing}
              onEdit={() => setIsProgressionEditing(true)}
              onSave={() => setIsProgressionEditing(false)}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.currentExp')}
            </Label>
            {isProgressionEditing ? (
              <Input
                type="number"
                defaultValue={character.experience ?? 0}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    experience: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="h-8"
              />
            ) : (
              <p
                data-testid="current-exp-value"
                className="text-sm font-medium"
              >
                {character.experience ?? 0}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.totalExpSpent')}
            </Label>
            {isProgressionEditing ? (
              <Input
                type="number"
                defaultValue={character.totalExpSpent ?? 0}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    totalExpSpent: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="h-8"
              />
            ) : (
              <p
                data-testid="total-exp-spent-value"
                className="text-sm font-medium"
              >
                {character.totalExpSpent ?? 0}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.availableExp')}
            </Label>
            <p
              data-testid="available-exp"
              className={cn(
                'text-sm font-semibold',
                available < 0 ? 'text-destructive' : 'text-primary',
              )}
            >
              {available}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium">{t('dh2.psySection')}</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRaisePsyRating}
            >
              {t('dh2.raisePsyRating')}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {t('dh2.nextPsyRating')}: {nextPsyRating} · {nextPsyCost}{' '}
            {t('dh2.xpAbbr')}. {t('dh2.psyPurchaseHint')}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label
                htmlFor={`${psyFieldId}-rating`}
                className="text-muted-foreground text-xs"
              >
                {t('dh2.psyRating')}
              </Label>
              {isProgressionEditing ? (
                <Input
                  id={`${psyFieldId}-rating`}
                  key={character.psy.rating}
                  type="number"
                  min={0}
                  defaultValue={character.psy.rating}
                  onBlur={(e) =>
                    updateCharacter(character.id, {
                      psy: {
                        ...character.psy,
                        rating: Math.max(0, parseInt(e.target.value, 10) || 0),
                      },
                    })
                  }
                  className="h-8"
                />
              ) : (
                <p className="text-sm font-medium">
                  {character.psy.rating || '-'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {t('dh2.focusPowerTest')}
              </Label>
              <p className="text-sm font-medium">
                {t('dh2.willpower')} {willpowerTotal}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('dh2.focusPowerHint')}
              </p>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`${psyFieldId}-disciplines`}
                className="text-muted-foreground text-xs"
              >
                {t('dh2.psyDisciplines')}
              </Label>
              {isProgressionEditing ? (
                <Input
                  id={`${psyFieldId}-disciplines`}
                  defaultValue={formatPsyList(character.psy.disciplines)}
                  onBlur={(e) => savePsyList('disciplines', e.target.value)}
                  className="h-8"
                />
              ) : (
                <p className="text-sm font-medium break-words">
                  {formatPsyList(character.psy.disciplines) || '-'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`${psyFieldId}-powers`}
                className="text-muted-foreground text-xs"
              >
                {t('dh2.psyPowers')}
              </Label>
              {isProgressionEditing ? (
                <Input
                  id={`${psyFieldId}-powers`}
                  defaultValue={formatPsyList(character.psy.powers)}
                  onBlur={(e) => savePsyList('powers', e.target.value)}
                  className="h-8"
                />
              ) : (
                <p className="text-sm font-medium break-words">
                  {formatPsyList(character.psy.powers) || '-'}
                </p>
              )}
            </div>
          </div>
          {isProgressionEditing && (
            <p className="text-muted-foreground text-xs">
              {t('dh2.psyFreeTextHint')}
            </p>
          )}
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="text-sm font-medium">{t('dh2.eliteAdvances')}</h4>
          {character.eliteAdvances.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t('dh2.noEliteAdvances')}
            </p>
          ) : (
            <ul className="space-y-2">
              {character.eliteAdvances.map((eliteId) => {
                const elite = eliteById(eliteId);
                return (
                  <li key={eliteId} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {elite ? t(elite.labelKey) : eliteId}
                        {elite ? ` · ${elite.cost} ${t('dh2.xpAbbr')}` : ''}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('dh2.removeEliteAdvance')}
                        onClick={() => handleRemoveElite(eliteId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {elite && (
                      <>
                        <p className="text-muted-foreground text-xs">
                          {t(`dh2.elitePrereq.${elite.id}`)}
                        </p>
                        <EliteRequirementWarnings
                          character={character}
                          elite={elite}
                        />
                        <p className="text-muted-foreground text-xs">
                          {t('dh2.instantChangesHint')}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {elite.changeKeys.map((key) => (
                            <li key={key}>• {t(key)}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {character.eliteAdvances.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {t('dh2.eliteRemoveHint')}
            </p>
          )}
          {availableElites.length > 0 && (
            <div className="space-y-2">
              <Select value={eliteToAdd} onValueChange={setEliteToAdd}>
                <SelectTrigger aria-label={t('dh2.selectEliteAdvance')}>
                  <SelectValue placeholder={t('dh2.selectEliteAdvance')} />
                </SelectTrigger>
                <SelectContent>
                  {availableElites.map((elite) => (
                    <SelectItem key={elite.id} value={elite.id}>
                      {t(elite.labelKey)} · {elite.cost} {t('dh2.xpAbbr')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedElite && (
                <div className="space-y-1 text-xs">
                  <p className="font-medium">{t('dh2.gmApprovalRequired')}</p>
                  <p className="text-muted-foreground">
                    {t(`dh2.elitePrereq.${selectedElite.id}`)}
                  </p>
                  <EliteRequirementWarnings
                    character={character}
                    elite={selectedElite}
                  />
                  <p className="text-muted-foreground">
                    {t('dh2.instantChangesHint')}
                  </p>
                  <ul className="space-y-0.5">
                    {selectedElite.changeKeys.map((key) => (
                      <li key={key}>• {t(key)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddElite}
                disabled={!selectedElite}
              >
                {t('dh2.addEliteAdvance')}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <Dialog open={isSpendOpen} onOpenChange={setIsSpendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh2.spendExp')}</DialogTitle>
            <DialogDescription>{t('dh2.spendHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="spend-amount">{t('dh2.spendAmount')}</Label>
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
              <Label htmlFor="spend-what">{t('dh2.spendWhat')}</Label>
              <Input
                id="spend-what"
                defaultValue=""
                onChange={(e) => setSpendWhat(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSpend}>
              {t('dh2.spendConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAwardOpen} onOpenChange={setIsAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh2.addExperience')}</DialogTitle>
            <DialogDescription>{t('dh2.addExperienceHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="award-amount">{t('dh2.spendAmount')}</Label>
              <Input
                id="award-amount"
                type="number"
                step={1}
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="award-what">{t('dh2.addExperienceWhat')}</Label>
              <Input
                id="award-what"
                value={awardWhat}
                onChange={(e) => setAwardWhat(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleAwardExp}>
              {t('dh2.addExperienceConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExperienceLogSheet
        open={isJournalOpen}
        onOpenChange={setIsJournalOpen}
        title={t('dh2.experienceLog')}
        description={t('dh2.experienceLogHint')}
        empty={t('dh2.experienceLogEmpty')}
        deleteLabel={t('dh2.deleteExperienceEntry')}
        language={language}
        rows={dh2ExperienceRows(character.experienceLog, t)}
        onDelete={handleDeleteExperience}
      />
    </Card>
  );
};
