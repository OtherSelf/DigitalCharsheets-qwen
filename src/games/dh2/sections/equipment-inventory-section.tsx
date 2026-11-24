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
  inventoryTotals,
  readQuantity,
  readStatus,
  readWeight,
} from '../inventory';
import {
  ArmorPiece,
  BodyPart,
  MeleeWeapon,
  RangedWeapon,
  type DH2Character,
} from '../types';
import { CustomResourceCounter } from './custom-resource-counter';
import { EditSaveButton } from './dh-ui-helpers';
import { RequisitionBlock } from './requisition-block';

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
  'Flak',
  'Mesh',
  'Carapace',
  'Power',
  'Force',
];

/**
 * В сохранённых листах мог остаться `Flack` (значение прежнего селекта):
 * сравниваем и показываем его как `Flak`, иначе селект не находил опцию, а
 * лист рисовал сырую строку вместо перевода.
 */
const ARMOR_TYPE_ALIASES: Readonly<Record<string, string>> = { Flack: 'Flak' };

function normalizeArmorType(type: string | null | undefined): string {
  if (!type) return '';
  return ARMOR_TYPE_ALIASES[type] ?? type;
}

/** Разбор чисел инвентаря: пустое поле — «не задано», отрицательное — 0. */
function parseQuantity(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, parsed);
}

function parseWeight(value: string): number | undefined {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, parsed);
}

/** Вес — один знак после запятой, если он не целый. */
function formatWeight(value: number | undefined): string {
  if (value === undefined) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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

    const [isArmorEditing, setIsArmorEditing] = React.useState(false);
    const [isMeleeWeaponsEditing, setIsMeleeWeaponsEditing] =
      React.useState(false);
    const [isRangedWeaponsEditing, setIsRangedWeaponsEditing] =
      React.useState(false);
    // Новый элемент рендерится только в раскрытом «Не экипировано»:
    // после добавления раскрываем нужный аккордеон, иначе клик по кнопке
    // выглядит как «ничего не произошло».
    const [openWeaponSlot, setOpenWeaponSlot] = React.useState<
      'melee' | 'ranged' | null
    >(null);
    const [isInventoryEditing, setIsInventoryEditing] = React.useState(false);
    const [isEquipmentSectionOpen, setIsEquipmentSectionOpen] =
      React.useState(true);
    const [isInventorySectionOpen, setIsInventorySectionOpen] =
      React.useState(true);
    const [isArmorExpanded, setIsArmorExpanded] = React.useState(false);

    const [editableEquipment, setEditableEquipment] = React.useState(
      character.equipment ?? defaultEquipment,
    );
    const [editableInventory, setEditableInventory] = React.useState(
      character.inventory ?? [],
    );
    const [newInventoryItem, setNewInventoryItem] = React.useState('');

    const isAnyEditing =
      isArmorEditing ||
      isMeleeWeaponsEditing ||
      isRangedWeaponsEditing ||
      isInventoryEditing;

    /**
     * Свежий снимок оборудования в `editableEquipment` перед правкой.
     *
     * Без него переключение «Экипировано» в режиме просмотра терялось: снимок
     * оставался от монтирования секции, и сохранение писало старые флаги.
     * Если другая секция уже правится, снимок не берём — иначе пропадут её
     * несохранённые изменения.
     */
    const beginEquipmentEditing = (open: () => void) => {
      if (!isAnyEditing) {
        setEditableEquipment(
          JSON.parse(JSON.stringify(character.equipment ?? defaultEquipment)),
        );
      }
      open();
    };

    const handleSaveArmor = React.useCallback(() => {
      const base = character.equipment ?? defaultEquipment;
      updateCharacter(character.id, {
        equipment: { ...base, armor: editableEquipment.armor },
      });
      setIsArmorEditing(false);
    }, [character.id, character.equipment, editableEquipment, updateCharacter]);
    const handleSaveMeleeWeapons = React.useCallback(() => {
      const base = character.equipment ?? defaultEquipment;
      updateCharacter(character.id, {
        equipment: {
          ...base,
          weapons: {
            ...(base.weapons ?? defaultEquipment.weapons),
            melee: editableEquipment.weapons?.melee ?? [],
          },
        },
      });
      setIsMeleeWeaponsEditing(false);
    }, [character.id, character.equipment, editableEquipment, updateCharacter]);
    const handleSaveRangedWeapons = React.useCallback(() => {
      const base = character.equipment ?? defaultEquipment;
      updateCharacter(character.id, {
        equipment: {
          ...base,
          weapons: {
            ...(base.weapons ?? defaultEquipment.weapons),
            ranged: editableEquipment.weapons?.ranged ?? [],
          },
        },
      });
      setIsRangedWeaponsEditing(false);
    }, [character.id, character.equipment, editableEquipment, updateCharacter]);
    const handleSaveInventory = React.useCallback(() => {
      updateCharacter(character.id, { inventory: editableInventory });
      setIsInventoryEditing(false);
    }, [character.id, editableInventory, updateCharacter]);
    React.useEffect(() => {
      onEditingChange?.(isAnyEditing);
    }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        // Сохранение всех секций сразу собирает оборудование одним патчем:
        // последовательные вызовы handleSave* писали бы каждый свою версию
        // от одного и того же снимка и затирали бы друг друга.
        saveAll: () => {
          if (
            isArmorEditing ||
            isMeleeWeaponsEditing ||
            isRangedWeaponsEditing
          ) {
            const base = character.equipment ?? defaultEquipment;
            updateCharacter(character.id, {
              equipment: {
                ...base,
                armor: isArmorEditing ? editableEquipment.armor : base.armor,
                weapons: {
                  melee: isMeleeWeaponsEditing
                    ? (editableEquipment.weapons?.melee ?? [])
                    : (base.weapons?.melee ?? []),
                  ranged: isRangedWeaponsEditing
                    ? (editableEquipment.weapons?.ranged ?? [])
                    : (base.weapons?.ranged ?? []),
                },
              },
            });
            setIsArmorEditing(false);
            setIsMeleeWeaponsEditing(false);
            setIsRangedWeaponsEditing(false);
          }
          if (isInventoryEditing) handleSaveInventory();
        },
      }),
      [
        character.id,
        character.equipment,
        editableEquipment,
        isArmorEditing,
        isMeleeWeaponsEditing,
        isRangedWeaponsEditing,
        isInventoryEditing,
        handleSaveInventory,
        updateCharacter,
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
      setOpenWeaponSlot('melee');
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
        penetration: '',
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
      setOpenWeaponSlot('ranged');
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
            quantity: 1,
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
      const normalized = normalizeArmorType(type);
      if (!normalized) return '-';
      const translationKey = `dh2.armorType${normalized}`;
      const translated = t(translationKey);
      return translated === translationKey ? normalized : translated;
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

    // Каждая ветка берёт свой источник: правка одного вида оружия не должна
    // подменять отображение соседнего (иначе переключение в просмотре теряется).
    const storedEquipment = character.equipment ?? defaultEquipment;
    const currentEquipment = {
      armor: isArmorEditing ? editableEquipment.armor : storedEquipment.armor,
      weapons: {
        melee: isMeleeWeaponsEditing
          ? (editableEquipment.weapons?.melee ?? [])
          : (storedEquipment.weapons?.melee ?? []),
        ranged: isRangedWeaponsEditing
          ? (editableEquipment.weapons?.ranged ?? [])
          : (storedEquipment.weapons?.ranged ?? []),
      },
    };
    const currentInventory = isInventoryEditing
      ? editableInventory
      : (character.inventory ?? []);
    const inventoryTotal = inventoryTotals(currentInventory);
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
                <RequisitionBlock character={character} />
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
                          onEdit={() =>
                            beginEquipmentEditing(() => setIsArmorEditing(true))
                          }
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
                                          value={normalizeArmorType(
                                            armorPiece?.type,
                                          )}
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
                                            value={normalizeArmorType(
                                              armorPiece?.type,
                                            )}
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
                <div className="space-y-4" data-testid="melee-weapons">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-lg font-semibold">
                        {t('dh2.meleeWeapons')}
                      </h4>
                      {(showEditButtons || isMeleeWeaponsEditing) && (
                        <EditSaveButton
                          editing={isMeleeWeaponsEditing}
                          onEdit={() =>
                            beginEquipmentEditing(() =>
                              setIsMeleeWeaponsEditing(true),
                            )
                          }
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
                                      className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                  className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                  <Accordion
                    type="single"
                    collapsible
                    className="w-full"
                    value={openWeaponSlot === 'melee' ? 'unequipped-melee' : ''}
                    onValueChange={(value) =>
                      setOpenWeaponSlot(
                        value === 'unequipped-melee' ? 'melee' : null,
                      )
                    }
                  >
                    <AccordionItem
                      value="unequipped-melee"
                      className="border-b-0"
                    >
                      <AccordionPrimitive.Header className="flex w-full">
                        <AccordionPrimitive.Trigger
                          data-testid="unequipped-melee-trigger"
                          className="flex flex-1 items-center justify-between py-2 text-sm font-medium [&[data-state=open]>svg]:rotate-180"
                        >
                          <span>
                            {t('dh2.notEquipped')} (
                            <span className="text-muted-foreground">
                              {unequippedMeleeWeapons.length}
                            </span>
                            )
                          </span>
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
                                          className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                      className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  {isMeleeWeaponsEditing && (
                    <div className="pt-2">
                      <Button
                        data-testid="add-melee-weapon"
                        onClick={addMeleeWeapon}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" /> {t('common.add')}{' '}
                        {t('dh2.meleeWeapons')}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-4" data-testid="ranged-weapons">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-lg font-semibold">
                        {t('dh2.rangedWeapons')}
                      </h4>
                      {(showEditButtons || isRangedWeaponsEditing) && (
                        <EditSaveButton
                          editing={isRangedWeaponsEditing}
                          onEdit={() =>
                            beginEquipmentEditing(() =>
                              setIsRangedWeaponsEditing(true),
                            )
                          }
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
                                      className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                  className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                  <Label>
                                    {t('dh2.weaponPenetration')}
                                  </Label>{' '}
                                  <Input
                                    defaultValue={weapon.penetration ?? ''}
                                    onChange={(e) =>
                                      handleRangedWeaponChange(
                                        weapon.id,
                                        'penetration',
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
                                    {t('dh2.weaponPenetration')}:
                                  </strong>{' '}
                                  {weapon.penetration || '-'}
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
                  <Accordion
                    type="single"
                    collapsible
                    className="w-full"
                    value={
                      openWeaponSlot === 'ranged' ? 'unequipped-ranged' : ''
                    }
                    onValueChange={(value) =>
                      setOpenWeaponSlot(
                        value === 'unequipped-ranged' ? 'ranged' : null,
                      )
                    }
                  >
                    <AccordionItem
                      value="unequipped-ranged"
                      className="border-b-0"
                    >
                      <AccordionPrimitive.Header className="flex w-full">
                        <AccordionPrimitive.Trigger
                          data-testid="unequipped-ranged-trigger"
                          className="flex flex-1 items-center justify-between py-2 text-sm font-medium [&[data-state=open]>svg]:rotate-180"
                        >
                          <span>
                            {t('dh2.notEquipped')} (
                            <span className="text-muted-foreground">
                              {unequippedRangedWeapons.length}
                            </span>
                            )
                          </span>
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
                                          className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                      className="h-7 w-7 max-md:h-10 max-md:w-10"
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
                                      <Label>
                                        {t('dh2.weaponPenetration')}
                                      </Label>{' '}
                                      <Input
                                        defaultValue={weapon.penetration ?? ''}
                                        onChange={(e) =>
                                          handleRangedWeaponChange(
                                            weapon.id,
                                            'penetration',
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
                                        {t('dh2.weaponPenetration')}:
                                      </strong>{' '}
                                      {weapon.penetration || '-'}
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  {isRangedWeaponsEditing && (
                    <div className="pt-2">
                      <Button
                        data-testid="add-ranged-weapon"
                        onClick={addRangedWeapon}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" /> {t('common.add')}{' '}
                        {t('dh2.rangedWeapons')}
                      </Button>
                    </div>
                  )}
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
                <div className="bg-card space-y-4 rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-lg font-semibold">
                      {t('common.items')}
                    </h4>
                    {(showEditButtons || isInventoryEditing) && (
                      <EditSaveButton
                        editing={isInventoryEditing}
                        onEdit={() => {
                          // Снимок берётся в момент входа в правку: переключения
                          // «потеряно» из режима просмотра не должны откатиться.
                          setEditableInventory(character.inventory ?? []);
                          setIsInventoryEditing(true);
                        }}
                        onSave={handleSaveInventory}
                      />
                    )}
                  </div>
                  {isInventoryEditing ? (
                    <div className="space-y-2">
                      {editableInventory.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-2 gap-2 rounded border p-2"
                        >
                          <Input
                            defaultValue={item.name}
                            aria-label={t('common.items')}
                            onChange={(e) =>
                              setEditableInventory(
                                editableInventory.map((i) =>
                                  i.id === item.id
                                    ? { ...i, name: e.target.value }
                                    : i,
                                ),
                              )
                            }
                            className="col-span-2 h-8 text-sm"
                          />
                          <div className="space-y-1">
                            <span className="text-muted-foreground block text-[10px] leading-none">
                              {t('dh2.inventoryQuantityShort')}
                            </span>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              defaultValue={item.quantity ?? ''}
                              placeholder="1"
                              aria-label={t('common.quantity')}
                              onChange={(e) =>
                                setEditableInventory(
                                  editableInventory.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          quantity: parseQuantity(
                                            e.target.value,
                                          ),
                                        }
                                      : i,
                                  ),
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block text-[10px] leading-none">
                              {t('dh2.inventoryWeightUnit')}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              defaultValue={item.weight ?? ''}
                              placeholder="0.0"
                              aria-label={t('common.weight')}
                              onChange={(e) =>
                                setEditableInventory(
                                  editableInventory.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          weight: parseWeight(e.target.value),
                                        }
                                      : i,
                                  ),
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <Checkbox
                              checked={readStatus(item) === 'lost'}
                              aria-label={t('dh2.inventoryLost')}
                              onCheckedChange={(checked) =>
                                setEditableInventory(
                                  editableInventory.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          status: checked ? 'lost' : 'default',
                                        }
                                      : i,
                                  ),
                                )
                              }
                            />
                            <Label className="text-xs">
                              {t('dh2.inventoryLost')}
                            </Label>
                            {!hideNotes && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={item.notes ? 'secondary' : 'ghost'}
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
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
                        </div>
                      ))}
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
                    <>
                      <div className="text-muted-foreground hidden grid-cols-[minmax(0,1fr)_3rem_3.5rem] gap-2 px-1 text-xs md:grid">
                        <span>{t('common.items')}</span>
                        <span className="text-right">
                          {t('common.quantity')}
                        </span>
                        <span className="text-right">{t('common.weight')}</span>
                      </div>
                      {currentInventory.length > 0 ? (
                        currentInventory.map((item) => {
                          const lost = readStatus(item) === 'lost';
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'hover:bg-muted/50 grid grid-cols-2 items-center gap-x-3 gap-y-0.5 rounded p-1.5 text-sm transition-colors md:grid-cols-[minmax(0,1fr)_3rem_3.5rem] md:gap-2',
                                lost && 'text-muted-foreground',
                              )}
                            >
                              <div className="col-span-2 flex min-w-0 items-center gap-1.5 md:col-span-1">
                                <Checkbox
                                  checked={lost}
                                  aria-label={t('dh2.inventoryLost')}
                                  title={t('dh2.inventoryLost')}
                                  onCheckedChange={(checked) =>
                                    updateCharacter(character.id, {
                                      inventory: (
                                        character.inventory ?? []
                                      ).map((i) =>
                                        i.id === item.id
                                          ? {
                                              ...i,
                                              status: checked
                                                ? 'lost'
                                                : 'default',
                                            }
                                          : i,
                                      ),
                                    })
                                  }
                                />
                                <span
                                  title={item.name}
                                  className={cn(
                                    'min-w-0 flex-1 truncate font-medium',
                                    lost
                                      ? 'text-muted-foreground line-through'
                                      : 'text-foreground',
                                  )}
                                >
                                  {item.name}
                                </span>
                                {!hideNotes && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={
                                          item.notes ? 'secondary' : 'ghost'
                                        }
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                      >
                                        <InfoIcon className="h-3.5 w-3.5" />
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
                                              character.inventory ?? []
                                            ).map((i) =>
                                              i.id === item.id
                                                ? {
                                                    ...i,
                                                    notes: e.target.value,
                                                  }
                                                : i,
                                            ),
                                          })
                                        }
                                        placeholder={t(
                                          'dh2.addNotesPlaceholder',
                                        )}
                                        className="mt-2 min-h-[100px] text-sm"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              <div className="flex flex-col items-start leading-tight md:items-end">
                                <span className="text-muted-foreground text-[10px] md:hidden">
                                  {t('common.quantity')}
                                </span>
                                <span>{readQuantity(item)}</span>
                              </div>
                              <div className="flex flex-col items-start leading-tight md:items-end">
                                <span className="text-muted-foreground text-[10px] md:hidden">
                                  {t('common.weight')}
                                </span>
                                <span>{formatWeight(readWeight(item))}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm italic">
                          {t('dh2.noInventoryItems')}
                        </p>
                      )}
                      {currentInventory.length > 0 && (
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-1 pt-1 text-sm font-medium">
                          <span className="mr-auto">
                            {t('dh2.inventoryTotals')}
                          </span>
                          <span>
                            {t('common.weight')}:{' '}
                            <span className="text-foreground">
                              {formatWeight(inventoryTotal.weight)}
                            </span>
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <CustomResourceCounter
                    character={character}
                    isCompactView={isCompactView}
                  />
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
