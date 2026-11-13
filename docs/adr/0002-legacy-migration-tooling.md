# ADR 0002 — Legacy migration tooling lives in the repository

Status: **accepted** (2026-11-13). Scope: what happens to the Firebase-era
migration scripts `dcs-migrate.py` / `dcs-migrate-check.py`, the Firestore
export procedure around them, and why they are part of the public repository
while the data they process is not. Related: [data-storage.md](../data-storage.md)
§ Legacy data, [`scripts/legacy-migration/README.md`](../../scripts/legacy-migration/README.md).

## Context

The project started on Firebase Studio (Firestore + Firebase Auth). Moving the
sheets into the file-based application was a one-off operator job, done with two
local Python scripts and a hand-written Russian procedure. At the time of the
migration:

- the runtime had `GET /api/import`, which read `<data-dir>/import-source.json`,
  created accounts with a shared default password and was reachable without
  authentication. It was **removed** during the security hardening
  ([api.md](../api.md), [security.md](../security.md));
- the scripts, the export procedure and the real dumps lived in the dev
  workspace, outside git. The procedure drifted from the code within weeks and
  the dumps sat next to keys with `0777` permissions;
- [`data-storage.md`](../data-storage.md) § Legacy data promised that the
  migration "can be re-run as a script", but the script was not published.

Keeping the status quo was not an option: an undocumented, unpublished migration
path cannot be reproduced, and a published dumps folder would leak real accounts
and credentials into a public repository.

## Decision

1. **The tooling is published, the data is not.** `dcs-migrate.py`,
   `dcs-migrate-check.py`, `make-fixture.py`, this README and the fixtures in
   `examples/` live under
   [`scripts/legacy-migration/`](../../scripts/legacy-migration/README.md).
   Firestore exports, `auth-users.json`, service-account keys and generated
   passwords never enter git. The committed fixture is a pseudonymized subset
   of the real 2026-11-01 export (names, notes, ids and uids replaced; game
   system, editions, dice and enum fields kept) so the scripts can be exercised
   without carrying the data; `make-fixture.py` regenerates it and refuses to
   write a file that still contains a replaced value. The fixture ships twice:
   as a JSON array and as a synthetic managed export (LevelDB log + protobuf)
   under `examples/firestore-export/`, so the binary dump parser stays testable
   after the real export is deleted.
2. **No `archive/` directory with historical documents.** The repository keeps
   one describing page for legacy data (in `data-storage.md`) and points to the
   tool; dated dumps, old metrics and "what was broken in November" narratives
   are not committed (see [docs/README.md](../README.md) § What belongs where).
   The rationale that would otherwise need an archive is this ADR.
3. **The migration writes the current profile shape**, not the shape it was
   originally written against: `user.json` with `schemaVersion: 4`,
   `role`, `isBlocked` and `scrypt` password hashes (`src/lib/security/scrypt.ts`);
   `dcs-migrate-check.py` verifies the output against `src/lib/types.ts`.
4. **Verification is manual and cheap.** Neither script runs in the npm gate:
   they need a dump and are not part of the application. The README documents the
   three commands that prove they still work (`py_compile`, run on the example
   fixture, `--types` check on the result).
5. **The runtime endpoint stays removed.** Migration is an offline operation;
   re-introducing an HTTP import would repeat the security problem that got it
   deleted.

## Consequences

- The procedure is reproducible by anyone with a dump, and it is versioned with
  the profile it targets: when `types.ts` grows a required field, the check
  script reports it immediately instead of silently producing incomplete data.
- The public repository now names the defunct old deployment domain in script
  comments (`@verse-scribe.app`). That is not a secret: the domain appears in
  git history and in the legacy schema description. Project ids, bucket names,
  keys and user records stay out.
- Drift is possible: nothing fails CI when the profile changes and the migrator
  defaults agree with it. The documented fixture run is the guard; treat a
  failure there as a required update to `dcs-migrate.py`.
- Anyone who still has the old deployment must export the data themselves; the
  repository cannot and must not carry it.
