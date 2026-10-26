'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { DnD5eCharacter } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import React from 'react';
import { useTranslation } from '@/context/language-context';

// Map internal English names to translation keys
const RACE_TRANSLATION_KEYS: Record<string, string> = {
  "Aarakocra": "raceAarakocra", "Aasimar": "raceAasimar", "Autognome": "raceAutognome", "Astral elf": "raceAstralelf",
  "Bugbear": "raceBugbear", "Vedalken": "raceVedalken", "Verdan": "raceVerdan", "Simic hybrid": "raceSimichybrid",
  "Gith": "raceGith", "Giff": "raceGiff", "Gnome": "raceGnome", "Goblin": "raceGoblin", "Goliath": "raceGoliath",
  "Grung": "raceGrung", "Dwarf": "raceDwarf", "Genasi": "raceGenasi", "Dragonborn": "raceDragonborn", "Harengon": "raceHarengon",
  "Kalashtar": "raceKalashtar", "Kender": "raceKender", "Kenku": "raceKenku", "Centaur": "raceCentaur", "Kobold": "raceKobold",
  "Warforged": "raceWarforged", "Leonin": "raceLeonin", "Locathah": "raceLocathah", "Loxodon": "raceLoxodon", "Lizardfolk": "raceLizardfolk",
  "Minotaur": "raceMinotaur", "Orc": "raceOrc", "Plasmoid": "racePlasmoid", "Half-orc": "raceHalforc", "Halfling": "raceHalfling",
  "Half-elf": "raceHalfelf", "Satyr": "raceSatyr", "Owlin": "raceOwlin", "Tabaxi": "raceTabaxi", "Tiefling": "raceTiefling",
  "Tortle": "raceTortle", "Thri-kreen": "raceThrikreen", "Triton": "raceTriton", "Firbolg": "raceFirbolg", "Fairy": "raceFairy",
  "Hadozee": "raceHadozee", "Hobgoblin": "raceHobgoblin", "Changeling": "raceChangeling", "Human": "raceHuman", "Shifter": "raceShifter",
  "Elf": "raceElf", "Yuan-ti Pureblood": "raceYuantPureblood",
};

const BG_TRANSLATION_KEYS: Record<string, string> = {
  "Entertainer": "bgEntertainer", "Urchin": "bgUrchin", "Noble": "bgNoble", "Guild Artisan": "bgGuildArtisan",
  "Sailor": "bgSailor", "Sage": "bgSage", "Folk Hero": "bgFolkHero", "Hermit": "bgHermit", "Outlander": "bgOutlander",
  "Charlatan": "bgCharlatan", "Pirate": "bgPirate", "Criminal": "bgCriminal", "Acolyte": "bgAcolyte", "Soldier": "bgSoldier",
  "Gambler": "bgGambler", "Plaintiff": "bgPlaintiff", "Failed Merchant": "bgFailedMerchant", "Celebrity Adventurers Scion": "bgCelebrityAdventurersScion",
  "Rival Intern": "bgRivalIntern", "Giant Foundling": "bgGiantFoundling", "Rune Carver": "bgRuneCarver", "Rewarded": "bgRewarded",
  "Ruined": "bgRuined", "House Agent": "bgHouseAgent", "Volstrucker Agent": "bgVolstruckerAgent", "Grinner": "bgGrinner",
  "Golgari Agent": "bgGolgariAgent", "Gruul Anarch": "bgGruulAnarch", "Izzet Engineer": "bgIzzetEngineer", "Rakdos Cultist": "bgRakdosCultist",
  "Boros Legionnaire": "bgBorosLegionnaire", "Dimir Operative": "bgDimirOperative", "Selesnya Initiate": "bgSelesnyaInitiate", "Orzhov Representative": "bgOrzhovRepresentative",
  "Simic Scientist": "bgSimicScientist", "Azorius Functionary": "bgAzoriusFunctionary", "Athlete": "bgAthlete", "Planar Philosopher": "bgPlanarPhilosopher",
  "Gate Warden": "bgGateWarden", "Astral Drifter": "bgAstralDrifter", "Wildspacer": "bgWildspacer", "Mercenary Veteran": "bgMercenaryVeteran",
  "Urban Bounty Hunter": "bgUrbanBountyHunter", "City Watch": "bgCityWatch", "Far Traveler": "bgFarTraveler", "Waterdhavian Noble": "bgWaterdhavianNoble",
  "Clan Crafter": "bgClanCrafter", "Inheritor": "bgInheritor", "Faction Agent": "bgFactionAgent", "Courtier": "bgCourtier",
  "Knight of the Order": "bgKnightoftheOrder", "Uthgardt Tribe Member": "bgUthgardtTribeMember", "Cloistered Scholar": "bgCloisteredScholar", "Haunted One": "bgHauntedOne",
  "Investigator": "bgInvestigator", "Faceless": "bgFaceless", "Mage of Hight Sorcery": "bgMageofHightSorcery", "Knight of Solamnia": "bgKnightofSolamnia",
  "Smuggler": "bgSmuggler", "Shipwright": "bgShipwright", "Marine": "bgMarine", "Fisher": "bgFisher",
  "Witherbloom Student": "bgWitherbloomStudent", "Quandrix Student": "bgQuandrixStudent", "Lorehold Student": "bgLoreholdStudent", "Prismari Student": "bgPrismariStudent",
  "Silverquill Student": "bgSilverquillStudent", "Anthropologist": "bgAnthropologist", "Archeologist": "bgArcheologist", "Witchlight Hand": "bgWitchlightHand", "Feylost": "bgFeylost",
};

const DND_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", 
  "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
] as const;

const DND_RACES = Object.keys(RACE_TRANSLATION_KEYS);
const DND_BACKGROUNDS = Object.keys(BG_TRANSLATION_KEYS);

const DND_DEFAULT_SAVING_THROWS = [
  { name: 'Strength', proficient: false, value: 0 },
  { name: 'Dexterity', proficient: false, value: 0 },
  { name: 'Constitution', proficient: false, value: 0 },
  { name: 'Intelligence', proficient: false, value: 0 },
  { name: 'Wisdom', proficient: false, value: 0 },
  { name: 'Charisma', proficient: false, value: 0 },
];

const DND_DEFAULT_SKILLS = [
  { name: 'acrobatics', label: 'Acrobatics (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'animalHandling', label: 'Animal Handling (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'arcana', label: 'Arcana (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'athletics', label: 'Athletics (Str)', proficient: false, expertise: false, value: 0 },
  { name: 'deception', label: 'Deception (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'history', label: 'History (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'insight', label: 'Insight (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'intimidation', label: 'Intimidation (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'investigation', label: 'Investigation (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'medicine', label: 'Medicine (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'nature', label: 'Nature (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'perception', label: 'Perception (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'performance', label: 'Performance (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'persuasion', label: 'Persuasion (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'religion', label: 'Religion (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'sleightOfHand', label: 'Sleight of Hand (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'stealth', label: 'Stealth (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'survival', label: 'Survival (Wis)', proficient: false, expertise: false, value: 0 },
];

const calculateLevelFromExp = (exp: number): number => {
  if (exp >= 355000) return 20;
  if (exp >= 305000) return 19;
  if (exp >= 265000) return 18;
  if (exp >= 225000) return 17;
  if (exp >= 195000) return 16;
  if (exp >= 165000) return 15;
  if (exp >= 140000) return 14;
  if (exp >= 120000) return 13;
  if (exp >= 100000) return 12;
  if (exp >= 85000) return 11;
  if (exp >= 64000) return 10;
  if (exp >= 48000) return 9;
  if (exp >= 34000) return 8;
  if (exp >= 23000) return 7;
  if (exp >= 14000) return 6;
  if (exp >= 6500) return 5;
  if (exp >= 2700) return 4;
  if (exp >= 900) return 3;
  if (exp >= 300) return 2;
  return 1;
};

export function DndCharacterForm() {
  const { toast } = useToast();
  const router = useRouter();
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();

  const formSchema = z.object({
    name: z.string().min(2, t('nameMinLength')),
    characterClass: z.enum(DND_CLASSES as unknown as [string, ...string[]], { required_error: t('selectClassError') }),
    race: z.enum(DND_RACES as unknown as [string, ...string[]], { required_error: t('selectRaceError') }),
    background: z.enum(DND_BACKGROUNDS as unknown as [string, ...string[]], { required_error: t('selectBackgroundError') }),
    alignment: z.string().optional(),
    level: z.coerce.number().int().min(1).max(20),
    experiencePoints: z.coerce.number().int().optional(),
    age: z.string().optional(),
    eyes: z.string().optional(),
    skin: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    hair: z.string().optional(),
    backstory: z.string().optional(),
    strength: z.coerce.number().int().min(1).max(30),
    dexterity: z.coerce.number().int().min(1).max(30),
    constitution: z.coerce.number().int().min(1).max(30),
    intelligence: z.coerce.number().int().min(1).max(30),
    wisdom: z.coerce.number().int().min(1).max(30),
    charisma: z.coerce.number().int().min(1).max(30),
    armorClass: z.coerce.number().int(),
    speed: z.coerce.number().int(),
    max: z.coerce.number().int(),
    spellcastingAbility: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'none']).default('none'),
    spellAttackBonus: z.string().optional(),
    spellSaveDifficulty: z.coerce.number().int().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      level: 1,
      race: 'Human',
      background: 'Acolyte',
      alignment: '',
      experiencePoints: 0,
      age: '',
      eyes: '',
      skin: '',
      height: '',
      weight: '',
      hair: '',
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      armorClass: 10,
      speed: 30,
      max: 8, 
      spellcastingAbility: 'none',
      spellAttackBonus: '',
      spellSaveDifficulty: 8,
    },
  });

  const watchedExp = form.watch('experiencePoints');
  const watchedCon = form.watch('constitution');

  React.useEffect(() => {
    if (watchedExp !== undefined) {
      form.setValue('level', calculateLevelFromExp(watchedExp));
    }
  }, [watchedExp, form]);

  React.useEffect(() => {
    if (form.getValues('level') === 1) {
      const conMod = Math.floor((watchedCon - 10) / 2);
      form.setValue('max', Math.max(1, 8 + conMod));
    }
  }, [watchedCon, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const profBonus = Math.floor((values.level - 1) / 4) + 2;

    const newCharacter: Omit<DnD5eCharacter, 'id' | 'userId'> = {
      name: values.name,
      characterClass: values.characterClass,
      race: values.race,
      background: values.background,
      alignment: values.alignment || 'Neutral',
      experiencePoints: values.experiencePoints || 0,
      age: values.age || '',
      eyes: values.eyes || '',
      skin: values.skin || '',
      height: values.height || '',
      weight: values.weight || '',
      hair: values.hair || '',
      inspiration: '',
      proficiencyBonus: profBonus,
      level: values.level,
      gameSystem: 'Dungeons & Dragons',
      backstory: values.backstory || '',
      notes: '',
      questLog: [],
      divineBoons: [],
      stats: {
        strength: values.strength,
        dexterity: values.dexterity,
        constitution: values.constitution,
        intelligence: values.intelligence,
        wisdom: values.wisdom,
        charisma: values.charisma,
      },
      savingThrows: DND_DEFAULT_SAVING_THROWS,
      skills: DND_DEFAULT_SKILLS,
      armorClass: values.armorClass,
      speed: values.speed,
      hitPoints: {
        current: values.max,
        max: values.max,
      },
      temporaryHitPoints: 0,
      hitDice: `${values.level}d8`,
      deathSaves: { successes: 0, failures: 0 },
      exhaustion: 0,
      otherProficienciesAndLanguages: [],
      attacks: [],
      spellcastingAbility: values.spellcastingAbility as any,
      spellAttackBonus: values.spellAttackBonus || '',
      spellSaveDifficulty: values.spellSaveDifficulty || 8,
      spellcastingEntries: [
        { id: 'primary', ability: values.spellcastingAbility as any, attackBonus: values.spellAttackBonus || '', saveDC: values.spellSaveDifficulty || 8 }
      ],
      personalityTraits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      featuresAndTraits: [],
      equipment: [],
      attunementItems: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 },
      inventory: [],
      spells: [],
    };
    
    const docRef = await addCharacter(newCharacter);

    if (docRef) {
        toast({
          title: t('characterCreatedTitle'),
          description: t('characterCreatedDesc'),
        });
        router.push(`/${docRef.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dndCharacterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
                <h3 className="text-base font-medium">{t('basicInformation')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('characterName')}</FormLabel>
                          <FormControl><Input placeholder={t('placeholderName')} {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="experiencePoints"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('experiencePoints')}</FormLabel>
                          <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">{t('levelAutoCalculated')}</Label>
                    <div className="h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-bold flex items-center">
                      {form.getValues('level')}
                    </div>
                  </div>
                  <FormField
                      control={form.control}
                      name="characterClass"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('class')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectClass')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DND_CLASSES.map((cls) => (
                                <SelectItem key={cls} value={cls}>{t(`class${cls}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="race"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('race')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectRace')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DND_RACES.map((race) => (
                                <SelectItem key={race} value={race}>{t(RACE_TRANSLATION_KEYS[race])}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="background"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('background')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectBackground')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              {DND_BACKGROUNDS.map((bg) => (
                                <SelectItem key={bg} value={bg}>{t(BG_TRANSLATION_KEYS[bg])}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="alignment"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('alignment')}</FormLabel>
                          <FormControl><Input placeholder={t('neutralGood')} {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>{t('age')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="eyes" render={({ field }) => (<FormItem><FormLabel>{t('eyes')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="skin" render={({ field }) => (<FormItem><FormLabel>{t('skin')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>{t('height')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>{t('weight')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="hair" render={({ field }) => (<FormItem><FormLabel>{t('hairFur')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
            </div>
            
            <FormField
              control={form.control}
              name="backstory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('backstory')}</FormLabel>
                  <FormControl><Textarea placeholder={t('placeholderBackstory')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('abilityScores')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <FormField control={form.control} name="strength" render={({ field }) => (<FormItem><FormLabel>{t('strength')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dexterity" render={({ field }) => (<FormItem><FormLabel>{t('dexterity')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="constitution" render={({ field }) => (<FormItem><FormLabel>{t('constitution')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="intelligence" render={({ field }) => (<FormItem><FormLabel>{t('intelligence')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="wisdom" render={({ field }) => (<FormItem><FormLabel>{t('wisdom')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="charisma" render={({ field }) => (<FormItem><FormLabel>{t('charisma')}</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-medium">{t('combatAndSpellStats')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="armorClass" render={({ field }) => (<FormItem><FormLabel>{t('armorClass')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="speed" render={({ field }) => (<FormItem><FormLabel>{t('speed')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="max" render={({ field }) => (<FormItem><FormLabel>{t('maxHitPoints')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <FormField
                    control={form.control}
                    name="spellcastingAbility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('primarySpellcastingAbility')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('select')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('none')}</SelectItem>
                            <SelectItem value="intelligence">{t('intelligence')}</SelectItem>
                            <SelectItem value="wisdom">{t('wisdom')}</SelectItem>
                            <SelectItem value="charisma">{t('charisma')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="spellAttackBonus" render={({ field }) => (<FormItem><FormLabel>{t('spellAttackBonus')}</FormLabel><FormControl><Input placeholder="+0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="spellSaveDifficulty" render={({ field }) => (<FormItem><FormLabel>{t('spellSaveDC')}</FormLabel><FormControl><Input type="number" placeholder="8" {...field} /></FormControl><FormMessage /></FormItem>)} />
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