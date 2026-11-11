# Data storage

Everything the app owns lives in a single data directory on the host you
control. There is no database: profiles, character sheets and the login index are
JSON files, written through small, synchronous helpers in `src/lib/`.

## Overview

- Default data directory: `./data` (relative to the project root).
- Override: `DCS_DATA_DIR=/absolute/or/relative/path`.
- The directory must be writable by the server process.
- The data directory is **not** committed; `data/*` is gitignored.

## Layout

```
<data-dir>/
  users/
    <uid>/
      user.json                 profile (schema v4, source of truth)
      characters/
        <character-id>.json     one file per character sheet (schema v2)
  index/
    logins.json                 derived: normalized login → uid
  .session-secret               HMAC key for session cookies (0600)
  .lock/                        short-lived directory mutex
  .initial-admin.txt            generated bootstrap admin (0600, optional)
```

`<uid>` is a random UUID and never changes. The login is an attribute, so
renaming an account only rewrites `user.json` and the index entry — the
directory and sheets stay where they are.

## `user.json` (schema v4)

```json
{
  "schemaVersion": 4,
  "uid": "9d1f0d4e-2c0f-4b5e-9f8a-4a1b2c3d4e5f",
  "username": "hero@example.com",
  "displayName": "Hero",
  "passwordHash": "<sha256 hex>",
  "role": "user",
  "isBlocked": false,
  "lastLoginAt": "2026-01-01T00:00:00.000Z",
  "recoveryPhrase": "amber cobalt lantern",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

| Field | Meaning |
| --- | --- |
| `uid` | Immutable UUID; also the directory name. |
| `username` | Normalized login (lowercase, trimmed). The login index key. |
| `displayName` | Human-readable name shown in the UI. |
| `passwordHash` | SHA-256 hash of the password. |
| `role` | `user`, `tester` or `admin`. Missing/invalid values are treated as `user` (fail-closed). `tester` sees `test` editions but has no access to `/admin` or admin API. |
| `isBlocked` | When true, login is refused and existing sessions stop working. |
| `blockedAt` | Timestamp set while blocked; removed on unblock. |
| `lastLoginAt` | Updated on successful login; absent before the first login. |
| `mustChangePassword` | Present only for the bootstrap admin; removed after a password change. |
| `recoveryPhrase` | Lowercase phrase used by the recovery flow. |
| `createdAt`/`updatedAt` | ISO timestamps; missing values are filled from file mtime. |
| `originalFirebaseId` | Present only on accounts imported from the old Firebase export. |

Startup normalization (`src/lib/user-schema.ts`) fills missing v4 fields without
overwriting existing values (including an existing `tester` role). A profile
without `passwordHash` is reported but cannot be logged into; an administrator
can set a password from `/admin`.

## Character sheets (schema v2)

One file per sheet: `users/<uid>/characters/<character-id>.json`. The content is
the `Character` object from `src/lib/types.ts` (D&D 5e, Dark Heresy 1e or Dark
Heresy 2e). The file name is the sheet `id`. `GET /api/characters` reads and
parses every `*.json` in the user's `characters/` directory; a broken file is
skipped rather than failing the whole list.

`CharacterBase.schemaVersion` is `2`; legacy files without it are migrated on
startup by `src/lib/character-schema.ts` and lazily on read/save by
`normalizeCharacterRecord` (`src/lib/character-version.ts`). The migration is
idempotent and writes a file only when it changes.

### Discriminant and editions

`systemId` is the machine identifier of the sheet: `dnd5e`, `dh1` or `dh2`.
The human-readable game name is resolved from the module registry and i18n and
is not stored in the sheet. For compatibility with consumers that are still
being migrated, `gameSystem` remains in v2 data as a legacy mirror; it will be
removed once everything reads the registry.

Dark Heresy editions are separate shapes, with no `edition` field and no fields
of the other edition:

- `dh1`: nine characteristics (no `influence`), `fatigue1st`;
- `dh2`: ten characteristics including `influence`, `fatigue2nd`.

Migration rules (`v0/v1 → v2`):

- `gameSystem: "Dungeons & Dragons"` → `dnd5e`;
- `gameSystem: "Dark Heresy"` + `edition: "2nd"` → `dh2`;
- `"1st"`, `"hybrid"` or no edition → `dh1` (legacy default);
- `edition` is removed;
- a meaningful value of the other edition is not dropped silently: it is
  appended to `notes` as a `[migration v2] …` block and reported by the
  startup scan. Default `influence: 30` and empty `fatigue` values are ignored
  to avoid noise on every legacy sheet.

For Dark Heresy, `divination` and `divinationEffect` store stable IDs, not
sentences:

```json
{
  "schemaVersion": 2,
  "systemId": "dh1",
  "gameSystem": "Dark Heresy",
  "divination": "mutationWithout",
  "divinationEffect": "minorMutation",
  "fatigue1st": { "current": 0 }
}
```

Old files and 2.0 exports contain sentences (`"Mutation without..."`); the
normalizer maps them to IDs via `src/lib/divination-i18n.ts`. Unknown custom
values are preserved and shown as-is. Files with a newer `schemaVersion` are
reported but not rewritten.

### Backups

A backup is a copy of the whole data directory (or of the JSON export envelope,
`docs/export-format.md`). Because migrations rewrite files in place, take a copy
before upgrading a production data directory.

## Login index

`index/logins.json` is **derived**:

```json
{ "version": 1, "logins": { "hero@example.com": "<uid>" } }
```

It is safe to delete: `resolveLogin()` rebuilds it by scanning
`users/*/user.json`. Mutations happen under the data-dir lock. `user.json`
remains the source of truth if the index write fails.

## Write safety

- **Atomic writes** — `writeJsonAtomic()` writes a temp file in the same
  directory, fsyncs and renames it over the target. Readers see either the old
  complete file or the new complete file. If `rename` fails with `EXDEV`, the
  helper falls back to a direct write (documented in
  `src/lib/fs-atomic.ts`).
- **Data lock** — `withDataLock()` creates `<data-dir>/.lock` with `mkdir`
  (atomic) for operations that touch more than one file (register, rename,
  delete, admin updates). Stale locks older than 30 seconds are removed; the
  wait is capped at 2 seconds.
- **Stale-write guard** — the client sends `__page`/`__seq` with sheet updates;
  the server drops writes that arrive out of order. This state is in memory and
  is not persisted.

## Backup and restore

The whole account state is the data directory. To back up:

1. Stop the server (or at least avoid writes) and copy the entire data
   directory, including hidden files (`.session-secret`).
2. To restore, place it back and start the server with the same `DCS_DATA_DIR`.
   `index/logins.json` can be deleted and will be rebuilt.

Per-user JSON/Excel exports are a separate feature; see
[export-format.md](export-format.md).

## Legacy data

The original Firebase Studio schema is kept in
[`backend.json`](backend.json). The `GET /api/import` maintenance endpoint reads
a Firestore export from `<data-dir>/import-source.json`, creates local accounts
and converts sheets. It is a legacy path, not part of the regular user flow; see
[api.md](api.md) for its current status.

## Related

- [architecture.md](architecture.md) — auth/session and startup checks
- [admin.md](admin.md) — profile normalization and admin operations
- [`src/lib/data-dir.ts`](../src/lib/data-dir.ts),
  [`src/lib/server-storage.ts`](../src/lib/server-storage.ts),
  [`src/lib/user-schema.ts`](../src/lib/user-schema.ts)
