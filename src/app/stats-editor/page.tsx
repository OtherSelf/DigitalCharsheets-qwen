'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalAuth } from '@/context/local-auth-context';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DarkHeresyCharacter, DnD5eCharacter } from '@/lib/types';

// ─── STAT DEFINITIONS ──────────────────────────────────────────────
const DH_STATS = [
  { key: 'weaponSkill', labelKey: 'weaponSkill' },
  { key: 'ballisticSkill', labelKey: 'ballisticSkill' },
  { key: 'strength', labelKey: 'strength' },
  { key: 'toughness', labelKey: 'toughness' },
  { key: 'agility', labelKey: 'agility' },
  { key: 'intelligence', labelKey: 'intelligence' },
  { key: 'perception', labelKey: 'perception' },
  { key: 'willpower', labelKey: 'willpower' },
  { key: 'fellowship', labelKey: 'fellowship' },
  { key: 'influence', labelKey: 'influence' },
];

const DND_STATS = [
  { key: 'strength', labelKey: 'statStrAbbr' },
  { key: 'dexterity', labelKey: 'statDexAbbr' },
  { key: 'constitution', labelKey: 'statConAbbr' },
  { key: 'intelligence', labelKey: 'statIntAbbr' },
  { key: 'wisdom', labelKey: 'statWisAbbr' },
  { key: 'charisma', labelKey: 'statChaAbbr' },
];

// ─── EDIT STATE TYPES ──────────────────────────────────────────────
interface StatsEdit {
  id: string;
  name: string;
  gameSystem: string;
  stats: Record<string, number>;
  saved: boolean;
}

interface DHVitalsEdit {
  id: string;
  name: string;
  wounds: { current: number; max: number; notes: string };
  fatePoints: { current: number; max: number; notes: string };
  insanityPoints: { total: number; notes: string };
  corruptionPoints: { total: number; notes: string };
  experience: number;
  saved: boolean;
}

interface DnDVitalsEdit {
  id: string;
  name: string;
  level: number;
  hitPoints: { current: number; max: number };
  armorClass: number;
  proficiencyBonus: number;
  speed: string;
  experiencePoints: number;
  saved: boolean;
}

type TabId = 'stats' | 'dh-vitals' | 'dnd-vitals';

// ─── HELPERS ───────────────────────────────────────────────────────
function getDndExperience(char: any): number {
  return char.experiencePoints ?? char.experience ?? 0;
}

export default function StatsEditorPage() {
  const { user } = useLocalAuth();
  const { characters, updateCharacter, isLoaded } = useCharacterContext();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [statsEdits, setStatsEdits] = useState<StatsEdit[]>([]);
  const [dhVitalsEdits, setDhVitalsEdits] = useState<DHVitalsEdit[]>([]);
  const [dndVitalsEdits, setDndVitalsEdits] = useState<DnDVitalsEdit[]>([]);
  const [saveStatus, setSaveStatus] = useState('');

  // Load all edit states from characters
  useEffect(() => {
    if (!isLoaded || characters.length === 0) return;

    // Stats edits
    const stats = characters.map(char => {
      const isDH = char.gameSystem === 'Dark Heresy';
      const statKeys = isDH ? DH_STATS : DND_STATS;
      const defaultStats: Record<string, number> = {};
      statKeys.forEach(s => {
        defaultStats[s.key] = (char as any).stats?.[s.key] || (isDH ? 30 : 10);
      });
      return { id: char.id, name: char.name || 'Unnamed', gameSystem: char.gameSystem, stats: defaultStats, saved: false };
    });
    setStatsEdits(stats);

    // DH Vitals edits
    const dhChars = characters.filter(c => c.gameSystem === 'Dark Heresy');
    const dhVitals = dhChars.map(char => {
      const dh = char as DarkHeresyCharacter;
      return {
        id: char.id,
        name: char.name || 'Unnamed',
        wounds: {
          current: dh.wounds?.current ?? 0,
          max: dh.wounds?.max ?? 0,
          notes: dh.wounds?.notes ?? '',
        },
        fatePoints: {
          current: dh.fatePoints?.current ?? 0,
          max: dh.fatePoints?.max ?? 0,
          notes: dh.fatePoints?.notes ?? '',
        },
        insanityPoints: {
          total: dh.insanityPoints?.total ?? 0,
          notes: dh.insanityPoints?.notes ?? '',
        },
        corruptionPoints: {
          total: dh.corruptionPoints?.total ?? 0,
          notes: dh.corruptionPoints?.notes ?? '',
        },
        experience: dh.experience ?? 0,
        saved: false,
      };
    });
    setDhVitalsEdits(dhVitals);

    // DnD Vitals edits
    const dndChars = characters.filter(c => c.gameSystem === 'Dungeons & Dragons');
    const dndVitals = dndChars.map(char => {
      const dnd = char as DnD5eCharacter;
      return {
        id: char.id,
        name: char.name || 'Unnamed',
        level: dnd.level ?? 1,
        hitPoints: {
          current: dnd.hitPoints?.current ?? 0,
          max: dnd.hitPoints?.max ?? 0,
        },
        armorClass: dnd.armorClass ?? 10,
        proficiencyBonus: dnd.proficiencyBonus ?? 2,
        speed: String(dnd.speed ?? '30ft'),
        experiencePoints: getDndExperience(char),
        saved: false,
      };
    });
    setDndVitalsEdits(dndVitals);
  }, [isLoaded, characters]);

  const flashStatus = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // ─── STATS HANDLERS ──────────────────────────────────────────────
  const handleStatChange = (charId: string, statKey: string, value: string) => {
    const num = parseInt(value, 10) || 0;
    setStatsEdits(prev => prev.map(e =>
      e.id === charId ? { ...e, stats: { ...e.stats, [statKey]: num }, saved: false } : e
    ));
  };

  const handleSaveStats = (charId: string) => {
    const edit = statsEdits.find(e => e.id === charId);
    if (!edit) return;
    updateCharacter(charId, { stats: edit.stats } as any);
    setStatsEdits(prev => prev.map(e => e.id === charId ? { ...e, saved: true } : e));
    flashStatus(`${t('savedStatsFor')} "${edit.name}"`);
  };

  const handleSaveAllStats = () => {
    statsEdits.filter(e => !e.saved).forEach(edit => {
      updateCharacter(edit.id, { stats: edit.stats } as any);
    });
    setStatsEdits(prev => prev.map(e => ({ ...e, saved: true })));
    flashStatus(t('allStatsSaved'));
  };

  // ─── DH VITALS HANDLERS ──────────────────────────────────────────
  const handleDHVitalChange = (charId: string, field: string, subField: string | null, value: string) => {
    const num = parseInt(value, 10) || 0;
    setDhVitalsEdits(prev => prev.map(e => {
      if (e.id !== charId) return e;
      const updated = { ...e, saved: false };
      if (subField) {
        (updated as any)[field] = { ...(updated as any)[field], [subField]: num };
      } else {
        (updated as any)[field] = num;
      }
      return updated;
    }));
  };

  const handleSaveDHVitals = (charId: string) => {
    const edit = dhVitalsEdits.find(e => e.id === charId);
    if (!edit) return;
    updateCharacter(charId, {
      wounds: edit.wounds,
      fatePoints: edit.fatePoints,
      insanityPoints: edit.insanityPoints,
      corruptionPoints: edit.corruptionPoints,
      experience: edit.experience,
    } as any);
    setDhVitalsEdits(prev => prev.map(e => e.id === charId ? { ...e, saved: true } : e));
    flashStatus(`${t('savedVitalsFor')} "${edit.name}"`);
  };

  const handleSaveAllDHVitals = () => {
    dhVitalsEdits.filter(e => !e.saved).forEach(edit => {
      updateCharacter(edit.id, {
        wounds: edit.wounds,
        fatePoints: edit.fatePoints,
        insanityPoints: edit.insanityPoints,
        corruptionPoints: edit.corruptionPoints,
        experience: edit.experience,
      } as any);
    });
    setDhVitalsEdits(prev => prev.map(e => ({ ...e, saved: true })));
    flashStatus(t('allDhVitalsSaved'));
  };

  // ─── DND VITALS HANDLERS ─────────────────────────────────────────
  const handleDnDVitalChange = (charId: string, field: string, subField: string | null, value: string) => {
    setDndVitalsEdits(prev => prev.map(e => {
      if (e.id !== charId) return e;
      const updated = { ...e, saved: false };
      if (field === 'speed') {
        (updated as any)[field] = value;
      } else {
        const num = parseInt(value, 10) || 0;
        if (subField) {
          (updated as any)[field] = { ...(updated as any)[field], [subField]: num };
        } else {
          (updated as any)[field] = num;
        }
      }
      return updated;
    }));
  };

  const handleSaveDnDVitals = (charId: string) => {
    const edit = dndVitalsEdits.find(e => e.id === charId);
    if (!edit) return;
    updateCharacter(charId, {
      level: edit.level,
      hitPoints: edit.hitPoints,
      armorClass: edit.armorClass,
      proficiencyBonus: edit.proficiencyBonus,
      speed: edit.speed,
      experiencePoints: edit.experiencePoints,
      experience: edit.experiencePoints,
    } as any);
    setDndVitalsEdits(prev => prev.map(e => e.id === charId ? { ...e, saved: true } : e));
    flashStatus(`${t('savedVitalsFor')} "${edit.name}"`);
  };

  const handleSaveAllDnDVitals = () => {
    dndVitalsEdits.filter(e => !e.saved).forEach(edit => {
      updateCharacter(edit.id, {
        level: edit.level,
        hitPoints: edit.hitPoints,
        armorClass: edit.armorClass,
        proficiencyBonus: edit.proficiencyBonus,
        speed: edit.speed,
        experiencePoints: edit.experiencePoints,
        experience: edit.experiencePoints,
      } as any);
    });
    setDndVitalsEdits(prev => prev.map(e => ({ ...e, saved: true })));
    flashStatus(t('allDndVitalsSaved'));
  };

  // ─── GUARDS ──────────────────────────────────────────────────────
  if (!user) {
    router.push('/login');
    return null;
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t('loadingCharacters')}</p>
      </div>
    );
  }

  // Split stats by system for rendering
  const dhStats = statsEdits.filter(e => e.gameSystem === 'Dark Heresy');
  const dndStats = statsEdits.filter(e => e.gameSystem === 'Dungeons & Dragons');

  const tabButton = (id: TabId, label: string) => (
    <Button
      variant={activeTab === id ? 'default' : 'outline'}
      size="sm"
      onClick={() => setActiveTab(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-headline font-bold">{t('bulkEditor')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('bulkEditorDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 flex-wrap">
          {tabButton('stats', t('statsTab'))}
          {tabButton('dh-vitals', `${t('dhVitals')} (${dhVitalsEdits.length})`)}
          {tabButton('dnd-vitals', `${t('dndVitals')} (${dndVitalsEdits.length})`)}
        </div>

        {/* Save Status */}
        {saveStatus && (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              {saveStatus}
            </AlertDescription>
          </Alert>
        )}

        {/* ─── STATS TAB ─────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleSaveAllStats}>
                <Save className="mr-2 h-4 w-4" /> {t('saveAllStats')}
              </Button>
            </div>

            {dhStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('dhStats')} ({dhStats.length})</CardTitle>
                  <CardDescription>{t('dhStatsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="space-y-2 min-w-[900px]">
                    <div className="grid grid-cols-[180px_repeat(10,1fr)_60px] gap-1 items-center text-xs font-semibold text-muted-foreground border-b pb-2">
                      <span>{t('characterName')}</span>
                      {DH_STATS.map(s => <span key={s.key} className="text-center">{t(s.labelKey)}</span>)}
                      <span></span>
                    </div>
                    {dhStats.map(char => (
                      <div key={char.id} className="grid grid-cols-[180px_repeat(10,1fr)_60px] gap-1 items-center">
                        <span className="text-sm font-medium truncate" title={char.name}>{char.name}</span>
                        {DH_STATS.map(s => (
                          <Input
                            key={s.key}
                            type="number"
                            value={char.stats[s.key] || 0}
                            onChange={(e) => handleStatChange(char.id, s.key, e.target.value)}
                            className="h-8 text-center text-sm"
                            min={0} max={100}
                          />
                        ))}
                        <Button size="sm" variant={char.saved ? 'outline' : 'default'} onClick={() => handleSaveStats(char.id)} className="h-8">
                          {char.saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {dndStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('dndStats')} ({dndStats.length})</CardTitle>
                  <CardDescription>{t('dhStatsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="space-y-2 min-w-[700px]">
                    <div className="grid grid-cols-[180px_repeat(6,1fr)_60px] gap-1 items-center text-xs font-semibold text-muted-foreground border-b pb-2">
                      <span>{t('characterName')}</span>
                      {DND_STATS.map(s => <span key={s.key} className="text-center">{t(s.labelKey)}</span>)}
                      <span></span>
                    </div>
                    {dndStats.map(char => (
                      <div key={char.id} className="grid grid-cols-[180px_repeat(6,1fr)_60px] gap-1 items-center">
                        <span className="text-sm font-medium truncate" title={char.name}>{char.name}</span>
                        {DND_STATS.map(s => (
                          <Input
                            key={s.key}
                            type="number"
                            value={char.stats[s.key] || 0}
                            onChange={(e) => handleStatChange(char.id, s.key, e.target.value)}
                            className="h-8 text-center text-sm"
                            min={0} max={30}
                          />
                        ))}
                        <Button size="sm" variant={char.saved ? 'outline' : 'default'} onClick={() => handleSaveStats(char.id)} className="h-8">
                          {char.saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── DH VITALS TAB ─────────────────────────────────────── */}
        {activeTab === 'dh-vitals' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleSaveAllDHVitals}>
                <Save className="mr-2 h-4 w-4" /> {t('saveAllDhVitals')}
              </Button>
            </div>

            {dhVitalsEdits.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('dhVitals')} ({dhVitalsEdits.length})</CardTitle>
                  <CardDescription>{t('dhVitalsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="space-y-2 min-w-[800px]">
                    <div className="grid grid-cols-[180px_repeat(5,1fr)_60px] gap-2 items-center text-xs font-semibold text-muted-foreground border-b pb-2">
                      <span>{t('characterName')}</span>
                      <span className="text-center">{t('woundsMax')}</span>
                      <span className="text-center">{t('fateMax')}</span>
                      <span className="text-center">{t('insanity')}</span>
                      <span className="text-center">{t('corruption')}</span>
                      <span className="text-center">{t('experience')}</span>
                      <span></span>
                    </div>
                    {dhVitalsEdits.map(char => (
                      <div key={char.id} className="grid grid-cols-[180px_repeat(5,1fr)_60px] gap-2 items-center">
                        <span className="text-sm font-medium truncate" title={char.name}>{char.name}</span>
                        <Input type="number" value={char.wounds.max} onChange={(e) => handleDHVitalChange(char.id, 'wounds', 'max', e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.fatePoints.max} onChange={(e) => handleDHVitalChange(char.id, 'fatePoints', 'max', e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.insanityPoints.total} onChange={(e) => handleDHVitalChange(char.id, 'insanityPoints', 'total', e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.corruptionPoints.total} onChange={(e) => handleDHVitalChange(char.id, 'corruptionPoints', 'total', e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.experience} onChange={(e) => handleDHVitalChange(char.id, 'experience', null, e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Button size="sm" variant={char.saved ? 'outline' : 'default'} onClick={() => handleSaveDHVitals(char.id)} className="h-8">
                          {char.saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{t('noDhCharacters')}</CardContent></Card>
            )}
          </div>
        )}

        {/* ─── DND VITALS TAB ────────────────────────────────────── */}
        {activeTab === 'dnd-vitals' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleSaveAllDnDVitals}>
                <Save className="mr-2 h-4 w-4" /> {t('saveAllDndVitals')}
              </Button>
            </div>

            {dndVitalsEdits.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('dndVitals')} ({dndVitalsEdits.length})</CardTitle>
                  <CardDescription>{t('dndVitalsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="space-y-2 min-w-[850px]">
                    <div className="grid grid-cols-[180px_70px_90px_70px_70px_100px_110px_60px] gap-2 items-center text-xs font-semibold text-muted-foreground border-b pb-2">
                      <span>{t('characterName')}</span>
                      <span className="text-center">{t('level')}</span>
                      <span className="text-center">{t('hpMax')}</span>
                      <span className="text-center">{t('armorClass')}</span>
                      <span className="text-center">{t('profShort')}</span>
                      <span className="text-center">{t('speed')}</span>
                      <span className="text-center">{t('experience')}</span>
                      <span></span>
                    </div>
                    {dndVitalsEdits.map(char => (
                      <div key={char.id} className="grid grid-cols-[180px_70px_90px_70px_70px_100px_110px_60px] gap-2 items-center">
                        <span className="text-sm font-medium truncate" title={char.name}>{char.name}</span>
                        <Input type="number" value={char.level} onChange={(e) => handleDnDVitalChange(char.id, 'level', null, e.target.value)} className="h-8 text-center text-sm" min={1} max={20} />
                        <Input type="number" value={char.hitPoints.max} onChange={(e) => handleDnDVitalChange(char.id, 'hitPoints', 'max', e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.armorClass} onChange={(e) => handleDnDVitalChange(char.id, 'armorClass', null, e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="number" value={char.proficiencyBonus} onChange={(e) => handleDnDVitalChange(char.id, 'proficiencyBonus', null, e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Input type="text" value={char.speed} onChange={(e) => handleDnDVitalChange(char.id, 'speed', null, e.target.value)} className="h-8 text-center text-sm" />
                        <Input type="number" value={char.experiencePoints} onChange={(e) => handleDnDVitalChange(char.id, 'experiencePoints', null, e.target.value)} className="h-8 text-center text-sm" min={0} />
                        <Button size="sm" variant={char.saved ? 'outline' : 'default'} onClick={() => handleSaveDnDVitals(char.id)} className="h-8">
                          {char.saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{t('noDndCharacters')}</CardContent></Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {characters.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('noCharactersFound')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}