'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
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
  FormDescription,
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
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';
import {
  ALL_QUIRKS,
  CAREER_KEYS,
  DIVINATIONS,
  getQuirksForHomeWorld,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  VARIANT_KEYS,
  WORLD_VARIANT_LABELS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from '@/lib/dark-heresy-data';
import { calculateRank, RanksByCareer } from '@/lib/dark-heresy-ranks';
import {
  divinationEffectKey,
  divinationKey,
  effectIdForDivination,
} from '@/lib/divination-i18n';
import {
  DarkHeresyCareerPath,
  DarkHeresyCareerPaths,
  DarkHeresyCharacter,
  DarkHeresyHomeWorlds,
} from '@/lib/types';

const VARIANT_LABEL_KEYS: Record<string, string> = {
  'Feral World': 'dh.tribalTaboos',
  'Hive World': 'dh.hiveClass',
  'Imperial World': 'dh.birthPlanet',
  'Void Born': 'dh.shipTradition',
  'Forge World': 'dh.placeOfBirth',
};

export function DarkHeresyCharacterForm() {
  const { toast } = useToast();
  const router = useRouter();
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const [showAllQuirks, setShowAllQuirks] = React.useState(false);
  const [availableQuirks, setAvailableQuirks] = React.useState<string[]>([]);

  // MOVED INSIDE COMPONENT TO ACCESS t()
  const formSchema = z.object({
    name: z.string().min(2, t('common.nameMinLength')),
    homeWorld: z.enum(DarkHeresyHomeWorlds, {
      error: t('dh.selectHomeWorldError'),
    }),
    worldVariant: z.string().optional(),
    careerPath: z.enum(DarkHeresyCareerPaths, {
      error: t('dh.selectCareerPathError'),
    }),
    backstory: z.string().optional(),
    divination: z.string({ error: t('dh.selectDivinationError') }),
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
  const watchedCareerPath = form.watch('careerPath');

  const divinationEffect = React.useMemo(() => {
    return effectIdForDivination(watchedDivination);
  }, [watchedDivination]);

  const availableWorldVariants = React.useMemo(() => {
    return watchedHomeWorld
      ? WORLD_VARIANTS_BY_HOMEWORLD[watchedHomeWorld] || []
      : [];
  }, [watchedHomeWorld]);

  const worldVariantLabel = React.useMemo(() => {
    return watchedHomeWorld
      ? WORLD_VARIANT_LABELS[watchedHomeWorld] || t('dh.worldVariant')
      : t('dh.waitingHomeWorld');
  }, [watchedHomeWorld]);

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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const careerRanks = watchedCareerPath
      ? RanksByCareer[watchedCareerPath as DarkHeresyCareerPath]
      : null;
    const agiBonus = Math.floor(values.agility / 10);

    const newCharacter: Omit<DarkHeresyCharacter, 'id' | 'userId'> = {
      name: values.name,
      characterClass: values.careerPath,
      gameSystem: 'Dark Heresy',
      schemaVersion: CHARACTER_SCHEMA_VERSION,
      backstory: values.backstory || '',
      homeWorld: values.homeWorld,
      worldVariant: values.worldVariant || '',
      careerPath: values.careerPath,
      rank: careerRanks
        ? calculateRank(careerRanks, values.totalExpSpent ?? 0, null, null)
        : 'N/A',
      divination: values.divination,
      divinationEffect: divinationEffect,
      quirk: values.quirk || '',
      height: values.height || '',
      weight: values.weight || '',
      age: values.age || '',
      skinColor: values.skinColor || '',
      hairColor: values.hairColor || '',
      eyeColor: values.eyeColor || '',
      experience: values.experience || 0,
      totalExpSpent: values.totalExpSpent || 0,
      alternatePath: null,
      advancedPath: null,
      notes: '',
      questLog: [],
      stats: {
        weaponSkill: values.weaponSkill,
        ballisticSkill: values.ballisticSkill,
        strength: values.strength,
        toughness: values.toughness,
        agility: values.agility,
        intelligence: values.intelligence,
        perception: values.perception,
        willpower: values.willpower,
        fellowship: values.fellowship,
        influence: values.influence,
      },
      statUpgrades: {
        weaponSkill: [false, false, false, false],
        ballisticSkill: [false, false, false, false],
        strength: [false, false, false, false],
        toughness: [false, false, false, false],
        agility: [false, false, false, false],
        intelligence: [false, false, false, false],
        perception: [false, false, false, false],
        willpower: [false, false, false, false],
        fellowship: [false, false, false, false],
        influence: [false, false, false, false],
      },
      statNotes: {},
      wounds: { current: values.wounds, max: values.wounds },
      fatePoints: { current: values.fatePoints, max: values.fatePoints },
      insanityPoints: { total: 0, notes: '' },
      corruptionPoints: { total: 0, notes: '' },
      wealth: {
        throneGelt: 0,
        monthlyIncome: 0,
      },
      movement: {
        walkHalf: agiBonus,
        walkFull: agiBonus * 2,
        charge: agiBonus * 3,
        run: agiBonus * 6,
      },
      equipment: {
        armor: {
          Head: null,
          Body: null,
          'Left arm': null,
          'Right arm': null,
          'Left leg': null,
          'Right leg': null,
        },
        weapons: {
          melee: [],
          ranged: [],
        },
      },
      inventory: [],
      skills: [],
      talents: [],
      fatigue1st: { current: 0 },
      fatigue2nd: { current: 0 },
      criticalConditions: [],
    };

    const docRef = await addCharacter(newCharacter);

    if (docRef) {
      toast({
        title: t('common.characterCreatedTitle'),
        description: t('dh.characterCreatedDescDH'),
      });
      router.push(`/${docRef.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dh.characterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                          placeholder={t('dh.placeholderJax')}
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
                      <FormLabel>{t('dh.homeWorld')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh.selectHomeWorld')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyHomeWorlds.map((world) => (
                            <SelectItem key={world} value={world}>
                              {t(HOME_WORLD_KEYS[world] || world)}
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
                            'dh.worldVariant',
                        )}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedHomeWorld}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh.selectVariant')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(watchedHomeWorld
                            ? WORLD_VARIANTS_BY_HOMEWORLD[watchedHomeWorld] ||
                              []
                            : []
                          ).map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(VARIANT_KEYS[v] || v)}
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
                      <FormLabel>{t('dh.careerPath')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh.selectCareerPath')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyCareerPaths.map((path) => (
                            <SelectItem key={path} value={path}>
                              {t(CAREER_KEYS[path] || path)}
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
                      <FormLabel>{t('dh.divination')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dh.selectDivination')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DIVINATIONS.map(({ id }) => (
                            <SelectItem key={id} value={id}>
                              {t(divinationKey(id))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>{t('dh.divinationEffect')}</FormLabel>
                  <Input
                    readOnly
                    value={
                      divinationEffect
                        ? t(divinationEffectKey(divinationEffect))
                        : ''
                    }
                    placeholder={t('dh.effectAppearsHere')}
                    className="bg-muted/50 border-dashed"
                  />
                </FormItem>
                <FormField
                  control={form.control}
                  name="quirk"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh.quirk')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedHomeWorld && !showAllQuirks}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dh.selectQuirk')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableQuirks.map((quirk) => (
                            <SelectItem key={quirk} value={quirk}>
                              {t(QUIRK_KEYS[quirk] || quirk)}
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
                    {t('dh.showAllQuirks')}
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
                          placeholder={t('dh.placeholderHeight')}
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
                          placeholder={t('dh.placeholderWeight')}
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
                          placeholder={t('dh.placeholderAge')}
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
                      <FormLabel>{t('dh.skinColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh.placeholderSkinColor')}
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
                      <FormLabel>{t('dh.hairColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh.placeholderHairColor')}
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
                      <FormLabel>{t('dh.eyeColor')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('dh.placeholderEyeColor')}
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
                      placeholder={t('dh.placeholderUnderhive')}
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
                      <FormLabel>{t('dh.experience')}</FormLabel>
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
                      <FormLabel>{t('dh.totalExpSpent')}</FormLabel>
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
                      <FormLabel>{t('dh.weaponSkill')}</FormLabel>
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
                      <FormLabel>{t('dh.ballisticSkill')}</FormLabel>
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
                      <FormLabel>{t('dh.toughness')}</FormLabel>
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
                      <FormLabel>{t('dh.agility')}</FormLabel>
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
                      <FormLabel>{t('dh.fellowship')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="influence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh.influence')}</FormLabel>
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
              <h3 className="text-base font-medium">{t('dh.otherStats')}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="wounds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dh.wounds')}</FormLabel>
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
                      <FormLabel>{t('dh.fatePoints')}</FormLabel>
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
