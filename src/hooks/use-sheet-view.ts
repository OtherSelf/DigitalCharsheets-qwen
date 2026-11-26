'use client';

import { useCallback, useMemo } from 'react';

import { resolveSheetPresentation } from '@/lib/viewport';

import { useSheetViewPreference } from './use-sheet-view-preference';
import { useViewportFlags } from './use-viewport-flags';

/**
 * ─── LANDMARK: USE_SHEET_VIEW ───────────────────────────────────────────────
 * Собирает раскладку листа из двух независимых источников: ширины окна и
 * предпочтения «плотный вид». Наружу отдаёт обе оси (`isPhoneView`,
 * `isCompactView`) — лист обязан спрашивать про навигацию `isPhoneView`, а про
 * размеры `isCompactView`.
 *
 * `isSmallScreen` остаётся в наборе для мест, которым нужен именно телефон как
 * ширина (шапка, гостевые страницы), а не подача листа.
 */
export function useSheetView() {
  const { isSmallScreen, isTabletScreen } = useViewportFlags();
  const { prefersCompact, setPrefersCompact } = useSheetViewPreference();

  const presentation = useMemo(
    () => resolveSheetPresentation(isSmallScreen, prefersCompact),
    [isSmallScreen, prefersCompact],
  );

  const toggleCompactView = useCallback(
    () => setPrefersCompact(!prefersCompact),
    [prefersCompact, setPrefersCompact],
  );

  return {
    isSmallScreen,
    isTabletScreen,
    isPhoneView: presentation.isPhoneView,
    isCompactView: presentation.isCompactView,
    prefersCompact,
    toggleCompactView,
  };
}
