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
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';

import { calculateLevelFromExp, createDnd5eDefaults } from './defaults';

// Map internal English names to translation keys
const RACE_TRANSLATION_KEYS: Record<string, string> = {
  Aarakocra: 'dnd.raceAarakocra',
  Aasimar: 'dnd.raceAasimar',
  Autognome: 'dnd.raceAutognome',
  'Astral elf': 'dnd.raceAstralelf',
  Bugbear: 'dnd.raceBugbear',
  Vedalken: 'dnd.raceVedalken',
  Verdan: 'dnd.raceVerdan',
  'Simic hybrid': 'dnd.raceSimichybrid',
  Gith: 'dnd.raceGith',
  Giff: 'dnd.raceGiff',
  Gnome: 'dnd.raceGnome',
  Goblin: 'dnd.raceGoblin',
  Goliath: 'dnd.raceGoliath',
  Grung: 'dnd.raceGrung',
  Dwarf: 'dnd.raceDwarf',
  Genasi: 'dnd.raceGenasi',
  Dragonborn: 'dnd.raceDragonborn',
  Harengon: 'dnd.raceHarengon',
  Kalashtar: 'dnd.raceKalashtar',
  Kender: 'dnd.raceKender',
  Kenku: 'dnd.raceKenku',
  Centaur: 'dnd.raceCentaur',
  Kobold: 'dnd.raceKobold',
  Warforged: 'dnd.raceWarforged',
  Leonin: 'dnd.raceLeonin',
  Locathah: 'dnd.raceLocathah',
  Loxodon: 'dnd.raceLoxodon',
  Lizardfolk: 'dnd.raceLizardfolk',
  Minotaur: 'dnd.raceMinotaur',
  Orc: 'dnd.raceOrc',
  Plasmoid: 'dnd.racePlasmoid',
  'Half-orc': 'dnd.raceHalforc',
  Halfling: 'dnd.raceHalfling',
  'Half-elf': 'dnd.raceHalfelf',
  Satyr: 'dnd.raceSatyr',
  Owlin: 'dnd.raceOwlin',
  Tabaxi: 'dnd.raceTabaxi',
  Tiefling: 'dnd.raceTiefling',
  Tortle: 'dnd.raceTortle',
  'Thri-kreen': 'dnd.raceThrikreen',
  Triton: 'dnd.raceTriton',
  Firbolg: 'dnd.raceFirbolg',
  Fairy: 'dnd.raceFairy',
  Hadozee: 'dnd.raceHadozee',
  Hobgoblin: 'dnd.raceHobgoblin',
  Changeling: 'dnd.raceChangeling',
  Human: 'dnd.raceHuman',
  Shifter: 'dnd.raceShifter',
  Elf: 'dnd.raceElf',
  'Yuan-ti Pureblood': 'dnd.raceYuantPureblood',
};

const BG_TRANSLATION_KEYS: Record<string, string> = {
  Entertainer: 'dnd.bgEntertainer',
  Urchin: 'dnd.bgUrchin',
  Noble: 'dnd.bgNoble',
  'Guild Artisan': 'dnd.bgGuildArtisan',
  Sailor: 'dnd.bgSailor',
  Sage: 'dnd.bgSage',
  'Folk Hero': 'dnd.bgFolkHero',
  Hermit: 'dnd.bgHermit',
  Outlander: 'dnd.bgOutlander',
  Charlatan: 'dnd.bgCharlatan',
  Pirate: 'dnd.bgPirate',
  Criminal: 'dnd.bgCriminal',
  Acolyte: 'dnd.bgAcolyte',
  Soldier: 'dnd.bgSoldier',
  Gambler: 'dnd.bgGambler',
  Plaintiff: 'dnd.bgPlaintiff',
  'Failed Merchant': 'dnd.bgFailedMerchant',
  'Celebrity Adventurers Scion': 'dnd.bgCelebrityAdventurersScion',
  'Rival Intern': 'dnd.bgRivalIntern',
  'Giant Foundling': 'dnd.bgGiantFoundling',
  'Rune Carver': 'dnd.bgRuneCarver',
  Rewarded: 'dnd.bgRewarded',
  Ruined: 'dnd.bgRuined',
  'House Agent': 'dnd.bgHouseAgent',
  'Volstrucker Agent': 'dnd.bgVolstruckerAgent',
  Grinner: 'dnd.bgGrinner',
  'Golgari Agent': 'dnd.bgGolgariAgent',
  'Gruul Anarch': 'dnd.bgGruulAnarch',
  'Izzet Engineer': 'dnd.bgIzzetEngineer',
  'Rakdos Cultist': 'dnd.bgRakdosCultist',
  'Boros Legionnaire': 'dnd.bgBorosLegionnaire',
  'Dimir Operative': 'dnd.bgDimirOperative',
  'Selesnya Initiate': 'dnd.bgSelesnyaInitiate',
  'Orzhov Representative': 'dnd.bgOrzhovRepresentative',
  'Simic Scientist': 'dnd.bgSimicScientist',
  'Azorius Functionary': 'dnd.bgAzoriusFunctionary',
  Athlete: 'dnd.bgAthlete',
  'Planar Philosopher': 'dnd.bgPlanarPhilosopher',
  'Gate Warden': 'dnd.bgGateWarden',
  'Astral Drifter': 'dnd.bgAstralDrifter',
  Wildspacer: 'dnd.bgWildspacer',
  'Mercenary Veteran': 'dnd.bgMercenaryVeteran',
  'Urban Bounty Hunter': 'dnd.bgUrbanBountyHunter',
  'City Watch': 'dnd.bgCityWatch',
  'Far Traveler': 'dnd.bgFarTraveler',
  'Waterdhavian Noble': 'dnd.bgWaterdhavianNoble',
  'Clan Crafter': 'dnd.bgClanCrafter',
  Inheritor: 'dnd.bgInheritor',
  'Faction Agent': 'dnd.bgFactionAgent',
  Courtier: 'dnd.bgCourtier',
  'Knight of the Order': 'dnd.bgKnightoftheOrder',
  'Uthgardt Tribe Member': 'dnd.bgUthgardtTribeMember',
  'Cloistered Scholar': 'dnd.bgCloisteredScholar',
  'Haunted One': 'dnd.bgHauntedOne',
  Investigator: 'dnd.bgInvestigator',
  Faceless: 'dnd.bgFaceless',
  'Mage of Hight Sorcery': 'dnd.bgMageofHightSorcery',
  'Knight of Solamnia': 'dnd.bgKnightofSolamnia',
  Smuggler: 'dnd.bgSmuggler',
  Shipwright: 'dnd.bgShipwright',
  Marine: 'dnd.bgMarine',
  Fisher: 'dnd.bgFisher',
  'Witherbloom Student': 'dnd.bgWitherbloomStudent',
  'Quandrix Student': 'dnd.bgQuandrixStudent',
  'Lorehold Student': 'dnd.bgLoreholdStudent',
  'Prismari Student': 'dnd.bgPrismariStudent',
  'Silverquill Student': 'dnd.bgSilverquillStudent',
  Anthropologist: 'dnd.bgAnthropologist',
  Archeologist: 'dnd.bgArcheologist',
  'Witchlight Hand': 'dnd.bgWitchlightHand',
  Feylost: 'dnd.bgFeylost',
};

const DND_CLASSES = [
  'Artificer',
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
] as const;

const DND_RACES = Object.keys(RACE_TRANSLATION_KEYS);
const DND_BACKGROUNDS = Object.keys(BG_TRANSLATION_KEYS);
const DND_ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

const ALIGNMENT_TRANSLATION_KEYS: Record<string, string> = {
  'Lawful Good': 'dnd.alignmentLawfulGood',
  'Neutral Good': 'dnd.alignmentNeutralGood',
  'Chaotic Good': 'dnd.alignmentChaoticGood',
  'Lawful Neutral': 'dnd.alignmentLawfulNeutral',
  'True Neutral': 'dnd.alignmentTrueNeutral',
  'Chaotic Neutral': 'dnd.alignmentChaoticNeutral',
  'Lawful Evil': 'dnd.alignmentLawfulEvil',
  'Neutral Evil': 'dnd.alignmentNeutralEvil',
  'Chaotic Evil': 'dnd.alignmentChaoticEvil',
};

export function DndCharacterForm() {
  const { toast } = useToast();
  const router = useRouter();
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();

  const formSchema = z.object({
    name: z.string().min(2, t('common.nameMinLength')),
    characterClass: z.enum(DND_CLASSES as unknown as [string, ...string[]], {
      error: t('dnd.selectClassError'),
    }),
    race: z.enum(DND_RACES as unknown as [string, ...string[]], {
      error: t('dnd.selectRaceError'),
    }),
    background: z.enum(DND_BACKGROUNDS as unknown as [string, ...string[]], {
      error: t('dnd.selectBackgroundError'),
    }),
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
    spellcastingAbility: z
      .enum([
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma',
        'none',
      ])
      .default('none'),
    spellAttackBonus: z.string().optional(),
    spellSaveDifficulty: z.coerce.number().int().optional(),
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
    const newCharacter = createDnd5eDefaults(values);

    const docRef = await addCharacter(newCharacter);

    if (docRef) {
      toast({
        title: t('common.characterCreatedTitle'),
        description: t('dnd.characterCreatedDesc'),
      });
      router.push(`/${docRef.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dnd.characterDetails')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
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
                          placeholder={t('dnd.placeholderName')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="experiencePoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.experiencePoints')}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    {t('dnd.levelAutoCalculated')}
                  </Label>
                  <div className="border-input bg-muted flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm font-bold">
                    {form.getValues('level')}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="characterClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.class')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dnd.selectClass')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DND_CLASSES.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              {t(`class${cls}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="race"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.race')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dnd.selectRace')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DND_RACES.map((race) => (
                            <SelectItem key={race} value={race}>
                              {t(RACE_TRANSLATION_KEYS[race])}
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
                  name="background"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.background')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dnd.selectBackground')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {DND_BACKGROUNDS.map((bg) => (
                            <SelectItem key={bg} value={bg}>
                              {t(BG_TRANSLATION_KEYS[bg])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="alignment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.alignment')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('dnd.selectAlignment')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DND_ALIGNMENTS.map((alignment) => (
                            <SelectItem key={alignment} value={alignment}>
                              {t(ALIGNMENT_TRANSLATION_KEYS[alignment])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.age')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eyes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.eyes')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="skin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.skin')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.height')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
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
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hair"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.hairFur')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
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
                      placeholder={t('dnd.placeholderBackstory')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('dnd.abilityScores')}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.strength')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dexterity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.dexterity')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="constitution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.constitution')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
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
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wisdom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.wisdom')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="charisma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.charisma')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-medium">
                {t('dnd.combatAndSpellStats')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="armorClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.armorClass')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="speed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.speed')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.maxHitPoints')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="spellcastingAbility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('dnd.primarySpellcastingAbility')}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('dnd.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            {t('common.none')}
                          </SelectItem>
                          <SelectItem value="intelligence">
                            {t('common.intelligence')}
                          </SelectItem>
                          <SelectItem value="wisdom">
                            {t('common.wisdom')}
                          </SelectItem>
                          <SelectItem value="charisma">
                            {t('common.charisma')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spellAttackBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.spellAttackBonus')}</FormLabel>
                      <FormControl>
                        <Input placeholder="+0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spellSaveDifficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dnd.spellSaveDC')}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="8" {...field} />
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
