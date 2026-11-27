'use client';

import { useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import type { Armor, BodyPart, DH2Character } from '../types';

/**
 * ─── LANDMARK: ARMOR BY HIT LOCATION ───────────────────────────────────────
 * Схема попаданий 1d100 по частям тела и AP каждой части. На десктопе блок
 * живёт отдельной колонкой, на узких экранах — внутри вкладки «Информация».
 */

const defaultArmor: Armor = {
  Head: null,
  'Right arm': null,
  Body: null,
  'Left arm': null,
  'Right leg': null,
  'Left leg': null,
};

export const ArmorDisplay = ({
  character,
  isCompactView,
  embedded = false,
}: {
  character: DH2Character;
  isCompactView: boolean;
  /** Блок в своей карточке (мобильный «Информация»): без отступа десктопной колонки. */
  embedded?: boolean;
}) => {
  const { t } = useTranslation();
  const armor = character.equipment?.armor ?? defaultArmor;
  const bodyPartLocations: Record<BodyPart, string> = {
    Head: '1-10',
    'Right arm': '11-20',
    'Left arm': '21-30',
    Body: '31-70',
    'Right leg': '71-85',
    'Left leg': '86-00',
  };
  const displayArmorType = (type: string | undefined | null) => {
    if (!type) return '—';
    const translationKey = `common.armorType${type}`;
    const translated = t(translationKey);
    return translated === translationKey ? type : translated;
  };
  const ArmorBox = ({
    part,
    location,
  }: {
    part: BodyPart;
    location: string;
  }) => {
    const armorPiece = armor[part];
    const bodyPartKey: Record<BodyPart, string> = {
      Head: 'dh2.bodyPartHead',
      'Right arm': 'dh2.bodyPartRightArm',
      'Left arm': 'dh2.bodyPartLeftArm',
      Body: 'dh2.bodyPartBody',
      'Right leg': 'dh2.bodyPartRightLeg',
      'Left leg': 'dh2.bodyPartLeftLeg',
    };
    const title = t(bodyPartKey[part] || part);
    return (
      <div
        className={cn(
          'bg-card text-card-foreground flex w-full min-w-0 flex-col items-center rounded-md border shadow-md',
          isCompactView ? 'p-1' : 'p-2',
        )}
      >
        <h4
          className={cn(
            'w-full truncate px-1 text-center font-bold',
            isCompactView ? 'text-10px' : 'text-xs',
          )}
        >
          {title}
        </h4>
        <div className="text-muted-foreground text-10px mb-1">({location})</div>
        <div
          className={cn(
            'w-full space-y-0.5',
            isCompactView ? 'text-9px' : 'text-10px text-center',
          )}
        >
          <p className="truncate">
            <strong className="text-muted-foreground">
              {t('dh2.armorAp')}:{' '}
            </strong>
            {armorPiece?.ap ?? '—'}
          </p>
          <p className="truncate">
            <strong className="text-muted-foreground">
              {t('dh2.armorType')}:{' '}
            </strong>
            {displayArmorType(armorPiece?.type)}
          </p>
        </div>
      </div>
    );
  };
  return (
    <div
      data-testid="armor-display"
      className={cn(
        'grid w-full max-w-full grid-cols-3 gap-x-2 gap-y-4 overflow-hidden',
        embedded ? 'pt-0' : 'pt-8',
      )}
    >
      <div />{' '}
      <div className="flex items-start justify-center">
        {' '}
        <ArmorBox part="Head" location={bodyPartLocations['Head']} />{' '}
      </div>{' '}
      <div />
      <div className="mt-2 flex flex-col justify-start">
        {' '}
        <ArmorBox
          part="Left arm"
          location={bodyPartLocations['Left arm']}
        />{' '}
      </div>
      <div className="mt-8">
        {' '}
        <ArmorBox part="Body" location={bodyPartLocations['Body']} />{' '}
      </div>
      <div className="mt-2 flex flex-col justify-start">
        {' '}
        <ArmorBox
          part="Right arm"
          location={bodyPartLocations['Right arm']}
        />{' '}
      </div>
      <div className="-mt-2">
        {' '}
        <ArmorBox
          part="Left leg"
          location={bodyPartLocations['Left leg']}
        />{' '}
      </div>{' '}
      <div />
      <div className="-mt-2">
        {' '}
        <ArmorBox
          part="Right leg"
          location={bodyPartLocations['Right leg']}
        />{' '}
      </div>
    </div>
  );
};
