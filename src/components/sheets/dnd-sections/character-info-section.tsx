'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RACE_TRANSLATION_KEYS: Record<string, string> = {
  "Aarakocra": "raceAarakocra", "Aasimar": "raceAasimar", "Autognome": "raceAutognome", "Astral elf": "raceAstralelf",
  "Bugbear": "raceBugbear", "Vedalken": "raceVedalken", "Verdan": "raceVerdan", "Simic hybrid": "raceSimichybrid",
  "Gith": "raceGith", "Giff": "raceGiff", "Gnome": "raceGnome", "Goblin": "raceGoblin", "Goliath": "raceGoliath",
  "Grung": "raceGrung", "Dwarf": "raceDwarf", "Genasi": "raceGenasi", "Dragonborn": "raceDragonborn", "Harengon": "raceHarengon",
  "Kalashtar": "raceKalashtar", "Kender": "raceKender", "Kenku": "raceKenku", "Centaur": "raceCentaur", "Kobold": "raceKobold",
  "Warforged": "raceWarforged", "Leonin": "raceLeonin", "Locathah": "raceLocathah", "Loxodon": "raceLoxodon", "Lizardfolk": "raceLizardfolk",
  "Minotaur": "raceMinotaur", "Orc": "raceOrc", "Plasmoid": "racePlasmoid", "Half-orc": "raceHalforc", "Halfling": "raceHalfling",
  "Half-elf": "raceHalfelf", "Satyr": "raceSatyr", "Owlin": "raceOwlin", "Tabaxi": "raceTabaxi", "Tiefling": "raceTiefling",
  "Tortle": "raceTortle", "Thri-kreen": "raceThrikreen", "Triton": "raceTriton", "Firbolg": "raceFirbolg", "Fairy": "raceFairy",
  "Hadozee": "raceHadozee", "Hobgoblin": "raceHobgoblin", "Changeling": "raceChangeling", "Human": "raceHuman", "Shifter": "raceShifter",
  "Elf": "raceElf", "Yuan-ti Pureblood": "raceYuantPureblood",
};

const BG_TRANSLATION_KEYS: Record<string, string> = {
  "Entertainer": "bgEntertainer", "Urchin": "bgUrchin", "Noble": "bgNoble", "Guild Artisan": "bgGuildArtisan",
  "Sailor": "bgSailor", "Sage": "bgSage", "Folk Hero": "bgFolkHero", "Hermit": "bgHermit", "Outlander": "bgOutlander",
  "Charlatan": "bgCharlatan", "Pirate": "bgPirate", "Criminal": "bgCriminal", "Acolyte": "bgAcolyte", "Soldier": "bgSoldier",
  "Gambler": "bgGambler", "Plaintiff": "bgPlaintiff", "Failed Merchant": "bgFailedMerchant", "Celebrity Adventurers Scion": "bgCelebrityAdventurersScion",
  "Rival Intern": "bgRivalIntern", "Giant Foundling": "bgGiantFoundling", "Rune Carver": "bgRuneCarver", "Rewarded": "bgRewarded",
  "Ruined": "bgRuined", "House Agent": "bgHouseAgent", "Volstrucker Agent": "bgVolstruckerAgent", "Grinner": "bgGrinner",
  "Golgari Agent": "bgGolgariAgent", "Gruul Anarch": "bgGruulAnarch", "Izzet Engineer": "bgIzzetEngineer", "Rakdos Cultist": "bgRakdosCultist",
  "Boros Legionnaire": "bgBorosLegionnaire", "Dimir Operative": "bgDimirOperative", "Selesnya Initiate": "bgSelesnyaInitiate", "Orzhov Representative": "bgOrzhovRepresentative",
  "Simic Scientist": "bgSimicScientist", "Azorius Functionary": "bgAzoriusFunctionary", "Athlete": "bgAthlete", "Planar Philosopher": "bgPlanarPhilosopher",
  "Gate Warden": "bgGateWarden", "Astral Drifter": "bgAstralDrifter", "Wildspacer": "bgWildspacer", "Mercenary Veteran": "bgMercenaryVeteran",
  "Urban Bounty Hunter": "bgUrbanBountyHunter", "City Watch": "bgCityWatch", "Far Traveler": "bgFarTraveler", "Waterdhavian Noble": "bgWaterdhavianNoble",
  "Clan Crafter": "bgClanCrafter", "Inheritor": "bgInheritor", "Faction Agent": "bgFactionAgent", "Courtier": "bgCourtier",
  "Knight of the Order": "bgKnightoftheOrder", "Uthgardt Tribe Member": "bgUthgardtTribeMember", "Cloistered Scholar": "bgCloisteredScholar", "Haunted One": "bgHauntedOne",
  "Investigator": "bgInvestigator", "Faceless": "bgFaceless", "Mage of Hight Sorcery": "bgMageofHightSorcery", "Knight of Solamnia": "bgKnightofSolamnia",
  "Smuggler": "bgSmuggler", "Shipwright": "bgShipwright", "Marine": "bgMarine", "Fisher": "bgFisher",
  "Witherbloom Student": "bgWitherbloomStudent", "Quandrix Student": "bgQuandrixStudent", "Lorehold Student": "bgLoreholdStudent", "Prismari Student": "bgPrismariStudent",
  "Silverquill Student": "bgSilverquillStudent", "Anthropologist": "bgAnthropologist", "Archeologist": "bgArcheologist", "Witchlight Hand": "bgWitchlightHand", "Feylost": "bgFeylost",
};

const ALIGNMENT_TRANSLATION_KEYS: Record<string, string> = {
  "Lawful Good": "alignmentLawfulGood",
  "Neutral Good": "alignmentNeutralGood",
  "Chaotic Good": "alignmentChaoticGood",
  "Lawful Neutral": "alignmentLawfulNeutral",
  "True Neutral": "alignmentTrueNeutral",
  "Chaotic Neutral": "alignmentChaoticNeutral",
  "Lawful Evil": "alignmentLawfulEvil",
  "Neutral Evil": "alignmentNeutralEvil",
  "Chaotic Evil": "alignmentChaoticEvil",
};

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? (
    <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7">
      <Save className="h-4 w-4" />
    </Button>
  ) : (
    <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7">
      <Edit className="h-4 w-4" />
    </Button>
  )
);

const DetailField = ({ label, value, editing, onChange }: { label: string; value: string | number; editing: boolean; onChange: (val: string) => void }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] text-muted-foreground uppercase font-bold">{label}</Label>
    {editing ? (
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs p-1" />
    ) : (
      <span className="text-sm font-semibold truncate">{value || '-'}</span>
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
  t
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
    <Label className="text-[10px] text-muted-foreground uppercase font-bold">{label}</Label>
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
      <span className="text-sm font-semibold truncate">
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
  characterId: string;
  initialName: string;
  initialHeaderData: HeaderData;
}

export const DndCharacterInfoSection = React.forwardRef<{ saveAll: () => void }, CharacterInfoSectionProps>(
  ({ characterId, initialName, initialHeaderData }, ref) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();
    
    const [isOpen, setIsOpen] = React.useState(true);
    const [name, setName] = React.useState(initialName);
    const [headerData, setHeaderData] = React.useState<HeaderData>(initialHeaderData);
    const [isHeaderEditing, setIsHeaderEditing] = React.useState(false);

    React.useEffect(() => {
      setName(initialName);
      setHeaderData(initialHeaderData);
    }, [characterId]);

    const handleSaveHeader = React.useCallback(() => {
      updateCharacter(characterId, { name, ...headerData });
      setIsHeaderEditing(false);
    }, [characterId, name, headerData, updateCharacter]);

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isHeaderEditing) handleSaveHeader();
      }
    }), [isHeaderEditing, handleSaveHeader]);

    return (
      <Accordion 
        type="single" 
        collapsible 
        defaultValue="expanded" 
        onValueChange={(val) => setIsOpen(val === 'expanded')}
        className={cn("flex-1", !isOpen && "md:self-start")}
      >
        <AccordionItem value="expanded" className="border-0">
          <Card className="flex flex-col border-2 overflow-hidden h-full">
            <CardHeader className="px-4 pt-2 pb-2 bg-muted/5 flex flex-row items-center justify-between">
              <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('characterInfo')}</Label>
              </AccordionTrigger>
              {(showEditButtons || isHeaderEditing) && <EditSaveButton editing={isHeaderEditing} onEdit={() => setIsHeaderEditing(true)} onSave={handleSaveHeader} />}
            </CardHeader>
            <AccordionContent>
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailSelectField 
                  label={t('race')} 
                  value={headerData.race} 
                  editing={isHeaderEditing} 
                  onChange={v => setHeaderData({ ...headerData, race: v })}
                  options={Object.keys(RACE_TRANSLATION_KEYS)}
                  translationKeys={RACE_TRANSLATION_KEYS}
                  t={t}
                />
                <DetailSelectField 
                  label={t('background')} 
                  value={headerData.background} 
                  editing={isHeaderEditing} 
                  onChange={v => setHeaderData({ ...headerData, background: v })}
                  options={Object.keys(BG_TRANSLATION_KEYS)}
                  translationKeys={BG_TRANSLATION_KEYS}
                  t={t}
                />
                <DetailSelectField 
                  label={t('alignment')} 
                  value={headerData.alignment} 
                  editing={isHeaderEditing} 
                  onChange={v => setHeaderData({ ...headerData, alignment: v })}
                  options={Object.keys(ALIGNMENT_TRANSLATION_KEYS)}
                  translationKeys={ALIGNMENT_TRANSLATION_KEYS}
                  t={t}
                />
                <DetailField label={t('age')} value={headerData.age} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, age: v })} />
                <DetailField label={t('eyes')} value={headerData.eyes} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, eyes: v })} />
                <DetailField label={t('skin')} value={headerData.skin} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, skin: v })} />
                <DetailField label={t('height')} value={headerData.height} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, height: v })} />
                <DetailField label={t('weight')} value={headerData.weight} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, weight: v })} />
                <DetailField label={t('hairFur')} value={headerData.hair} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, hair: v })} />
                <div className="col-span-2 md:col-span-3 mt-2 border-t pt-4">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="backstory" className="border-b-0">
                      <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('backstory')}</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        {isHeaderEditing ? (
                          <Textarea value={headerData.backstory} onChange={e => setHeaderData({ ...headerData, backstory: e.target.value })} placeholder="Your character's backstory..." className="min-h-[150px] text-sm" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.backstory || '-'}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="notes" className="border-b-0">
                      <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('notes')}</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        {isHeaderEditing ? (
                          <Textarea value={headerData.notes} onChange={e => setHeaderData({ ...headerData, notes: e.target.value })} placeholder="General notes about this character..." className="min-h-[100px] text-sm" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.notes || '-'}</p>
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
  }
);

DndCharacterInfoSection.displayName = 'DndCharacterInfoSection';