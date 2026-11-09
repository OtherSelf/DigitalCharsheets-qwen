// src/components/demo-landing.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Sparkles, Sword, UserPlus } from 'lucide-react';

import { CharacterSheet } from '@/components/sheets/character-sheet';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: DEMO_LANDING ────────────────────────────────────────────────
 * Общий демо-лендинг: гостевая главная («/») и отдельный маршрут «/demo».
 * Раньше разметка дублировалась в двух страницах, теперь тексты берутся из
 * словарей (en/ru), а отличаются только ссылкой «Начать создание персонажа».
 */

// 🎯 LANDMARK: DEMO_MOCK_DATA_DND
const demoDndCharacter: Character = {
  id: 'demo-dnd-1',
  userId: 'demo',
  name: 'Thorin Ironforge',
  characterClass: 'Fighter',
  gameSystem: 'Dungeons & Dragons',
  backstory:
    'A seasoned warrior from the northern mountains, seeking glory and gold.',
  notes: 'Demo character for preview purposes.',
  questLog: [],
  level: 3,
  race: 'Dwarf',
  background: 'Soldier',
  alignment: 'Lawful Good',
  experiencePoints: 900,
  inspiration: '0',
  proficiencyBonus: 2,
  stats: {
    strength: 16,
    dexterity: 12,
    constitution: 15,
    intelligence: 10,
    wisdom: 13,
    charisma: 8,
  },
  savingThrows: [],
  skills: [],
  armorClass: 18,
  speed: 25,
  hitPoints: { current: 28, max: 28 },
  temporaryHitPoints: 0,
  hitDice: '3d10',
  deathSaves: { successes: 0, failures: 0 },
  otherProficienciesAndLanguages: ['Common', 'Dwarvish'],
  attacks: [],
  personalityTraits: ['I face problems head-on.'],
  ideals: ['Tradition. The ancient traditions of my people must be preserved.'],
  bonds: ['I will bring glory to my clan.'],
  flaws: ['I am suspicious of strangers.'],
  featuresAndTraits: ['Darkvision', 'Dwarven Resilience'],
  equipment: [],
  currency: { cp: 0, sp: 0, gp: 15, pp: 0, ep: 0 },
  inventory: [],
  spells: [],
} as Character;

// 🎯 LANDMARK: DEMO_MOCK_DATA_DH
const demoDhCharacter: Character = {
  id: 'demo-dh-1',
  userId: 'demo',
  name: 'Inquisitor Vane',
  characterClass: 'Acolyte',
  gameSystem: 'Dark Heresy',
  backstory:
    'A dedicated servant of the Inquisition, rooting out heresy in the underhive.',
  notes: 'Demo character for preview purposes.',
  questLog: [],
  edition: '1st',
  homeWorld: 'Hive World',
  worldVariant: 'Scintilla',
  careerPath: 'Guardsman',
  rank: 'Rank 1',
  divination: 'The Emperor Protects',
  divinationEffect: '+10 to next test',
  quirk: 'Always cleans their weapon',
  height: '180 cm',
  weight: '75 kg',
  age: '28',
  skinColor: 'Pale',
  hairColor: 'Black',
  eyeColor: 'Grey',
  experience: 500,
  totalExpSpent: 500,
  alternatePath: null,
  advancedPath: null,
  stats: {
    weaponSkill: 35,
    ballisticSkill: 30,
    strength: 35,
    toughness: 40,
    agility: 35,
    intelligence: 40,
    perception: 45,
    willpower: 40,
    fellowship: 35,
    influence: 30,
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
  wounds: { current: 12, max: 12 },
  fatePoints: { current: 2, max: 2 },
  insanityPoints: { total: 5 },
  corruptionPoints: { total: 0 },
  wealth: { throneGelt: 50, monthlyIncome: 10 },
  movement: { walkHalf: 2, walkFull: 4, charge: 8, run: 12 },
  equipment: {
    armor: {
      Head: { ap: 3, type: 'Flak', mods: '', quality: 'Common' },
      'Right arm': null,
      Body: { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
      'Left arm': null,
      'Right leg': null,
      'Left leg': null,
    },
    weapons: {
      melee: [
        {
          id: 'm1',
          name: 'Chainsword',
          type: 'Melee',
          range: '-',
          penetration: '2',
          damage: '1d10+3 R',
          traits: 'Tearing',
          equipped: true,
        },
      ],
      ranged: [
        {
          id: 'r1',
          name: 'Lasgun',
          type: 'Basic',
          range: '100m',
          rof: 'S/3/-',
          damage: '1d10+3 E',
          clip: 60,
          clipSize: 60,
          reload: 'Full',
          traits: '',
          equipped: true,
        },
      ],
    },
  },
  inventory: [],
  skills: [],
  talents: [],
  fatigue1st: { current: 0 },
  fatigue2nd: { current: 0 },
  criticalConditions: [],
} as Character;

interface DemoLandingProps {
  /** Куда ведёт «Начать создание персонажа» (у гостевой главной и /demo разное). */
  createHref?: string;
}

export function DemoLanding({ createHref = '/new/manual' }: DemoLandingProps) {
  const { t } = useTranslation();
  const [previewSystem, setPreviewSystem] = useState<
    'Dungeons & Dragons' | 'Dark Heresy' | null
  >(null);

  const activeCharacter =
    previewSystem === 'Dungeons & Dragons'
      ? demoDndCharacter
      : previewSystem === 'Dark Heresy'
        ? demoDhCharacter
        : null;

  // Имя персонажа в переводе остаётся подстановкой внутри фразы.
  const [hintBeforeName, hintAfterName] = t('demoModeHint').split('{name}');

  return (
    <>
      {/* 🎯 LANDMARK: DEMO_HERO */}
      <div className="mb-10 space-y-4 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          {t('demoHeroTitle')}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {t('demoHeroSubtitle')}
        </p>
      </div>

      {/* 🎯 LANDMARK: DEMO_ACTION_CARDS */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="transition-colors hover:border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('demoCreateCardTitle')}
            </CardTitle>
            <CardDescription>{t('demoCreateCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={createHref}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('demoCreateCardAction')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-primary" />
              {t('demoExploreCardTitle')}
            </CardTitle>
            <CardDescription>{t('demoExploreCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={
                previewSystem === 'Dungeons & Dragons' ? 'default' : 'outline'
              }
              className="w-full justify-start"
              onClick={() => setPreviewSystem('Dungeons & Dragons')}
            >
              {t('demoPreviewDnd')}
            </Button>
            <Button
              variant={previewSystem === 'Dark Heresy' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setPreviewSystem('Dark Heresy')}
            >
              {t('demoPreviewDh')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 🎯 LANDMARK: DEMO_SHEET_PREVIEW */}
      {activeCharacter && (
        <div className="space-y-4 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col justify-between gap-4 rounded-lg border border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-primary">
                {t('demoModeActive')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {hintBeforeName}
                <strong>{activeCharacter.name}</strong>
                {hintAfterName}
              </p>
            </div>
            <Button asChild variant="default" className="shrink-0">
              <Link href="/login">
                <UserPlus className="mr-2 h-4 w-4" />
                {t('demoCreateAccountToSave')}
              </Link>
            </Button>
          </div>

          <div className="rounded-lg border bg-card p-4 md:p-6">
            <CharacterSheet
              character={activeCharacter}
              activeCompactSection="info-section"
            />
          </div>
        </div>
      )}
    </>
  );
}
