'use client';

import * as React from 'react';

import { Edit, Save } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

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
                {t('dnd.characterInfo')}
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
                label={t('dnd.race')}
                value={headerData.race}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, race: v })}
                options={Object.keys(RACE_TRANSLATION_KEYS)}
                translationKeys={RACE_TRANSLATION_KEYS}
                t={t}
              />
              <DetailSelectField
                label={t('dnd.background')}
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
                label={t('dnd.alignment')}
                value={headerData.alignment}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, alignment: v })}
                options={Object.keys(ALIGNMENT_TRANSLATION_KEYS)}
                translationKeys={ALIGNMENT_TRANSLATION_KEYS}
                t={t}
              />
              <DetailField
                label={t('common.age')}
                value={headerData.age}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, age: v })}
              />
              <DetailField
                label={t('dnd.eyes')}
                value={headerData.eyes}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, eyes: v })}
              />
              <DetailField
                label={t('dnd.skin')}
                value={headerData.skin}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, skin: v })}
              />
              <DetailField
                label={t('common.height')}
                value={headerData.height}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, height: v })}
              />
              <DetailField
                label={t('common.weight')}
                value={headerData.weight}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, weight: v })}
              />
              <DetailField
                label={t('dnd.hairFur')}
                value={headerData.hair}
                editing={isHeaderEditing}
                onChange={(v) => setHeaderData({ ...headerData, hair: v })}
              />
              <div className="col-span-2 mt-2 border-t pt-4 md:col-span-3">
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="backstory" className="border-b-0">
                    <AccordionTrigger className="py-2 font-semibold hover:no-underline">
                      {t('common.backstory')}
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
                          placeholder={t('dnd.backstoryPlaceholder')}
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
                      {t('common.notes')}
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
                          placeholder={t('dnd.generalNotesPlaceholder')}
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
