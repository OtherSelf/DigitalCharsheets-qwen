# Legacy migration: Firebase → local files

Offline tooling for moving character sheets off the old Firebase Studio
deployment into the current data-directory layout. The runtime endpoint that
used to do this (`GET /api/import`) was removed because it created accounts with
a shared default password and was reachable without authentication; migration is
a one-off operator task now, not part of the running application. The legacy
entity schema is described in
[`docs/data-storage.md`](../../docs/data-storage.md) § Legacy data; the decision
to keep the tooling in the repository is recorded in
[ADR 0002](../../docs/adr/0002-legacy-migration-tooling.md).

| File | Purpose |
| --- | --- |
| `dcs-migrate.py` | Reads a Firestore managed export (directory or `.7z`), a legacy `import-source.json` array, and writes `users/<uid>/user.json`, sheets and `index/logins.json`. |
| `dcs-migrate-check.py` | Parses `src/lib/types.ts` and verifies the written data against the current profile: required fields, types, literals, tuples, owner wiring, `user.json` and the login index. Exit code `1` means incompatible. |
| `make-fixture.py` | Dev-only: rebuilds the redacted fixtures below from a real dump. Not used by the migration itself. |
| `examples/import-source.example.json` | Six documents (3 Dark Heresy + 3 Dungeons & Dragons) from the real 2026-11-01 export, pseudonymized. |
| `examples/auth-users.example.json` | Redacted `firebase auth:export` file matching those documents' uids. |
| `examples/service-account.example.json` | Shape of a Firebase Admin SDK service-account key used for the Auth export: non-secret fields only, secret fields are described in prose. |
| `examples/firestore-export/` | The same documents encoded back into a synthetic managed export (LevelDB log + protobuf), so the binary parser stays testable. |

Real dumps, `auth-users.json` and service-account keys are **never committed**.
A developer machine may keep an untracked copy (`firebase-backup/`, mode
`0700`); this directory ships code, pseudonymized data and a credential
template — no working key.

## Fixtures

`examples/` exists for history and for testing the scripts without a dump. All
three data fixtures come from the real 2026-11-01 export (19 documents, 9 accounts)
and were produced by `make-fixture.py`; the committed subset keeps 3 documents
per game system, chosen for structural coverage, not for volume.

`examples/firestore-export/` is the same set encoded as a Firestore managed
export: `<timestamp>.overall_export_metadata` plus
`all_namespaces/all_kinds/output-0`, a LevelDB log of `EntityProto` records.
It exists because a JSON array only covers the `--source file.json` branch —
with this directory the script's binary parser (`iter_log_records`,
`decode_entity`, document keys) is exercised without the real dump. Some
records are split into FIRST/LAST fragments to cover that path. It is not a
byte-exact LevelDB file: block padding and 32 KiB fragmentation are not
reproduced, because `dcs-migrate.py` reads headers sequentially and does not
track block boundaries. The generator verifies the export by parsing it back
and comparing it with the JSON fixture; a mismatch aborts the run.

Pseudonymization rules (`make-fixture.py`):

- replaced — character/item/spell/skill names, notes, backstories, quests,
  divination, appearance, age/size/weight, class/path/rank/world/alignment/race
  and trait lists, avatars; Firebase uids, document ids and `userId`;
- kept — `gameSystem`, `edition`, enum fields (`type`, `status`, `quality`,
  `damageType`, `ability`, `class`, `size`, `speed`, …), dice strings
  (`1d8+5 P`), numbers and booleans.

That keeps the interesting conversion paths alive: missing Dark Heresy defaults
are filled, `statUpgrades` objects are expanded to flags, `atkBonus` becomes
`damageDice`/`damageModifier`, D&D companions and multiclasses survive. Fake
auth logins keep the old domain so the domain-stripping path is exercised too.

`examples/service-account.example.json` is not data: it is the credential shape
the Auth export expects, kept so the procedure is readable after the real key is
gone. It lists the non-secret fields (`type`, `project_id`, `client_email`, the
OAuth URLs, `universe_domain`) with fictional values. The two secret fields are
missing on purpose: `private_key_id` is a 40-character hex id and `private_key`
is a PEM block. A JSON file containing those keys is flagged as a leaked Google
Cloud credential by GitHub push protection — even a placeholder value — so the
template stays readable without being a credential. Never commit a real key:
download it, point `GOOGLE_APPLICATION_CREDENTIALS` at it, revoke it after the
migration.

The generator refuses to write a fixture that still contains a replaced source
value (exact-match check over all string leaves). Regenerate and format:

```sh
python3 make-fixture.py --source ../../../firebase-backup \
  --auth-export ../../../firebase-backup/auth-users.json \
  --out examples/import-source.example.json \
  --out-auth examples/auth-users.example.json \
  --binary-out examples/firestore-export --max-per-system 3
npx prettier --write examples/*.json     # from the repo root
```

Run the scripts against the fixtures:

```sh
rm -rf /tmp/dcs-fixture
python3 dcs-migrate.py --source examples/import-source.example.json \
  --data-dir /tmp/dcs-fixture --auth-export examples/auth-users.example.json --force
python3 dcs-migrate-check.py --data-dir /tmp/dcs-fixture --types ../../src/lib/types.ts
```

Expected: 4 accounts, 6 sheets, logins `player1`/`player3`/`player5`/`player9`
from the auth fixture, and `ИТОГ: миграция соответствует текущему профилю`
(exit 0).

The binary path is checked the same way, with `--source` pointing at the export
directory instead of the JSON file:

```sh
rm -rf /tmp/dcs-fixture-binary
python3 dcs-migrate.py --source examples/firestore-export \
  --data-dir /tmp/dcs-fixture-binary \
  --auth-export examples/auth-users.example.json --force
python3 dcs-migrate-check.py --data-dir /tmp/dcs-fixture-binary \
  --types ../../src/lib/types.ts
```

## Requirements

- Python 3.8+, standard library only.
- Unpacked export directory: no extra packages.
- `.7z` input: one of `7z`, `7za`, `7zr`, `bsdtar` or the `py7zr` package.
- Exporting from Google Cloud (not needed to run the scripts): `gcloud`/`gsutil`
  and, for the Auth export, Firebase CLI (or a service-account key + REST).

## 1. Export the old data

### 1.1 Firestore managed export

Create the export once (Console → Firestore → Import/Export) and download it:

```sh
gcloud init                                    # one-time, pick <project-id>
mkdir -p ~/legacy-export && cd ~/legacy-export
gsutil -m cp -r "gs://<bucket>/<timestamp>_<id>" .
```

The result is one directory per export:

```text
<timestamp>_<id>/
├── <timestamp>_<id>.overall_export_metadata
└── all_namespaces/all_kinds/output-0
```

`--source` accepts the parent directory (the script picks the newest export by
name), a single export directory, or a `.7z` with the same tree.

### 1.2 Firebase Auth users (owner logins and names)

The Firestore export contains only `uid`; e-mails and display names live in the
separate Authentication service. Three ways to get them, in order of
preference:

```sh
# a) Firebase CLI
npm install -g firebase-tools
firebase login                          # on a headless host: --no-localhost
firebase auth:export auth-users.json --project <project-id>

# b) Service-account key (no interactive login)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
firebase auth:export auth-users.json --project <project-id>

# c) Same key, but gcloud activates it and Firebase CLI prints no browser:
gcloud auth activate-service-account --key-file=/path/to/service-account.json
firebase --token "$(gcloud auth print-access-token)" \
  auth:export auth-users.json --project <project-id>
```

The key file is a JSON object shaped like
[`examples/service-account.example.json`](examples/service-account.example.json).
The committed copy keeps every non-secret field with fictional values;
`private_key_id` (40 hex characters) and `private_key` (a PEM block) are
deliberately absent — a JSON containing those keys is reported as a leaked
credential by GitHub push protection even when the value is a placeholder.
Download the real key once, keep it outside the repository and revoke it after
the migration.

Notes:

- `firebase auth:export [file]` reads the format from the file extension;
  `--format json|csv` is optional and ignored when the name has a suffix.
- The IAM permission `firebaseauth.users.get` is enough (Firebase
  Authentication Viewer, Editor or Owner). Password hashes/salts are returned
  only with extended scope and are not needed here.
- Users are paged 1000 at a time by the CLI; nothing to tune.
- `gcloud beta identity-platform users export` does not exist, and the Console
  has no bulk JSON export — do not look for them.
- Without any Auth access, run the migration without `--auth-export`: logins
  become `imported-<uid6>` and names can be assigned later via `--map`.

Fallback without Firebase CLI is the Identity Toolkit REST endpoint
`accounts:batchGet` with a `gcloud auth print-access-token` token and
`nextPageToken` pagination; it returns the same fields and must be stored as
`{"users": [...]}`.

Sanitized shape of the file (real values are personal data):

```json
{
  "users": [
    {
      "localId": "<firebase-uid>",
      "email": "petya@example.com",
      "displayName": "Petya",
      "disabled": false
    }
  ]
}
```

### 1.3 Who owns which account

Priority: `--map` > `--auth-export` > `--username-template`. `--map` takes a
JSON object `{"<firebase-uid>": "<login>"}`; use sheet names as a hint when Auth
is gone. Accounts are matched by `localId`/`uid`, so uids missing from the Auth
export keep template logins and are listed in the output.

## 2. Run the migration

Commands below assume the current directory is `scripts/legacy-migration/`
(otherwise prefix the script path).

```sh
# what is in the source: date, size, sheets, accounts
python3 dcs-migrate.py --source <path-to-export> --list

# dry run: nothing is written
python3 dcs-migrate.py --source <path-to-export> --data-dir <data-dir> --dry-run

# real run into an empty data directory
python3 dcs-migrate.py --source <path-to-export> --data-dir <data-dir> \
  --auth-export auth-users.json \
  --report migration-report.json
```

`uid` is a UUIDv5 derived from the Firebase uid: stable across reruns, so
`--force` overwrites the same directories instead of duplicating accounts. In
the application itself uids are random; login and identity are decoupled and a
login change does not move the directory.

Smoke-test without a dump: see [Fixtures](#fixtures) above.

### Flags

| Flag | Meaning |
| --- | --- |
| `--source PATH` | Export directory, single export, `.7z`, or legacy JSON array |
| `--list` | Show discovered exports (date, size, sheets, accounts) and exit |
| `--export NAME` | Pick one export: full directory name or its prefix |
| `--all` | Merge every export, oldest → newest (newest wins on the same id) |
| `--data-dir PATH` | Output data directory (default `./data`) |
| `--dry-run` | Print what would be written |
| `--password VALUE` | Shared password for created accounts (default `1234`, see below) |
| `--random-passwords` | Generate a distinct random password per account |
| `--password-length N` | Length of a random password, 6..64 (default 12) |
| `--credentials FILE` | Write issued logins/passwords to CSV (`chmod 600`) |
| `--username-template S` | Login template: `{uid}`, `{uid6}`, `{uid8}`, `{n}` |
| `--map FILE` | Own logins: `{"<firebase-uid>": "<login>"}` |
| `--auth-export FILE` | Use logins/names from `firebase auth:export` |
| `--force` | Write into a non-empty `--data-dir` |
| `--strict` | Fail on a missing required field instead of filling a default |
| `--report FILE` | Save the migration report (accounts, sheets, defaults) as JSON |

The default `--password 1234` is kept for local stands only: it is shorter than
the application's 12-character policy, and the script prints a warning. For a
real migration use `--random-passwords --password-length 16`.

## 3. Verify the result

```sh
python3 dcs-migrate-check.py --data-dir <data-dir> --types ../src/lib/types.ts
#  exit 0 — every sheet and user.json match the current profile
#  exit 1 — mismatches are listed (field, expected type, got)
```

`~` warnings about extra fields are expected: the old documents carried fields
the current profile no longer declares (or that belong to the other game
system); the application keeps them untouched. Missing required fields would be
errors — the migrator fills known ones, so a new error means the profile grew a
field the migrator does not default yet.

The scripts contain no tests of their own; the fastest sanity check after an
edit is:

```sh
python3 -m py_compile dcs-migrate.py dcs-migrate-check.py make-fixture.py
python3 dcs-migrate.py --source examples/import-source.example.json \
  --data-dir /tmp/dcs-fixture --force
python3 dcs-migrate-check.py --data-dir /tmp/dcs-fixture \
  --types ../src/lib/types.ts
```

## 4. What gets written

```text
<data-dir>/
├── users/<uid>/user.json                  # schemaVersion 4, role, isBlocked, scrypt hash
├── users/<uid>/characters/<id>.json       # sheet, userId = owning uid
└── index/logins.json                      # normalized login → uid (derived)
```

- `user.json` is written in the current profile shape: `schemaVersion: 4`,
  `role: "user"`, `isBlocked: false`, `passwordHash` as
  `scrypt$N$r$p$<salt>$<hash>` — the same format as
  [`src/lib/security/scrypt.ts`](../../src/lib/security/scrypt.ts). The server
  normalizes either shape on startup, but writing the canonical one avoids a
  rewrite on first read.
- Provenance fields `migratedFromUid` / `migratedFromEmail` / `migratedAt` stay
  on disk and are stripped from portable exports
  ([`docs/export-format.md`](../../docs/export-format.md)).
- Logins lose the old domains (`@verse-scribe.app`, `@local.charsheets`); the
  full e-mail is preserved in `migratedFromEmail` and in the report.
- Firebase passwords are not transferable: the Auth export holds only hashes
  for another system. The tool issues new local passwords and prints them once;
  they are also written to `--report` / `--credentials` when requested.
- Migration accounts have no recovery phrase; users set one after signing in.

## 5. Known conversions and why

The old sheets use the same field names, so data is copied as-is; no stats are
reset (the removed `/api/import` zeroed them to 30/10). Defaults are added only
where the current profile requires a value:

- Dark Heresy sheets get `fatigue1st`, `fatigue2nd`, `criticalConditions` and an
  explicit `edition: "1st"`. Those fields were added to the profile after most
  data was written; the UI reads them with `?? 0` / `|| []`, so old data looked
  fine but did not satisfy the type.
- Skills get `training.plus30: false` when an older sheet was written before
  the `+30` training flag existed.
- `RangedWeapon` no longer synthesizes `penetration`: the current profile has
  that field only on melee weapons.
- `statUpgrades` is padded to four flags (old sheets sometimes had three).
- Legacy attacks (`atkBonus` / `damageType`) get `damageDice` +
  `damageModifier`; the old values are kept in `notes`. Speed `"30ft"` becomes a
  number, `spellSlots` keys become strings, items/spells/quests without an `id`
  get stable ids.

## 6. Data handling

- A dump, `auth-users.json` and service-account keys are personal data plus
  live credentials: mode `0600`, outside the repository, deleted or revoked
  after the migration.
- The repository is public: never paste real logins, e-mails or generated
  passwords into issues, docs or commits. Use this README and
  `examples/import-source.example.json` as the documented examples.
- After a successful migration: revoke the service-account key and the OAuth
  client secret in Google Cloud, then remove the local dump.

## 7. Related

- [`docs/data-storage.md`](../../docs/data-storage.md) — current layout and § Legacy data
- [`docs/export-format.md`](../../docs/export-format.md) — portable JSON envelope
- [`docs/adr/0002-legacy-migration-tooling.md`](../../docs/adr/0002-legacy-migration-tooling.md) — why this tooling lives in the repository
