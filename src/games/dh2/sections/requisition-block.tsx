'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/games/plugin-host';

import { DH2E_AVAILABILITY, DH2E_CRAFTSMANSHIP } from '../dh2e-rules';
import { creationAcquisitionLimit, requisitionTarget } from '../influence';
import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 REQUISITION ─────────────────────────────────────────────
 * Реквизиция 2e (с. 141): цель = Influence + модификатор доступности +
 * модификатор качества. Приложение только считает цель; бросок и разрешение
 * ГМ — за столом (D1/D5). Автоматическая доступность теста не требует.
 */
export function RequisitionBlock({ character }: { character: DH2Character }) {
  const { t } = useTranslation();
  const [availability, setAvailability] = React.useState('average');
  const [craftsmanship, setCraftsmanship] = React.useState('common');
  const availabilityId = React.useId();
  const craftsmanshipId = React.useId();

  const target = requisitionTarget(character, availability, craftsmanship);
  const limit = creationAcquisitionLimit(character);
  const signed = (value: number): string =>
    value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '+0';

  return (
    <div className="bg-background/50 space-y-3 rounded-lg border p-3">
      <div>
        <h4 className="text-lg font-semibold">{t('dh2.requisition')}</h4>
        <p className="text-muted-foreground text-xs">
          {t('dh2.requisitionHint')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label
            htmlFor={availabilityId}
            className="text-muted-foreground text-xs"
          >
            {t('dh2.availability')}
          </Label>
          <Select value={availability} onValueChange={setAvailability}>
            <SelectTrigger id={availabilityId} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DH2E_AVAILABILITY.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {t(entry.labelKey)} (
                  {entry.automatic
                    ? t('dh2.automatic')
                    : signed(entry.modifier ?? 0)}
                  )
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={craftsmanshipId}
            className="text-muted-foreground text-xs"
          >
            {t('dh2.craftsmanship')}
          </Label>
          <Select value={craftsmanship} onValueChange={setCraftsmanship}>
            <SelectTrigger id={craftsmanshipId} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DH2E_CRAFTSMANSHIP.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {t(entry.labelKey)} ({signed(entry.modifier)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1 rounded-md border p-2 text-sm">
        <p className="font-medium">
          {t('dh2.requisitionTarget')}:{' '}
          {target.automatic ? t('dh2.automatic') : target.total}
        </p>
        {!target.automatic && (
          <p className="text-muted-foreground text-xs">
            {t('dh2.influence')} {target.base} · {t('dh2.availability')}{' '}
            {signed(target.availability)} · {t('dh2.craftsmanship')}{' '}
            {signed(target.craftsmanship)}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {t('dh2.influenceBonus')}: {limit} ·{' '}
          {t('dh2.creationAcquisitionHint')}: {limit}
        </p>
      </div>
    </div>
  );
}
