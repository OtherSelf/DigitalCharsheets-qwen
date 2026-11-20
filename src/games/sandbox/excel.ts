import type {
  ExcelSection,
  ExportTranslate,
  GameExportConfig,
} from '@/games/types';

import type { SandboxCharacter } from './types';

export function buildSandboxExcelSections(
  character: SandboxCharacter,
  config: GameExportConfig,
  translate: ExportTranslate,
): readonly ExcelSection[] {
  const sections: ExcelSection[] = [];
  if (config.includeBasicInfo) {
    sections.push({
      title: translate('sandbox.rank'),
      rows: [[character.rank]],
    });
  }
  if (config.includeStats) {
    sections.push({
      title: translate('sandbox.sheetTitle'),
      rows: [[character.stats.might, character.stats.wits]],
    });
  }
  return sections;
}
