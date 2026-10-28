'use client';

import * as React from 'react';
import { type DnDCompanion, type DnDSkill, type DnDSavingThrow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '@/components/ui/label';
import { Edit, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { DndStatsSection } from './stats-section';
import { DndSavesSkillsSection } from './saves-skills-section';
import { DndCombatSection } from './combat-section';
import { DndNarrativeSection } from './narrative-section';
import { DndAttunementSection } from './attunement-section';
import { DndInventorySection } from './inventory-section';
import { DndSpellsSection } from './spells-section';
import { DndCharacterInfoSection } from './character-info-section';
import { DndProgressionSection } from './progression-section';
import { DndDivineBoonsSection } from './divine-boons-section';

const DEFAULT_SKILLS: DnDSkill[] = [
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

const DEFAULT_SAVING_THROWS: DnDSavingThrow[] = [
  { name: 'strength', proficient: false, value: 0 },
  { name: 'dexterity', proficient: false, value: 0 },
  { name: 'constitution', proficient: false, value: 0 },
  { name: 'intelligence', proficient: false, value: 0 },
  { name: 'wisdom', proficient: false, value: 0 },
  { name: 'charisma', proficient: false, value: 0 },
];

const SKILL_STAT_MAP: Record<string, keyof DnDCompanion['stats']> = {
  acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence', athletics: 'strength',
  deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma',
  investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', sleightOfHand: 'dexterity',
  stealth: 'dexterity', survival: 'wisdom',
};

const SECTION_LABELS: Record<string, string> = {
  stats: 'characteristics',
  combat: 'combatStats',
  attacks: 'attacksAndSpellcasting',
  inventory: 'inventory',
  spells: 'spells',
  narrative: 'narrativeSection',
  info: 'characterInfo',
  progression: 'progression',
  divineBoons: 'divineBoons',
  hitDice: 'hitDice',
};

interface CompanionSheetProps {
  companion: DnDCompanion;
  onUpdate: (updates: Partial<DnDCompanion>) => void;
  onDelete: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

export function CompanionSheet({ companion, onUpdate, onDelete, isEditing, onToggleEdit }: CompanionSheetProps) {
  const { t } = useTranslation();
  const narrativeRef = React.useRef<{ saveAll: () => void }>(null);
  const attunementRef = React.useRef<{ saveAll: () => void }>(null);
  const inventoryRef = React.useRef<{ saveAll: () => void }>(null);
  const characterInfoRef = React.useRef<{ saveAll: () => void }>(null);
  const combatRef = React.useRef<{ saveAll: () => void }>(null);
  const boonsRef = React.useRef<{ saveAll: () => void }>(null);

  const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
  const [isStatsEditing, setIsStatsEditing] = React.useState(false);
  const [isSavesEditing, setIsSavesEditing] = React.useState(false);
  const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
  const [isOtherProficienciesEditing, setIsOtherProficienciesEditing] = React.useState(false);
  
  const [progressionData, setProgressionData] = React.useState({
    characterClass: companion.characterClass || companion.type || 'NPC',
    level: companion.level || 1,
    experiencePoints: companion.experiencePoints || 0,
    isMulticlass: companion.isMulticlass || false,
    multiclasses: companion.multiclasses || []
  });
  const [expToCount, setExpToCount] = React.useState(0);
  
  const [stats, setStats] = React.useState(companion.stats);
  const [savingThrows, setSavingThrows] = React.useState<DnDSavingThrow[]>(
    companion.savingThrows && companion.savingThrows.length > 0 
      ? companion.savingThrows 
      : DEFAULT_SAVING_THROWS
  );
  const [skills, setSkills] = React.useState(companion.skills && companion.skills.length > 0 ? companion.skills : DEFAULT_SKILLS);
  const [otherProficienciesAndLanguages, setOtherProficienciesAndLanguages] = React.useState<string[]>(companion.otherProficienciesAndLanguages || []);
  const [newProfItem, setNewProfItem] = React.useState('');

  const profBonus = parseInt(companion.proficiencyBonus?.replace('+', '') || '2');

  const calculatedSkills = React.useMemo(() => {
    return skills.map(skill => {
      const statKey = SKILL_STAT_MAP[skill.name];
      if (!statKey || isSkillsEditing) return skill;
      const mod = Math.floor((stats[statKey] - 10) / 2);
      return { ...skill, value: mod + (skill.proficient ? profBonus : 0) + (skill.expertise ? profBonus * 2 : 0) };
    });
  }, [skills, stats, profBonus, isSkillsEditing]);

  const passivePerception = 10 + (calculatedSkills.find(s => s.name === 'perception')?.value || 0);

  const calculatedSavingThrows = React.useMemo(() => {
    return savingThrows.map(st => {
      const statKey = st.name.toLowerCase() as keyof typeof stats;
      const mod = Math.floor((stats[statKey] - 10) / 2);
      return { ...st, value: mod + (st.proficient ? profBonus : 0) };
    });
  }, [savingThrows, stats, profBonus]);

  const handleSaveProgression = React.useCallback(() => {
    onUpdate({ ...progressionData });
    setIsProgressionEditing(false);
  }, [progressionData, onUpdate]);

  const handleSaveStats = React.useCallback(() => {
    onUpdate({ stats });
    setIsStatsEditing(false);
  }, [stats, onUpdate]);

  const handleSaveSaves = React.useCallback(() => {
    onUpdate({ savingThrows: calculatedSavingThrows });
    setIsSavesEditing(false);
  }, [calculatedSavingThrows, onUpdate]);

  const handleSaveSkills = React.useCallback(() => {
    onUpdate({ skills: calculatedSkills });
    setIsSkillsEditing(false);
  }, [calculatedSkills, onUpdate]);

  const handleSaveOtherProf = React.useCallback(() => {
    onUpdate({ otherProficienciesAndLanguages });
    setIsOtherProficienciesEditing(false);
  }, [otherProficienciesAndLanguages, onUpdate]);

  const show = {
    stats: companion.showStats ?? true,
    combat: companion.showCombat ?? true,
    attacks: companion.showAttacks ?? true,
    inventory: companion.showInventory ?? true,
    spells: companion.showSpells ?? false,
    narrative: companion.showNarrative ?? false,
    info: companion.showInfo ?? false,
    progression: companion.showProgression ?? false,
    divineBoons: companion.showDivineBoons ?? false,
    hitDice: companion.showHitDice ?? true,
  };

  const combatStats = React.useMemo(() => ({
    armorClass: companion.armorClass,
    speed: typeof companion.speed === 'string' ? parseInt(companion.speed) || 30 : companion.speed,
    hitPoints: companion.hitPoints || { current: 10, max: 10 },
    temporaryHitPoints: companion.temporaryHitPoints || 0,
    deathSaves: companion.deathSaves || { successes: 0, failures: 0 },
    hitPointsNotes: companion.hitPointsNotes || '',
    hpTracking: companion.hpTracking || ''
  }), [companion.armorClass, companion.speed, companion.hitPoints, companion.temporaryHitPoints, companion.deathSaves, companion.hitPointsNotes, companion.hpTracking]);

  const stableEmptyArray = React.useMemo(() => [], []);
  const stableEmptyObject = React.useMemo(() => ({}), []);

  const toggleVisibility = (key: keyof typeof show) => {
    const fieldKey = `show${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof DnDCompanion;
    onUpdate({ [fieldKey]: !show[key] });
  };

  return (
    <Card className="p-6 border-2">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between p-0 mb-6 border-b pb-4 gap-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input 
                value={companion.name} 
                onChange={e => onUpdate({ name: e.target.value })} 
                className="h-10 text-xl font-bold w-full" 
                placeholder={t('companionNamePlaceholder')} 
              />
              <div className="flex gap-2">
                <Input 
                  value={companion.type} 
                  onChange={e => onUpdate({ type: e.target.value })} 
                  className="h-8 text-sm flex-1" 
                  placeholder={t('companionTypePlaceholder')} 
                />
                <Input 
                  value={companion.size} 
                  onChange={e => onUpdate({ size: e.target.value })} 
                  className="h-8 text-sm flex-1" 
                  placeholder={t('companionSizePlaceholder')} 
                />
              </div>
            </div>
          ) : (
            <div>
              <CardTitle className="text-2xl font-bold">{companion.name || t('unnamedCompanion')}</CardTitle>
              {(companion.type || companion.size) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {companion.size}{companion.size && companion.type ? ', ' : ''}{companion.type}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="icon" 
            variant={isEditing ? "default" : "outline"} 
            onClick={onToggleEdit} 
            className={cn("h-9 w-9", isEditing && "bg-green-600 hover:bg-green-700")}
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-destructive hover:bg-destructive/10" 
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {isEditing && (
        <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg border mb-6">
          <Label className="text-xs font-bold uppercase w-full mb-1">{t('showSections')}</Label>
          {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(key => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox 
                id={`show-${key}`} 
                checked={show[key as keyof typeof show]} 
                onCheckedChange={() => toggleVisibility(key as keyof typeof show)} 
              />
              <Label htmlFor={`show-${key}`} className="text-sm capitalize cursor-pointer">
                {t(SECTION_LABELS[key])}
              </Label>
            </div>
          ))}
        </div>
      )}

      <CardContent className="p-0">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-6 items-stretch">
            {show.progression && (
              <DndProgressionSection
                progressionData={progressionData}
                setProgressionData={setProgressionData}
                expToCount={expToCount}
                setExpToCount={setExpToCount}
                isProgressionEditing={isProgressionEditing}
                setIsProgressionEditing={setIsProgressionEditing}
                handleSaveProgression={handleSaveProgression}
              />
            )}
            
            {show.divineBoons && (
              <DndDivineBoonsSection
                ref={boonsRef}
                characterId={`companion-${companion.id}`}
                initialBoons={companion.divineBoons || []}
                isCompactView={false}
                activeCompactSection=""
              />
            )}
            
            {show.info && (
              <DndCharacterInfoSection
                ref={characterInfoRef}
                characterId={`companion-${companion.id}`}
                initialName={companion.name}
                initialHeaderData={{
                  background: companion.background || '',
                  race: companion.race || companion.type || '',
                  alignment: companion.alignment || '',
                  age: companion.age || '',
                  eyes: companion.eyes || '',
                  skin: companion.skin || '',
                  height: companion.height || '',
                  weight: companion.weight || '',
                  hair: companion.hair || '',
                  backstory: companion.backstory || '',
                  notes: companion.notes || ''
                }}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {show.stats && (
              <DndStatsSection
                characterId={`companion-${companion.id}`}
                stats={stats}
                setStats={setStats}
                isStatsEditing={isStatsEditing}
                setIsStatsEditing={setIsStatsEditing}
                handleSaveStats={handleSaveStats}
                statNotes={companion.statNotes}
                otherProficienciesAndLanguages={otherProficienciesAndLanguages}
                setOtherProficienciesAndLanguages={setOtherProficienciesAndLanguages}
                isOtherProficienciesEditing={isOtherProficienciesEditing}
                setIsOtherProficienciesEditing={setIsOtherProficienciesEditing}
                newProfItem={newProfItem}
                setNewProfItem={setNewProfItem}
                handleSaveOtherProf={handleSaveOtherProf}
                isCompactView={false}
                activeCompactSection=""
                proficiencyBonus={profBonus}
                passivePerception={passivePerception}
              />
            )}

            {show.stats && (
              <DndSavesSkillsSection
                characterId={`companion-${companion.id}`}
                savingThrows={savingThrows}
                setSavingThrows={setSavingThrows}
                isSavesEditing={isSavesEditing}
                setIsSavesEditing={setIsSavesEditing}
                handleSaveSaves={handleSaveSaves}
                calculatedSavingThrows={calculatedSavingThrows}
                skills={skills}
                setSkills={setSkills}
                isSkillsEditing={isSkillsEditing}
                setIsSkillsEditing={setIsSkillsEditing}
                handleSaveSkills={handleSaveSkills}
                calculatedSkills={calculatedSkills}
                isCompactView={false}
                activeCompactSection=""
                proficiencyBonus={profBonus}
              />
            )}

            {show.combat && (
              <DndCombatSection
                key={`combat-${companion.id}`}
                ref={combatRef}
                characterId={`companion-${companion.id}`}
                initialCombatStats={combatStats}
                initialExhaustion={companion.exhaustion || 0}
                initialHitDiceUsed={companion.hitDiceUsed ?? stableEmptyObject}
                initialAttacks={companion.attacks ?? stableEmptyArray}
                initialCombatResources={companion.combatResources ?? stableEmptyArray}
                initialSpellcastingEntries={companion.spellcastingEntries ?? stableEmptyArray}
                stats={stats}
                proficiencyBonus={profBonus}
                progressionData={progressionData}
                isCompactView={false}
                activeCompactSection=""
                manualHitDice={companion.hitDice || 'None'} 
                onManualHitDiceChange={(value) => onUpdate({ hitDice: value })}
              />
            )}

            <div className="md:col-span-3 space-y-6">
              {show.narrative && (
                <DndNarrativeSection
                  ref={narrativeRef}
                  characterId={`companion-${companion.id}`}
                  initialData={{
                    personalityTraits: companion.personalityTraits || [],
                    ideals: companion.ideals || [],
                    bonds: companion.bonds || [],
                    flaws: companion.flaws || [],
                    featuresAndTraits: companion.featuresAndTraits || [],
                    divineBoons: []
                  }}
                />
              )}

              {show.inventory && (
                <>
                  <DndAttunementSection
                    ref={attunementRef}
                    characterId={`companion-${companion.id}`}
                    initialItems={companion.attunementItems || []}
                  />
                  <DndInventorySection
                    ref={inventoryRef}
                    characterId={`companion-${companion.id}`}
                    initialCurrency={companion.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }}
                    initialEquipment={companion.equipment || []}
                  />
                </>
              )}
            </div>
          </div>

          {show.spells && (
            <DndSpellsSection
              characterId={`companion-${companion.id}`}
              initialSpells={companion.spells || []}
              initialSpellSlots={companion.spellSlots}
              initialSpellcastingEntries={companion.spellcastingEntries || []}
              stats={stats}
              proficiencyBonus={profBonus}
              isCompactView={false}
              activeCompactSection=""
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}