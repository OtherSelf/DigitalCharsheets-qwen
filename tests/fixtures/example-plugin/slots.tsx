import { ScrollText } from 'lucide-react';

import type { CardSummary, PluginNavItem } from '@/games/types';

import type { ExampleCharacter } from './types';

/**
 * Слоты эталонного плагина: шапка, мобильная навигация, карточка.
 * `CompactNav` отдаёт иконку: без неё мобильная навигация рисует пустое
 * место, а контракт слота (`plugin-slots.test.ts`) требует `icon`.
 */
export function exampleHeaderSubtitle(
  character: ExampleCharacter,
  t: (key: string) => string,
): string {
  return `${t('example.rank')}: ${character.rank}`;
}

export function exampleCompactNav(
  _character: ExampleCharacter,
): readonly PluginNavItem[] {
  return [
    {
      labelKey: 'example.sheetTitle',
      id: 'info-section',
      icon: <ScrollText className="h-5 w-5" />,
    },
  ];
}

export function exampleCardSummary(
  character: ExampleCharacter,
  t: (key: string) => string,
): CardSummary {
  return {
    text: `${t('example.rank')} ${character.rank}`,
    badgeVariant: 'outline',
  };
}
