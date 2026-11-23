---
title: "Architecture"
description: "Stack, application layout, auth/session flow, startup checks, client state"
---

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

"A game-agnostic core" is enforced, not just intended. Four gates run inside
`npm run verify`:

- `npm run plugins:purity` scans `src/lib`, `src/components`, `src/app`,
  `src/context`, `src/hooks` and the SDK layer `src/games/shared` for game
  names and game field names (`proficiencyBonus`, `rank`, `wounds`, …), for
  **exact game ids inside string literals** (`if (systemId === 'dh1')` used to
  be invisible) and for **game selectors in core CSS** (`.dnd-sheet`,
  `.dh-sheet`). Comments are not code and do not count; exceptions carry a
  reason and a removal deadline, and the CSS debt ratchet can only go down.
- `npm run plugins:imports` checks the reverse direction: the core never
  imports a plugin folder, only its contract (`registry*`, `types`,
  `plugin-api*`, `plugin-host`, `character-system`, `games*`, `i18n*`,
  `shared/*`).
- `npm run plugins:boundaries` checks that a plugin imports the core only
  through the allowlist in `scripts/plugins/boundaries.json`.
- `npm run test:layout` checks that a test of one edition lives in
  `src/games/<id>/tests/`, and keeps a ratchet on host tests that still
  mention game ids.

The same rule covers admin summaries (the sheet label comes from the plugin's
`CardSummary` slot), conditions (the plugin passes its `kinds`/`sources`) and
Excel labels (they live in plugin dictionaries under `<plugin>.excel.*`).

### Who owns what

| Thing | Owner | Where |
|---|---|---|
| Sheet layout and responsive rules | the edition | `src/games/<id>/sheet.module.css` |
| Palette and accents of the sheet page | the edition, as data | `plugin.json#ui.theme` (host renders scoped CSS variables) |
| Plugin font | the edition, lazily | `plugin.json#ui.theme.font` → `generatedFontLoaders` |
| Mechanics that look alike (DH stats, skill training) | each edition separately | `src/games/dh1/…`, `src/games/dh2/…` (parity test) |
| Data pack generation (dh2 reference) | the edition | `src/games/dh2/scripts/generate.mjs` |
| Game-agnostic kernel (base fields, quests, Excel writer, import review store) | the core | `src/games/shared/` |
| Theme rendering, gates, registry | the core | `src/lib/game-theme.ts`, `scripts/plugins/*` |

The original prototype was scaffolded in Firebase Studio; the current version is
a Next.js App Router rewrite finished with Qwen assistance. The legacy schema the
importer still accepts is summarised in
[data-storage.md](data-storage.md#legacy-data).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, route handlers, Turbopack in dev) |
| UI | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn components |
| State | React contexts (`LocalAuthProvider`, `CharacterProvider`) + a small save queue |
| Storage | Node `fs` + JSON files under a data directory; no DB |
| Auth | Signed HttpOnly session cookie; per-user `user.json` |
| API docs | OpenAPI 3.1 + Scalar at `/api/docs`; engineering docs at `/docs` |
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

### Pages

| Path | What |
| --- | --- |
| `/` | Dashboard for a signed-in user, demo landing for a guest |
| `/character/<id>` | One character sheet (id is the file name, `[A-Za-z0-9_-]{1,64}`) |
| `/share/<token>` | Public read-only sheet from a bearer share link; no session, `noindex`/`no-store` |
| `/character/<id>/history` | Owner-only change history for one sheet |
| `/new`, `/new/manual` | Creation wizard (catalog pick / manual sheet) |
| `/login` | Sign in, registration and the two-step recovery |
| `/settings` | Profile, sessions («sign out everywhere»), account deletion |
| `/admin` | Administrator panel (HTML shell; data via `/api/admin/*`) |
| `/demo` | Demo landing, always the guest view |
| `/stats-editor` | Bulk stats editor |
| `/docs`, `/docs/<slug>` | Engineering documentation rendered from `docs/*.md` (public) |
| `/error/<code>` | Informational page for a supported HTTP status (`400`, `401`, `403`, `409`, `413`, `429`, `500`, `503`); an unknown code is a real 404 |

Sheet URLs are built by `characterPath()` in
[`src/lib/routes.ts`](../src/lib/routes.ts); share URLs use `sharePath()`. There
is deliberately no redirect from the old root `/<id>` route, so bookmarks of
that form now answer `404`.

## Request flow

```
Browser
  │  cookie: __Host-dcs_session=<uid>.<exp>.<jti>.<hmac>
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
- The core footer (`SiteFooter`: version, commit, branch, repository, license,
  `/about`) is rendered at the end of each page's scrollable `main`, not in the
  root layout: pages own `h-dvh` shells and scroll their own `main`, so a bar
  under `{children}` would sit outside the viewport and never appear. A shared
  `AppFrame` that would unify these shells is a separate task (see
  `_BACKLOG.md`).
- `GET /admin` is a public HTML shell, but all data comes from `/api/admin/*`,
  which returns 401/403 without an active administrator. Client-side role is
  only used to show/hide the menu item.
- The data directory is selected by `DCS_DATA_DIR`; the default is `./data`.

## Write coordination

Two locks guard the data directory. `withDataLock()` is the global `mkdir`
mutex used by multi-file operations: registration and login rename, account
deletion, the game catalog, sessions/tokens/shares. `withSheetLock(key)` is an
in-process per-sheet queue used by single-sheet saves; different sheets run in
parallel, one sheet is serialized. A global operation waits for every active
key lock and blocks new ones, and a key operation waits while a global lock is
held (global has priority over new keys). The global `mkdir` lock remains
cross-process; the per-key coordination is local, which is safe because one
process per data dir is required (see below).

## Process-local read cache

`sessions.json`, every `user.json`, `index/logins.json`,
`settings/game-catalog.json` and each character sheet are parsed once and kept
in memory. A read is a `stat` plus a signature check on `(ino, mtimeMs, size)`;
`writeJsonAtomic` invalidates the entry after `rename`, so a write by the same
process is visible on the next read. An external edit changes the signature and
is picked up on the next `stat`.

The cache assumes **one Node process per data directory**. Write-through
invalidation only knows this process's writes; a second process could still
serve its own copy between edits. Session revocation and account blocking stay
immediate because the write happens before the response and invalidates the
sessions/profile entry; a corrupt `sessions.json` still means "no live
sessions" (fail-closed). The cache stores only the value; it never changes what
is written to disk.

## Auth and sessions

- Identity is the immutable `uid` (UUID) stored in `users/<uid>/user.json`.
- The login (`username`) is a mutable attribute; the derived
  `index/logins.json` maps normalized login → uid and can be rebuilt by scanning
  `users/*/user.json`.
- The session cookie contains `<uid>.<exp>.<jti>.<hmac>`; the HMAC key comes
  from `DCS_SESSION_SECRET` or `<data-dir>/.session-secret` (created with mode
  `0600`). The cookie is `HttpOnly; SameSite=Lax`, `Secure` in production, and
  valid for 14 days.
- `jti` points at a live record in `<data-dir>/sessions.json`
  ([`src/lib/security/sessions.ts`](../src/lib/security/sessions.ts)). Logout,
  password/phrase changes, recovery and administrator actions delete the record,
  so the cookie stops working at once instead of at its expiry.
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
- The public `/share/<token>` page is the one deliberate exception: it derives
  the owner from the hashed bearer token and renders one sheet read-only. The
  uid still never comes from the request; see [sharing.md](sharing.md).

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
- Two client-side watches guard the open tab. `BuildWatcher` polls
  `GET /api/version` (15 s in development, 60 s in production, visible tab only)
  and shows a banner when the server reports another `buildId`; `ClientErrorGuard`
  does the same for chunk-load failures seen on `window`
  `error`/`unhandledrejection`. The banner only informs — nothing reloads on its
  own, because the tab may hold unsaved input.

### Error surfaces

Every status the UI can explain has one screen and one source of truth
(`src/lib/error-pages.ts`: the code list and the actions).

| Surface | Status | What it shows |
| --- | --- | --- |
| `src/app/not-found.tsx` | 404 | unknown route and `notFound()`; branded `not-found-page`, not Next's English default |
| `src/app/error.tsx` | 500 / 503 | segment render error; a chunk-load failure becomes 503 (the build changed) and offers reload, not retry |
| `src/app/global-error.tsx` | 500 | root layout failed; no providers or Tailwind, inline styles and the same dictionaries |
| `src/app/error/<code>/page.tsx` | 400/401/403/409/413/429/500/503 | linkable informational page; `/error/404` deliberately calls `notFound()` |
| `UnavailableState`, `SheetErrorBoundary` | context-specific | inline cards inside a working page (load failed, plugin render failed) |

Titles and hints live under `error.<code>.*` in both site languages; the screen
never renders a raw status or an i18n key. The `Retry` action re-renders the
segment and keeps unsaved input, while `Reload page` is used when the tab state
has already diverged from the server (429, 503, chunk error).

## Related

- [game-modules.md](game-modules.md) — how a game/edition is added
- [data-storage.md](data-storage.md) — concrete files and schemas
- [api.md](api.md) — endpoints and OpenAPI docs
- [testing.md](testing.md) — how the behaviour is verified
