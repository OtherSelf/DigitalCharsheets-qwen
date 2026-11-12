# Architecture

A high-level look at how Digital Character Sheets is put together: the stack,
the layout, the auth/session model and what happens at server start.

## Overview

The app is a **self-hosted Next.js application** intended to run on
infrastructure you control. It has no database and no
external backend: user profiles and character sheets are JSON files in a data
directory, and the same Node process serves both the UI and the API.

Games and editions are **modules**: every sheet type, form, validator, demo,
translations and export adapter lives under `src/games/<systemId>/`, and the
core works through a single registry. Adding a game does not touch the core.
See [game-modules.md](game-modules.md).

The original prototype was scaffolded in Firebase Studio (see
[blueprint.md](blueprint.md)); the current version is a Next.js App Router
rewrite finished with Qwen assistance.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, route handlers, Turbopack in dev) |
| UI | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn components |
| State | React contexts (`LocalAuthProvider`, `CharacterProvider`) + a small save queue |
| Storage | Node `fs` + JSON files under a data directory; no DB |
| Auth | Signed HttpOnly session cookie; per-user `user.json` |
| API docs | OpenAPI 3.1 + Scalar at `/api/docs` |
| Tests | Vitest, HTTP smoke script, Playwright visual regression |

## Application layout

```
src/
  app/                 Next.js App Router: pages + API route handlers
    api/               HTTP API (auth, characters, admin, docs)
    admin/             Admin panel page
  components/          Host UI shell (header, sidebar, dialogs) + shadcn
                       primitives; game sheets/sections live in src/games
  context/             LocalAuthProvider, CharacterProvider, language
  games/               Game plugins (contract, generated registry,
                       dnd5e/dh1/dh2): a plugin folder owns its plugin.json,
                       sheet, form, sections, ui.ts slots, JSON dictionaries
                       and data; registry.generated.ts + i18n.generated.ts are
                       produced from the manifests
  lib/                 Server auth/session, storage, export, OpenAPI, schema,
                       game catalog and module access
  instrumentation.ts   Runs startup maintenance when the server starts
  hooks/               UI helpers (toasts, mobile, display settings)
tests/
  unit/                Vitest: lib/API/storage/OpenAPI
  visual/              Playwright screenshot regression + baselines
scripts/               smoke / visual / predeploy / dev helpers
scripts/plugins/       plugin manifest validation, registry/i18n generation and
                       import-boundary check (`npm run plugins:*`)
docs/                  This documentation
```

## Request flow

```
Browser
  │  cookie: dcs_session=<uid>.<exp>.<hmac>
  ▼
Next.js route handler
  │  getSessionUid(request)  → verifies HMAC + expiry, reads user.json
  │  requireAdmin(request)   → additionally checks role === "admin"
  │  requireModuleAccess()   → role × game catalog visibility
  ▼
src/lib/* (server-only)
  │  data-dir.ts, data-lock.ts, fs-atomic.ts, server-storage.ts, server-auth.ts,
  │  game-catalog.ts, module-access.ts
  ▼
<data-dir>/users/<uid>/…   (JSON files)
<data-dir>/settings/game-catalog.json
```

- UI pages are mostly client components; they fetch the API with the cookie.
- `GET /admin` is a public HTML shell, but all data comes from `/api/admin/*`,
  which returns 401/403 without an active administrator. Client-side role is
  only used to show/hide the menu item.
- The data directory is selected by `DCS_DATA_DIR`; the default is `./data`.

## Auth and sessions

- Identity is the immutable `uid` (UUID) stored in `users/<uid>/user.json`.
- The login (`username`) is a mutable attribute; the derived
  `index/logins.json` maps normalized login → uid and can be rebuilt by scanning
  `users/*/user.json`.
- The session cookie contains `<uid>.<exp>.<hmac>`; the HMAC key comes from
  `DCS_SESSION_SECRET` or `<data-dir>/.session-secret` (created with mode
  `0600`). The cookie is `HttpOnly; SameSite=Lax`, valid for 30 days.
- `getSessionUid()` also checks that the profile still exists and is not blocked.
  Blocking a user therefore invalidates their existing sessions on the next
  request.
- Roles live in `user.json` (`role: "admin" | "tester" | "user"`).
  `requireAdmin()` is the only server-side gate for `/api/admin/*`; `tester`
  behaves like `user` plus it may create `test` editions. The edition
  visibility matrix is enforced by `requireModuleAccess()` on creation.
- All API routes that touch user data take the uid from the session, never from
  the query or body. Creating a sheet additionally checks that the role may see
  the requested edition (403 otherwise).

See [admin.md](admin.md) for the admin invariants and
[data-storage.md](data-storage.md) for the file layout.

## Startup

`src/instrumentation.ts` runs once per Node server process (dev and production)
and calls `src/lib/startup.ts`:

1. **Profile check** — every `users/<uid>/user.json` is normalized to schema v4:
   missing `schemaVersion`, `role`, `isBlocked`, `createdAt`/`updatedAt` are
   filled in; existing values (including `tester`) are preserved.
2. **Character sheets** — every `users/*/characters/*.json` is normalized to
   sheet schema v2 (`systemId`, dh1/dh2 split, divination IDs, hybrid values to
   `notes`). Files newer than v2 are left untouched.
3. **Login index rebuild** — `index/logins.json` is derived and can be
   regenerated from the profiles.
4. **Administrator bootstrap** — if no active administrator exists, a service
   account is created with a generated password (console + data-dir file).

The startup work is best-effort: a read-only or partially broken data directory
does not prevent the server from starting.

## Client state

- `LocalAuthProvider` keeps a localStorage snapshot of the profile for instant
  rendering, then refreshes it from `GET /api/auth/session`. A 401 clears the
  snapshot (account deleted or blocked).
- `CharacterProvider` loads the user's sheets from `/api/characters`, applies
  pending drafts/edits and saves through a queue. The server additionally drops
  late writes using `__page`/`__seq` tokens.
- UI language (`en`/`ru`) and theme are stored in localStorage; sheets support a
  compact view and independent text/UI scaling.
- `GET /api/games` returns the games/editions visible to the current role and
  the optional site-title override; the creation wizard and `/demo` render from
  it. The header caches the title for the session.

## Related

- [game-modules.md](game-modules.md) — how a game/edition is added
- [data-storage.md](data-storage.md) — concrete files and schemas
- [api.md](api.md) — endpoints and OpenAPI docs
- [testing.md](testing.md) — how the behaviour is verified
