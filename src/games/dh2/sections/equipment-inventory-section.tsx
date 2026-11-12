// src/games/dh2/sections/equipment-inventory-section.tsx
'use client';

import * as React from 'react';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  ChevronDown,
  ChevronRight,
  Info as InfoIcon,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import {
  ArmorPiece,
  BodyPart,
  MeleeWeapon,
  RangedWeapon,
  type DH2Character,
} from '../types';
import { EditSaveButton } from './dh-ui-helpers';

const defaultEquipment = {
  armor: {
    Head: null,
    'Right arm': null,
    Body: null,
    'Left arm': null,
    'Right leg': null,
    'Left leg': null,
  },
  weapons: { melee: [], ranged: [] },
};

const ARMOR_TYPES = [
  'Primitive',
  'Advanced',
  'Flack',
  'Mesh',
  'Carapace',
  'Power',
  'Force',
];

interface EquipmentInventorySectionProps {
  character: DH2Character;
  isCompactView: boolean;
  activeCompactSection: string;
  onEditingChange?: (val: boolean) => void;
}

export const EquipmentInventorySection = React.forwardRef<
  { saveAll: () => void },
  EquipmentInventorySectionProps
>(
  (
    { character, isCompactView, activeCompactSection, onEditingChange },
    ref,
  ) => {
    const { updateCharacter, hideNotes, showEditButtons } =
      useCharacterContext();
    const { t } = useTranslation();

    const [isWealthEditing, setIsWealthEditing] = React.useState(false);
    const [isArmorEditing, setIsArmorEditing] = React.useState(false);
    const [isMeleeWeaponsEditing, setIsMeleeWeaponsEditing] =
      React.useState(false);
    const [isRangedWeaponsEditing, setIsRangedWeaponsEditing] =
      React.useState(false);
    const [isInventoryEditing, setIsInventoryEditing] = React.useState(false);
    const [isEquipmentSectionOpen, setIsEquipmentSectionOpen] =
      React.useState(true);
    const [isInventorySectionOpen, setIsInventorySectionOpen] =
      React.useState(true);
    const [isArmorExpanded, setIsArmorExpanded] = React.useState(false);

    const [editableWealth, setEditableWealth] = React.useState({
      throneGelt: character.wealth?.throneGelt ?? 0,
      monthlyIncome: character.wealth?.monthlyIncome ?? 0,
      notes: character.wealth?.notes ?? '',
    });
    const [editableEquipment, setEditableEquipment] = React.useState(
      character.equipment ?? defaultEquipment,
    );
    const [editableInventory, setEditableInventory] = React.useState(
      character.inventory ?? [],
    );
    const [newInventoryItem, setNewInventoryItem] = React.useState('');

    const handleSaveWealth = React.useCallback(() => {
      updateCharacter(character.id, { wealth: editableWealth });
      setIsWealthEditing(false);
    }, [character.id, editableWealth, updateCharacter]);
    const handleSaveArmor = React.useCallback(() => {
      updateCharacter(character.id, {
        equipment: { ...editableEquipment, armor: editableEquipment.armor },
      });
      setIsArmorEditing(false);
    }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveMeleeWeapons = React.useCallback(() => {
      updateCharacter(character.id, { equipment: editableEquipment });
      setIsMeleeWeaponsEditing(false);
    }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveRangedWeapons = React.useCallback(() => {
      updateCharacter(character.id, { equipment: editableEquipment });
      setIsRangedWeaponsEditing(false);
    }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveInventory = React.useCallback(() => {
      updateCharacter(character.id, { inventory: editableInventory });
      setIsInventoryEditing(false);
    }, [character.id, editableInventory, updateCharacter]);

    const isAnyEditing =
      isWealthEditing ||
      isArmorEditing ||
      isMeleeWeaponsEditing ||
      isRangedWeaponsEditing ||
      isInventoryEditing;
    React.useEffect(() => {
      onEditingChange?.(isAnyEditing);
    }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        saveAll: () => {
          if (isWealthEditing) handleSaveWealth();
          if (isArmorEditing) handleSaveArmor();
          if (isMeleeWeaponsEditing) handleSaveMeleeWeapons();
          if (isRangedWeaponsEditing) handleSaveRangedWeapons();
          if (isInventoryEditing) handleSaveInventory();
        },
      }),
      [
        isWealthEditing,
        isArmorEditing,
        isMeleeWeaponsEditing,
        isRangedWeaponsEditing,
        isInventoryEditing,
        handleSaveWealth,
        handleSaveArmor,
        handleSaveMeleeWeapons,
        handleSaveRangedWeapons,
        handleSaveInventory,
      ],
    );

    const handleArmorChange = (
      part: BodyPart,
      field: keyof ArmorPiece,
      value: string,
    ) => {
      setEditableEquipment((prev) => {
        const newArmor = { ...prev.armor };
        const currentPiece = newArmor[part]
          ? { ...newArmor[part]! }
          : { ap: 0, type: '', mods: '', quality: '' };
        if (field === 'ap') currentPiece.ap = parseInt(value, 10) || 0;
        else Object.assign(currentPiece, { [field]: value });
        newArmor[part] = currentPiece;
        return { ...prev, armor: newArmor };
      });
    };

    const handleMeleeWeaponChange = (
      weaponId: string,
      field: keyof Omit<MeleeWeapon, 'id'>,
      value: string | boolean,
    ) => {
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          melee: (prev.weapons.melee ?? []).map((w) =>
            w.id === weaponId ? { ...w, [field]: value } : w,
          ),
        },
      }));
    };
    const addMeleeWeapon = () => {
      const newWeapon: MeleeWeapon = {
        id: `melee-${Date.now()}`,
        name: t('dh2.newMeleeWeapon'),
        type: '',
        range: '',
        penetration: '',
        damage: '',
        traits: '',
        notes: '',
        equipped: false,
      };
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          melee: [...(prev.weapons.melee ?? []), newWeapon],
        },
      }));
    };
    const removeMeleeWeapon = (weaponId: string) => {
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          melee: (prev.weapons.melee ?? []).filter((w) => w.id !== weaponId),
        },
      }));
    };

    const handleRangedWeaponChange = (
      weaponId: string,
      field: keyof Omit<RangedWeapon, 'id'>,
      value: string | number | boolean,
    ) => {
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          ranged: (prev.weapons.ranged ?? []).map((w) => {
            if (w.id === weaponId) {
              const updated = { ...w };
              if (field === 'clip' || field === 'clipSize')
                Object.assign(updated, {
                  [field]: parseInt(value as string, 10) || 0,
                });
              else Object.assign(updated, { [field]: value });
              return updated;
            }
            return w;
          }),
        },
      }));
    };
    const addRangedWeapon = () => {
      const newWeapon: RangedWeapon = {
        id: `ranged-${Date.now()}`,
        name: t('dh2.newRangedWeapon'),
        type: '',
        range: '',
        rof: '',
        damage: '',
        clip: 0,
        clipSize: 0,
        reload: '',
        traits: '',
        notes: '',
        equipped: false,
      };
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          ranged: [...(prev.weapons.ranged ?? []), newWeapon],
        },
      }));
    };
    const removeRangedWeapon = (weaponId: string) => {
      setEditableEquipment((prev) => ({
        ...prev,
        weapons: {
          ...prev.weapons,
          ranged: (prev.weapons.ranged ?? []).filter((w) => w.id !== weaponId),
        },
      }));
    };

    const addInventoryItem = () => {
      if (newInventoryItem.trim() !== '') {
        setEditableInventory([
          ...editableInventory,
          {
            id: `new-inv-${Date.now()}`,
            name: newInventoryItem,
            status: 'default',
            notes: '',
          },
        ]);
        setNewInventoryItem('');
      }
    };

    const bodyParts: BodyPart[] = [
      'Head',
      'Right arm',
      'Left arm',
      'Body',
      'Right leg',
      'Left leg',
    ];
    const bodyPartLocations: Record<BodyPart, string> = {
      Head: '1-10',
      'Right arm': '11-20',
      'Left arm': '21-30',
      Body: '31-70',
      'Right leg': '71-85',
      'Left leg': '86-00',
    };

    const bodyPartTranslations: Record<BodyPart, string> = {
      Head: t('dh2.armorHead'),
      'Right arm': t('dh2.armorRightArm'),
      'Left arm': t('dh2.armorLeftArm'),
      Body: t('dh2.armorBody'),
      'Right leg': t('dh2.armorRightLeg'),
      'Left leg': t('dh2.armorLeftLeg'),
    };

    const ARMOR_TYPE_OPTIONS = ARMOR_TYPES.map((type) => ({
      value: type,
      label: t(`dh2.armorType${type}`),
    }));
    // Helper to translate armor type for display
    const displayArmorType = (type: string | undefined | null) => {
      if (!type) return '-';
      const translationKey = `dh2.armorType${type}`;
      const translated = t(translationKey);
      return translated === translationKey ? type : translated;
    };

    // Helper to translate armor quality for display
    const displayQuality = (quality: string | undefined | null) => {
      if (!quality || quality === 'none') return '-';
      const translationKey = `dh2.armorQuality${quality.replace('-', '')}`;
      const translated = t(translationKey);
      return translated === translationKey ? quality : translated;
    };
    // Radix Select не принимает пустой value: элемент с value='' не выбирается
    // и роняет Select. Поэтому «нет значения» — это явный 'none'.
    const ARMOR_QUALITY_OPTIONS = [
      { value: 'none', label: t('dh2.armorQualityNone') },
      { value: 'Poor', label: t('dh2.armorQualityPoor') },
      { value: 'Cheap', label: t('dh2.armorQualityCheap') },
      { value: 'Common', label: t('dh2.armorQualityCommon') },
      { value: 'Good', label: t('dh2.armorQualityGood') },
      { value: 'Best', label: t('dh2.armorQualityBest') },
      { value: 'Master-Crafted', label: t('dh2.armorQualityMasterCrafted') },
    ];

    const currentEquipment =
      isArmorEditing || isMeleeWeaponsEditing || isRangedWeaponsEditing
        ? editableEquipment
        : (character.equipment ?? defaultEquipment);
    const currentInventory = isInventoryEditing
      ? editableInventory
      : (character.inventory ?? []);
    const equippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(
      (w) => w.equipped,
    );
    const unequippedMeleeWeapons = (
      currentEquipment.weapons?.melee ?? []
    ).filter((w) => !w.equipped);
    const equippedRangedWeapons = (
      currentEquipment.weapons?.ranged ?? []
    ).filter((w) => w.equipped);
    const unequippedRangedWeapons = (
      currentEquipment.weapons?.ranged ?? []
    ).filter((w) => w.equipped === false || w.equipped === undefined);

    return (
      <>
        <div
          className={cn(
            isCompactView &&
              activeCompactSection !== 'equipment-section' &&
              'hidden',
          )}
        >
          <Collapsible
            id="equipment-section"
            open={isEquipmentSectionOpen}
            onOpenChange={setIsEquipmentSectionOpen}
            className={cn(
              'overflow-hidden rounded-lg border',
              isCompactView && 'bg-card',
            )}
          >
            <div className="flex items-center border-b pr-4">
              <h3 className="font-headline flex-1 px-6 py-4 text-lg leading-none font-semibold tracking-tight">
                {t('dh2.equipment')}
              </h3>
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isEquipmentSectionOpen && 'rotate-90',
                    )}
                  />
                  <span className="sr-only">{t('dh2.toggleEquipment')}</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className={cn('space-y-6', isCompactView ? 'p-3' : 'p-6')}>
                <div>
                  <Collapsible
                    open={!isCompactView || isArmorExpanded}
                    onOpenChange={setIsArmorExpanded}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <CollapsibleTrigger asChild disabled={!isCompactView}>
                        <div
                          className={cn(
                            'flex items-center gap-2',
                            isCompactView && 'cursor-pointer',
                          )}
                        >
                          <h4 className="text-lg font-semibold">
                            {t('dh2.armor')}
                          </h4>
                          {isCompactView && (
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                isArmorExpanded && 'rotate-180',
                              )}
                            />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      {(showEditButtons || isArmorEditing) && (
                        <EditSaveButton
                          editing={isArmorEditing}
                          onEdit={() => setIsArmorEditing(true)}
                          onSave={handleSaveArmor}
                        />
                      )}
                    </div>
                    <CollapsibleContent
                      forceMount={!isCompactView ? true : undefined}
                    >
                      {isCompactView ? (
                        <div className="space-y-2">
                          {bodyParts.map((part) => {
                            const armorPiece = currentEquipment.armor[part];
                            const translatedName = bodyPartTranslations[part];
                            return (
                              <div
                                key={part}
                                className="bg-background/50 space-y-2 rounded-lg border p-3"
                              >
                                <h5 className="font-semibold">
                                  {translatedName} ({bodyPartLocations[part]})
                                </h5>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                  {isArmorEditing ? (
                                    <>
                                      <div className="space-y-1">
                                        <Label>{t('dh2.armorAp')}</Label>
                                        <Input
                                          type="number"
                                          className="h-7 text-xs"
                                          value={
                                            armorPiece?.ap === 0
                                              ? ''
                                              : (armorPiece?.ap ?? '')
                                          }
                                          onChange={(e) =>
                                            handleArmorChange(
                                              part,
                                              'ap',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label>{t('dh2.armorType')}</Label>
                                        <Select
                                          value={armorPiece?.type ?? ''}
                                          onValueChange={(value) =>
                                            handleArmorChange(
                                              part,
                                              'type',
                                              value,
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-7 text-xs">
                                            <SelectValue
                                              placeholder={t('dh2.armorType')}
                                            />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ARMOR_TYPE_OPTIONS.map(
                                              (option) => (
                                                <SelectItem
                                                  key={option.value}
                                                  value={option.value}
                                                >
                                                  {option.label}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="col-span-2 space-y-1">
                                        <Label>{t('dh2.armorMods')}</Label>
                                        <Input
                                          className="h-7 text-xs"
                                          value={armorPiece?.mods ?? ''}
                                          onChange={(e) =>
                                            handleArmorChange(
                                              part,
                                              'mods',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="col-span-2 space-y-1">
                                        <Label>{t('dh2.armorQuality')}</Label>
                                        <Select
                                          value={armorPiece?.quality ?? 'none'}
                                          onValueChange={(value) =>
                                            handleArmorChange(
                                              part,
                                              'quality',
                                              value,
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-7 text-xs">
                                            <SelectValue
                                              placeholder={t(
                                                'dh2.armorQuality',
                                              )}
                                            />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ARMOR_QUALITY_OPTIONS.map(
                                              (option) => (
                                                <SelectItem
                                                  key={option.value}
                                                  value={option.value}
                                                >
                                                  {option.label}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <strong className="text-muted-foreground">
                                          {t('dh2.armorAp')}:
                                        </strong>{' '}
                                        {armorPiece?.ap ?? '-'}
                                      </div>
                                      <div>
                                        <strong className="text-muted-foreground">
                                          {t('dh2.armorType')}:
                                        </strong>{' '}
                                        {displayArmorType(armorPiece?.type)}
                                      </div>
                                      <div className="col-span-2">
                                        <strong className="text-muted-foreground">
                                          {t('dh2.armorMods')}:
                                        </strong>{' '}
                                        {armorPiece?.mods ?? '-'}
                                      </div>
                                      <div className="col-span-2">
                                        <strong className="text-muted-foreground">
                                          {t('dh2.armorQuality')}:
                                        </strong>{' '}
                                        {displayQuality(armorPiece?.quality)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-lg border p-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('dh2.armorLocation')}</TableHead>
                                <TableHead>{t('dh2.armorAp')}</TableHead>
                                <TableHead>{t('dh2.armorType')}</TableHead>
                                <TableHead>{t('dh2.armorMods')}</TableHead>
                                <TableHead>{t('dh2.armorQuality')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bodyParts.map((part) => {
                                const armorPiece = currentEquipment.armor[part];
                                return (
                                  <TableRow key={part}>
                                    <TableCell className="font-medium">
                                      {bodyPartTranslations[part]}
                                    </TableCell>
                                    {isArmorEditing ? (
                                      <>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            className="h-8 w-16"
                                            value={armorPiece?.ap ?? ''}
                                            onChange={(e) =>
                                              handleArmorChange(
                                                part,
                                                'ap',
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Select
                                            value={armorPiece?.type ?? ''}
                                            onValueChange={(value) =>
                                              handleArmorChange(
                                                part,
                                                'type',
                                                value,
                                              )
                                            }
                                          >
                                            <SelectTrigger className="h-8">
                                              <SelectValue
                                                placeholder={t('dh2.armorType')}
                                              />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {ARMOR_TYPE_OPTIONS.map(
                                                (option) => (
                                                  <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                  >
                                                    {option.label}
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            className="h-8"
                                            value={armorPiece?.mods ?? ''}
                                            onChange={(e) =>
                                              handleArmorChange(
                                                part,
                                                'mods',
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Select
                                            value={
                                              armorPiece?.quality ?? 'none'
                                            }
                                            onValueChange={(value) =>
                                              handleArmorChange(
                                                part,
                                                'quality',
                                                value,
                                              )
                                            }
                                          >
                                            <SelectTrigger className="h-8">
                                              <SelectValue
                                                placeholder={t(
                                                  'dh2.armorQuality',
                                                )}
                                              />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {ARMOR_QUALITY_OPTIONS.map(
                                                (option) => (
                                                  <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                  >
                                                    {option.label}
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell>
                                          {armorPiece?.ap ?? '-'}
                                        </TableCell>
                                        <TableCell>
                                          {displayArmorType(armorPiece?.type)}
                                        </TableCell>
                                        <TableCell>
                                          {armorPiece?.mods ?? '-'}
                                        </TableCell>
                                        <TableCell>
                                          {displayQuality(armorPiece?.quality)}
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-lg font-semibold">
                        {t('dh2.meleeWeapons')}
                      </h4>
                      {(showEditButtons || isMeleeWeaponsEditing) && (
                        <EditSaveButton
                          editing={isMeleeWeaponsEditing}
                          onEdit={() => setIsMeleeWeaponsEditing(true)}
                          onSave={handleSaveMeleeWeapons}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      {equippedMeleeWeapons.map((weapon) => (
                        <div
                          key={weapon.id}
                          className="bg-background/50 space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between">
                            {isMeleeWeaponsEditing ? (
                              <Input
                                defaultValue={weapon.name}
                                onChange={(e) =>
                                  handleMeleeWeaponChange(
                                    weapon.id,
                                    'name',
                                    e.target.value,
                                  )
                                }
                                className="h-8 text-sm font-semibold"
                              />
                            ) : (
                              <h5 className="text-sm font-semibold break-words">
                                {weapon.name}
                              </h5>
                            )}
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              {!hideNotes && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={
                                        weapon.notes ? 'secondary' : 'ghost'
                                      }
                                      size="icon"
                                      className="h-7 w-7"
                                    >
                                      <InfoIcon className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64">
                                    <Label className="mb-2 block text-xs">
                                      {t('common.notesFor')} {weapon.name}
                                    </Label>
                                    <Textarea
                                      defaultValue={weapon.notes || ''}
                                      {...(isMeleeWeaponsEditing
                                        ? {
                                            onChange: (e) =>
                                              handleMeleeWeaponChange(
                                                weapon.id,
                                                'notes',
                                                e.target.value,
                                              ),
                                          }
                                        : {
                                            onBlur: (e) =>
                                              updateCharacter(character.id, {
                                                equipment: {
                                                  ...character.equipment,
                                                  weapons: {
                                                    ...character.equipment
                                                      .weapons,
                                                    melee: (
                                                      character.equipment
                                                        .weapons.melee ?? []
                                                    ).map((w) =>
                                                      w.id === weapon.id
                                                        ? {
                                                            ...w,
                                                            notes:
                                                              e.target.value,
                                                          }
                                                        : w,
                                                    ),
                                                  },
                                                },
                                              }),
                                          })}
                                      placeholder={t('dh2.addNotesPlaceholder')}
                                      className="mt-2 min-h-[100px] text-sm"
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                              {isMeleeWeaponsEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeMeleeWeapon(weapon.id)}
                                >
                                  <Trash2 className="text-destructive h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {isMeleeWeaponsEditing ? (
                              <>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponType')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.type}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'type',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponRange')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.range}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'range',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponDamage')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.damage}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'damage',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>
                                    {t('dh2.weaponPenetration')}
                                  </Label>{' '}
                                  <Input
                                    defaultValue={weapon.penetration}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'penetration',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="col-span-2 space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponTraits')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.traits}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'traits',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponType')}:
                                  </strong>{' '}
                                  {weapon.type || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponRange')}:
                                  </strong>{' '}
                                  {weapon.range || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponDamage')}:
                                  </strong>{' '}
                                  {weapon.damage || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponPenetration')}:
                                  </strong>{' '}
                                  {weapon.penetration || '-'}
                                </div>
                                <div className="col-span-2">
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponTraits')}:
                                  </strong>{' '}
                                  <span className="break-words">
                                    {weapon.traits || '-'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                              checked={!!weapon.equipped}
                              onCheckedChange={(c) =>
                                isMeleeWeaponsEditing
                                  ? handleMeleeWeaponChange(
                                      weapon.id,
                                      'equipped',
                                      !!c,
                                    )
                                  : updateCharacter(character.id, {
                                      equipment: {
                                        ...character.equipment,
                                        weapons: {
                                          ...character.equipment.weapons,
                                          melee: (
                                            character.equipment.weapons.melee ??
                                            []
                                          ).map((w) =>
                                            w.id === weapon.id
                                              ? { ...w, equipped: !!c }
                                              : w,
                                          ),
                                        },
                                      },
                                    })
                              }
                            />
                            <Label className="text-xs">
                              {t('dh2.equipped')}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem
                      value="unequipped-melee"
                      className="border-b-0"
                    >
                      <AccordionPrimitive.Header className="flex w-full">
                        <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium">
                          <span>{t('dh2.notEquipped')}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        </AccordionPrimitive.Trigger>
                      </AccordionPrimitive.Header>
                      <AccordionContent>
                        <div className="space-y-2">
                          {unequippedMeleeWeapons.map((weapon) => (
                            <div
                              key={weapon.id}
                              className="bg-background/50 space-y-2 rounded-lg border p-3"
                            >
                              <div className="flex items-start justify-between">
                                {isMeleeWeaponsEditing ? (
                                  <Input
                                    defaultValue={weapon.name}
                                    onChange={(e) =>
                                      handleMeleeWeaponChange(
                                        weapon.id,
                                        'name',
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm font-semibold"
                                  />
                                ) : (
                                  <h5 className="text-sm font-semibold break-words">
                                    {weapon.name}
                                  </h5>
                                )}
                                <div className="ml-2 flex shrink-0 items-center gap-1">
                                  {!hideNotes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant={
                                            weapon.notes ? 'secondary' : 'ghost'
                                          }
                                          size="icon"
                                          className="h-7 w-7"
                                        >
                                          <InfoIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64">
                                        <Label className="mb-2 block text-xs">
                                          {t('common.notesFor')} {weapon.name}
                                        </Label>
                                        <Textarea
                                          defaultValue={weapon.notes || ''}
                                          {...(isMeleeWeaponsEditing
                                            ? {
                                                onChange: (e) =>
                                                  handleMeleeWeaponChange(
                                                    weapon.id,
                                                    'notes',
                                                    e.target.value,
                                                  ),
                                              }
                                            : {
                                                onBlur: (e) =>
                                                  updateCharacter(
                                                    character.id,
                                                    {
                                                      equipment: {
                                                        ...character.equipment,
                                                        weapons: {
                                                          ...character.equipment
                                                            .weapons,
                                                          melee: (
                                                            character.equipment
                                                              .weapons.melee ??
                                                            []
                                                          ).map((w) =>
                                                            w.id === weapon.id
                                                              ? {
                                                                  ...w,
                                                                  notes:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              : w,
                                                          ),
                                                        },
                                                      },
                                                    },
                                                  ),
                                              })}
                                          placeholder={t(
                                            'dh2.addNotesPlaceholder',
                                          )}
                                          className="mt-2 min-h-[100px] text-sm"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  {isMeleeWeaponsEditing && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        removeMeleeWeapon(weapon.id)
                                      }
                                    >
                                      <Trash2 className="text-destructive h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {isMeleeWeaponsEditing ? (
                                  <>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponType')}</Label>{' '}
                                      <Input
                                        defaultValue={weapon.type}
                                        onChange={(e) =>
                                          handleMeleeWeaponChange(
                                            weapon.id,
                                            'type',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponRange')}</Label>{' '}
                                      <Input
                                        defaultValue={weapon.range}
                                        onChange={(e) =>
                                          handleMeleeWeaponChange(
                                            weapon.id,
                                            'range',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponDamage')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.damage}
                                        onChange={(e) =>
                                          handleMeleeWeaponChange(
                                            weapon.id,
                                            'damage',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponPenetration')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.penetration}
                                        onChange={(e) =>
                                          handleMeleeWeaponChange(
                                            weapon.id,
                                            'penetration',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponTraits')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.traits}
                                        onChange={(e) =>
                                          handleMeleeWeaponChange(
                                            weapon.id,
                                            'traits',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponType')}:
                                      </strong>{' '}
                                      {weapon.type || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponRange')}:
                                      </strong>{' '}
                                      {weapon.range || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponDamage')}:
                                      </strong>{' '}
                                      {weapon.damage || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponPenetration')}:
                                      </strong>{' '}
                                      {weapon.penetration || '-'}
                                    </div>
                                    <div className="col-span-2">
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponTraits')}:
                                      </strong>{' '}
                                      <span className="break-words">
                                        {weapon.traits || '-'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                  checked={!!weapon.equipped}
                                  onCheckedChange={(c) =>
                                    isMeleeWeaponsEditing
                                      ? handleMeleeWeaponChange(
                                          weapon.id,
                                          'equipped',
                                          !!c,
                                        )
                                      : updateCharacter(character.id, {
                                          equipment: {
                                            ...character.equipment,
                                            weapons: {
                                              ...character.equipment.weapons,
                                              melee: (
                                                character.equipment.weapons
                                                  .melee ?? []
                                              ).map((w) =>
                                                w.id === weapon.id
                                                  ? { ...w, equipped: !!c }
                                                  : w,
                                              ),
                                            },
                                          },
                                        })
                                  }
                                />
                                <Label className="text-xs">
                                  {t('dh2.equipped')}
                                </Label>
                              </div>
                            </div>
                          ))}
                        </div>
                        {isMeleeWeaponsEditing && (
                          <div className="p-2 pt-4">
                            <Button
                              onClick={addMeleeWeapon}
                              size="sm"
                              className="w-full"
                            >
                              <Plus className="mr-2 h-4 w-4" />{' '}
                              {t('common.add')} {t('dh2.meleeWeapons')}
                            </Button>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-lg font-semibold">
                        {t('dh2.rangedWeapons')}
                      </h4>
                      {(showEditButtons || isRangedWeaponsEditing) && (
                        <EditSaveButton
                          editing={isRangedWeaponsEditing}
                          onEdit={() => setIsRangedWeaponsEditing(true)}
                          onSave={handleSaveRangedWeapons}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      {equippedRangedWeapons.map((weapon) => (
                        <div
                          key={weapon.id}
                          className="bg-background/50 space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between">
                            {isRangedWeaponsEditing ? (
                              <Input
                                defaultValue={weapon.name}
                                onChange={(e) =>
                                  handleRangedWeaponChange(
                                    weapon.id,
                                    'name',
                                    e.target.value,
                                  )
                                }
                                className="h-8 text-sm font-semibold"
                              />
                            ) : (
                              <h5 className="text-sm font-semibold break-words">
                                {weapon.name}
                              </h5>
                            )}
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              {!hideNotes && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={
                                        weapon.notes ? 'secondary' : 'ghost'
                                      }
                                      size="icon"
                                      className="h-7 w-7"
                                    >
                                      <InfoIcon className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64">
                                    <Label className="mb-2 block text-xs">
                                      {t('common.notesFor')} {weapon.name}
                                    </Label>
                                    <Textarea
                                      defaultValue={weapon.notes || ''}
                                      {...(isRangedWeaponsEditing
                                        ? {
                                            onChange: (e) =>
                                              handleRangedWeaponChange(
                                                weapon.id,
                                                'notes',
                                                e.target.value,
                                              ),
                                          }
                                        : {
                                            onBlur: (e) =>
                                              updateCharacter(character.id, {
                                                equipment: {
                                                  ...character.equipment,
                                                  weapons: {
                                                    ...character.equipment
                                                      .weapons,
                                                    ranged: (
                                                      character.equipment
                                                        .weapons.ranged ?? []
                                                    ).map((w) =>
                                                      w.id === weapon.id
                                                        ? {
                                                            ...w,
                                                            notes:
                                                              e.target.value,
                                                          }
                                                        : w,
                                                    ),
                                                  },
                                                },
                                              }),
                                          })}
                                      placeholder={t('dh2.addNotesPlaceholder')}
                                      className="mt-2 min-h-[100px] text-sm"
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                              {isRangedWeaponsEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeRangedWeapon(weapon.id)}
                                >
                                  <Trash2 className="text-destructive h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {isRangedWeaponsEditing ? (
                              <>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponType')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.type}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'type',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponRange')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.range}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'range',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponRof')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.rof}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'rof',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponDamage')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.damage}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'damage',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponClip')}</Label>{' '}
                                  <Input
                                    type="number"
                                    defaultValue={
                                      weapon.clip === 0 ? '' : weapon.clip
                                    }
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'clip',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponClipSize')}</Label>{' '}
                                  <Input
                                    type="number"
                                    defaultValue={
                                      weapon.clipSize === 0
                                        ? ''
                                        : weapon.clipSize
                                    }
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'clipSize',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="col-span-2 space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponReload')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.reload}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'reload',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                                <div className="col-span-2 space-y-1">
                                  {' '}
                                  <Label>{t('dh2.weaponTraits')}</Label>{' '}
                                  <Input
                                    defaultValue={weapon.traits}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'traits',
                                        e.target.value,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  />{' '}
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponType')}:
                                  </strong>{' '}
                                  {weapon.type || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponRange')}:
                                  </strong>{' '}
                                  {weapon.range || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponRof')}:
                                  </strong>{' '}
                                  {weapon.rof || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponDamage')}:
                                  </strong>{' '}
                                  {weapon.damage || '-'}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponClip')}:
                                  </strong>{' '}
                                  {weapon.clip} / {weapon.clipSize}
                                </div>
                                <div>
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponReload')}:
                                  </strong>{' '}
                                  {weapon.reload || '-'}
                                </div>
                                <div className="col-span-2">
                                  <strong className="text-muted-foreground">
                                    {t('dh2.weaponTraits')}:
                                  </strong>{' '}
                                  <span className="break-words">
                                    {weapon.traits || '-'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                              checked={!!weapon.equipped}
                              onCheckedChange={(c) =>
                                isRangedWeaponsEditing
                                  ? handleRangedWeaponChange(
                                      weapon.id,
                                      'equipped',
                                      !!c,
                                    )
                                  : updateCharacter(character.id, {
                                      equipment: {
                                        ...character.equipment,
                                        weapons: {
                                          ...character.equipment.weapons,
                                          ranged: (
                                            character.equipment.weapons
                                              .ranged ?? []
                                          ).map((w) =>
                                            w.id === weapon.id
                                              ? { ...w, equipped: !!c }
                                              : w,
                                          ),
                                        },
                                      },
                                    })
                              }
                            />
                            <Label className="text-xs">
                              {t('dh2.equipped')}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem
                      value="unequipped-ranged"
                      className="border-b-0"
                    >
                      <AccordionPrimitive.Header className="flex w-full">
                        <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium">
                          <span>{t('dh2.notEquipped')}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        </AccordionPrimitive.Trigger>
                      </AccordionPrimitive.Header>
                      <AccordionContent>
                        <div className="space-y-2">
                          {unequippedRangedWeapons.map((weapon) => (
                            <div
                              key={weapon.id}
                              className="bg-background/50 space-y-2 rounded-lg border p-3"
                            >
                              <div className="flex items-start justify-between">
                                {isRangedWeaponsEditing ? (
                                  <Input
                                    defaultValue={weapon.name}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'name',
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm font-semibold"
                                  />
                                ) : (
                                  <h5 className="text-sm font-semibold break-words">
                                    {weapon.name}
                                  </h5>
                                )}
                                <div className="ml-2 flex shrink-0 items-center gap-1">
                                  {!hideNotes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant={
                                            weapon.notes ? 'secondary' : 'ghost'
                                          }
                                          size="icon"
                                          className="h-7 w-7"
                                        >
                                          <InfoIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64">
                                        <Label className="mb-2 block text-xs">
                                          {t('common.notesFor')} {weapon.name}
                                        </Label>
                                        <Textarea
                                          defaultValue={weapon.notes || ''}
                                          {...(isRangedWeaponsEditing
                                            ? {
                                                onChange: (e) =>
                                                  handleRangedWeaponChange(
                                                    weapon.id,
                                                    'notes',
                                                    e.target.value,
                                                  ),
                                              }
                                            : {
                                                onBlur: (e) =>
                                                  updateCharacter(
                                                    character.id,
                                                    {
                                                      equipment: {
                                                        ...character.equipment,
                                                        weapons: {
                                                          ...character.equipment
                                                            .weapons,
                                                          ranged: (
                                                            character.equipment
                                                              .weapons.ranged ??
                                                            []
                                                          ).map((w) =>
                                                            w.id === weapon.id
                                                              ? {
                                                                  ...w,
                                                                  notes:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              : w,
                                                          ),
                                                        },
                                                      },
                                                    },
                                                  ),
                                              })}
                                          placeholder={t(
                                            'dh2.addNotesPlaceholder',
                                          )}
                                          className="mt-2 min-h-[100px] text-sm"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  {isRangedWeaponsEditing && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        removeRangedWeapon(weapon.id)
                                      }
                                    >
                                      <Trash2 className="text-destructive h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {isRangedWeaponsEditing ? (
                                  <>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponType')}</Label>{' '}
                                      <Input
                                        defaultValue={weapon.type}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'type',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponRange')}</Label>{' '}
                                      <Input
                                        defaultValue={weapon.range}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'range',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponRof')}</Label>{' '}
                                      <Input
                                        defaultValue={weapon.rof}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'rof',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponDamage')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.damage}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'damage',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>{t('dh2.weaponClip')}</Label>{' '}
                                      <Input
                                        type="number"
                                        defaultValue={
                                          weapon.clip === 0 ? '' : weapon.clip
                                        }
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'clip',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponClipSize')}
                                      </Label>{' '}
                                      <Input
                                        type="number"
                                        defaultValue={
                                          weapon.clipSize === 0
                                            ? ''
                                            : weapon.clipSize
                                        }
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'clipSize',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponReload')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.reload}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'reload',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      {' '}
                                      <Label>
                                        {t('dh2.weaponTraits')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.traits}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'traits',
                                            e.target.value,
                                          )
                                        }
                                        className="h-7 text-xs"
                                      />{' '}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponType')}:
                                      </strong>{' '}
                                      {weapon.type || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponRange')}:
                                      </strong>{' '}
                                      {weapon.range || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponRof')}:
                                      </strong>{' '}
                                      {weapon.rof || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponDamage')}:
                                      </strong>{' '}
                                      {weapon.damage || '-'}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponClip')}:
                                      </strong>{' '}
                                      {weapon.clip} / {weapon.clipSize}
                                    </div>
                                    <div>
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponReload')}:
                                      </strong>{' '}
                                      {weapon.reload || '-'}
                                    </div>
                                    <div className="col-span-2">
                                      <strong className="text-muted-foreground">
                                        {t('dh2.weaponTraits')}:
                                      </strong>{' '}
                                      <span className="break-words">
                                        {weapon.traits || '-'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                  checked={!!weapon.equipped}
                                  onCheckedChange={(c) =>
                                    isRangedWeaponsEditing
                                      ? handleRangedWeaponChange(
                                          weapon.id,
                                          'equipped',
                                          !!c,
                                        )
                                      : updateCharacter(character.id, {
                                          equipment: {
                                            ...character.equipment,
                                            weapons: {
                                              ...character.equipment.weapons,
                                              ranged: (
                                                character.equipment.weapons
                                                  .ranged ?? []
                                              ).map((w) =>
                                                w.id === weapon.id
                                                  ? { ...w, equipped: !!c }
                                                  : w,
                                              ),
                                            },
                                          },
                                        })
                                  }
                                />
                                <Label className="text-xs">
                                  {t('dh2.equipped')}
                                </Label>
                              </div>
                            </div>
                          ))}
                        </div>
                        {isRangedWeaponsEditing && (
                          <div className="p-2 pt-4">
                            <Button
                              onClick={addRangedWeapon}
                              size="sm"
                              className="w-full"
                            >
                              <Plus className="mr-2 h-4 w-4" />{' '}
                              {t('common.add')} {t('dh2.rangedWeapons')}
                            </Button>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div
          className={cn(
            isCompactView &&
              activeCompactSection !== 'inventory-section' &&
              'hidden',
          )}
        >
          <Collapsible
            id="inventory-section"
            open={isInventorySectionOpen}
            onOpenChange={setIsInventorySectionOpen}
            className={cn(
              'overflow-hidden rounded-lg border',
              isCompactView && 'bg-card',
            )}
          >
            <div className="flex items-center border-b pr-4">
              <h3 className="font-headline flex-1 px-6 py-4 text-lg leading-none font-semibold tracking-tight">
                {t('common.inventory')}
              </h3>
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isInventorySectionOpen && 'rotate-90',
                    )}
                  />
                  <span className="sr-only">{t('dh2.toggleInventory')}</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className={cn('space-y-8', isCompactView ? 'p-3' : 'p-6')}>
                <div className="bg-card rounded-lg border p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-primary text-lg font-semibold">
                        {t('dh2.wealth')}
                      </h4>
                      {!hideNotes && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={
                                character.wealth?.notes ? 'secondary' : 'ghost'
                              }
                              size="icon"
                              className="h-6 w-6 shrink-0"
                            >
                              <InfoIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64">
                            <Label className="mb-2 block text-xs">
                              {t('dh2.wealthNotes')}
                            </Label>
                            <Textarea
                              defaultValue={character.wealth?.notes || ''}
                              onBlur={(e) =>
                                updateCharacter(character.id, {
                                  wealth: {
                                    ...editableWealth,
                                    notes: e.target.value,
                                  },
                                })
                              }
                              placeholder={t('dh2.wealthNotesPlaceholder')}
                              className="min-h-[100px] text-sm"
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {(showEditButtons || isWealthEditing) && (
                      <EditSaveButton
                        editing={isWealthEditing}
                        onEdit={() => setIsWealthEditing(true)}
                        onSave={handleSaveWealth}
                      />
                    )}
                  </div>
                  {isWealthEditing ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>{t('dh2.throneGelt')}</Label>
                        <Input
                          type="number"
                          value={
                            editableWealth.throneGelt === 0
                              ? ''
                              : editableWealth.throneGelt
                          }
                          onChange={(e) =>
                            setEditableWealth((prev) => ({
                              ...prev,
                              throneGelt: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t('dh2.monthlyIncome')}</Label>
                        <Input
                          type="number"
                          value={
                            editableWealth.monthlyIncome === 0
                              ? ''
                              : editableWealth.monthlyIncome
                          }
                          onChange={(e) =>
                            setEditableWealth((prev) => ({
                              ...prev,
                              monthlyIncome: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 text-sm font-medium md:grid-cols-2">
                      <div className="bg-background flex items-center justify-between rounded border p-2">
                        <span>{t('dh2.throneGelt')}:</span>{' '}
                        <span className="text-primary font-bold">
                          {character.wealth?.throneGelt ?? 0}
                        </span>
                      </div>
                      <div className="bg-background flex items-center justify-between rounded border p-2">
                        <span>{t('dh2.monthlyIncome')}:</span>{' '}
                        <span className="text-primary font-bold">
                          {character.wealth?.monthlyIncome ?? 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-card space-y-4 rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-lg font-semibold">
                      {t('common.items')}
                    </h4>
                    {(showEditButtons || isInventoryEditing) && (
                      <EditSaveButton
                        editing={isInventoryEditing}
                        onEdit={() => setIsInventoryEditing(true)}
                        onSave={handleSaveInventory}
                      />
                    )}
                  </div>
                  {isInventoryEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
                        {editableInventory.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2"
                          >
                            <Input
                              defaultValue={item.name}
                              onChange={(e) =>
                                setEditableInventory(
                                  editableInventory.map((i) =>
                                    i.id === item.id
                                      ? { ...i, name: e.target.value }
                                      : i,
                                  ),
                                )
                              }
                              className="h-9 text-sm"
                            />
                            {!hideNotes && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={item.notes ? 'secondary' : 'ghost'}
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                  >
                                    <InfoIcon className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64">
                                  <Label className="mb-2 block text-xs">
                                    {t('common.notesFor')} {item.name}
                                  </Label>
                                  <Textarea
                                    defaultValue={item.notes || ''}
                                    onBlur={(e) =>
                                      setEditableInventory(
                                        editableInventory.map((i) =>
                                          i.id === item.id
                                            ? { ...i, notes: e.target.value }
                                            : i,
                                        ),
                                      )
                                    }
                                    placeholder={t('dh2.addNotesPlaceholder')}
                                    className="mt-2 min-h-[100px] text-sm"
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() =>
                                setEditableInventory(
                                  editableInventory.filter(
                                    (i) => i.id !== item.id,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="text-destructive h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Input
                          placeholder={t('dh2.newInventoryItem')}
                          value={newInventoryItem}
                          onChange={(e) => setNewInventoryItem(e.target.value)}
                        />
                        <Button onClick={addInventoryItem} size="sm">
                          <Plus className="mr-2 h-4 w-4" /> {t('common.add')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground grid grid-cols-1 gap-x-4 gap-y-1 text-sm md:grid-cols-2">
                      {(currentInventory ?? []).length > 0 ? (
                        currentInventory.map((item) => (
                          <div
                            key={item.id}
                            className="hover:bg-muted/50 flex items-start gap-2 rounded p-1.5 transition-colors"
                          >
                            <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"></span>
                            <span className="text-foreground flex-grow font-medium break-words">
                              {item.name}
                            </span>
                            {!hideNotes && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={item.notes ? 'secondary' : 'ghost'}
                                    size="icon"
                                    className="-mt-0.5 -mr-1 h-5 w-5 shrink-0"
                                  >
                                    <InfoIcon className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64">
                                  <Label className="mb-2 block text-xs">
                                    {t('common.notesFor')} {item.name}
                                  </Label>
                                  <Textarea
                                    defaultValue={item.notes || ''}
                                    onBlur={(e) =>
                                      updateCharacter(character.id, {
                                        inventory: (
                                          character.inventory || []
                                        ).map((i) =>
                                          i.id === item.id
                                            ? { ...i, notes: e.target.value }
                                            : i,
                                        ),
                                      })
                                    }
                                    placeholder={t('dh2.addNotesPlaceholder')}
                                    className="mt-2 min-h-[100px] text-sm"
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground col-span-full rounded-lg border border-dashed p-4 text-center text-sm italic">
                          {t('dh2.noInventoryItems')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </>
    );
  },
);

EquipmentInventorySection.displayName = 'EquipmentInventorySection';
