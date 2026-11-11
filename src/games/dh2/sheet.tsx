'use client';

import { DarkHeresySheet } from '../dh-shared/sheet';
import type { GameSheetProps } from '../types';
import type { DH2Character } from './types';

/**
 * Лист DH 2-й редакции: общий DH-компонент (📌 D2) с capability
 * `influence` + `fatigue2nd`, определяемым по `systemId`.
 */
export function Dh2Sheet({
  character,
  isCompactView,
  activeCompactSection,
  ref,
}: GameSheetProps<DH2Character>) {
  return (
    <DarkHeresySheet
      ref={ref}
      character={character}
      isCompactView={isCompactView}
      activeCompactSection={activeCompactSection}
    />
  );
}

export default Dh2Sheet;
