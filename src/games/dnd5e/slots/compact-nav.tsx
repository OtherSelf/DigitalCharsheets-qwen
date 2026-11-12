'use client';

import {
  Activity,
  Backpack,
  Info,
  PawPrint,
  Sparkles,
  Star,
  Swords,
} from 'lucide-react';

import type { PluginNavItem } from '@/games/types';

import type { DnD5eCharacter } from '../types';

/**
 * ─── LANDMARK: DND5E COMPACT NAV ───────────────────────────────────────────
 * Пункты мобильного сайдбара редакции. Раньше список `dndItems` и условие
 * «эпические дары только на 20 уровне» жили в
 * `src/components/sheets/compact-sidebar.tsx`; теперь их отдаёт плагин
 * (слот `CompactNav`, этап 3).
 */
export function dnd5eCompactNav(
  character: DnD5eCharacter,
): readonly PluginNavItem[] {
  const isLevel20 = character.level === 20;

  return [
    {
      labelKey: 'common.info',
      id: 'info-section',
      icon: <Info className="h-5 w-5" />,
    },
    {
      labelKey: 'dnd.abilityScores',
      id: 'stats-section',
      icon: <Activity className="h-5 w-5" />,
    },
    {
      labelKey: 'dnd.combatStats',
      id: 'combat-section',
      icon: <Swords className="h-5 w-5" />,
    },
    {
      labelKey: 'common.inventoryAndAttunement',
      id: 'inventory-section',
      icon: <Backpack className="h-5 w-5" />,
    },
    {
      labelKey: 'dnd.spells',
      id: 'spells-section',
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      labelKey: 'dnd.companions',
      id: 'companion-section',
      icon: <PawPrint className="h-5 w-5" />,
    },
    ...(isLevel20
      ? [
          {
            labelKey: 'dnd.divineBoons',
            id: 'boons-section',
            icon: <Star className="h-5 w-5" />,
          },
        ]
      : []),
  ];
}
