# Character change history

Every successful save of a sheet can leave a compact record of what changed.
The owner reads it as a timeline grouped by game sessions; it is a change log,
not a backup and not a rollback mechanism.

## What is recorded

- A successful `PUT /api/characters/{id}` produces a revision with structured
  changes: field path, before, after, added/removed values.
- Creating a sheet writes a `create` marker; startup migrations write a
  `migration` marker. Markers have no field diff.
- Empty saves and writes rejected by the stale `__page`/`__seq` guard produce
  nothing.
- Arrays of objects (inventory, spells, quests, companions) are compared by a
  stable key (`id`, `name`, `title`, …), so a change reads as
  “Inventory · Longsword · Notes” instead of an index.
- Long strings and large objects are stored as a truncated preview; full values
  are not kept.
- History is best-effort: if the log cannot be written, the sheet is still
  saved and the error is logged.

The log starts when the feature is enabled; older edits cannot be backfilled.

## Storage

`<data-dir>/users/<uid>/history/<character-id>.jsonl`, one revision per line:

```json
{"v":1,"id":"m3k2-7f3c","at":"2026-05-12T18:04:11.000Z","source":"save","changes":[{"kind":"changed","path":"stats.strength","before":{"value":10},"after":{"value":12}}],"summary":{"changed":1,"added":0,"removed":0,"bulk":0}}
```

The limit is **2 MiB per sheet**, overridable with `DCS_HISTORY_MAX_BYTES`
(64 KiB … 64 MiB). When the limit is reached, the oldest revisions are dropped
and a `{"kind":"truncated"}` marker records how many. A broken line is skipped;
an incomplete last line does not break the next append. Deleting the sheet
deletes its history; deleting the account removes the user directory.

## API

Both endpoints require the owner's session; the uid comes from the cookie and
the sheet id is validated before disk access.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/characters/{id}/history?limit=50&before=…` | Sessions, newest first, with a cursor for the next page. |
| `DELETE` | `/api/characters/{id}/history` | Clear the log (irreversible); the sheet is untouched. |

`GET` caps a page at 50 sessions and about 2000 changes. `limit` is 1…100;
`before` is the ISO start of the oldest session on the previous page. The
response also carries `totalSessions`, `totalRevisions` and storage info
(`bytes`, `truncated`, `oldestAt`).

## Screen

`/character/<id>/history` shows:

- totals, the oldest stored change and a truncation notice;
- sessions grouped by a 30-minute gap, with their markers;
- every change with a plugin-provided label, a `before → after` pair, the
  `added`/`removed` badge, keyed-array elements and truncated values;
- “Show more” pagination and an empty state;
- “Clear history” with a confirmation dialog.

The page is owner-only. Labels come from the edition plugin
(`GameHistoryConfig.labels` / `collections`); unknown fields fall back to a
humanised path. A guest link may optionally expose a read-only tab with the
latest 20 sessions (`includeHistory`, off by default); it has no clear action
and its values are sanitized.

## Limits and privacy

- The log keeps old values even after they are removed from the current sheet.
  Treat the data directory, and especially `history/`, as sensitive.
- “Clear history” deletes the log permanently. Deleting the sheet or account
  also removes it.
- This is **not a backup**: it stores no full snapshots and cannot restore a
  sheet. Full backups remain copies of the data directory.
- The API is owner-only; administrators do not see other users' history.

## Related

- [data-storage.md](data-storage.md) — on-disk format and cleanup
- [api.md](api.md) — status codes
- [security.md](security.md) — privacy of old values
- [plugin-sdk.md](plugin-sdk.md) — `history` labels on a module
- [`src/lib/character-history.ts`](../src/lib/character-history.ts),
  [`src/lib/history-diff.ts`](../src/lib/history-diff.ts)
