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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import {
  buildInvalidFormAlert,
  focusFirstInvalidField,
} from '@/lib/form-validation';

import {
  ALL_QUIRKS,
  CAREER_KEYS,
  dhLocalizedKey,
  DIVINATIONS,
  getQuirksForHomeWorld,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  RANK_KEYS,
  STARTING_EXPERIENCE,
  STARTING_WEALTH,
  VARIANT_KEYS,
  WORLD_FEATURES,
  WORLD_STARTING_PROFILE,
  WORLD_VARIANT_LABELS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from './dark-heresy-data';
import { RanksByCareer } from './dark-heresy-ranks';
import { createDh1Defaults } from './defaults';
import {
  divinationEffectKey,
  divinationKey,
  effectIdForDivination,
} from './divination-i18n';
import { STARTING_PACKAGES } from './starting-packages';
import { DarkHeresyCareerPaths, DarkHeresyHomeWorlds } from './types';

/** Порядок характеристик в подсказке стартового профиля (Таблица 1-3). */
const STARTING_STAT_KEYS = [
  ['weaponSkill', 'weaponSkillAbbr'],
  ['ballisticSkill', 'ballisticSkillAbbr'],
  ['strength', 'strengthAbbr'],
  ['toughness', 'toughnessAbbr'],
  ['agility', 'agilityAbbr'],
  ['intelligence', 'intelligenceAbbr'],
  ['perception', 'perceptionAbbr'],
  ['willpower', 'willpowerAbbr'],
  ['fellowship', 'fellowshipAbbr'],
] as const;

export type DarkHeresyFormVariant = 'dh1';

/**
 * ─── LANDMARK: DARK HERESY CREATE FORM ─────────────────────────────────────
 * Форма создания Dark Heresy 1-й редакции. Модуль самодостаточен:
 * поля, фабрика персонажа и переводы принадлежат только этой редакции.
 */
export function DarkHeresyCreateForm({
  variant,
  onCreated,
}: {
  variant: DarkHeresyFormVariant;
  onCreated?: (characterId: string) => void;
}) {
  const { toast } = useToast();
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const [showAllQuirks, setShowAllQuirks] = React.useState(false);
  const [availableQuirks, setAvailableQuirks] = React.useState<string[]>([]);

  // Схема зависит от языка: тексты ошибок берутся из словаря, поэтому она
  // собирается внутри компонента, а не один раз на уровне модуля.
  const formSchema = z.object({
    name: z.string().min(2, t('common.nameMinLength')),
    homeWorld: z.enum(DarkHeresyHomeWorlds, {
      error: t('dh1.selectHomeWorldError'),
    }),
    worldVariant: z.string().optional(),
    careerPath: z.enum(DarkHeresyCareerPaths, {
      error: t('dh1.selectCareerPathError'),
    }),
    backstory: z.string().optional(),
    divination: z.string({ error: t('dh1.selectDivinationError') }),
    quirk: z.string().optional(),
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
    insanity: z.coerce.number().int().min(0).optional(),
    corruption: z.coerce.number().int().min(0).optional(),
    gender: z.string().optional(),
    throneGelt: z.coerce.number().int().optional(),
  });

  // zod 4 разделяет типы входа и выхода (z.input/z.output, например из-за
  // z.coerce.number()). zodResolver возвращает разобранные данные, поэтому
  // форма типизируется выходным типом схемы; приведение сужает TFieldValues.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as unknown as Resolver<
      z.infer<typeof formSchema>
    >,
    // Фокус/скролл на первом невалидном поле делает handleInvalid: RHF умеет
    // фокусировать только зарегистрированные refs, а кастомные Select на
    // мобильном остаются вне экрана.
    shouldFocusError: false,
    defaultValues: {
      name: '',
      worldVariant: '',
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
      insanity: 0,
      corruption: 0,
      gender: '',
      throneGelt: 0,
      divination: '',
      quirk: '',
      height: '',
      weight: '',
      age: '',
      skinColor: '',
      hairColor: '',
      eyeColor: '',
      experience: STARTING_EXPERIENCE,
      totalExpSpent: 0,
    },
  });

  const watchedDivination = form.watch('divination');
  const watchedHomeWorld = form.watch('homeWorld');
  const watchedCareer = form.watch('careerPath');
  const watchedProfile = React.useMemo(
    () => (watchedHomeWorld ? WORLD_STARTING_PROFILE[watchedHomeWorld] : null),
    [watchedHomeWorld],
  );
  const startingRank = React.useMemo(() => {
    if (!watchedCareer) return null;
    const rank = RanksByCareer[watchedCareer].standard[0]?.name;
    return rank ? (RANK_KEYS[rank] ?? rank) : null;
  }, [watchedCareer]);

  const divinationEffect = React.useMemo(() => {
    return effectIdForDivination(watchedDivination);
  }, [watchedDivination]);

  React.useEffect(() => {
    if (showAllQuirks) {
      setAvailableQuirks(ALL_QUIRKS);
    } else if (watchedHomeWorld) {
      // У Мира-кузницы своей таблицы примет нет — хелпер отдаёт общий список.
      setAvailableQuirks(getQuirksForHomeWorld(watchedHomeWorld));
    } else {
      setAvailableQuirks([]);
    }
    form.setValue('quirk', '');
  }, [watchedHomeWorld, showAllQuirks, form]);

  React.useEffect(() => {
    form.setValue('worldVariant', '');
  }, [watchedHomeWorld, form]);

  const handleInvalid = (errors: FieldErrors) => {
    // RHF фокусирует только «нативные» поля; Select на мобильном может
    // оказаться вне экрана — поэтому явно скроллим/фокусируем и показываем
    // тост с первой ошибкой, чтобы нажатие «Создать» не выглядело немым.
    // onInvalid вызывается до перерисовки ошибок: `aria-invalid` появится
    // только в следующем кадре, поэтому фокус ставим после коммита React.
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
    const newCharacter = createDh1Defaults(values);

    const docRef = await addCharacter(newCharacter);

    if (docRef) {
      toast({
        title: t('common.characterCreatedTitle'),
        description: t('dh1.characterCreatedDescDH'),
      });
      onCreated?.(docRef.id);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dh1.characterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('common.basicInformation')}
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
                          placeholder={t('dh1.placeholderJax')}
                          {...field}
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
                      <FormLabel>{t('dh1.homeWorld')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh1.selectHomeWorld')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyHomeWorlds.map((world) => (
                            <SelectItem key={world} value={world}>
                              {t(
                                dhLocalizedKey(
                                  HOME_WORLD_KEYS[world] || world,
                                  'dh1',
                                ),
                              )}
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
                  name="worldVariant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          WORLD_VARIANT_LABELS[watchedHomeWorld] ||
                            'dh1.worldVariant',
                        )}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedHomeWorld}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh1.selectVariant')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(watchedHomeWorld
                            ? WORLD_VARIANTS_BY_HOMEWORLD[watchedHomeWorld] ||
                              []
                            : []
                          ).map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(dhLocalizedKey(VARIANT_KEYS[v] || v, 'dh1'))}
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
                  name="careerPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.careerPath')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh1.selectCareerPath')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyCareerPaths.map((path) => (
                            <SelectItem key={path} value={path}>
                              {t(
                                dhLocalizedKey(
                                  CAREER_KEYS[path] || path,
                                  'dh1',
                                ),
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {watchedHomeWorld && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md border p-3">
                  <h4 className="text-sm font-medium">
                    {t('dh1.worldFeatures')}
                  </h4>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    {WORLD_FEATURES[watchedHomeWorld].map((feature) => (
                      <li key={feature.name}>
                        <span className="text-foreground font-medium">
                          {t(feature.labelKey)}
                        </span>
                        {' — '}
                        {t(feature.effectKey)}
                      </li>
                    ))}
                  </ul>
                </div>
                {watchedProfile && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium">
                        {t('dh1.startingProfile')}
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          for (const [statKey] of STARTING_STAT_KEYS) {
                            form.setValue(
                              statKey,
                              watchedProfile.characteristics[statKey],
                            );
                          }
                        }}
                      >
                        {t('dh1.applyBaseStats')}
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {t('dh1.startingWounds')}: {watchedProfile.wounds}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t('dh1.startingFate')}: {watchedProfile.fate}
                    </p>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      {STARTING_STAT_KEYS.map(([statKey, abbrKey]) => (
                        <div
                          key={statKey}
                          className="flex justify-between gap-2"
                        >
                          <span className="text-muted-foreground">
                            {t(`dh1.${abbrKey}`)}
                          </span>
                          <span className="font-medium">
                            {watchedProfile.characteristics[statKey]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {watchedCareer && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {t('dh1.startingRank')}:{' '}
                  </span>
                  {startingRank ? t(startingRank) : '-'}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t('dh1.startingWealth')}:{' '}
                  </span>
                  {STARTING_WEALTH[watchedCareer] ?? '-'}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t('dh1.startingExperience')}:{' '}
                  </span>
                  {STARTING_EXPERIENCE}
                </p>
                {watchedCareer === 'Imperial Psyker' && (
                  <p className="text-muted-foreground pt-1">
                    {t('dh1.psykerStartHint')}
                  </p>
                )}
              </div>
            )}

            {watchedCareer && STARTING_PACKAGES[watchedCareer] && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <h4 className="text-sm font-medium">
                  {t('dh1.startingPackage')}
                </h4>
                {(
                  [
                    ['skills', 'dh1.startingSkills'],
                    ['talents', 'dh1.startingTalents'],
                    ['gear', 'dh1.startingGear'],
                    ['traits', 'dh1.startingTraits'],
                  ] as const
                ).map(([field, labelKey]) => {
                  const groups = STARTING_PACKAGES[watchedCareer][field];
                  if (!groups || groups.length === 0) return null;
                  return (
                    <div key={field} className="space-y-1">
                      <span className="text-muted-foreground text-xs">
                        {t(labelKey)}
                      </span>
                      <ul className="list-disc pl-4 text-sm">
                        {groups.map((group, index) => (
                          <li key={`${field}-${index}`}>
                            {group.map((key) => t(key)).join(' / ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('common.description')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="divination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.divination')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh1.selectDivination')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DIVINATIONS.map(({ id }) => (
                            <SelectItem key={id} value={id}>
                              {t(divinationKey(id, 'dh1'))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>{t('dh1.divinationEffect')}</FormLabel>
                  <Input
                    readOnly
                    value={
                      divinationEffect
                        ? t(divinationEffectKey(divinationEffect, 'dh1'))
                        : ''
                    }
                    placeholder={t('dh1.effectAppearsHere')}
                    className="bg-muted/50 border-dashed"
                  />
                </FormItem>
                <FormField
                  control={form.control}
                  name="quirk"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.quirk')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedHomeWorld && !showAllQuirks}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh1.selectQuirk')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableQuirks.map((quirk) => (
                            <SelectItem key={quirk} value={quirk}>
                              {t(
                                dhLocalizedKey(
                                  QUIRK_KEYS[quirk] || quirk,
                                  'dh1',
                                ),
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center space-x-2 self-end pb-2">
                  <Checkbox
                    id="all-quirks"
                    checked={showAllQuirks}
                    onCheckedChange={(checked) => setShowAllQuirks(!!checked)}
                  />
                  <label
                    htmlFor="all-quirks"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('dh1.showAllQuirks')}
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.height')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderHeight')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.weight')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderWeight')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.age')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderAge')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="skinColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.skinColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderSkinColor')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hairColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.hairColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderHairColor')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eyeColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.eyeColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh1.placeholderEyeColor')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="backstory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.backstory')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('dh1.placeholderUnderhive')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('common.progression')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.experience')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalExpSpent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.totalExpSpent')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('common.characteristics')}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                <FormField
                  control={form.control}
                  name="weaponSkill"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.weaponSkill')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ballisticSkill"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.ballisticSkill')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.strength')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toughness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.toughness')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.agility')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="intelligence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.intelligence')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="perception"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.perception')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="willpower"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.willpower')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fellowship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.fellowship')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-medium">{t('dh1.otherStats')}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="wounds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.wounds')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fatePoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.fatePoints')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insanity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.insanity')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="corruption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.corruption')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.gender')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="throneGelt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh1.startingWealthThrones')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">{t('common.createCharacter')}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export function Dh1CharacterForm({
  onCreated,
}: { onCreated?: (characterId: string) => void } = {}) {
  return <DarkHeresyCreateForm variant="dh1" onCreated={onCreated} />;
}

export default Dh1CharacterForm;
