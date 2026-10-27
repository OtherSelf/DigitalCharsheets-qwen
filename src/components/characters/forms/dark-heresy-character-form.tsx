'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useCharacterContext } from '@/context/character-context';
import { DarkHeresyCharacter, DarkHeresyHomeWorlds, DarkHeresyCareerPaths, DarkHeresyCareerPath } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DIVINATIONS, QUIRKS_BY_HOMEWORLD, ALL_QUIRKS, WORLD_VARIANTS_BY_HOMEWORLD, WORLD_VARIANT_LABELS } from '@/lib/dark-heresy-data';
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { RanksByCareer, calculateRank } from '@/lib/dark-heresy-ranks';
import { useTranslation } from '@/context/language-context';

// Map raw data strings to translation keys
const HOME_WORLD_KEYS: Record<string, string> = {
  "Feral World": "homeWorldFeral",
  "Hive World": "homeWorldHive",
  "Imperial World": "homeWorldImperial",
  "Void Born": "homeWorldVoidBorn",
};

const CAREER_KEYS: Record<string, string> = {
  "Adept": "careerAdept",
  "Arbitrator": "careerArbitrator",
  "Assassin": "careerAssassin",
  "Cleric": "careerCleric",
  "Guardsman": "careerGuardsman",
  "Imperial Psyker": "careerImperialPsyker",
  "Scum": "careerScum",
  "Tech-Priest": "careerTechPriest",
};

const VARIANT_KEYS: Record<string, string> = {
  "Agri-World": "variantAgriWorld",
  "Backwater": "variantBackwater",
  "Feudal World": "variantFeudalWorld",
  "War Zone": "variantWarZone",
  "Dead Planet": "variantDeadPlanet",
  "Shrine World": "variantShrineWorld",
  "Paradise World": "variantParadiseWorld",
  "Dirt Ward": "variantDirtWard",
  "Unlucky Colour": "variantUnluckyColour",
  "Hunter's Oath": "variantHuntersOath",
  "Thirsty Blade": "variantThirstyBlade",
  "Spirit Shackle": "variantSpiritShackle",
  "Warrior Death": "variantWarriorDeath",
  "Power of Names": "variantPowerOfNames",
  "Lonely Dead": "variantLonelyDead",
  "Living Record": "variantLivingRecord",
  "Nemesis": "variantNemesis",
  "Dross Hound": "variantDrossHound",
  "Ganger Scum": "variantGangerScum",
  "Factory Dregs": "variantFactoryDregs",
  "Middle Hive": "variantMiddleHive",
  "Specialist": "variantSpecialist",
  "Hive Noble": "variantHiveNoble",
  "Space Hulk": "variantSpaceHulk",
  "Orbital": "variantOrbital",
  "Chartist Vessel": "variantChartistVessel",
  "War Ship": "variantWarShip",
  "Rogue Trader": "variantRogueTrader",
};

const VARIANT_LABEL_KEYS: Record<string, string> = {
  "Feral World": "tribalTaboos",
  "Hive World": "hiveClass",
  "Imperial World": "birthPlanet",
  "Void Born": "shipTradition",
};

// Helper to dynamically generate quirk translation keys (e.g., "Cat’s Eyes" -> "quirkCatsEyes")
const getQuirkKey = (quirk: string) => {
  return "quirk" + quirk.replace(/[^a-zA-Z]/g, "");
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
    name: z.string().min(2, t('nameMinLength')),
    homeWorld: z.enum(DarkHeresyHomeWorlds, { required_error: t('selectHomeWorldError') }),
    worldVariant: z.string().optional(),
    careerPath: z.enum(DarkHeresyCareerPaths, { required_error: t('selectCareerPathError') }),
    backstory: z.string().optional(),
    divination: z.string({ required_error: t('selectDivinationError') }),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
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
    return DIVINATIONS.find(d => d.divination === watchedDivination)?.effect || '';
  }, [watchedDivination]);

  const availableWorldVariants = React.useMemo(() => {
    return watchedHomeWorld ? WORLD_VARIANTS_BY_HOMEWORLD[watchedHomeWorld] || [] : [];
  }, [watchedHomeWorld]);

  const worldVariantLabel = React.useMemo(() => {
    return watchedHomeWorld 
      ? (WORLD_VARIANT_LABELS[watchedHomeWorld] || t('worldVariant')) 
      : t('waitingHomeWorld');
  }, [watchedHomeWorld]);
  
  React.useEffect(() => {
    if (showAllQuirks) {
        setAvailableQuirks(ALL_QUIRKS);
    } else if (watchedHomeWorld && QUIRKS_BY_HOMEWORLD[watchedHomeWorld]) {
        setAvailableQuirks(QUIRKS_BY_HOMEWORLD[watchedHomeWorld].sort());
    } else {
        setAvailableQuirks([]);
    }
    form.setValue('quirk', '');
  }, [watchedHomeWorld, showAllQuirks, form]);

  React.useEffect(() => {
    form.setValue('worldVariant', '');
  }, [watchedHomeWorld, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const careerRanks = watchedCareerPath ? RanksByCareer[watchedCareerPath as DarkHeresyCareerPath] : null;
    const agiBonus = Math.floor(values.agility / 10);
    
    const newCharacter: Omit<DarkHeresyCharacter, 'id' | 'userId'> = {
        name: values.name,
        characterClass: values.careerPath,
        gameSystem: 'Dark Heresy',
        backstory: values.backstory || '',
        homeWorld: values.homeWorld,
        worldVariant: values.worldVariant || '',
        careerPath: values.careerPath,
        rank: careerRanks ? calculateRank(careerRanks, values.totalExpSpent ?? 0, null, null) : 'N/A',
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
            'Head': null,
            'Body': null,
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
    };

    const docRef = await addCharacter(newCharacter);
    
    if (docRef) {
        toast({
            title: t('characterCreatedTitle'),
            description: t('characterCreatedDescDH'),
        });
        router.push(`/${docRef.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dhCharacterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('basicInformation')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('characterName')}</FormLabel><FormControl><Input placeholder={t('placeholderJax')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                  control={form.control}
                  name="homeWorld"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('homeWorld')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectHomeWorld')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                         {DarkHeresyHomeWorlds.map(world => (
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
                        {t(VARIANT_LABEL_KEYS[watchedHomeWorld] || 'worldVariant')}
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={!watchedHomeWorld}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectVariant')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(watchedHomeWorld ? WORLD_VARIANTS_BY_HOMEWORLD[watchedHomeWorld] || [] : []).map(v => (
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
                      <FormLabel>{t('careerPath')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectCareerPath')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyCareerPaths.map(path => (
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
                <h3 className="text-base font-medium">{t('description')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="divination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('divination')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectDivination')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DIVINATIONS.map(({ divination }) => (
                              <SelectItem key={divination} value={divination}>
                                {t(divination)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>{t('divinationEffect')}</FormLabel>
                    <Input
                      readOnly
                      value={divinationEffect ? t(divinationEffect) : ''}
                      placeholder={t('effectAppearsHere')}
                      className="border-dashed bg-muted/50"
                    />
                  </FormItem>
                  <FormField
                      control={form.control}
                      name="quirk"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('quirk')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!watchedHomeWorld && !showAllQuirks}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectQuirk')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableQuirks.map((quirk) => (
                                <SelectItem key={quirk} value={quirk}>
                                  {t(getQuirkKey(quirk))}
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
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {t('showAllQuirks')}
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
<FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>{t('height')}</FormLabel><FormControl><Input placeholder={t('placeholderHeight')} {...field} /></FormControl><FormMessage /></FormItem>)} />
<FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>{t('weight')}</FormLabel><FormControl><Input placeholder={t('placeholderWeight')} {...field} /></FormControl><FormMessage /></FormItem>)} />
<FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>{t('age')}</FormLabel><FormControl><Input placeholder={t('placeholderAge')} {...field} /></FormControl><FormMessage /></FormItem>)} />
<FormField control={form.control} name="skinColor" render={({ field }) => (<FormItem><FormLabel>{t('skinColor')}</FormLabel><FormControl><Input placeholder={t('placeholderSkinColor')} {...field} /></FormControl><FormMessage /></FormItem>)} />
<FormField control={form.control} name="hairColor" render={({ field }) => (<FormItem><FormLabel>{t('hairColor')}</FormLabel><FormControl><Input placeholder={t('placeholderHairColor')} {...field} /></FormControl><FormMessage /></FormItem>)} />
<FormField control={form.control} name="eyeColor" render={({ field }) => (<FormItem><FormLabel>{t('eyeColor')}</FormLabel><FormControl><Input placeholder={t('placeholderEyeColor')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>
            
             <FormField
              control={form.control}
              name="backstory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('backstory')}</FormLabel>
                  <FormControl><Textarea placeholder={t('placeholderUnderhive')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('progression')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="experience" render={({ field }) => (<FormItem><FormLabel>{t('experience')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="totalExpSpent" render={({ field }) => (<FormItem><FormLabel>{t('totalExpSpent')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('characteristics')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <FormField control={form.control} name="weaponSkill" render={({ field }) => (<FormItem><FormLabel>{t('weaponSkill')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="ballisticSkill" render={({ field }) => (<FormItem><FormLabel>{t('ballisticSkill')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="strength" render={({ field }) => (<FormItem><FormLabel>{t('strength')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="toughness" render={({ field }) => (<FormItem><FormLabel>{t('toughness')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="agility" render={({ field }) => (<FormItem><FormLabel>{t('agility')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="intelligence" render={({ field }) => (<FormItem><FormLabel>{t('intelligence')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="perception" render={({ field }) => (<FormItem><FormLabel>{t('perception')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="willpower" render={({ field }) => (<FormItem><FormLabel>{t('willpower')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fellowship" render={({ field }) => (<FormItem><FormLabel>{t('fellowship')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="influence" render={({ field }) => (<FormItem><FormLabel>{t('influence')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('otherStats')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="wounds" render={({ field }) => (<FormItem><FormLabel>{t('wounds')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fatePoints" render={({ field }) => (<FormItem><FormLabel>{t('fatePoints')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>
          </CardContent>
           <CardFooter>
            <Button type="submit">{t('createCharacter')}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}