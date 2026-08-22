'use client';

import * as React from 'react';
import { type DnD5eCharacter, type DnDSkill, type DnDCompanion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { DndCompanionsSection } from './dnd-sections/companions-section';
import { DndSpellsSection } from './dnd-sections/spells-section';
import { DndNarrativeSection } from './dnd-sections/narrative-section';
import { DndAttunementSection } from './dnd-sections/attunement-section';
import { DndInventorySection } from './dnd-sections/inventory-section';
import { DndStatsSection } from './dnd-sections/stats-section';
import { DndSavesSkillsSection } from './dnd-sections/saves-skills-section';
import { DndProgressionSection } from './dnd-sections/progression-section';
import { DndCharacterInfoSection } from './dnd-sections/character-info-section';
import { DndCombatSection } from './dnd-sections/combat-section';
import { DndDivineBoonsSection } from './dnd-sections/divine-boons-section';

type DndSheetProps = {
  character: DnD5eCharacter;
  isCompactView: boolean;
  activeCompactSection: string;
};

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

const SKILL_STAT_MAP: Record<string, keyof DnD5eCharacter['stats']> = {
  acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence', athletics: 'strength',
  deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma',
  investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', sleightOfHand: 'dexterity',
  stealth: 'dexterity', survival: 'wisdom',
};

const EXHAUSTION_EFFECTS = [
  'No exhaustion',
  'Disadvantage on Ability Checks',
  'Speed halved',
  'Disadvantage on Attack rolls and Saving Throws',
  'Hit point maximum halved',
  'Speed reduced to 0',
  'Death',
];

export const DndSheet = React.forwardRef<any, DndSheetProps>(
  ({ character, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter } = useCharacterContext();
    const { t } = useTranslation();
    const narrativeRef = React.useRef<{ saveAll: () => void }>(null);
    const attunementRef = React.useRef<{ saveAll: () => void }>(null);
    const inventoryRef = React.useRef<{ saveAll: () => void }>(null);
    const characterInfoRef = React.useRef<{ saveAll: () => void }>(null);
    const combatRef = React.useRef<{ saveAll: () => void }>(null);
    const boonsRef = React.useRef<{ saveAll: () => void }>(null);

    // UI States
    const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
    const [isStatsEditing, setIsStatsEditing] = React.useState(false);
    const [isSavesEditing, setIsSavesEditing] = React.useState(false);
    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isOtherProficienciesEditing, setIsOtherProficienciesEditing] = React.useState(false);

    // Data States
    const [progressionData, setProgressionData] = React.useState({ characterClass: character.characterClass, level: character.level, experiencePoints: character.experiencePoints || 0, isMulticlass: character.isMulticlass || false, multiclasses: character.multiclasses || [] });
    const [expToCount, setExpToCount] = React.useState(0);
    const [stats, setStats] = React.useState(character.stats);
    const [savingThrows, setSavingThrows] = React.useState((character.savingThrows && character.savingThrows.length > 0) ? character.savingThrows : []);
    const [skills, setSkills] = React.useState((character.skills && character.skills.length > 0) ? character.skills : DEFAULT_SKILLS);
    const [otherProficienciesAndLanguages, setOtherProficienciesAndLanguages] = React.useState<string[]>(character.otherProficienciesAndLanguages || []);

    // New Items States
    const [newProfItem, setNewProfItem] = React.useState('');
    const [companions, setCompanions] = React.useState<DnDCompanion[]>(character.companions || []);
    

    // Derived values
    const proficiencyBonus = Math.floor((progressionData.level - 1) / 4) + 2;

    const calculatedSkills = React.useMemo(() => {
      return skills.map(skill => {
        const statKey = SKILL_STAT_MAP[skill.name];
        if (!statKey || isSkillsEditing) return skill;
        const mod = Math.floor((stats[statKey] - 10) / 2);
        return { ...skill, value: mod + (skill.proficient ? proficiencyBonus : 0) + (skill.expertise ? proficiencyBonus : 0) };
      });
    }, [skills, stats, proficiencyBonus, isSkillsEditing]);

    const passivePerception = 10 + (calculatedSkills.find(s => s.name === 'perception')?.value || 0);

    const calculatedSavingThrows = React.useMemo(() => {
      return savingThrows.map(st => {
        const statKey = st.name.toLowerCase() as keyof typeof stats;
        const mod = Math.floor((stats[statKey] - 10) / 2);
        return { ...st, value: mod + (st.proficient ? proficiencyBonus : 0) };
      });
    }, [savingThrows, stats, proficiencyBonus]);

    // Save Handlers
    const handleSaveProgression = React.useCallback(() => { updateCharacter(character.id, { ...progressionData }); setIsProgressionEditing(false); }, [character.id, progressionData, updateCharacter]);
    const handleSaveStats = React.useCallback(() => { updateCharacter(character.id, { stats }); setIsStatsEditing(false); }, [character.id, stats, updateCharacter]);
    const handleSaveSaves = React.useCallback(() => { updateCharacter(character.id, { savingThrows: calculatedSavingThrows }); setIsSavesEditing(false); }, [character.id, calculatedSavingThrows, updateCharacter]);
    const handleSaveSkills = React.useCallback(() => { updateCharacter(character.id, { skills: calculatedSkills }); setIsSkillsEditing(false); }, [character.id, calculatedSkills, updateCharacter]);
    const handleSaveOtherProf = React.useCallback(() => { updateCharacter(character.id, { otherProficienciesAndLanguages: otherProficienciesAndLanguages }); setIsOtherProficienciesEditing(false); }, [character.id, otherProficienciesAndLanguages, updateCharacter]);
   
    const handleSaveAll = React.useCallback(() => {
      if (isProgressionEditing) handleSaveProgression(); if (isStatsEditing) handleSaveStats();
      if (isSavesEditing) handleSaveSaves(); if (isSkillsEditing) handleSaveSkills();
      if (isOtherProficienciesEditing) handleSaveOtherProf();
      characterInfoRef.current?.saveAll();
      combatRef.current?.saveAll();
      narrativeRef.current?.saveAll();
      attunementRef.current?.saveAll();
      inventoryRef.current?.saveAll();
      boonsRef.current?.saveAll();
    }, [isProgressionEditing, isStatsEditing, isSavesEditing, isSkillsEditing, isOtherProficienciesEditing, handleSaveProgression, handleSaveStats, handleSaveSaves, handleSaveSkills, handleSaveOtherProf]);
    React.useImperativeHandle(ref, () => ({ saveAll: handleSaveAll }));


    return (
      <div className="space-y-8 pb-12">
        {/* Compact View Stats Bar - Matching Dark Heresy exactly */}
        {isCompactView && (
          <div className="bg-card px-4 py-3 border-b shadow-sm space-y-3">
            <div className="grid grid-cols-6 gap-1">
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(key => {
                const val = stats[key as keyof typeof stats]; const mod = Math.floor((val - 10) / 2);
                return (
                  <div key={key} className="flex flex-col items-center justify-center bg-background border rounded py-1 min-w-0">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase truncate w-full text-center px-0.5">{key.slice(0, 3)}</span>
                    <span className="text-xs font-black">{mod >= 0 ? `+${mod}` : mod}</span>
                    <span className="text-[8px] text-muted-foreground/60">{val}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between px-2 py-1.5 bg-background border rounded min-w-0">
                <span className="text-[8px] font-bold uppercase text-muted-foreground truncate mr-1">{t('passivePerception')}</span>
                <span className="text-xs font-black shrink-0">{passivePerception}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 bg-background border rounded min-w-0">
                <span className="text-[8px] font-bold uppercase text-muted-foreground truncate mr-1">{t('proficiencyBonus')}</span>
                <span className="text-xs font-black shrink-0">+{proficiencyBonus}</span>
              </div>
            </div>
          </div>
        )}

     {/* Progression, Divine Boons, Character Info, Narrative */}
     <div className={cn("flex flex-col gap-6 items-stretch", isCompactView && activeCompactSection !== 'info-section' && "hidden")}>
       <div className="flex flex-col md:flex-row gap-6 items-stretch">
         <DndProgressionSection
           progressionData={progressionData}
           setProgressionData={setProgressionData}
           expToCount={expToCount}
           setExpToCount={setExpToCount}
           isProgressionEditing={isProgressionEditing}
           setIsProgressionEditing={setIsProgressionEditing}
           handleSaveProgression={handleSaveProgression}
         />
         {progressionData.level >= 20 && (
           <DndDivineBoonsSection
             ref={boonsRef}
             characterId={character.id}
             initialBoons={character.divineBoons || []}
             isCompactView={isCompactView}
             activeCompactSection={activeCompactSection}
           />
         )}
         <DndCharacterInfoSection
           ref={characterInfoRef}
           characterId={character.id}
           initialName={character.name}
           initialHeaderData={{
             background: character.background,
             race: character.race,
             alignment: character.alignment || '',
             age: character.age || '',
             eyes: character.eyes || '',
             skin: character.skin || '',
             height: character.height || '',
             weight: character.weight || '',
             hair: character.hair || '',
             backstory: character.backstory || '',
             notes: character.notes || ''
           }}
         />
         {/* Compact View Only: Narrative Section moves to Info */}
         {isCompactView && (
           <DndNarrativeSection
             ref={narrativeRef}
             characterId={character.id}
             initialData={{
               personalityTraits: character.personalityTraits || [],
               ideals: character.ideals || [],
               bonds: character.bonds || [],
               flaws: character.flaws || [],
               featuresAndTraits: character.featuresAndTraits || [],
               divineBoons: character.divineBoons || []
             }}
           />
         )}
       </div>
     </div>

        {/* Stats, Saves, Skills, Combat */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <DndStatsSection
            characterId={character.id}
            stats={stats}
            setStats={setStats}
            isStatsEditing={isStatsEditing}
            setIsStatsEditing={setIsStatsEditing}
            handleSaveStats={handleSaveStats}
            statNotes={character.statNotes}
            otherProficienciesAndLanguages={otherProficienciesAndLanguages}
            setOtherProficienciesAndLanguages={setOtherProficienciesAndLanguages}
            isOtherProficienciesEditing={isOtherProficienciesEditing}
            setIsOtherProficienciesEditing={setIsOtherProficienciesEditing}
            newProfItem={newProfItem}
            setNewProfItem={setNewProfItem}
            handleSaveOtherProf={handleSaveOtherProf}
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
          />
          <DndSavesSkillsSection
            characterId={character.id}
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
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
          />
          <DndCombatSection
            ref={combatRef}
            characterId={character.id}
            initialCombatStats={{ armorClass: character.armorClass, speed: character.speed, hitPoints: character.hitPoints || { current: 10, max: 10 }, temporaryHitPoints: character.temporaryHitPoints || 0, deathSaves: character.deathSaves || { successes: 0, failures: 0 } }}
            initialExhaustion={character.exhaustion || 0}
            initialHitDiceUsed={character.hitDiceUsed || {}}
            initialAttacks={character.attacks || []}
            initialCombatResources={character.combatResources || []}
            initialSpellcastingEntries={character.spellcastingEntries || []}
            stats={stats}
            proficiencyBonus={proficiencyBonus}
            progressionData={progressionData}
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
          />

          <div className={cn("md:col-span-3 space-y-6", isCompactView && activeCompactSection !== 'inventory-section' && "hidden")}>
            {/* Desktop View Only: Strict Order */}
            {!isCompactView && (
              <>
                <DndNarrativeSection
                  ref={narrativeRef}
                  characterId={character.id}
                  initialData={{
                    personalityTraits: character.personalityTraits || [],
                    ideals: character.ideals || [],
                    bonds: character.bonds || [],
                    flaws: character.flaws || [],
                    featuresAndTraits: character.featuresAndTraits || [],
                    divineBoons: character.divineBoons || []
                  }}
                />
                <DndAttunementSection
                  ref={attunementRef}
                  characterId={character.id}
                  initialItems={character.attunementItems || []}
                />
                <DndInventorySection
                  ref={inventoryRef}
                  characterId={character.id}
                  initialCurrency={character.currency || { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 }}
                  initialEquipment={character.equipment ?? []}
                />
              </>
            )}

            {/* Compact View Only: Attunement and Inventory */}
            {isCompactView && (
              <>
                <DndAttunementSection
                  ref={attunementRef}
                  characterId={character.id}
                  initialItems={character.attunementItems || []}
                />
                <DndInventorySection
                  ref={inventoryRef}
                  characterId={character.id}
                  initialCurrency={character.currency || { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 }}
                  initialEquipment={character.equipment ?? []}
                />
              </>
            )}
          </div>
        </div>

        {/* Spells */}
        <DndSpellsSection
          characterId={character.id}
            initialSpells={character.spells || []}
            initialSpellSlots={character.spellSlots}
            initialSpellcasting={{
              spellcastingAbility: character.spellcastingAbility || 'none',
              spellAttackBonus: character.spellAttackBonus || '',
              spellSaveDifficulty: character.spellSaveDifficulty || 0
            }}
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
          />

        {/* Companions */}
        <DndCompanionsSection
          characterId={character.id}
          companions={companions}
          setCompanions={setCompanions}
          isCompactView={isCompactView}
          activeCompactSection={activeCompactSection}
        />
      </div>
    );
  }
);

DndSheet.displayName = 'DndSheet';