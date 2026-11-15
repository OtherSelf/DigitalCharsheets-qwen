'use client';

import * as React from 'react';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import {
  aptitudeLabels,
  backgroundLabel,
  divinationEffectLabel,
  divinationLabel,
  eliteAdvanceLabel,
  homeWorldLabel,
  roleLabel,
} from '../dh2e-labels';
import type { DH2Character } from '../types';
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
            label={t('dh2.gender')}
            value={character.gender}
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
  const { t, language } = useTranslation();
  const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
  const [isSpendOpen, setIsSpendOpen] = React.useState(false);
  const [isJournalOpen, setIsJournalOpen] = React.useState(false);
  const [spendAmount, setSpendAmount] = React.useState(0);
  const [spendWhat, setSpendWhat] = React.useState('');

  React.useEffect(() => {
    onEditingChange?.(isProgressionEditing);
  }, [isProgressionEditing, onEditingChange]);

  const available =
    (character.experience ?? 0) - (character.totalExpSpent ?? 0);

  const handleDeleteExperience = (entryId: string) => {
    const entry = character.experienceLog.find((item) => item.id === entryId);
    if (!entry) return;
    updateCharacter(character.id, {
      totalExpSpent: Math.max(0, character.totalExpSpent - entry.cost),
      experienceLog: character.experienceLog.filter(
        (item) => item.id !== entryId,
      ),
    });
  };

  const handleSpend = () => {
    if (spendAmount <= 0) return;
    const note = spendWhat.trim();
    updateCharacter(character.id, {
      totalExpSpent: character.totalExpSpent + spendAmount,
      experienceLog: [
        ...character.experienceLog,
        {
          id: `manual:${Date.now()}`,
          kind: 'other',
          ref: note || t('dh2.experienceKind.other'),
          cost: spendAmount,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setSpendAmount(0);
    setSpendWhat('');
    setIsSpendOpen(false);
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSpendOpen(true)}
          >
            {t('dh2.spendExp')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsJournalOpen(true)}
          >
            {t('dh2.experienceLog')}
          </Button>
          {(showEditButtons || isProgressionEditing) && (
            <EditSaveButton
              editing={isProgressionEditing}
              onEdit={() => setIsProgressionEditing(true)}
              onSave={() => setIsProgressionEditing(false)}
            />
          )}
        </div>
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
      </CardContent>
      <Dialog open={isSpendOpen} onOpenChange={setIsSpendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh2.spendExp')}</DialogTitle>
            <DialogDescription>{t('dh2.spendHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="spend-amount">{t('dh2.spendAmount')}</Label>
              <Input
                id="spend-amount"
                type="number"
                min={0}
                defaultValue={0}
                onChange={(e) =>
                  setSpendAmount(parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="spend-what">{t('dh2.spendWhat')}</Label>
              <Input
                id="spend-what"
                defaultValue=""
                onChange={(e) => setSpendWhat(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSpend}>
              {t('dh2.spendConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isJournalOpen} onOpenChange={setIsJournalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dh2.experienceLog')}</DialogTitle>
            <DialogDescription>{t('dh2.experienceLogHint')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {character.experienceLog.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t('dh2.experienceLogEmpty')}
              </p>
            )}
            {character.experienceLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.ref}</p>
                  <p className="text-muted-foreground text-xs">
                    {t(`dh2.experienceKind.${entry.kind}`)} ·{' '}
                    {new Date(entry.createdAt).toLocaleDateString(
                      language === 'ru' ? 'ru-RU' : 'en-GB',
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-semibold">
                    {entry.cost}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('dh2.deleteExperienceEntry')}
                    onClick={() => handleDeleteExperience(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
