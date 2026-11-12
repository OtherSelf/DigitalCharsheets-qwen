import type { CardSummary, PluginNavItem } from '@/games/types';

import type { ExampleCharacter } from './types';

/** Слоты эталонного плагина: шапка, мобильная навигация, карточка. */
export function exampleHeaderSubtitle(
  character: ExampleCharacter,
  t: (key: string) => string,
): string {
  return `${t('example.rank')}: ${character.rank}`;
}

export function exampleCompactNav(
  _character: ExampleCharacter,
): readonly PluginNavItem[] {
  return [{ labelKey: 'example.sheetTitle', id: 'info-section' }];
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
