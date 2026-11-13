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
      history/
        <character-id>.jsonl    append-only change log (one revision per line)
  settings/
    game-catalog.json           runtime visibility/statuses + site title
  index/
    logins.json                 derived: normalized login → uid
  tokens.json                   single-use recovery tokens (hashed)
  sessions.json                 live session records (uid per `jti`)
  shares.json                   read-only share links (hashed tokens)
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
  "passwordHash": "scrypt$16384$8$1$<salt>$<hash>",
  "role": "user",
  "isBlocked": false,
  "lastLoginAt": "2026-01-01T00:00:00.000Z",
  "recoveryPhrase": "scrypt$16384$8$1$<salt>$<hash>",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

| Field | Meaning |
| --- | --- |
| `uid` | Immutable UUID; also the directory name. |
| `username` | Normalized login (lowercase, trimmed). The login index key. |
| `displayName` | Human-readable name shown in the UI. |
| `passwordHash` | Salted `scrypt` hash (`scrypt$N$r$p$<salt>$<hash>`, see [`src/lib/security/scrypt.ts`](../src/lib/security/scrypt.ts)). Unsalted SHA-256 values written by older versions are verified once and transparently replaced on the next successful login. |
| `role` | `user`, `tester` or `admin`. Missing/invalid values are treated as `user` (fail-closed). `tester` sees `test` editions but has no access to `/admin` or admin API. |
| `isBlocked` | When true, login is refused and existing sessions stop working. |
| `blockedAt` | Timestamp set while blocked; removed on unblock. |
| `lastLoginAt` | Updated on successful login; absent before the first login. |
| `mustChangePassword` | Present only for the bootstrap admin; removed after a password change. |
| `recoveryPhrase` | Salted `scrypt` hash of the normalized phrase (`src/lib/security/phrase.ts`). The phrase itself is never stored; older plaintext values are re-hashed on the first successful verification and by the startup pass. |
| `createdAt`/`updatedAt` | ISO timestamps; missing values are filled from file mtime. |
| `originalFirebaseId` | Present only on accounts imported from the old Firebase export. |

`sessions.json` maps each live session `jti` to `{ uid, createdAt, expiresAt }`.
A record exists only while the session is valid: logout, password/phrase change,
administrator password change, recovery and account deletion delete it, so a
stolen cookie stops working immediately. Expired records are pruned on every
write. The file holds no secret — the signature lives in the cookie and is
verified with `.session-secret`.

`tokens.json` holds hashes (never the tokens) of single-use recovery tokens,
keyed by the SHA-256 of the value handed to the client: `{ "version": 1,
"tokens": { "<sha256>": { "uid", "createdAt", "expiresAt" } } }`. An entry is
deleted when exchanged and dropped after 15 minutes, so a copied data directory
cannot be used to reset a password.

`shares.json` is the read-only share registry: `{ "version": 1, "shares":
{ "<sha256>": { "uid", "characterId", "createdAt", "expiresAt",
"includeHistory" } } }`. The token itself is never stored, only its SHA-256; one
active record exists per `uid + characterId`, and issuing a new link replaces the
old one. `expiresAt: null` means “until revoked”. Expired records are pruned on
the next write; deleting a sheet revokes its link, and deleting an account
removes all of its records.

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
`normalizeCharacterRecord` (`src/lib/character-version.ts`). The orchestrator
resolves the edition and calls the plugin's `normalize`
(`src/games/<id>/normalize.ts`); at startup/save it only remaps legacy fields
and coerces types, while missing structures are filled with defaults only on
import (`applyDefaults`). The migration is idempotent and writes a file only
when it changes.

### Discriminant and editions

`systemId` is the machine identifier of the sheet, taken from the plugin
folders (`dnd5e`, `dh1`, `dh2`). Legacy sheets without it are resolved by the
aliases each plugin declares in `plugin.json#aliases`
(`gameSystem`/`edition`), most specific match first. The human-readable game
name is resolved from the registry/manifests and i18n and is not stored in the
sheet. For compatibility with consumers that are still being migrated,
`gameSystem` remains in v2 data as a legacy mirror; it will be removed once
everything reads the registry.

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

Old files and 2.0 exports contain sentences (`"Mutation without..."`); each
edition maps them to IDs in its own copy (`src/games/dh1/divination-i18n.ts`,
`src/games/dh2/divination-i18n.ts`), which its `normalize.ts`, form and sections
use, so the editions stay independent (D10). Unknown custom values are preserved
and shown as-is. Files with a newer `schemaVersion` are
reported but not rewritten.

### Backups

A backup is a copy of the whole data directory (or of the JSON export envelope,
`docs/export-format.md`). Because migrations rewrite files in place, take a copy
before upgrading a production data directory.

## Character history (change log)

Each sheet may have an append-only JSONL log at
`users/<uid>/history/<character-id>.jsonl`. One line is one revision:

```json
{"v":1,"id":"m3k2-7f3c","at":"2026-05-12T18:04:11.000Z","source":"save","changes":[...],"summary":{"changed":1,"added":1,"removed":0,"bulk":0}}
```

- `source` is `save`, `create` or `migration`; markers have no field diff.
- `changes` are structured before/after entries produced by the core diff
  engine; keyed arrays (inventory, spells, quests) are compared by `id`/`name`.
- Long values are truncated to a preview; the full value is not stored.
- The log is best-effort: a failed history write is logged, the sheet still
  saves. A late/empty save does not create a revision.
- The default limit is **2 MiB per sheet**, overridable with
  `DCS_HISTORY_MAX_BYTES` (64 KiB … 64 MiB). When it is exceeded, the oldest
  revisions are dropped and a `{"kind":"truncated"}` marker records how many.
- Deleting the sheet deletes its log; deleting the account removes the whole
  user directory. The log is owner-only and is **not** a backup: it stores no
  full snapshots and cannot restore a sheet.

## `settings/game-catalog.json`

Runtime state of the installed plugins and the optional site title. Missing
file means "every plugin is enabled and uses `defaultStatus`".

The file is **v2** (the plugin catalog). The old v1 `statuses` map is read and
migrated automatically on the next read: every plugin becomes `enabled: true`
with `visibility` equal to its old status (§5.9 of the plugin plan).

```json
{
  "version": 2,
  "plugins": {
    "dh1": { "enabled": true, "visibility": "published" },
    "dh2": { "enabled": false, "visibility": "test" }
  },
  "siteTitle": "My table"
}
```

| Field | Meaning |
| --- | --- |
| `plugins[id].visibility` | `published` / `test` / `hidden` — who sees the plugin in creation and menus. Matrix: `published` → everyone, `test` → tester+admin, `hidden` → admin. Invalid values are ignored. |
| `plugins[id].enabled` | Whether the plugin is active at all. `false` disappears from creation/menus/demo; existing sheets open **read-only** with a banner, JSON export keeps working (D9). Missing → `true`. |
| `siteTitle` | Optional header title override (≤80 chars). Empty/absent → built-in brand. |

`enabled` and `visibility` are independent (D16): a hidden plugin can still be
enabled for admins, and a disabled plugin stays hidden from everyone's creation
wizard regardless of visibility.

Written atomically under the data-dir lock by `src/lib/game-catalog.ts`
(`setModuleStatus`, `setModuleEnabled`, `setSiteTitle`). It applies to
creation/menus, not to reading or exporting existing sheets.

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

The project started as a Firebase Studio app. Firebase itself is gone — no SDK,
no `firebase/` directory. Migrating a Firestore export is an **offline**
operation: the former unauthenticated `GET /api/import` endpoint was removed
because it created accounts with a shared default password. Plugins still carry
the converters (`matchesLegacyImport` / `convertLegacyImport`), so the
migration can be re-run as a script — the published one lives in
[`scripts/legacy-migration/`](../scripts/legacy-migration/README.md)
(`dcs-migrate.py` converts a dump, `dcs-migrate-check.py` verifies the result
against `src/lib/types.ts`). It is operator tooling, not part of the running
application; dumps and credentials are never committed
([ADR 0002](adr/0002-legacy-migration-tooling.md)). The original entity schema
is reproduced here for reference.

Firestore paths:

```text
/users/{userId}
/users/{userId}/characterSheets/{characterSheetId}
```

| Entity | Fields |
| --- | --- |
| `UserProfile` | `id`, `username`, `createdAt`, `updatedAt` |
| `CharacterSheet` | `id`, `userId`, `name`, `gameSystem`, `concept`, `notes`, `questLog`, `data` (JSON string with the system-specific sheet), `createdAt`, `updatedAt` |

The prototype used the `google.com` and `password` auth providers and keyed
everything by the Firebase UID. The importer groups rows by the `Document ID`
(`/users/<uid>/characterSheets/<sheetId>`), creates local accounts and converts
each sheet through the owning plugin. It is a legacy path, not part of the
regular user flow; see [api.md](api.md) for its current status.

## Related

- [architecture.md](architecture.md) — auth/session and startup checks
- [admin.md](admin.md) — profile normalization and admin operations
- [`src/lib/data-dir.ts`](../src/lib/data-dir.ts),
  [`src/lib/server-storage.ts`](../src/lib/server-storage.ts),
  [`src/lib/user-schema.ts`](../src/lib/user-schema.ts)
