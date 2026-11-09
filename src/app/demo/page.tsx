// src/app/demo/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Sparkles, Sword, UserPlus } from 'lucide-react';

import { GuestHeader } from '@/components/layout/guest-header';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type Character } from '@/lib/types';

// 🎯 LANDMARK: DEMO_MOCK_DATA_DND
// Customize this object to match your preferred pre-made D&D character
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
// Customize this object to match your preferred pre-made Dark Heresy character
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

export default function DemoPage() {
  const [previewSystem, setPreviewSystem] = useState<
    'Dungeons & Dragons' | 'Dark Heresy' | null
  >(null);

  const activeCharacter =
    previewSystem === 'Dungeons & Dragons'
      ? demoDndCharacter
      : previewSystem === 'Dark Heresy'
        ? demoDhCharacter
        : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 🎯 LANDMARK: DEMO_HEADER → общая гостевая шапка с темой/языком/видом */}
      <GuestHeader showLoginLink />

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-8">
        {/* 🎯 LANDMARK: DEMO_HERO */}
        <div className="mb-10 space-y-4 text-center">
          <h1 className="font-headline text-4xl font-bold tracking-tight">
            Try Before You Commit
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Explore our digital character sheets for D&D 5e and Dark Heresy.
            Create a new character or preview a pre-made sheet. When you&apos;re
            ready to save your progress, simply create an account!
          </p>
        </div>

        {/* 🎯 LANDMARK: DEMO_ACTION_CARDS */}
        <div className="mb-12 grid gap-6 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create Your Own Character
              </CardTitle>
              <CardDescription>
                Start building your hero from scratch. Your progress will be
                saved locally, and you can create an account at the end to keep
                it forever.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/new">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Start Character Creation
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-primary" />
                Explore Pre-made Sheets
              </CardTitle>
              <CardDescription>
                Interact with a fully populated demo character sheet to see how
                the system works. Create an account to save changes or make your
                own.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant={
                  previewSystem === 'Dungeons & Dragons' ? 'default' : 'outline'
                }
                className="w-full justify-start"
                onClick={() => setPreviewSystem('Dungeons & Dragons')}
              >
                Preview D&D 5e Character
              </Button>
              <Button
                variant={
                  previewSystem === 'Dark Heresy' ? 'default' : 'outline'
                }
                className="w-full justify-start"
                onClick={() => setPreviewSystem('Dark Heresy')}
              >
                Preview Dark Heresy Character
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 🎯 LANDMARK: DEMO_SHEET_PREVIEW */}
        {activeCharacter && (
          <div className="space-y-4 duration-500 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col justify-between gap-4 rounded-lg border border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-primary">Demo Mode Active</h3>
                <p className="text-sm text-muted-foreground">
                  You are viewing a preview of{' '}
                  <strong>{activeCharacter.name}</strong>. Changes made here are
                  temporary until you create an account.
                </p>
              </div>
              <Button asChild variant="default" className="shrink-0">
                <Link href="/login">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account to Save
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
      </main>
    </div>
  );
}
