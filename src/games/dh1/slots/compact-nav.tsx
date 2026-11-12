'use client';

import {
  Backpack,
  BookOpen,
  Info,
  Shield,
  Star,
  TrendingUp,
} from 'lucide-react';

import type { PluginNavItem } from '@/games/types';

import type { DH1Character } from '../types';

/**
 * ─── LANDMARK: DH1 COMPACT NAV ─────────────────────────────────────────────
 * Пункты мобильного сайдбара 1-й редакции. Раньше список `dhItems` жил в
 * `src/components/sheets/compact-sidebar.tsx`; теперь — слот плагина
 * (`CompactNav`, этап 3). Ключи — с префиксом `dh1.`.
 */
export function dh1CompactNav(
  _character: DH1Character,
): readonly PluginNavItem[] {
  return [
    {
      labelKey: 'common.info',
      id: 'info-section',
      icon: <Info className="h-5 w-5" />,
    },
    {
      labelKey: 'common.progression',
      id: 'progression-section',
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      labelKey: 'common.skills',
      id: 'skills-section',
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      labelKey: 'dh1.talentsAndTraits',
      id: 'talents-section',
      icon: <Star className="h-5 w-5" />,
    },
    {
      labelKey: 'dh1.equipment',
      id: 'equipment-section',
      icon: <Shield className="h-5 w-5" />,
    },
    {
      labelKey: 'common.inventory',
      id: 'inventory-section',
      icon: <Backpack className="h-5 w-5" />,
    },
  ];
}
