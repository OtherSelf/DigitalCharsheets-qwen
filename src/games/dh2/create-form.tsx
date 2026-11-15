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

import { createDh2Defaults } from './defaults';
import { deriveAptitudes } from './dh2e-aptitudes';
import {
  DH2E_BACKGROUNDS,
  DH2E_CHARACTERISTICS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from './dh2e-data';
import {
  aptitudeLabels,
  backgroundLabel,
  divinationLabel,
  homeWorldLabel,
  roleLabel,
} from './dh2e-labels';

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
  strength: 'common.strength',
  toughness: 'dh2.toughness',
  agility: 'dh2.agility',
  intelligence: 'common.intelligence',
  perception: 'common.perception',
  willpower: 'common.willpower',
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
      deriveAptitudes({
        homeWorld: watchedHomeWorld,
        background: watchedBackground,
        role: watchedRole,
      }),
    [watchedHomeWorld, watchedBackground, watchedRole],
  );
  const divination = React.useMemo(
    () => DH2E_DIVINATIONS.find((item) => item.id === watchedDivination),
    [watchedDivination],
  );

  // Мир задаёт порог Судьбы и раны: подсказываем значения, игрок их правит.
  React.useEffect(() => {
    if (!world) return;
    form.setValue('fatePoints', world.fateThreshold);
    const match = world.wounds.match(/^(\d+)\+1d5$/);
    form.setValue('wounds', match ? Number(match[1]) + 1 : 10);
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
    const newCharacter = createDh2Defaults(values);
    const docRef = await addCharacter(newCharacter);

    if (docRef) {
      toast({
        title: t('common.characterCreatedTitle'),
        description: t('dh2.characterCreatedDescDH'),
      });
      onCreated?.(docRef.id);
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
              </p>
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="wounds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh2.wounds')}</FormLabel>
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
                      <FormLabel>{t('dh2.fate')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                <div className="space-y-1 text-xs">
                  {divination ? (
                    <p>
                      <span className="font-medium">
                        {t(divination.effectKey)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      {t('dh2.divinationHint')}
                    </p>
                  )}
                </div>
              </div>
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
