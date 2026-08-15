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

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  homeWorld: z.enum(DarkHeresyHomeWorlds, {
      required_error: "You must select a home world."
  }),
  worldVariant: z.string().optional(),
  careerPath: z.enum(DarkHeresyCareerPaths, {
      required_error: "You must select a career path."
  }),
  backstory: z.string().optional(),
  divination: z.string({ required_error: 'Please select a divination.' }),
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

export function DarkHeresyCharacterForm() {
  const { toast } = useToast();
  const router = useRouter();
  const { addCharacter } = useCharacterContext();
  const [showAllQuirks, setShowAllQuirks] = React.useState(false);
  const [availableQuirks, setAvailableQuirks] = React.useState<string[]>([]);

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
      ? (WORLD_VARIANT_LABELS[watchedHomeWorld] || "World Variant") 
      : "Waiting for Home World selection...";
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

  // Reset world variant when home world changes
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
            title: 'Character Created!',
            description: 'Your new Dark Heresy character has been saved.',
        });
        router.push(`/${docRef.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warhammer 40k: Dark Heresy Character Details</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-base font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Character Name</FormLabel><FormControl><Input placeholder="Jax Valerius" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                  control={form.control}
                  name="homeWorld"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home World</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a home world" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyHomeWorlds.map(world => (
                            <SelectItem key={world} value={world}>{world}</SelectItem>
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
                      <FormLabel>{worldVariantLabel}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={!watchedHomeWorld}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchedHomeWorld ? "Select a variant" : "Select home world first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableWorldVariants.map(variant => (
                            <SelectItem key={variant} value={variant}>{variant}</SelectItem>
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
                      <FormLabel>Career Path</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a career path" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DarkHeresyCareerPaths.map(path => (
                            <SelectItem key={path} value={path}>{path}</SelectItem>
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
                <h3 className="text-base font-medium">Description</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="divination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Divination</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a divination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DIVINATIONS.map(({ divination }) => (
                              <SelectItem key={divination} value={divination}>
                                {divination}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Divination Effect</FormLabel>
                    <Input
                      readOnly
                      value={divinationEffect}
                      placeholder="Effect appears here"
                      className="border-dashed bg-muted/50"
                    />
                  </FormItem>
                  <FormField
                      control={form.control}
                      name="quirk"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quirk</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!watchedHomeWorld && !showAllQuirks}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a quirk" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableQuirks.map((quirk) => (
                                <SelectItem key={quirk} value={quirk}>{quirk}</SelectItem>
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
                            Show all quirks
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><FormControl><Input placeholder="1.8m" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight</FormLabel><FormControl><Input placeholder="80kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input placeholder="25" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="skinColor" render={({ field }) => (<FormItem><FormLabel>Skin Color</FormLabel><FormControl><Input placeholder="Pale" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="hairColor" render={({ field }) => (<FormItem><FormLabel>Hair Color</FormLabel><FormControl><Input placeholder="Black" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="eyeColor" render={({ field }) => (<FormItem><FormLabel>Eye Color</FormLabel><FormControl><Input placeholder="Grey" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>
            
             <FormField
              control={form.control}
              name="backstory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Backstory</FormLabel>
                  <FormControl><Textarea placeholder="Born in the underhive of Scintilla..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
                <h3 className="text-base font-medium">Progression</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="experience" render={({ field }) => (<FormItem><FormLabel>Experience</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="totalExpSpent" render={({ field }) => (<FormItem><FormLabel>Total EXP Spent</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-medium">Characteristics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <FormField control={form.control} name="weaponSkill" render={({ field }) => (<FormItem><FormLabel>Weapon Skill</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="ballisticSkill" render={({ field }) => (<FormItem><FormLabel>Ballistic Skill</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="strength" render={({ field }) => (<FormItem><FormLabel>Strength</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="toughness" render={({ field }) => (<FormItem><FormLabel>Toughness</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="agility" render={({ field }) => (<FormItem><FormLabel>Agility</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="intelligence" render={({ field }) => (<FormItem><FormLabel>Intelligence</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="perception" render={({ field }) => (<FormItem><FormLabel>Perception</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="willpower" render={({ field }) => (<FormItem><FormLabel>Willpower</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fellowship" render={({ field }) => (<FormItem><FormLabel>Fellowship</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="influence" render={({ field }) => (<FormItem><FormLabel>Influence</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-medium">Other Stats</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="wounds" render={({ field }) => (<FormItem><FormLabel>Wounds</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fatePoints" render={({ field }) => (<FormItem><FormLabel>Fate Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>
          </CardContent>
           <CardFooter>
            <Button type="submit">Create Character</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
