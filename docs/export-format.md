# Export format

Digital Character Sheets uses one portable envelope for single-character and
full-backup JSON exports. The user-facing import accepts only this format; the
separate legacy `GET /api/import` maintenance endpoint is described in
[api.md](api.md).

## JSON envelope

Both JSON exports (one character and the full backup) use the same envelope:

```json
{
  "metadata": {
    "appName": "DigitalCharsheets-qwen",
    "format": "dcs-export",
    "version": "3.0",
    "kind": "character",
    "exportDate": "2026-11-08T21:32:41.717Z",
    "characterCount": 1,
    "config": { "...": "..." }
  },
  "character": {
    "id": "…",
    "systemId": "dnd5e",
    "schemaVersion": 2,
    "gameSystem": "Dungeons & Dragons",
    "name": "…"
  }
}
```

A full backup uses `"kind": "backup"`, `"characters": [...]` and
`"account": "<login>"`.

## File names

- Single character: `dcs_character_<name>_<YYYY-MM-DD>.json`
- Full backup: `dcs_characters_all_<login>_<YYYY-MM-DD>.json`
- Excel: `dcs_character_<name>_<YYYY-MM-DD>.xlsx`

## Excel export

The Excel file follows the same base name and starts with the same technical
block before the human-readable sections:

`App`, `Format`, `Format version` (`3.0`), `Kind`, `Export date`,
`Character ID`, `Character`, `Game system`.

The human-readable section titles and row labels are resolved through i18n in
the site language at export time.

The sheet is named after the character.

## Import rules

The user-facing import accepts only the `dcs-export` format and validates
`appName`, `format`, version, `kind`, character fields and `characterCount`.

Exports always use format **3.0**. Each character has a machine `systemId`
(`dnd5e`, `dh1`, `dh2`), `schemaVersion: 2`, and the legacy `gameSystem` mirror
that is kept for consumers still being migrated. Dark Heresy divination fields
are stable IDs (`"divination": "mutationWithout"`,
`"divinationEffect": "minorMutation"`).

Import accepts:

- **3.0** natively;
- **2.0 / 2.1** with migration to the v2 sheet (edition split, `systemId`,
  sentence divinations);
- older or foreign envelopes are rejected with a "re-export" message
  (bare arrays, bare characters, v1 envelopes, other apps).

The portable shape drops migration provenance and the owner id; the owner is
taken from the current session on import.

The portable shape intentionally drops migration provenance and the owner id;
the owner is taken from the current session on import (the legacy Firestore
import creates local accounts separately and runs the same character
normalizer).

## Where the code lives

- [`src/lib/export-utils.ts`](../src/lib/export-utils.ts) — envelope, import
  parsing/merging, file names and the Excel workbook writer.
- [`src/games/dnd5e/export.ts`](../src/games/dnd5e/export.ts),
  [`src/games/dh-shared/export.ts`](../src/games/dh-shared/export.ts) — JSON
  field selection per module (Excel sections are moving there too).
- [`src/lib/character-portable.ts`](../src/lib/character-portable.ts) — removes
  migration/Firestore/`userId` fields for the portable shape.
- [`src/app/api/export/route.ts`](../src/app/api/export/route.ts) — HTTP export.
- [`src/components/export-import-dialog.tsx`](../src/components/export-import-dialog.tsx)
  and [`src/components/import-character-dialog.tsx`](../src/components/import-character-dialog.tsx)
  — UI.

## Related

- [api.md](api.md) — `GET /api/export` and the legacy import endpoint
- [data-storage.md](data-storage.md) — on-disk character format
