import { ScrollText } from 'lucide-react';

import type { CardSummary, PluginNavItem } from '@/games/types';

import type { SandboxCharacter } from '../types';

/**
 * Слоты эталонного плагина: подпись шапки, мобильная навигация и карточка.
 * `CompactNav` отдаёт иконку: без неё мобильная навигация рисует пустое
 * место, а контракт слота (`plugin-slots.test.ts`) требует `icon`.
 */
export function sandboxHeaderSubtitle(
  character: SandboxCharacter,
  t: (key: string) => string,
): string {
  return `${t('sandbox.rank')}: ${character.rank} | ${t('sandbox.systemName')}`;
}

export function sandboxCompactNav(
  _character: SandboxCharacter,
): readonly PluginNavItem[] {
  return [
    {
      labelKey: 'sandbox.sheetTitle',
      id: 'info-section',
      icon: <ScrollText className="h-5 w-5" />,
    },
  ];
}

export function sandboxCardSummary(
  character: SandboxCharacter,
  t: (key: string) => string,
): CardSummary {
  return {
    text: `${t('sandbox.rank')} ${character.rank}`,
    badgeVariant: 'outline',
  };
}

export { SandboxHeaderActions } from './header-actions';
