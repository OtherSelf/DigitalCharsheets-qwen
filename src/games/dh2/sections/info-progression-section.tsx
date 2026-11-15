'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCharacterContext,
  useToast,
  useTranslation,
} from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import { countAptitudeMatches } from '../dh2e-aptitudes';
import {
  aptitudeLabels,
  backgroundLabel,
  divinationEffectLabel,
  divinationLabel,
  eliteAdvanceLabel,
  homeWorldLabel,
  roleLabel,
} from '../dh2e-labels';
import { DH2E_SKILLS, DH2E_TALENTS } from '../dh2e-reference';
import { DH2E_SKILL_TIERS } from '../dh2e-rules';
import { skillRankCost, talentCost, toMatches } from '../dh2e-xp';
import type { DH2Character, Skill, Talent } from '../types';
import { EditSaveButton } from './dh-ui-helpers';

interface SectionProps {
  character: DH2Character;
  isCompactView: boolean;
  activeCompactSection?: string;
  onEditingChange?: (val: boolean) => void;
}

const DetailField = ({
  label,
  value,
  editing,
  onChange,
  onBlur,
  isCompactView,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  isCompactView: boolean;
}) => (
  <div className="space-y-1">
    <Label
      className={cn(
        'text-muted-foreground text-xs',
        isCompactView && 'text-[10px]',
      )}
    >
      {label}
    </Label>
    {editing ? (
      <Input
        defaultValue={value}
        onChange={onChange}
        onBlur={onBlur}
        className={cn('h-8', isCompactView && 'h-7 text-xs')}
      />
    ) : (
      <p
        className={cn(
          'text-sm font-medium break-words',
          isCompactView && 'text-xs',
        )}
      >
        {value || '-'}
      </p>
    )}
  </div>
);

const ReadOnlyField = ({
  label,
  value,
  isCompactView,
}: {
  label: string;
  value: string;
  isCompactView: boolean;
}) => (
  <div className="space-y-1">
    <Label
      className={cn(
        'text-muted-foreground text-xs',
        isCompactView && 'text-[10px]',
      )}
    >
      {label}
    </Label>
    <p
      className={cn(
        'text-sm font-medium break-words',
        isCompactView && 'text-xs',
      )}
    >
      {value || '-'}
    </p>
  </div>
);

export const InfoSection = ({
  character,
  isCompactView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [isInfoEditing, setIsInfoEditing] = React.useState(false);
  const [isBackstoryOpen, setIsBackstoryOpen] = React.useState(false);
  const [isNotesOpen, setIsNotesOpen] = React.useState(false);

  React.useEffect(() => {
    onEditingChange?.(isInfoEditing);
  }, [isInfoEditing, onEditingChange]);

  const showInfo = !isCompactView || activeCompactSection === 'info-section';
  if (!showInfo) return null;

  return (
    <Card id="info-section">
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between px-6 pt-3 pb-6',
          isCompactView && 'px-4 pt-2 pb-4',
        )}
      >
        <CardTitle
          className={cn(
            'font-headline',
            isCompactView ? 'text-lg' : 'text-2xl',
          )}
        >
          {t('common.info')}
        </CardTitle>
        {(showEditButtons || isInfoEditing) && (
          <EditSaveButton
            editing={isInfoEditing}
            onEdit={() => setIsInfoEditing(true)}
            onSave={() => setIsInfoEditing(false)}
          />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="dcs-info-grid grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
          <DetailField
            label={t('common.characterName')}
            value={character.name}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { name: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.homeWorld')}
            value={
              character.homeWorld
                ? homeWorldLabel(character.homeWorld, t)
                : t('dh2.waitingHomeWorld')
            }
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.background')}
            value={backgroundLabel(character.background, t)}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.role')}
            value={roleLabel(character.role, t)}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.aptitudes')}
            value={aptitudeLabels(character.aptitudes.profile, t)}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.eliteAdvances')}
            value={character.eliteAdvances
              .map((id) => eliteAdvanceLabel(id, t))
              .join(', ')}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.psyRating')}
            value={character.psy.rating > 0 ? String(character.psy.rating) : ''}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.divination')}
            value={divinationLabel(character.divination, t)}
            isCompactView={isCompactView}
          />
          <ReadOnlyField
            label={t('dh2.divinationEffect')}
            value={divinationEffectLabel(character.divination, t)}
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.age')}
            value={character.age}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { age: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.height')}
            value={character.height}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { height: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('common.weight')}
            value={character.weight}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { weight: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh2.skinColor')}
            value={character.skinColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { skinColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh2.hairColor')}
            value={character.hairColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { hairColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
          <DetailField
            label={t('dh2.eyeColor')}
            value={character.eyeColor}
            editing={isInfoEditing}
            onBlur={(e) =>
              updateCharacter(character.id, { eyeColor: e.target.value })
            }
            isCompactView={isCompactView}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBackstoryOpen(true)}
          >
            {t('common.backstory')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsNotesOpen(true)}
          >
            {t('common.notes')}
          </Button>
        </div>
      </CardContent>

      <Dialog open={isBackstoryOpen} onOpenChange={setIsBackstoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.backstory')}</DialogTitle>
            <DialogDescription>{t('common.backstory')}</DialogDescription>
          </DialogHeader>
          <Textarea
            defaultValue={character.backstory}
            className="min-h-[180px]"
            onBlur={(e) =>
              updateCharacter(character.id, { backstory: e.target.value })
            }
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.notes')}</DialogTitle>
            <DialogDescription>{t('common.notes')}</DialogDescription>
          </DialogHeader>
          <Textarea
            defaultValue={character.notes}
            className="min-h-[180px]"
            onBlur={(e) =>
              updateCharacter(character.id, { notes: e.target.value })
            }
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export const ProgressionSection = ({
  character,
  isCompactView,
  activeCompactSection,
  onEditingChange,
}: SectionProps) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);

  React.useEffect(() => {
    onEditingChange?.(isProgressionEditing);
  }, [isProgressionEditing, onEditingChange]);

  const available =
    (character.experience ?? 0) - (character.totalExpSpent ?? 0);

  const [purchaseKind, setPurchaseKind] = React.useState<'skill' | 'talent'>(
    'skill',
  );
  const [purchaseRef, setPurchaseRef] = React.useState('');
  const [purchaseRank, setPurchaseRank] = React.useState(1);
  const [purchaseTier, setPurchaseTier] = React.useState(1);

  const talentOptions = React.useMemo(
    () => DH2E_TALENTS.filter((item) => item.tier === purchaseTier),
    [purchaseTier],
  );
  const selectedSkill = DH2E_SKILLS.find((item) => item.id === purchaseRef);
  const selectedTalent = DH2E_TALENTS.find((item) => item.id === purchaseRef);

  const purchaseCost = React.useMemo(() => {
    if (purchaseKind === 'skill') {
      if (!selectedSkill) return 0;
      const matches = toMatches(
        countAptitudeMatches(
          selectedSkill.aptitudeIds,
          character.aptitudes.profile,
        ),
      );
      return skillRankCost(matches, purchaseRank - 1);
    }
    if (!selectedTalent) return 0;
    const matches = toMatches(
      countAptitudeMatches(
        selectedTalent.aptitudeSlots,
        character.aptitudes.profile,
      ),
    );
    return talentCost(matches, selectedTalent.tier);
  }, [purchaseKind, selectedSkill, selectedTalent, purchaseRank, character]);

  const handlePurchase = () => {
    if (!purchaseRef || purchaseCost <= 0) return;
    const entry = {
      id: `${purchaseKind}:${purchaseRef}:${Date.now()}`,
      kind: purchaseKind,
      ref: purchaseRef,
      cost: purchaseCost,
      createdAt: new Date().toISOString(),
    } as DH2Character['experienceLog'][number];
    const patch: Partial<DH2Character> = {
      experienceLog: [...character.experienceLog, entry],
      totalExpSpent: character.totalExpSpent + purchaseCost,
    };
    if (purchaseKind === 'skill' && selectedSkill) {
      const name = t(selectedSkill.labelKey);
      const existing = character.skills.find((item) => item.name === name);
      const training = {
        skilled: purchaseRank >= 1,
        plus10: purchaseRank >= 2,
        plus20: purchaseRank >= 3,
        plus30: purchaseRank >= 4,
      };
      patch.skills = existing
        ? character.skills.map((item) =>
            item.name === name
              ? { ...item, training: { ...item.training, ...training } }
              : item,
          )
        : [
            ...character.skills,
            {
              id: `skill-${purchaseRef}`,
              name,
              notes: '',
              type: 'basic',
              training,
            } satisfies Skill,
          ];
    }
    if (purchaseKind === 'talent' && selectedTalent) {
      const name = t(selectedTalent.labelKey);
      if (!character.talents.some((item) => item.name === name)) {
        patch.talents = [
          ...character.talents,
          { id: `talent-${purchaseRef}`, name, notes: '' } satisfies Talent,
        ];
      }
    }
    updateCharacter(character.id, patch);
    if (purchaseCost > available) {
      toast({
        variant: 'destructive',
        title: t('dh2.xpWarning'),
        description: t('dh2.xpWarningNegative'),
      });
    }
    setPurchaseRef('');
  };

  const showProgression =
    !isCompactView || activeCompactSection === 'progression-section';
  if (!showProgression) return null;

  return (
    <Card id="progression-section">
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between px-6 pt-3 pb-6',
          isCompactView && 'px-4 pt-2 pb-4',
        )}
      >
        <CardTitle
          className={cn(
            'font-headline',
            isCompactView ? 'text-lg' : 'text-2xl',
          )}
        >
          {t('dh2.experience')}
        </CardTitle>
        {(showEditButtons || isProgressionEditing) && (
          <EditSaveButton
            editing={isProgressionEditing}
            onEdit={() => setIsProgressionEditing(true)}
            onSave={() => setIsProgressionEditing(false)}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.currentExp')}
            </Label>
            {isProgressionEditing ? (
              <Input
                type="number"
                defaultValue={character.experience ?? 0}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    experience: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="h-8"
              />
            ) : (
              <p className="text-sm font-medium">{character.experience ?? 0}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.totalExpSpent')}
            </Label>
            {isProgressionEditing ? (
              <Input
                type="number"
                defaultValue={character.totalExpSpent ?? 0}
                onBlur={(e) =>
                  updateCharacter(character.id, {
                    totalExpSpent: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="h-8"
              />
            ) : (
              <p className="text-sm font-medium">
                {character.totalExpSpent ?? 0}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.availableExp')}
            </Label>
            <p className="text-primary text-sm font-semibold">{available}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.psyRating')}
            </Label>
            <p className="text-sm font-medium">{character.psy.rating || '-'}</p>
          </div>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-muted-foreground text-xs">
            {t('dh2.purchaseExp')}
          </Label>
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
              value={purchaseKind}
              onChange={(event) => {
                setPurchaseKind(event.target.value as 'skill' | 'talent');
                setPurchaseRef('');
              }}
              aria-label={t('dh2.purchaseKind')}
            >
              <option value="skill">{t('dh2.skills')}</option>
              <option value="talent">{t('dh2.talentsAndTraits')}</option>
            </select>
            {purchaseKind === 'talent' && (
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={purchaseTier}
                onChange={(event) => {
                  setPurchaseTier(Number(event.target.value));
                  setPurchaseRef('');
                }}
                aria-label={t('dh2.tier')}
              >
                {[1, 2, 3].map((tier) => (
                  <option key={tier} value={tier}>
                    {t('dh2.tier')} {tier}
                  </option>
                ))}
              </select>
            )}
            <select
              className="border-input bg-background h-8 min-w-[10rem] rounded-md border px-2 text-xs"
              value={purchaseRef}
              onChange={(event) => setPurchaseRef(event.target.value)}
              aria-label={t('dh2.purchaseItem')}
            >
              <option value="">{t('dh2.purchaseItem')}</option>
              {(purchaseKind === 'skill' ? DH2E_SKILLS : talentOptions).map(
                (item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.labelKey)}
                  </option>
                ),
              )}
            </select>
            {purchaseKind === 'skill' && (
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={purchaseRank}
                onChange={(event) =>
                  setPurchaseRank(Number(event.target.value))
                }
                aria-label={t('dh2.rank')}
              >
                {DH2E_SKILL_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.rank}>
                    {t(tier.labelKey)}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handlePurchase}
              disabled={!purchaseRef || purchaseCost <= 0}
            >
              {t('dh2.buy')} {purchaseCost > 0 ? `· ${purchaseCost} XP` : ''}
            </Button>
          </div>
        </div>
        {character.experienceLog.length > 0 && (
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('dh2.experienceLog')}
            </Label>
            <ul className="space-y-1 text-xs">
              {character.experienceLog.slice(-10).map((entry) => (
                <li key={entry.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {t(`dh2.experienceKind.${entry.kind}`)}: {entry.ref}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {entry.cost}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
