'use client';

import * as React from 'react';

import { Edit, RefreshCw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import type { DnDSavingThrow, DnDSkill } from '../types';

// Внутренние имена навыков — английские, для UI нужны ключ словаря и
// сокращение (STR/DEX…).
const getSkillTranslationKey = (name: string): string => {
  const map: Record<string, string> = {
    acrobatics: 'dnd.skillAcrobatics',
    animalHandling: 'dnd.skillAnimalHandling',
    arcana: 'dnd.skillArcana',
    athletics: 'dnd.skillAthletics',
    deception: 'dnd.skillDeception',
    history: 'dnd.skillHistory',
    insight: 'dnd.skillInsight',
    intimidation: 'dnd.skillIntimidation',
    investigation: 'dnd.skillInvestigation',
    medicine: 'dnd.skillMedicine',
    nature: 'dnd.skillNature',
    perception: 'dnd.skillPerception',
    performance: 'dnd.skillPerformance',
    persuasion: 'dnd.skillPersuasion',
    religion: 'dnd.skillReligion',
    sleightOfHand: 'dnd.skillSleightOfHand',
    stealth: 'dnd.skillStealth',
    survival: 'dnd.skillSurvival',
  };
  return map[name] || name;
};

// То же для спасбросков: имя в данных не совпадает с ключом словаря.
const getSaveTranslationKey = (name: string): string => {
  const map: Record<string, string> = {
    strength: 'dnd.saveStrength',
    dexterity: 'dnd.saveDexterity',
    constitution: 'dnd.saveConstitution',
    intelligence: 'dnd.saveIntelligence',
    wisdom: 'dnd.saveWisdom',
    charisma: 'dnd.saveCharisma',
  };
  return map[name.toLowerCase()] || name;
};

const EditSaveButton = ({
  editing,
  onEdit,
  onSave,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
}) =>
  editing ? (
    <Button
      data-testid="save-button"
      size="icon"
      variant="ghost"
      onClick={onSave}
      className="h-7 w-7"
    >
      <Save className="h-4 w-4" />
    </Button>
  ) : (
    <Button
      data-testid="edit-button"
      size="icon"
      variant="outline"
      onClick={onEdit}
      className="h-7 w-7"
    >
      <Edit className="h-4 w-4" />
    </Button>
  );

interface SavesSkillsSectionProps {
  /**
   * Префикс для `id` карточек. Нужен, когда секция рендерится дважды —
   * например, в листе компаньона: без префикса на странице появляются
   * дубли `id` (`stats-card`, `hit-points-card`, ...), а на них держатся
   * `htmlFor`/`aria-*` и селекторы визуальных тестов.
   */
  idPrefix?: string;
  characterId: string;
  savingThrows: DnDSavingThrow[];
  setSavingThrows: React.Dispatch<React.SetStateAction<DnDSavingThrow[]>>;
  isSavesEditing: boolean;
  setIsSavesEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSaves: () => void;
  calculatedSavingThrows: DnDSavingThrow[];
  skills: DnDSkill[];
  setSkills: React.Dispatch<React.SetStateAction<DnDSkill[]>>;
  isSkillsEditing: boolean;
  setIsSkillsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSkills: () => void;
  calculatedSkills: DnDSkill[];
  isCompactView: boolean;
  activeCompactSection: string;
  proficiencyBonus: number;
}

export function DndSavesSkillsSection({
  characterId,
  savingThrows,
  setSavingThrows,
  isSavesEditing,
  setIsSavesEditing,
  handleSaveSaves,
  calculatedSavingThrows,
  skills,
  setSkills,
  isSkillsEditing,
  setIsSkillsEditing,
  handleSaveSkills,
  calculatedSkills,
  isCompactView,
  activeCompactSection,
  proficiencyBonus,
  idPrefix,
}: SavesSkillsSectionProps) {
  const idp = idPrefix ? `${idPrefix}-` : '';
  const { showEditButtons, getCharacter, updateCharacter } =
    useCharacterContext();
  const { t } = useTranslation();

  const character = getCharacter(characterId) as any;
  const stats = character?.stats;

  return (
    <div
      className={cn(
        'space-y-4 md:col-span-3',
        isCompactView && activeCompactSection !== 'stats-section' && 'hidden',
      )}
    >
      {/* PROFICIENCY BONUS BOX */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {t('dnd.proficiencyBonus')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="py-2 text-center text-2xl font-black">
            +{proficiencyBonus}
          </div>
        </CardContent>
      </Card>

      <Card id={`${idp}saving-throws-card`}>
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {t('dnd.savingThrows')}
          </CardTitle>
          {(showEditButtons || isSavesEditing) && (
            <EditSaveButton
              editing={isSavesEditing}
              onEdit={() => setIsSavesEditing(true)}
              onSave={handleSaveSaves}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-1 p-4 pt-0">
          {calculatedSavingThrows.map((st, i) => {
            const originalSt = savingThrows[i];
            const hasModifier = (originalSt.manualModifier ?? 0) !== 0;

            return (
              <div
                key={st.name}
                className="border-muted flex items-center gap-2 border-b py-1 last:border-0"
              >
                <Checkbox
                  checked={st.proficient}
                  onCheckedChange={(v) => {
                    const updated = savingThrows.map((s, idx) =>
                      idx === i ? { ...s, proficient: !!v } : s,
                    );
                    setSavingThrows(updated);
                    updateCharacter(characterId, { savingThrows: updated });
                  }}
                />
                <div className="w-10 text-center">
                  {isSavesEditing ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Input
                        type="number"
                        value={
                          originalSt.manualModifier === undefined
                            ? ''
                            : originalSt.manualModifier
                        }
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const val =
                            rawVal === '' ? undefined : parseInt(rawVal, 10);
                          const updated = savingThrows.map((s, idx) =>
                            idx === i ? { ...s, manualModifier: val } : s,
                          );
                          setSavingThrows(updated);
                          updateCharacter(characterId, {
                            savingThrows: updated,
                          });
                        }}
                        className="h-6 w-12 p-0 text-center text-xs"
                        placeholder="+0"
                      />
                      {hasModifier && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground h-4 w-4 p-0"
                          onClick={() => {
                            const updated = savingThrows.map((s, idx) =>
                              idx === i
                                ? { ...s, manualModifier: undefined }
                                : s,
                            );
                            setSavingThrows(updated);
                            updateCharacter(characterId, {
                              savingThrows: updated,
                            });
                          }}
                          title={t('dnd.clearManualModifier')}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-bold',
                        hasModifier && 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {st.value >= 0 ? '+' : ''}
                      {st.value}
                    </span>
                  )}
                </div>
                <span className="flex-1 text-[10px] font-bold uppercase">
                  {t(getSaveTranslationKey(st.name))}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card id={`${idp}skills-card`}>
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {t('common.skills')}
          </CardTitle>
          {(showEditButtons || isSkillsEditing) && (
            <EditSaveButton
              editing={isSkillsEditing}
              onEdit={() => setIsSkillsEditing(true)}
              onSave={handleSaveSkills}
            />
          )}
        </CardHeader>

        <CardContent className="space-y-1 p-4 pt-0">
          {calculatedSkills.map((sk, i) => {
            const originalSk = skills[i];
            const hasModifier = (originalSk.manualModifier ?? 0) !== 0;
            const displayValue = sk.value;

            return (
              <div
                key={sk.name}
                className="border-muted flex items-center gap-1.5 border-b py-1 last:border-0"
              >
                <Checkbox
                  checked={sk.proficient}
                  onCheckedChange={(v) => {
                    const updated = skills.map((s, idx) =>
                      idx === i
                        ? {
                            ...s,
                            proficient: !!v,
                            expertise: !!v ? s.expertise : false,
                          }
                        : s,
                    );
                    setSkills(updated);
                    updateCharacter(characterId, { skills: updated });
                  }}
                />
                <Checkbox
                  checked={sk.expertise || false}
                  disabled={!sk.proficient}
                  onCheckedChange={(v) => {
                    const updated = skills.map((s, idx) =>
                      idx === i ? { ...s, expertise: !!v } : s,
                    );
                    setSkills(updated);
                    updateCharacter(characterId, { skills: updated });
                  }}
                  className="border-primary/50 data-[state=checked]:bg-accent"
                />
                <div className="w-10 text-center">
                  {isSkillsEditing ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Input
                        type="number"
                        value={
                          originalSk.manualModifier === undefined
                            ? ''
                            : originalSk.manualModifier
                        }
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const val =
                            rawVal === '' ? undefined : parseInt(rawVal, 10);
                          const updated = skills.map((s, idx) =>
                            idx === i ? { ...s, manualModifier: val } : s,
                          );
                          setSkills(updated);
                          updateCharacter(characterId, { skills: updated });
                        }}
                        className="h-6 w-12 p-0 text-center text-xs"
                        placeholder="+0"
                      />
                      {hasModifier && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground h-4 w-4 p-0"
                          onClick={() => {
                            const updated = skills.map((s, idx) =>
                              idx === i
                                ? { ...s, manualModifier: undefined }
                                : s,
                            );
                            setSkills(updated);
                            updateCharacter(characterId, { skills: updated });
                          }}
                          title={t('dnd.clearManualModifier')}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-black',
                        hasModifier && 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {displayValue >= 0 ? '+' : ''}
                      {displayValue}
                    </span>
                  )}
                </div>
                <span className="flex-1 text-xs font-semibold">
                  {t(getSkillTranslationKey(sk.name))}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
