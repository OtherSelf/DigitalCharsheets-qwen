'use client';

import * as React from 'react';

import { Edit, Save } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';

const RACE_TRANSLATION_KEYS: Record<string, string> = {
  Aarakocra: 'raceAarakocra',
  Aasimar: 'raceAasimar',
  Autognome: 'raceAutognome',
  'Astral elf': 'raceAstralelf',
  Bugbear: 'raceBugbear',
  Vedalken: 'raceVedalken',
  Verdan: 'raceVerdan',
  'Simic hybrid': 'raceSimichybrid',
  Gith: 'raceGith',
  Giff: 'raceGiff',
  Gnome: 'raceGnome',
  Goblin: 'raceGoblin',
  Goliath: 'raceGoliath',
  Grung: 'raceGrung',
  Dwarf: 'raceDwarf',
  Genasi: 'raceGenasi',
  Dragonborn: 'raceDragonborn',
  Harengon: 'raceHarengon',
  Kalashtar: 'raceKalashtar',
  Kender: 'raceKender',
  Kenku: 'raceKenku',
  Centaur: 'raceCentaur',
  Kobold: 'raceKobold',
  Warforged: 'raceWarforged',
  Leonin: 'raceLeonin',
  Locathah: 'raceLocathah',
  Loxodon: 'raceLoxodon',
  Lizardfolk: 'raceLizardfolk',
  Minotaur: 'raceMinotaur',
  Orc: 'raceOrc',
  Plasmoid: 'racePlasmoid',
  'Half-orc': 'raceHalforc',
  Halfling: 'raceHalfling',
  'Half-elf': 'raceHalfelf',
  Satyr: 'raceSatyr',
  Owlin: 'raceOwlin',
  Tabaxi: 'raceTabaxi',
  Tiefling: 'raceTiefling',
  Tortle: 'raceTortle',
  'Thri-kreen': 'raceThrikreen',
  Triton: 'raceTriton',
  Firbolg: 'raceFirbolg',
  Fairy: 'raceFairy',
  Hadozee: 'raceHadozee',
  Hobgoblin: 'raceHobgoblin',
  Changeling: 'raceChangeling',
  Human: 'raceHuman',
  Shifter: 'raceShifter',
  Elf: 'raceElf',
  'Yuan-ti Pureblood': 'raceYuantPureblood',
};

const BG_TRANSLATION_KEYS: Record<string, string> = {
  Entertainer: 'bgEntertainer',
  Urchin: 'bgUrchin',
  Noble: 'bgNoble',
  'Guild Artisan': 'bgGuildArtisan',
  Sailor: 'bgSailor',
  Sage: 'bgSage',
  'Folk Hero': 'bgFolkHero',
  Hermit: 'bgHermit',
  Outlander: 'bgOutlander',
  Charlatan: 'bgCharlatan',
  Pirate: 'bgPirate',
  Criminal: 'bgCriminal',
  Acolyte: 'bgAcolyte',
  Soldier: 'bgSoldier',
  Gambler: 'bgGambler',
  Plaintiff: 'bgPlaintiff',
  'Failed Merchant': 'bgFailedMerchant',
  'Celebrity Adventurers Scion': 'bgCelebrityAdventurersScion',
  'Rival Intern': 'bgRivalIntern',
  'Giant Foundling': 'bgGiantFoundling',
  'Rune Carver': 'bgRuneCarver',
  Rewarded: 'bgRewarded',
  Ruined: 'bgRuined',
  'House Agent': 'bgHouseAgent',
  'Volstrucker Agent': 'bgVolstruckerAgent',
  Grinner: 'bgGrinner',
  'Golgari Agent': 'bgGolgariAgent',
  'Gruul Anarch': 'bgGruulAnarch',
  'Izzet Engineer': 'bgIzzetEngineer',
  'Rakdos Cultist': 'bgRakdosCultist',
  'Boros Legionnaire': 'bgBorosLegionnaire',
  'Dimir Operative': 'bgDimirOperative',
  'Selesnya Initiate': 'bgSelesnyaInitiate',
  'Orzhov Representative': 'bgOrzhovRepresentative',
  'Simic Scientist': 'bgSimicScientist',
  'Azorius Functionary': 'bgAzoriusFunctionary',
  Athlete: 'bgAthlete',
  'Planar Philosopher': 'bgPlanarPhilosopher',
  'Gate Warden': 'bgGateWarden',
  'Astral Drifter': 'bgAstralDrifter',
  Wildspacer: 'bgWildspacer',
  'Mercenary Veteran': 'bgMercenaryVeteran',
  'Urban Bounty Hunter': 'bgUrbanBountyHunter',
  'City Watch': 'bgCityWatch',
  'Far Traveler': 'bgFarTraveler',
  'Waterdhavian Noble': 'bgWaterdhavianNoble',
  'Clan Crafter': 'bgClanCrafter',
  Inheritor: 'bgInheritor',
  'Faction Agent': 'bgFactionAgent',
  Courtier: 'bgCourtier',
  'Knight of the Order': 'bgKnightoftheOrder',
  'Uthgardt Tribe Member': 'bgUthgardtTribeMember',
  'Cloistered Scholar': 'bgCloisteredScholar',
  'Haunted One': 'bgHauntedOne',
  Investigator: 'bgInvestigator',
  Faceless: 'bgFaceless',
  'Mage of Hight Sorcery': 'bgMageofHightSorcery',
  'Knight of Solamnia': 'bgKnightofSolamnia',
  Smuggler: 'bgSmuggler',
  Shipwright: 'bgShipwright',
  Marine: 'bgMarine',
  Fisher: 'bgFisher',
  'Witherbloom Student': 'bgWitherbloomStudent',
  'Quandrix Student': 'bgQuandrixStudent',
  'Lorehold Student': 'bgLoreholdStudent',
  'Prismari Student': 'bgPrismariStudent',
  'Silverquill Student': 'bgSilverquillStudent',
  Anthropologist: 'bgAnthropologist',
  Archeologist: 'bgArcheologist',
  'Witchlight Hand': 'bgWitchlightHand',
  Feylost: 'bgFeylost',
};

const ALIGNMENT_TRANSLATION_KEYS: Record<string, string> = {
  'Lawful Good': 'alignmentLawfulGood',
  'Neutral Good': 'alignmentNeutralGood',
  'Chaotic Good': 'alignmentChaoticGood',
  'Lawful Neutral': 'alignmentLawfulNeutral',
  'True Neutral': 'alignmentTrueNeutral',
  'Chaotic Neutral': 'alignmentChaoticNeutral',
  'Lawful Evil': 'alignmentLawfulEvil',
  'Neutral Evil': 'alignmentNeutralEvil',
  'Chaotic Evil': 'alignmentChaoticEvil',
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

const DetailField = ({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string | number;
  editing: boolean;
  onChange: (val: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label className="text-muted-foreground text-[10px] font-bold uppercase">
      {label}
    </Label>
    {editing ? (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 p-1 text-xs"
      />
    ) : (
      <span className="truncate text-sm font-semibold">{value || '-'}</span>
    )}
  </div>
);

// Dropdown field for select options
const DetailSelectField = ({
  label,
  value,
  editing,
  onChange,
  options,
  translationKeys,
  t,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (val: string) => void;
  options: string[];
  translationKeys: Record<string, string>;
  t: (key: string) => string;
}) => (
  <div className="flex flex-col gap-1">
    <Label className="text-muted-foreground text-[10px] font-bold uppercase">
      {label}
    </Label>
    {editing ? (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {t(translationKeys[opt] || opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="truncate text-sm font-semibold">
        {value ? t(translationKeys[value] || value) : '-'}
      </span>
    )}
  </div>
);

export interface HeaderData {
  background: string;
  race: string;
  alignment: string;
  age: string;
  eyes: string;
  skin: string;
  height: string;
  weight: string;
  hair: string;
  backstory: string;
  notes: string;
}

interface CharacterInfoSectionProps {
  /**
   * Префикс для `id`: нужен, когда секция рендерится ещё и в листе
   * компаньона — иначе на странице появляются дубли `id`, а на них
   * держатся `htmlFor`, `aria-*`, якоря и селекторы `#...` в тестах.
   */
  idPrefix?: string;
  characterId: string;
  initialName: string;
  initialHeaderData: HeaderData;
}

export const DndCharacterInfoSection = React.forwardRef<
  { saveAll: () => void },
  CharacterInfoSectionProps
>(({ characterId, initialName, initialHeaderData, idPrefix }, ref) => {
  const idp = idPrefix ? `${idPrefix}-` : '';
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = React.useState(true);
  const [name, setName] = React.useState(initialName);
  const [headerData, setHeaderData] =
    React.useState<HeaderData>(initialHeaderData);
  const [isHeaderEditing, setIsHeaderEditing] = React.useState(false);

  React.useEffect(() => {
    setName(initialName);
    setHeaderData(initialHeaderData);
  }, [characterId]);

  const handleSaveHeader = React.useCallback(() => {
    updateCharacter(characterId, { name, ...headerData });
    setIsHeaderEditing(false);
  }, [characterId, name, headerData, updateCharacter]);

  React.useImperativeHandle(
    ref,
    () => ({
      saveAll: () => {
        if (isHeaderEditing) handleSaveHeader();
      },
    }),
    [isHeaderEditing, handleSaveHeader],
  );

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="expanded"
      onValueChange={(val) => setIsOpen(val === 'expanded')}
      className={cn('flex-1', !isOpen && 'md:self-start')}
    >
      <AccordionItem value="expanded" className="border-0">
        <Card
          id={`${idp}character-info-card`}
          className="flex h-full flex-col overflow-hidden border-2"
        >
          <CardHeader className="bg-muted/5 flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <AccordionTrigger className="flex flex-1 items-center justify-between py-0 hover:no-underline">
              <Label className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
                {t('characterInfo')}
              </Label>
            </AccordionTrigger>
            {(showEditButtons || isHeaderEditing) && (
              <EditSaveButton
                editing={isHeaderEditing}
                onEdit={() => setIsHeaderEditing(true)}
                onSave={handleSaveHeader}
              />
            )}
          </CardHeader>
          <AccordionContent>
            <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
              <DetailSelectField
                label={t('race')}
                value={headerData.race}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, race: v })}
                options={Object.keys(RACE_TRANSLATION_KEYS)}
                translationKeys={RACE_TRANSLATION_KEYS}
                t={t}
              />
              <DetailSelectField
                label={t('background')}
                value={headerData.background}
                editing={isHeaderEditing}
                onChange={(v) =>
                  setHeaderData({ ...headerData, background: v })
                }
                options={Object.keys(BG_TRANSLATION_KEYS)}
                translationKeys={BG_TRANSLATION_KEYS}
                t={t}
              />
              <DetailSelectField
                label={t('alignment')}
                value={headerData.alignment}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, alignment: v })}
                options={Object.keys(ALIGNMENT_TRANSLATION_KEYS)}
                translationKeys={ALIGNMENT_TRANSLATION_KEYS}
                t={t}
              />
              <DetailField
                label={t('age')}
                value={headerData.age}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, age: v })}
              />
              <DetailField
                label={t('eyes')}
                value={headerData.eyes}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, eyes: v })}
              />
              <DetailField
                label={t('skin')}
                value={headerData.skin}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, skin: v })}
              />
              <DetailField
                label={t('height')}
                value={headerData.height}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, height: v })}
              />
              <DetailField
                label={t('weight')}
                value={headerData.weight}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, weight: v })}
              />
              <DetailField
                label={t('hairFur')}
                value={headerData.hair}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, hair: v })}
              />
              <div className="col-span-2 mt-2 border-t pt-4 md:col-span-3">
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="backstory" className="border-b-0">
                    <AccordionTrigger className="py-2 font-semibold hover:no-underline">
                      {t('backstory')}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {isHeaderEditing ? (
                        <Textarea
                          value={headerData.backstory}
                          onChange={(e) =>
                            setHeaderData({
                              ...headerData,
                              backstory: e.target.value,
                            })
                          }
                          placeholder={t('backstoryPlaceholder')}
                          className="min-h-[150px] text-sm"
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                          {headerData.backstory || '-'}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="notes" className="border-b-0">
                    <AccordionTrigger className="py-2 font-semibold hover:no-underline">
                      {t('notes')}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {isHeaderEditing ? (
                        <Textarea
                          value={headerData.notes}
                          onChange={(e) =>
                            setHeaderData({
                              ...headerData,
                              notes: e.target.value,
                            })
                          }
                          placeholder={t('generalNotesPlaceholder')}
                          className="min-h-[100px] text-sm"
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                          {headerData.notes || '-'}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
});

DndCharacterInfoSection.displayName = 'DndCharacterInfoSection';
