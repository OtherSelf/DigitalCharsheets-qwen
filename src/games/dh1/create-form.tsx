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
  VARIANT_KEYS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from './dark-heresy-data';
import { createDh1Defaults } from './defaults';
import {
  divinationEffectKey,
  divinationKey,
  effectIdForDivination,
} from './divination-i18n';
import { DarkHeresyCareerPaths, DarkHeresyHomeWorlds } from './types';

const VARIANT_LABEL_KEYS: Record<string, string> = {
  'Feral World': 'dh1.tribalTaboos',
  'Hive World': 'dh1.hiveClass',
  'Imperial World': 'dh1.birthPlanet',
  'Void Born': 'dh1.shipTradition',
  'Forge World': 'dh1.placeOfBirth',
};

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

  // MOVED INSIDE COMPONENT TO ACCESS t()
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
      divination: '',
      quirk: '',
      height: '',
      weight: '',
      age: '',
      skinColor: '',
      hairColor: '',
      eyeColor: '',
      experience: 0,
      totalExpSpent: 0,
    },
  });

  const watchedDivination = form.watch('divination');
  const watchedHomeWorld = form.watch('homeWorld');

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
                          VARIANT_LABEL_KEYS[watchedHomeWorld] ||
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
