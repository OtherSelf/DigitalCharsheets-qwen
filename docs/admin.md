# Administration

The admin panel lives at **`/admin`**. It is a normal Next.js page, but every
admin API call is guarded on the server: `GET /api/admin/users` returns `401`
without a session and `403` for a non-admin, so opening the URL as a regular user
redirects to `/`. The role is read from `users/<uid>/user.json` — the
client-side copy in localStorage only controls whether the menu item is visible.

## What the panel can do

- list users with role / block status / character-sheet count and search them;
- edit display name and login, reset a password, promote or demote;
- block or unblock — blocking invalidates existing sessions on the next request;
- delete an account together with all of its sheets (typed-login confirmation);
- open a read-only list of a user's character sheets (name, system, class,
  level/rank, file date).

The API behind it is documented in [api.md](api.md).

## Roles and guards

- `role: "admin" | "user"` is stored in `user.json`; a missing or invalid value
  is treated as `user`.
- `requireAdmin(request)` in [`src/lib/admin-auth.ts`](../src/lib/admin-auth.ts)
  is the only server-side gate. It calls `getSessionUid()` (cookie, profile
  existence, block state) and then checks the role.
- Invariants enforced by [`src/lib/admin-users.ts`](../src/lib/admin-users.ts):
  - you cannot demote or block your own account;
  - you cannot delete your own account from `/admin` (use `/settings`);
  - you cannot demote, block or delete the **last active administrator**;
  - deleting an account removes its directory, sheets and login-index entries.

## First administrator and startup checks

[`src/instrumentation.ts`](../src/instrumentation.ts) calls
[`src/lib/startup.ts`](../src/lib/startup.ts) once per server start (dev and
production):

1. checks every `users/<uid>/user.json` against schema v3 and fills in missing
   fields (`schemaVersion`, `role`, `isBlocked`, timestamps) without overwriting
   existing values;
2. rebuilds the derived `index/logins.json`;
3. creates a service administrator if there is **no active one**.

The generated account:

- login — `DCS_ADMIN_USERNAME` (default `admin`; if taken, `admin-2`, `admin-3`, …);
- password — 16 random base64url characters, printed to the server console and
  written to `<data-dir>/.initial-admin.txt` (mode `0600`);
- role — `admin`, plus a `mustChangePassword` flag shown on `/settings`.

The credentials file and password stay as they are on later restarts while an
active admin exists. Change the password after the first login and delete the
file. The data-dir layout is described in [data-storage.md](data-storage.md).

## Blocking

**Block** sets `isBlocked` in `user.json`. The next request from any existing
cookie fails (`401`), so the user is effectively signed out everywhere.

## Admin screenshot tests

[`tests/visual/admin.spec.ts`](../tests/visual/admin.spec.ts) covers the user
list (en/ru), edit dialog, character-sheet list, block dialog and delete dialog
on desktop and mobile. The fixtures are three deterministic `visual-admin-*`
accounts with fixed dates/roles/blocks, seeded by `scripts/visual.sh` into the
temporary data directory. When visual tests run against an external server
(`--base-url`) there is no data directory to seed, so only the admin tests are
skipped. See [testing.md](testing.md) for the commands.

## Related

- [api.md](api.md) — admin endpoints and status codes
- [data-storage.md](data-storage.md) — `user.json` fields and the login index
- [`src/lib/admin-users.ts`](../src/lib/admin-users.ts),
  [`src/lib/admin-bootstrap.ts`](../src/lib/admin-bootstrap.ts)
