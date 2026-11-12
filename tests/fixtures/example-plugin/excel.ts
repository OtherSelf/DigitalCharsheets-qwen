import type {
  ExcelSection,
  ExportTranslate,
  GameExportConfig,
} from '@/games/types';

import type { ExampleCharacter } from './types';

export function buildExampleExcelSections(
  character: ExampleCharacter,
  config: GameExportConfig,
  translate: ExportTranslate,
): readonly ExcelSection[] {
  const sections: ExcelSection[] = [];
  if (config.includeBasicInfo) {
    sections.push({
      title: translate('example.rank'),
      rows: [[character.rank]],
    });
  }
  if (config.includeStats) {
    sections.push({
      title: translate('example.sheetTitle'),
      rows: [[character.stats.might, character.stats.wits]],
    });
  }
  return sections;
}
