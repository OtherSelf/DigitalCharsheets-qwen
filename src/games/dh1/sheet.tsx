'use client';

import { DarkHeresySheet } from '../dh-shared/sheet';
import type { GameSheetProps } from '../types';
import type { DH1Character } from './types';

/**
 * Лист DH 1-й редакции: общий DH-компонент (📌 D2), который сам определяет
 * capability по `systemId`. Обёртка фиксирует тип листа для модуля.
 */
export function Dh1Sheet({
  character,
  isCompactView,
  activeCompactSection,
  ref,
}: GameSheetProps<DH1Character>) {
  return (
    <DarkHeresySheet
      ref={ref}
      character={character}
      isCompactView={isCompactView}
      activeCompactSection={activeCompactSection}
    />
  );
}

export default Dh1Sheet;
