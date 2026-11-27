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

import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 COMPACT NAV ─────────────────────────────────────────────
 * Пункты мобильного сайдбара 2-й редакции. Это слот плагина
 * (`CompactNav`): ядро только рисует рейл и прокручивает к секции. Ключи —
 * с префиксом `dh2.`.
 */
export function dh2CompactNav(
  _character: DH2Character,
): readonly PluginNavItem[] {
  return [
    {
      labelKey: 'common.info',
      id: 'info-section',
      icon: <Info className="h-5 w-5" />,
    },
    {
      labelKey: 'dh2.experience',
      id: 'progression-section',
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      labelKey: 'dh2.skills',
      id: 'skills-section',
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      labelKey: 'dh2.talentsAndTraits',
      id: 'talents-section',
      icon: <Star className="h-5 w-5" />,
    },
    {
      labelKey: 'dh2.equipment',
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
