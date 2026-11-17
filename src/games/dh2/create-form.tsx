'use client';

import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCharacterContext,
  useToast,
  useTranslation,
} from '@/games/plugin-host';
import type { CreateFormProps } from '@/games/types';
import {
  buildInvalidFormAlert,
  focusFirstInvalidField,
} from '@/lib/form-validation';

import { dh2CreationHintsMarkdown } from './creation-hints';
import { createDh2Defaults } from './defaults';
import { characteristicAptitudes, deriveAptitudes } from './dh2e-aptitudes';
import {
  DH2E_BACKGROUNDS,
  DH2E_CHARACTERISTICS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from './dh2e-data';
import {
  backgroundGrantChoices,
  grantOption,
  grantOptionLabel,
  grantValues,
} from './dh2e-grants';
import {
  aptitudeLabel,
  aptitudeLabels,
  backgroundLabel,
  divinationLabel,
  homeWorldLabel,
  roleLabel,
  talentHint,
  talentLabel,
} from './dh2e-labels';
import { fateRangeFor, woundsRangeFor } from './dh2e-starting-profile';
import type {
  Dh2eChoice,
  Dh2eSkillGrant,
  Dh2eSkillGrantSlot,
  Dh2eTalentGrant,
  Dh2eTalentGrantSlot,
} from './dh2e-types';
import { genderOptions } from './gender';
import { GENDER_CODES } from './types';

const CHARACTERISTIC_FIELDS = [
  'weaponSkill',
  'ballisticSkill',
  'strength',
  'toughness',
  'agility',
  'intelligence',
  'perception',
  'willpower',
  'fellowship',
  'influence',
] as const;

const CHARACTERISTIC_LABEL_KEYS: Record<
  (typeof CHARACTERISTIC_FIELDS)[number],
  string
> = {
  weaponSkill: 'dh2.weaponSkill',
  ballisticSkill: 'dh2.ballisticSkill',
  strength: 'dh2.strength',
  toughness: 'dh2.toughness',
  agility: 'dh2.agility',
  intelligence: 'dh2.intelligence',
  perception: 'dh2.perception',
  willpower: 'dh2.willpower',
  fellowship: 'dh2.fellowship',
  influence: 'dh2.influence',
};

/**
 * ─── LANDMARK: DARK HERESY CREATE FORM ─────────────────────────────────────
 * Создание персонажа 2e по шагам книги: мир → бэкграунд → роль →
 * характеристики → детали. Значения характеристик игрок вводит сам (броски
 * кубиков за столом), поэтому подсказки мира показывают, какие кубики
 * бросать, а не подставляют числа (D5).
 */
export function DarkHeresyCreateForm({ onCreated }: CreateFormProps) {
  const { toast } = useToast();
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();

  const formSchema = z.object({
    name: z.string().min(2, t('common.nameMinLength')),
    homeWorld: z.string({ error: t('dh2.selectHomeWorldError') }),
    background: z.string({ error: t('dh2.selectBackgroundError') }),
    role: z.string({ error: t('dh2.selectRoleError') }),
    divination: z.string().optional(),
    gender: z.enum(GENDER_CODES).optional(),
    insanity: z.coerce.number().int().min(0).optional(),
    corruption: z.coerce.number().int().min(0).optional(),
    backstory: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    age: z.string().optional(),
    skinColor: z.string().optional(),
    hairColor: z.string().optional(),
    eyeColor: z.string().optional(),
    experience: z.coerce.number().int().optional(),
    totalExpSpent: z.coerce.number().int().optional(),
    weaponSkill: z.coerce.number().int(),
    ballisticSkill: z.coerce.number().int(),
    strength: z.coerce.number().int(),
    toughness: z.coerce.number().int(),
    agility: z.coerce.number().int(),
    intelligence: z.coerce.number().int(),
    perception: z.coerce.number().int(),
    willpower: z.coerce.number().int(),
    fellowship: z.coerce.number().int(),
    influence: z.coerce.number().int(),
    wounds: z.coerce.number().int(),
    fatePoints: z.coerce.number().int(),
    creationAcquisitions: z.coerce.number().int().min(0).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as unknown as Resolver<
      z.infer<typeof formSchema>
    >,
    shouldFocusError: false,
    defaultValues: {
      name: '',
      homeWorld: '',
      background: '',
      role: '',
      divination: '',
      gender: '',
      insanity: 0,
      corruption: 0,
      weaponSkill: 30,
      ballisticSkill: 30,
      strength: 30,
      toughness: 30,
      agility: 30,
      intelligence: 30,
      perception: 30,
      willpower: 30,
      fellowship: 30,
      influence: 30,
      wounds: 10,
      fatePoints: 1,
      creationAcquisitions: 0,
      height: '',
      weight: '',
      age: '',
      skinColor: '',
      hairColor: '',
      eyeColor: '',
      experience: 1000,
      totalExpSpent: 0,
    },
  });

  const watchedHomeWorld = form.watch('homeWorld');
  const watchedBackground = form.watch('background');
  const watchedRole = form.watch('role');
  const watchedDivination = form.watch('divination');
  const watchedInfluence = form.watch('influence');
  const watchedAcquisitions = form.watch('creationAcquisitions');
  const influenceLimit = Math.floor((Number(watchedInfluence) || 0) / 10);
  const acquisitions = Number(watchedAcquisitions) || 0;

  // Выборы, которые правила оставляют игроку (D11): аптитюды, дубли,
  // талант роли и «одно из» стартового пакета. Живут вне zod-схемы: это не
  // поля характеристик, а решения мастера/игрока, которые сохраняются в
  // персонаже отдельными структурами.
  const [aptitudeChosen, setAptitudeChosen] = React.useState<
    Record<string, string>
  >({});
  const [roleTalent, setRoleTalent] = React.useState('');
  const [grantSelected, setGrantSelected] = React.useState<
    Record<string, string>
  >({});

  const world = React.useMemo(
    () => DH2E_HOMEWORLDS.find((item) => item.id === watchedHomeWorld),
    [watchedHomeWorld],
  );
  const background = React.useMemo(
    () => DH2E_BACKGROUNDS.find((item) => item.id === watchedBackground),
    [watchedBackground],
  );
  const role = React.useMemo(
    () => DH2E_ROLES.find((item) => item.id === watchedRole),
    [watchedRole],
  );
  const aptitudes = React.useMemo(
    () =>
      deriveAptitudes(
        {
          homeWorld: watchedHomeWorld,
          background: watchedBackground,
          role: watchedRole,
        },
        aptitudeChosen,
      ),
    [watchedHomeWorld, watchedBackground, watchedRole, aptitudeChosen],
  );
  const grantChoices = React.useMemo(
    () => (background ? backgroundGrantChoices(background) : []),
    [background],
  );
  const chosenSkillValues = React.useMemo(
    () => grantValues(background, 'skill', grantSelected),
    [background, grantSelected],
  );
  const chosenTalentValues = React.useMemo(
    () => grantValues(background, 'talent', grantSelected),
    [background, grantSelected],
  );
  const duplicateAptitudes = React.useMemo(
    () => [...new Set(aptitudes.duplicates)],
    [aptitudes.duplicates],
  );
  const divination = React.useMemo(
    () => DH2E_DIVINATIONS.find((item) => item.id === watchedDivination),
    [watchedDivination],
  );
  const woundsRange = React.useMemo(
    () => woundsRangeFor(watchedHomeWorld),
    [watchedHomeWorld],
  );
  const fateRange = React.useMemo(
    () => fateRangeFor(watchedHomeWorld),
    [watchedHomeWorld],
  );

  // Смена мира/бэкграунда/роли меняет набор слотов: старые выборы к ним уже
  // не относятся, поэтому сбрасываем их, а не тащим в новый профиль.
  React.useEffect(() => {
    setAptitudeChosen({});
    setRoleTalent('');
    setGrantSelected({});
  }, [watchedHomeWorld, watchedBackground, watchedRole]);

  // Мир задаёт раны и Судьбу: по умолчанию минимум диапазона, бросок игрок
  // вписывает сам (D12).
  React.useEffect(() => {
    if (!world) return;
    form.setValue('fatePoints', fateRangeFor(world.id)?.min ?? 1);
    form.setValue('wounds', woundsRangeFor(world.id)?.min ?? 10);
  }, [world, form]);

  const handleInvalid = (errors: FieldErrors) => {
    window.setTimeout(focusFirstInvalidField, 0);
    const alert = buildInvalidFormAlert(errors, {
      title: t('common.fillRequiredFields'),
      fallback: t('common.checkFields'),
    });
    toast({
      variant: 'destructive',
      title: alert.title,
      description: alert.description,
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const startingChoices = {
      ...(role && roleTalent ? { roleTalent } : {}),
      skills: chosenSkillValues,
      talents: chosenTalentValues,
    };
    const notes = dh2CreationHintsMarkdown(
      {
        homeWorld: values.homeWorld,
        background: values.background,
        role: values.role,
        aptitudes: aptitudes.profile,
        startingChoices,
        divination: values.divination,
        wounds: values.wounds,
        fatePoints: values.fatePoints,
      },
      t,
    );
    const newCharacter = createDh2Defaults({
      ...values,
      notes,
      chosen: aptitudeChosen,
      strictAptitudeChoices: true,
      startingChoices,
    });
    const docRef = await addCharacter(newCharacter);

    if (docRef) {
      toast({
        title: t('common.characterCreatedTitle'),
        description: t('dh2.characterCreatedDescDH'),
      });
      onCreated?.(docRef.id, { openNotes: true });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dh2.characterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)}>
          <CardContent className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-base font-medium">
                {t('dh2.stageHomeWorld')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.characterName')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('dh2.placeholderJax')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="homeWorld"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.homeWorld')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh2.selectHomeWorld')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DH2E_HOMEWORLDS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {t(item.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {world && (
                <div className="bg-muted/40 space-y-2 rounded-md border p-3 text-xs">
                  <p className="text-sm font-medium">
                    {homeWorldLabel(world.id, t)}
                  </p>
                  <p>
                    {t('dh2.worldModifierHint')}:{' '}
                    {world.characteristicModifiers.plus
                      .map((id) => `+ ${t(`dh2.catalog.characteristic.${id}`)}`)
                      .concat(
                        world.characteristicModifiers.minus.map(
                          (id) => `− ${t(`dh2.catalog.characteristic.${id}`)}`,
                        ),
                      )
                      .join(', ') || '—'}
                  </p>
                  <p>
                    {t('dh2.worldFateHint')}: {world.fateThreshold} (
                    {t('dh2.emperorsBlessing')} {world.emperorsBlessing}+),{' '}
                    {t('dh2.wounds')}: {world.wounds}
                  </p>
                  <p>
                    {t('dh2.worldAptitudeHint')}:{' '}
                    {t(`dh2.catalog.aptitude.${world.aptitudeId}`)}
                  </p>
                  <p className="text-muted-foreground">{t(world.bonusKey)}</p>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-medium">
                {t('dh2.stageBackground')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="background"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.background')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh2.selectBackground')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DH2E_BACKGROUNDS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {t(item.labelKey)}
                              {world?.recommendedBackgroundIds.includes(item.id)
                                ? ` · ${t('dh2.recommended')}`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.role')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh2.selectRole')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DH2E_ROLES.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {t(item.labelKey)}
                              {background?.recommendedRoleIds.includes(item.id)
                                ? ` · ${t('dh2.recommended')}`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {background && (
                <p className="text-muted-foreground text-xs">
                  {backgroundLabel(background.id, t)}:{' '}
                  {t(background.bonusKeys[0] ?? '')}
                </p>
              )}
              {role && (
                <p className="text-muted-foreground text-xs">
                  {roleLabel(role.id, t)}: {t(role.bonusKey)}
                </p>
              )}
              <p className="text-xs">
                {t('dh2.aptitudes')}:{' '}
                <span className="font-medium">
                  {aptitudeLabels(aptitudes.profile, t) || '—'}
                </span>
                {aptitudes.unresolved.length > 0 && (
                  <span className="text-destructive">
                    {' · '}
                    {t('dh2.unresolvedChoices')}
                  </span>
                )}
              </p>

              {(background || role) && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <h4 className="text-sm font-medium">
                    {t('dh2.startingPackage')}
                  </h4>
                  {background && (
                    <>
                      <GrantList
                        title={t('dh2.startingSkills')}
                        kind="skill"
                        items={background.startingSkills}
                        chosen={chosenSkillValues}
                      />
                      <GrantList
                        title={t('dh2.startingTalents')}
                        kind="talent"
                        items={background.startingTalents}
                        chosen={chosenTalentValues}
                        hintFor={(id) => talentHint(id, t)}
                      />
                      {background.startingTraits && (
                        <p className="text-xs">
                          <span className="text-muted-foreground">
                            {t('dh2.startingTraits')}:
                          </span>{' '}
                          {background.startingTraits.choose === 1
                            ? `${t('dh2.chooseOnePrefix')} `
                            : ''}
                          {background.startingTraits.keys
                            .map((key) => t(key))
                            .join(', ')}
                        </p>
                      )}
                      {background.startingCorruption !== undefined && (
                        <p className="text-xs">
                          <span className="text-muted-foreground">
                            {t('dh2.startingCorruption')}:
                          </span>{' '}
                          {background.startingCorruption}
                        </p>
                      )}
                      {background.startingMalignancy !== undefined && (
                        <p className="text-xs">
                          <span className="text-muted-foreground">
                            {t('dh2.startingMalignancy')}:
                          </span>{' '}
                          {background.startingMalignancy}
                        </p>
                      )}
                      {background.bonusKeys.map((key) => (
                        <p key={key} className="text-muted-foreground text-xs">
                          {t(key)}
                        </p>
                      ))}
                      <p className="text-xs">
                        {t('dh2.startingAptitude')}:{' '}
                        {aptitudeChosen.background
                          ? `${aptitudeLabel(aptitudeChosen.background, t)} · ${t('dh2.chosenPrefix')}`
                          : `${background.aptitudeChoice
                              .map((id) => aptitudeLabel(id, t))
                              .join(' / ')} — ${t('dh2.choosePrompt')}`}
                      </p>
                    </>
                  )}
                  {role && (
                    <>
                      <p className="text-xs">
                        {t('dh2.roleTalent')}:{' '}
                        {roleTalent
                          ? `${talentLabel(roleTalent, t)} · ${t('dh2.chosenPrefix')}`
                          : `${role.talentChoice.of
                              .map((id) => talentLabel(id, t))
                              .join(' / ')} — ${t('dh2.choosePrompt')}`}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t(role.bonusKey)}
                      </p>
                    </>
                  )}

                  {(aptitudes.choices.length > 0 ||
                    duplicateAptitudes.length > 0 ||
                    grantChoices.length > 0 ||
                    (role && role.talentChoice.of.length > 1)) && (
                    <div className="space-y-2 border-t pt-2">
                      <h4 className="text-sm font-medium">
                        {t('dh2.startingChoices')}
                      </h4>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {background && background.aptitudeChoice.length > 1 && (
                          <ChoiceSelect
                            label={`${t('dh2.backgroundAptitude')}: ${backgroundLabel(background.id, t)}`}
                            value={aptitudeChosen.background ?? ''}
                            placeholder={t('dh2.choosePrompt')}
                            options={background.aptitudeChoice.map((id) => ({
                              value: id,
                              label: aptitudeLabel(id, t),
                            }))}
                            onChange={(value) =>
                              setAptitudeChosen((prev) => ({
                                ...prev,
                                background: value,
                              }))
                            }
                          />
                        )}
                        {role &&
                          role.aptitudes.map((slot, index) => {
                            if (
                              typeof slot === 'string' ||
                              slot.of.length < 2
                            ) {
                              return null;
                            }
                            const key = `role.${index}`;
                            return (
                              <ChoiceSelect
                                key={key}
                                label={`${t('dh2.roleAptitude')} ${index + 1}`}
                                value={aptitudeChosen[key] ?? ''}
                                placeholder={t('dh2.choosePrompt')}
                                options={slot.of.map((id) => ({
                                  value: id,
                                  label: aptitudeLabel(id, t),
                                }))}
                                onChange={(value) =>
                                  setAptitudeChosen((prev) => ({
                                    ...prev,
                                    [key]: value,
                                  }))
                                }
                              />
                            );
                          })}
                        {role && role.talentChoice.of.length > 1 && (
                          <ChoiceSelect
                            label={`${t('dh2.roleTalent')}: ${roleLabel(role.id, t)}`}
                            value={roleTalent}
                            placeholder={t('dh2.choosePrompt')}
                            options={role.talentChoice.of.map((id) => ({
                              value: id,
                              label: talentLabel(id, t),
                            }))}
                            hint={
                              roleTalent ? talentHint(roleTalent, t) : undefined
                            }
                            onChange={setRoleTalent}
                          />
                        )}
                        {duplicateAptitudes.map((aptitude) => {
                          const key = `duplicate.${aptitude}`;
                          const picked = aptitudeChosen[key];
                          const options = characteristicAptitudes()
                            .filter(
                              (id) =>
                                !aptitudes.profile.includes(id) ||
                                id === picked,
                            )
                            .map((id) => ({
                              value: id,
                              label: aptitudeLabel(id, t),
                            }));
                          return options.length > 0 ? (
                            <ChoiceSelect
                              key={key}
                              label={`${t('dh2.duplicateAptitude')}: ${aptitudeLabel(aptitude, t)}`}
                              value={picked ?? ''}
                              placeholder={t('dh2.choosePrompt')}
                              options={options}
                              onChange={(value) =>
                                setAptitudeChosen((prev) => ({
                                  ...prev,
                                  [key]: value,
                                }))
                              }
                            />
                          ) : (
                            <p key={key} className="text-destructive text-xs">
                              {t('dh2.noFreeAptitudes')}
                            </p>
                          );
                        })}
                        {grantChoices.map((choice) => {
                          const key = `${choice.kind}:${choice.index}`;
                          return (
                            <ChoiceSelect
                              key={key}
                              label={`${choice.kind === 'skill' ? t('dh2.startingSkills') : t('dh2.startingTalents')} ${choice.index + 1}`}
                              value={grantSelected[key] ?? ''}
                              placeholder={t('dh2.choosePrompt')}
                              options={choice.options.map((option) => ({
                                value: option.key,
                                label: grantOptionLabel(option, t),
                              }))}
                              hint={
                                choice.kind === 'talent' && grantSelected[key]
                                  ? talentHint(
                                      grantSelected[key].split(':')[0],
                                      t,
                                    )
                                  : undefined
                              }
                              onChange={(value) =>
                                setGrantSelected((prev) => ({
                                  ...prev,
                                  [key]: value,
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-medium">
                {t('dh2.stageCharacteristics')}
              </h3>
              <p className="text-muted-foreground text-xs">
                {t('dh2.characteristicsHint')}
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {CHARACTERISTIC_FIELDS.map((key) => {
                  const modifier = world
                    ? world.characteristicModifiers.plus.includes(
                        characteristicId(key),
                      )
                      ? '+'
                      : world.characteristicModifiers.minus.includes(
                            characteristicId(key),
                          )
                        ? '−'
                        : ''
                    : '';
                  return (
                    <FormField
                      key={key}
                      control={form.control}
                      name={key}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            {t(CHARACTERISTIC_LABEL_KEYS[key])}
                            {modifier && (
                              <span className="text-primary font-semibold">
                                {modifier}
                              </span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('dh2.influenceLimitHint')}: {influenceLimit}.{' '}
                {t('dh2.acquisitionAvailabilityHint')}
              </p>
              {acquisitions > influenceLimit && (
                <p className="text-destructive text-xs">
                  {t('dh2.acquisitionLimitExceeded')}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-medium">
                {t('dh2.stageDivination')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="divination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.divination')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh2.selectDivination')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DH2E_DIVINATIONS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.from === item.to
                                ? String(item.from).padStart(3, '0')
                                : `${String(item.from).padStart(2, '0')}–${String(
                                    item.to,
                                  ).padStart(2, '0')}`}
                              {' · '}
                              {divinationLabel(item.id, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {divination ? t(divination.effectKey) : t('dh2.divinationHint')}
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-medium">{t('dh2.otherStats')}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.gender')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh2.selectGender')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderOptions(t).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(
                  [
                    ['wounds', 'dh2.wounds'],
                    ['fatePoints', 'dh2.fate'],
                    ['insanity', 'dh2.insanity'],
                    ['corruption', 'dh2.corruption'],
                    ['experience', 'dh2.experience'],
                    ['totalExpSpent', 'dh2.totalExpSpent'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(labelKey)}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="creationAcquisitions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.creationAcquisitions')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <p
                        className={
                          acquisitions > influenceLimit
                            ? 'text-destructive text-xs'
                            : 'text-muted-foreground text-xs'
                        }
                      >
                        {acquisitions} / {influenceLimit}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {woundsRange && fateRange && (
                <p className="text-muted-foreground text-xs">
                  {t('dh2.wounds')}: {woundsRange.formula} → {woundsRange.min}–
                  {woundsRange.max} · {t('dh2.fate')}: {fateRange.threshold} (
                  {t('dh2.emperorsBlessing')} {fateRange.blessing}+) →{' '}
                  {fateRange.min}–{fateRange.max}. {t('dh2.rollHint')}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-medium">{t('dh2.stageDetails')}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(
                  [
                    ['height', 'common.height'],
                    ['weight', 'common.weight'],
                    ['age', 'common.age'],
                    ['skinColor', 'dh2.skinColor'],
                    ['hairColor', 'dh2.hairColor'],
                    ['eyeColor', 'dh2.eyeColor'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(labelKey)}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormField
                control={form.control}
                name="backstory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.backstory')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit">{t('common.createCharacter')}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

/** Ключ статистики → смысловой id характеристики (для модификаторов мира). */
function characteristicId(key: string): string {
  const match = DH2E_CHARACTERISTICS.find((item) => item.id === key);
  return match?.aptitudeIds[0] ?? key;
}

/** Имя компонента из `plugin.json#sheet.createForm` (историческое). */
export const Dh2CharacterForm = DarkHeresyCreateForm;

type GrantItem = Dh2eSkillGrantSlot | Dh2eTalentGrantSlot;

function isGrantChoice(
  item: GrantItem,
): item is Dh2eChoice<Dh2eSkillGrant> | Dh2eChoice<Dh2eTalentGrant> {
  return (
    typeof item === 'object' &&
    item !== null &&
    'of' in item &&
    Array.isArray((item as { of?: unknown }).of)
  );
}

/**
 * Список стартовых навыков/талантов: выбранный вариант «одно из» показываем
 * как «выбрано: …», невыбранный — «выберите: A / B». Пакет остаётся
 * подсказкой, на лист игрок вносит значения вручную (D11).
 */
function GrantList({
  title,
  kind,
  items,
  chosen,
  hintFor,
}: {
  title: string;
  kind: 'skill' | 'talent';
  items: readonly GrantItem[];
  chosen: readonly string[] | undefined;
  hintFor?: (id: string) => string | undefined;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const text = items
    .map((item, index) => {
      if (isGrantChoice(item)) {
        const choiceIndex = items
          .slice(0, index)
          .filter((entry) => isGrantChoice(entry)).length;
        const value = chosen?.[choiceIndex];
        const picked = item.of.find(
          (option) => grantOption(kind, option).key === value,
        );
        if (picked) {
          return `${t('dh2.chosenPrefix')} ${grantOptionLabel(grantOption(kind, picked), t)}`;
        }
        const options = item.of
          .map((option) => grantOptionLabel(grantOption(kind, option), t))
          .join(' / ');
        return `${t('dh2.choosePrompt')} ${options}`;
      }
      return grantOptionLabel(grantOption(kind, item), t);
    })
    .join(', ');
  const fixedHints =
    kind === 'talent' && hintFor
      ? Array.from(
          new Set(
            items
              .filter((item) => !isGrantChoice(item))
              .map(
                (item) =>
                  grantOption(
                    kind,
                    item as Dh2eSkillGrant | Dh2eTalentGrant,
                  ).key.split(':')[0],
              ),
          ),
        )
          .map((id) => hintFor(id))
          .filter((hint): hint is string => Boolean(hint))
      : [];
  return (
    <div className="space-y-0.5">
      <p className="text-xs">
        <span className="text-muted-foreground">{title}: </span>
        {text}
      </p>
      {fixedHints.length > 0 && (
        <div className="text-muted-foreground space-y-0.5 pl-4 text-xs">
          {fixedHints.map((hint, index) => (
            <p key={index}>{hint}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Выпадающий список одного выбора при создании (D11). */
function ChoiceSelect({
  label,
  value,
  placeholder,
  options,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  hint?: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
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
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
