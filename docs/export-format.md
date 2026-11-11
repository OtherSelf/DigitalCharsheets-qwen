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
    "version": "2.0",
    "kind": "character",
    "exportDate": "2026-11-08T21:32:41.717Z",
    "characterCount": 1,
    "config": { "...": "..." }
  },
  "character": {
    "id": "…",
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

`App`, `Format`, `Format version`, `Kind`, `Export date`, `Character ID`,
`Character`, `Game system`.

The sheet is named after the character.

## Import rules

The user-facing import accepts only the `dcs-export` format and validates
`appName`, `format`, version, `kind`, character fields and `characterCount`.

Legacy files — a bare array, a bare character or a v1 envelope — are rejected
with a "re-export" message. The portable shape intentionally drops migration
provenance and the owner id; the owner is taken from the current session on
import (the legacy Firestore import creates local accounts separately).

## Where the code lives

- [`src/lib/export-utils.ts`](../src/lib/export-utils.ts) — JSON/Excel builders,
  file names, the export config.
- [`src/lib/character-portable.ts`](../src/lib/character-portable.ts) — removes
  migration/Firestore/`userId` fields for the portable shape.
- [`src/app/api/export/route.ts`](../src/app/api/export/route.ts) — HTTP export.
- [`src/components/export-import-dialog.tsx`](../src/components/export-import-dialog.tsx)
  and [`src/components/import-character-dialog.tsx`](../src/components/import-character-dialog.tsx)
  — UI.

## Related

- [api.md](api.md) — `GET /api/export` and the legacy import endpoint
- [data-storage.md](data-storage.md) — on-disk character format
