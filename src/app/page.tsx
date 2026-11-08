// src/app/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CharacterCard } from '@/components/characters/character-card';
import { Header } from '@/components/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useCharacterContext } from '@/context/character-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { type Character } from '@/lib/types';
import { buildBackupExport, exportFileName } from '@/lib/export-utils';
import { 
  PlusCircle, 
  FileDown, 
  Settings2, 
  Shield, 
  Sword, 
  UserPlus, 
  LogIn, 
  Sparkles 
} from 'lucide-react';
import Loading from './loading';
import { ImportCharacterDialog } from '@/components/import-character-dialog';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { CharacterSheet } from '@/components/sheets/character-sheet';

// 🎯 LANDMARK: DEMO_MOCK_DATA_DND
const demoDndCharacter: Character = {
  id: 'demo-dnd-1',
  userId: 'demo',
  name: 'Thorin Ironforge',
  characterClass: 'Fighter',
  gameSystem: 'Dungeons & Dragons',
  backstory: 'A seasoned warrior from the northern mountains, seeking glory and gold.',
  notes: 'Demo character for preview purposes.',
  questLog: [],
  level: 3,
  race: 'Dwarf',
  background: 'Soldier',
  alignment: 'Lawful Good',
  experiencePoints: 900,
  inspiration: '0',
  proficiencyBonus: 2,
  stats: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 13, charisma: 8 },
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
  backstory: 'A dedicated servant of the Inquisition, rooting out heresy in the underhive.',
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
    weaponSkill: 35, ballisticSkill: 30, strength: 35, toughness: 40,
    agility: 35, intelligence: 40, perception: 45, willpower: 40, fellowship: 35, influence: 30
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
      'Head': { ap: 3, type: 'Flak', mods: '', quality: 'Common' },
      'Right arm': null,
      'Body': { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
      'Left arm': null,
      'Right leg': null,
      'Left leg': null,
    },
    weapons: {
      melee: [{ id: 'm1', name: 'Chainsword', type: 'Melee', range: '-', penetration: '2', damage: '1d10+3 R', traits: 'Tearing', equipped: true }],
      ranged: [{ id: 'r1', name: 'Lasgun', type: 'Basic', range: '100m', rof: 'S/3/-', damage: '1d10+3 E', clip: 60, clipSize: 60, reload: 'Full', traits: '', equipped: true }],
    }
  },
  inventory: [],
  skills: [],
  talents: [],
  fatigue1st: { current: 0 },
  fatigue2nd: { current: 0 },
  criticalConditions: [],
} as Character;

// 🎯 LANDMARK: DEMO_LANDING_VIEW_COMPONENT
function DemoLandingView() {
  const [previewSystem, setPreviewSystem] = useState<'Dungeons & Dragons' | 'Dark Heresy' | null>(null);
  const { t } = useTranslation();

  const activeCharacter = previewSystem === 'Dungeons & Dragons' 
    ? demoDndCharacter 
    : previewSystem === 'Dark Heresy' 
    ? demoDhCharacter 
    : null;

  return (
    <>
      {/* 🎯 LANDMARK: DEMO_SCROLL_OVERRIDE - Override body height constraint */}
      <style jsx global>{`
        html, body {
          height: auto !important;
          overflow-y: auto !important;
        }
      `}</style>
      
      <div className="bg-background">
        {/* 🎯 LANDMARK: DEMO_HEADER */}
        <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-headline font-bold text-lg">Digital Character Sheets</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  {t('login') || 'Login / Register'}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl pb-20">
          {/* 🎯 LANDMARK: DEMO_HERO */}
          <div className="text-center mb-10 space-y-4">
            <h1 className="text-4xl font-headline font-bold tracking-tight">
              Try Before You Commit
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our digital character sheets for D&D 5e and Dark Heresy. 
              Create a new character or preview a pre-made sheet. When you're ready to save your progress, simply create an account!
            </p>
          </div>

          {/* 🎯 LANDMARK: DEMO_ACTION_CARDS */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Create Your Own Character
                </CardTitle>
                <CardDescription>
                  Start building your hero from scratch. Your progress will be saved locally, and you can create an account at the end to keep it forever.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/new/manual">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Start Character Creation
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sword className="h-5 w-5 text-primary" />
                  Explore Pre-made Sheets
                </CardTitle>
                <CardDescription>
                  Interact with a fully populated demo character sheet to see how the system works. Create an account to save changes or make your own.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant={previewSystem === 'Dungeons & Dragons' ? 'default' : 'outline'} 
                  className="w-full justify-start"
                  onClick={() => setPreviewSystem('Dungeons & Dragons')}
                >
                  Preview D&D 5e Character
                </Button>
                <Button 
                  variant={previewSystem === 'Dark Heresy' ? 'default' : 'outline'} 
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
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg gap-4">
                <div>
                  <h3 className="font-semibold text-primary">Demo Mode Active</h3>
                  <p className="text-sm text-muted-foreground">
                    You are viewing a preview of <strong>{activeCharacter.name}</strong>. Changes made here are temporary until you create an account.
                  </p>
                </div>
                <Button asChild variant="default" className="shrink-0">
                  <Link href="/login">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account to Save
                  </Link>
                </Button>
              </div>
              
              <div className="border rounded-lg bg-card p-4 md:p-6">
                <CharacterSheet 
                  character={activeCharacter} 
                  activeCompactSection="info-section" 
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// 🎯 LANDMARK: MAIN_DASHBOARD_PAGE
export default function DashboardPage() {
  const { characters, isLoaded, isCompactView } = useCharacterContext();
  const { user, isUserLoading } = useLocalAuth();
  const { t } = useTranslation();

  // «Backup All»: сервер отдаёт листы, клиент упаковывает их в стандартный
  // конверт и называет файл по шаблону dcs_characters_all_<логин>_<дата>.json.
  const handleBackupAll = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        console.error('Backup export failed:', res.status, await res.text());
        return;
      }
      const exported = await res.json();
      const backup = buildBackupExport(exported as Character[], user.username);
      downloadJSON(backup, exportFileName('backup', { login: user.username }));
    } catch (error) {
      console.error('Backup export failed:', error);
    }
  };

  if (!isLoaded || isUserLoading) {
    return <Loading />;
  }

  // 🎯 LANDMARK: UNREGISTERED_DEMO_VIEW_REDIRECT
  if (!user) {
    return <DemoLandingView />;
  }

  return (
    <>
      <DynamicFavicon gameSystem="default" />
      <div className="flex flex-col h-dvh">
        {/* 🎯 LANDMARK: HEADER_WITH_MOBILE_ACTIONS */}
        <Header
          mobileActions={
            <>
              <DropdownMenuItem asChild>
                <Link href="/stats-editor" className="flex items-center cursor-pointer">
                  <Settings2 className="mr-2 h-4 w-4" />
                  <span>{t('statsEditor')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center cursor-pointer"
                disabled={!user}
                onClick={handleBackupAll}
              >
                <FileDown className="mr-2 h-4 w-4" />
                <span>{t('backupAll')}</span>
              </DropdownMenuItem>
            </>
          }
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 safe-area-bottom">
          <div className="mb-6 sm:mb-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl font-headline font-bold">
                {t('existingCharacters')}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                {t('companionText')}
              </p>
            </div>
            {/* 🎯 LANDMARK: DESKTOP_BUTTON_GROUP - Hidden on mobile, visible on sm+ */}
            <div className="hidden sm:flex flex-row gap-2 w-auto">
              <Button variant="outline" size="sm" asChild className="justify-start">
                <Link href="/stats-editor">
                  <Settings2 className="mr-2 h-4 w-4 shrink-0" />
                  {t('statsEditor')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!user}
                onClick={handleBackupAll}
                className="justify-start"
              >
                <FileDown className="mr-2 h-4 w-4 shrink-0" />
                {t('backupAll')}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('myCharacters')}</CardTitle>
              <CardDescription>
                {t('allHeroes')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'grid gap-4',
                  isCompactView
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}
              >
                {characters.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
                {isCompactView ? (
                  <Button variant="outline" asChild className="flex items-center justify-center w-full h-16 sm:h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                    <Link href="/new/manual">
                      <PlusCircle className="h-6 w-6 sm:h-8 sm:w-8 mr-3 sm:mr-4" />
                      <span className="font-semibold text-sm sm:text-base">{t('createNew')}</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" asChild className="flex flex-col items-center justify-center w-full h-full min-h-[180px] sm:min-h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors duration-200 text-muted-foreground hover:text-accent-foreground p-0 bg-transparent">
                    <Link href="/new/manual">
                      <PlusCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-2" />
                      <span className="font-semibold text-sm sm:text-base">{t('createNew')}</span>
                    </Link>
                  </Button>
                )}
                <ImportCharacterDialog isCompactView={isCompactView} />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}