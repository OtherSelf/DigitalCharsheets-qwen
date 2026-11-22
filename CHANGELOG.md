# Changelog

All notable player-facing and operator-facing changes to Digital Character
Sheets. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/),
versions follow [Semantic Versioning](https://semver.org/), and the released
version is the `version` field in `package.json`.

Plugin versions are separate from the app version. A release note lists them
when they change; sheet `schemaVersion` only changes when the stored character
format changes.

## [Unreleased]

## [0.16.1] - 2026-11-22

### Fixed

- The login page no longer fails with "The original argument must be of type
  Function". It imported the password-length constant from the server module,
  which calls `promisify(crypto.scrypt)` while loading and has no `crypto.scrypt`
  in a browser; the policy now lives in `security/password-policy.ts`, and a
  unit test forbids client modules from importing `security/{password,scrypt,
  phrase}`, `server-*` and `node:fs`/`node:crypto`. The API was never affected —
  only the client bundle, so `/login` was the only broken screen.

## [0.16.0] - 2026-11-22

Reads and writes stop queueing, and the sheet list revalidates instead of
re-downloading.

### Added

- `GET /api/characters?view=summary` returns one card per sheet (`id`, `name`,
  `systemId`, `updatedAt`) instead of full bodies — the measured list drops from
  31.3 KB to 1.0 KB (30×). The response carries an `ETag` and
  `Cache-Control: private, no-cache`, and a matching `If-None-Match` answers
  `304` with no body. The default response is unchanged, and HTML, `/share/*`
  and the other API routes stay `no-store`.
- Excel export runs in a Web Worker: the page builds the rows and hands them
  over, the worker loads the vendored SheetJS from `public/vendor/xlsx` with
  `importScripts`, serializes the workbook off the main thread and returns an
  `ArrayBuffer`. Exporting a large sheet no longer freezes typing or scrolling;
  the file format and name are unchanged, `script-src 'self'` needs no
  exception, and a browser without Worker support falls back to the previous
  dynamic import.
- Performance checks, none of which are part of `npm run verify`:
  `npm run bench` (vitest microbenchmarks), `npm run test:load` (six autocannon
  scenarios on a throwaway server, `--assert` with calibrated thresholds),
  `npm run test:race` (registration, one-sheet PUTs, logout and deletion during
  a write) and `npm run test:perf` (Playwright `@perf`: LCP/CLS/first-input and
  a JS chunk budget on `/demo` and `/login`, plus a check that the built worker
  returns a non-empty xlsx). `autocannon` is a dev-only dependency.
- A `no-emoji` unit test rejects pictographs in `src/`, `tests/` and `scripts/`;
  arrows and `✓`/`⚠` are allowed.

### Changed

- Storage is asynchronous: file operations and the data lock use `fs/promises`
  and a FIFO queue with a 5 ms step instead of blocking `Atomics.wait`, and
  `updateCharacterOnServer` reads, checks `__seq` and writes under one lock.
- Single-sheet writes take a per-sheet lock instead of the global one; the
  global `mkdir` lock still covers registration, account deletion, the catalog
  and sessions, and it has priority over new per-sheet locks.
  `save-parallel` reached 325.6 rps against a 120 rps baseline (2.7×), the
  fsync ceiling being about 256 rps.
- `scrypt` runs in the libuv pool (`hashSecretAsync`/`verifySecretHashAsync`;
  the hash format, N/r/p and salt are unchanged), so a login no longer holds the
  event loop for ~50 ms: `login-storm` went from 21.7 to 46.7 rps.
  `UV_THREADPOOL_SIZE=8`–`16` is now documented for the service unit.
- Parsed JSON is cached per file and revalidated by `(ino, mtimeMs, size)`:
  sessions, profiles, the login index, the game catalog and every sheet are
  parsed once, `writeJsonAtomic` invalidates the entry, and an external edit is
  picked up by the signature. Session revocation and account blocking stay
  immediate, a corrupt `sessions.json` is still fail-closed, the history journal
  parse is cached the same way, and guest requests no longer copy an unchanged
  sheet.
- Data files are written as compact JSON (same schema and fields; pretty files
  are still read): a character file drops from 4.6 KB to 3.1 KB, while the
  user-facing export stays pretty.
- **One process per data directory** is a requirement, not a recommendation:
  the read cache only knows this process's writes and per-sheet locks are
  in-process, so `pm2 cluster`, several systemd instances or workers on one
  data dir are unsupported.
- Plugin versions are unchanged: `dh1` 1.9.0, `dh2` 1.9.0, `dnd5e` 1.7.0,
  `sandbox` 1.1.0 — only their unit and visual tests were touched. The sheet
  `schemaVersion` (Dark Heresy `5`, D&D 5e `2`) and `PLUGIN_API_VERSION`
  (`1.4.0`) are unchanged.

### Fixed

- A burst of parallel writes no longer answers `500 Data directory is locked`
  or stalls the event loop: the lock wait is a FIFO queue, not 50 pollers
  colliding on `mkdir` (event-loop p99 fell from 729 ms to 12 ms at 50 virtual
  users).

## [0.15.0] - 2026-11-22

A public about page and a core footer, and the phone gets layouts that fit.

### Added

- A core footer on all 11 screens: version, short commit, branch (from `md` up),
  repository, MIT license and a link to `/about`. It sits in the flow at the end
  of each page's scrollable `main` and is pinned to the bottom of a short page,
  so it no longer leaves a gap under the content.
- A public `/about` page, readable without signing in: what the project is, the
  stack, where `data/` lives and that it stays on your own server, the
  intellectual-property disclaimer, links to the source, changelog, license and
  issue tracker, and the running version.
- The tab icon is served on every page: `app/favicon.ico` covers `/login`,
  `/settings` and `/admin`, where the dynamic component is not mounted, so
  `/favicon.ico` no longer answers 404, and a plugin icon returns to the core
  one after an SPA transition.
- Below 768 px the admin games list and the bulk stats editor render a card per
  row instead of a table cropped halfway: the status select, the visibility
  checkbox and the gear stay reachable, card fields are labelled from the
  column headers, and the table is kept from `md` up with inner scroll.

### Changed

- The version label lives only in the footer: it is gone from the login card,
  the demo landing and the profile menu, and the footer shares one
  `/api/version` request per tab through `useAppVersion()`.
- The 768 and 1300 px thresholds are declared once in `src/lib/viewport.ts` and
  read through `useViewportFlags()`; the unused `ui/sidebar.tsx` and
  `use-mobile.tsx` (a second copy of 768) were removed, and the manual
  `viewport`/`title` tags in the root layout gave way to the `metadata` and
  `viewport` exports.
- Plugin versions: `dh1` 1.9.0, `dh2` 1.9.0, `dnd5e` 1.7.0 (`sandbox` stays
  1.1.0). The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`),
  and `PLUGIN_API_VERSION` stays `1.4.0`.

### Fixed

- Compact navigation scrolls again. D&D had no section anchors at all and Dark
  Heresy lacked skills/talents, so tapping the rail did nothing; the page now
  scrolls `main` to the section after the layout settles, with padding and
  clamping, repeats the scroll on a second tap, and warns in development when an
  id does not resolve.
- The rail itself scrolls on a short screen: on 360×640 the last buttons used to
  sit outside the window.
- Guest links use the mobile layout on the phone: the DH and D&D share pages no
  longer scroll sideways, their panels stack in a column, and no compact rail
  appears — a guest has no rail to switch sections with.
- iOS no longer zooms the page when a field gets focus: fields below 768 px use
  16 px on focus.
- Touch targets on the phone: dialog and sheet close buttons and destructive
  icons are 40×40, the D&D inspiration `±` and the rail buttons are at least
  32×32 with accessible names, and the DH characteristic dots keep their 12 px
  look inside a 24×24 hit area, so a tap 10 px off centre still counts.
- D&D "Add Companion" no longer covers the "Companions" heading and stays on its
  own line when the width is short; the inspiration pill is a labelled group;
  captions that were clipped ("FATE POIN…", "Passive Wisdom (Perception)",
  "Proficiency Bonus") wrap or get a hover title.
- The demo buttons on the landing wrap their captions, so the Russian
  "Dungeons & Dragons · 5-я редакция" no longer pushes the grid 8 px past
  `main`.
- The document no longer carries two `viewport` meta tags, and removing the
  `<link>` nodes in `DynamicFavicon` no longer breaks the next SPA transition
  (`removeChild of null`).

## [0.14.0] - 2026-11-21

Every shipped game gets its own typeface, and right sheets close with a swipe.

### Added

- Dark Heresy 1e gets its own theme: a gold accent palette for both modes, a
  matching border and focus ring, and a smaller radius. It was the last shipped
  game still drawn in the host indigo.
- Theme fonts in the shipped games: Cormorant Garamond (DH1), Cormorant SC
  (DH2), Forum (D&D 5e and the sandbox). Each plugin keeps two `woff2` subsets
  and the `OFL.txt` licence in `assets/`, declares `@font-face` with a Cyrillic
  `unicode-range` in its sheet CSS module and opts in through `ui.theme.font`,
  so the files load with the sheet chunk instead of every page. The theme wrapper
  exposes `data-font-expected` and `data-font-ready`, and a screenshot waits for
  both plus `document.fonts.ready`, so a baseline never catches the host face.
- A plugin may import `next/font/local` (exact match; the rest of `next/*` stays
  forbidden) when it prefers that route. `@font-face` in the game's CSS module
  remains the recommendation: Turbopack hoists the CSS and preload links of a
  font module imported from a lazy chunk into every page.
- The admin Games table has a gear per edition that opens **Game settings**: a
  "Use the game's theme" switch stored as `useHostTheme` in
  `game-catalog.json`, applied without a rebuild to the sheet, `/share` and
  `/demo`; a reset back to the game theme; and a link to the demo. The first
  column now shows the game family and the second the edition.
- Right sheets — notes, quest journal, experience log, narrative and backstory —
  close with a rightward swipe on touch screens: the panel follows the finger and
  closes past `max(80 px, 25% of the width)` or faster than 0.5 px/ms. Text
  fields, selects and contenteditable areas are exempt, and vertical scrolling
  stays with the browser; the close button, Escape and the overlay still work.

### Changed

- Plugin versions: `dh1` 1.8.0, `dh2` 1.8.0, `dnd5e` 1.6.0, `sandbox` 1.1.0.
  The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`), and
  `PLUGIN_API_VERSION` stays `1.4.0`.
- DH1 and DH2 inventory totals multiply a row's weight (and, for DH1, its price)
  by the row's quantity: the stored numbers are per unit. There is no migration
  — a row without a quantity reads as 1, so only rows already at 2 or more
  change their totals.

### Fixed

- A guest share link is interactive again. The sheet is no longer `inert`:
  inputs and textareas are read-only, checkboxes and switches are disabled, and
  the narrative and experience log stay in view mode, so collapsing a section,
  opening info popovers and switching the history tab work again. Server-side
  write protection and the no-op mutations are unchanged.
- The inventory edit fields are labelled "Qty / Weight, kg / Price, thrones"
  (DH1) and "Qty / Weight, kg" (DH2) instead of three bare numbers that differed
  only by their order.

## [0.13.0] - 2026-11-20

Each game gets its own palette, and the sandbox game ships.

### Added

- `ui.theme` in the plugin manifest: a plugin declares scoped light/dark design
  tokens (12 fixed tokens, colors as HSL triplets, `radius` as a length) and the
  sheet page applies them for that game only. Plugin API is now 1.4.0, and a
  plugin may ship a theme font that is loaded lazily (a failed chunk keeps the
  host fonts).
- Dark Heresy 2e (terracotta on parchment), D&D 5e (deep carmine with pink
  frames and a matching focus ring) and the sandbox game (green) no longer use
  the host indigo palette on their sheets; cards stay as they were and the
  radius comes from the token set.
- The permanent test game "Sandbox" (`defaultStatus: test`): a real plugin in
  the shipped build with its own schema, defaults, demo, export/Excel, migration,
  dictionaries, UI slots, scoped theme and favicon. Testers and admins see it,
  regular users do not by default, and its visibility is managed like any game.
- Two core-purity gates: the core may not import a game folder
  (`check-core-imports.mjs`), and core CSS or string literals may not name a
  game (`check-core-purity.mjs`, with a ratchet for the current debt).

### Changed

- Plugin versions: `dh1` 1.7.0, `dh2` 1.7.0, `dnd5e` 1.5.0 (`sandbox` ships at
  1.0.0). The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- Games are independent copies: Dark Heresy family rules live inside each
  edition instead of `src/games/shared`, sheet styles are CSS modules per game,
  and the 2e data generator moved to `src/games/dh2/scripts` — no game scripts
  or game paths remain in the repo root or in `predeploy.sh`.
- Visual specs and baselines moved into the plugin folders; the host specs check
  only geometry, so the host test suite stays green without any stock edition.

### Fixed

- The compact characteristics block on mobile and tablet no longer draws Radix
  checkmarks inside the 10 px step boxes.
- The import review mode survives a hard navigation (the mark lives in the tab's
  sessionStorage), so an imported sheet keeps its review banner after the
  segment reloads.

### Added

- Games can theme their own sheet (`plugin.json#ui.theme`): a fixed list of
  host tokens for the light and dark modes, rendered as CSS variables on the
  sheet page only. No selectors or arbitrary CSS — the rest of the site and the
  other games stay untouched. An optional plugin font (1.4) is loaded lazily
  and applied to the same scope without entering the shared bundle. `pluginApi`
  is now 1.4; the reference fixture and the DH2 demo theme exercise the
  contract.

### Changed

- Each shipped game now has its own restrained sheet palette through
  `plugin.json#ui.theme`: Dark Heresy 2e is terracotta on parchment, D&D 5e is
  crimson with rose frames, the sandbox is green. Only accents, frames and (for
  2e) card tint change; the rest of the site and the other games keep the host
  palette.
- The sheet layout of every game now lives in its own CSS module inside the
  plugin folder (`dnd5e/sheet.module.css`, `dh1/…`, `dh2/…`) instead of
  `globals.css`; the core keeps a gate that fails on game selectors in core
  CSS. Two dead rules (`.dcs-info-grid`, `.dnd-stretch-card`) were removed with
  it.
- Alike Dark Heresy mechanics (stat arithmetic, cumulative skill training, the
  import-review banner) are copies inside each edition instead of a shared
  layer; a parity test compares their behaviour and skips when one edition is
  absent. The DH2 data-pack generator moved into `src/games/dh2/scripts/` and
  the game-specific `dh2e:*` npm scripts are gone.
- Host unit tests no longer require a specific edition: the game catalog,
  slots, translations, admin badge and password helpers read the registry and
  files, and edition scenarios are guarded with `it.runIf(hasPlugin(id))`.
  Removing `src/games/dh2` now leaves `npm run verify` green (build and a
  temporary-server smoke test included).

### Fixed

- An imported sheet keeps its choice-review mode when the transition to the
  sheet page ends up as a full document load (Next.js hard-navigation
  fallback). The flag now lives in the tab's `sessionStorage` instead of module
  memory, so the creation locks open and the review banner appears again; the
  unit test reproduces the module reload.

## [0.12.0] - 2026-11-20

Inventory with quantities and totals, hit locations on the phone.

### Added

- DH1/DH2 inventory rows show quantity, weight and (DH1 only) price, with
  totals under the columns, a "Lost" checkbox that greys the row out, a compact
  grid on mobile and numeric fields in edit mode. A sheet from an older version
  is not rewritten: quantity defaults to 1, weight and price read as "not set".
- Hit locations and AP are visible on mobile: the armor scheme is its own
  section and, in compact view, is also rendered at the end of the "Info" card.
- Custom resources sit inside "Items" with their own plus/minus; the schema and
  `customResources` are unchanged.
- Madness and Corruption are edited with `−`/`+` buttons around the value
  (step 1, not below zero, saved immediately) instead of a modal and the
  points edit mode; notes stay in the popover.

### Changed

- Plugin versions: `dh1` 1.6.0, `dh2` 1.6.0, `dnd5e` 1.4.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- The inventory model is split per game: `InventoryItem` no longer lives in the
  shared types — DH1 has quantity/weight/price, DH2 quantity/weight, D&D 5e
  keeps its previous shape — and the core no longer re-exports the item type.
- The armor scheme returns to the bottom of "Info" (no separate compact tab,
  the sidebar is back to six tabs); body-part labels wrap instead of being
  clipped.

### Fixed

- Toggling "Equipped" in read mode no longer rolls back when a neighbouring
  section saves: the equipment list is read from the current sheet and saved as
  one patch.
- DH1 shows armour-piercing for the unequipped ranged weapon too, and weapon
  `weight` is gone from the types and forms (a legacy value is cleaned up on the
  next save).

## [0.11.0] - 2026-11-19

Stale tabs notice a new build, error screens stop reloading silently.

### Added

- `/api/version` reports `buildId`: the deployment id in production
  (`deploymentId` comes from the build commit, with `.next/BUILD_ID` as the
  fallback) and a per-process id in development. `next.config.ts` sets
  `deploymentId`, so Next itself appends `?dpl=` to static assets.
- A tab notices a new server: it polls `/api/version` every 60 s in production
  (15 s in development), only while visible, and immediately on focus,
  `visibilitychange` and `online`. When the build differs it shows an
  "application updated" banner instead of silently running stale JS.
- `npm run check:build-id` probes any stand from outside; `docs/deployment.md`
  gained a "New build and stale tabs" section.

### Changed

- Plugin versions: `dh1` 1.5.0, `dh2` 1.5.0, `dnd5e` 1.3.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- Error screens (`app/error.tsx`, the sheet error boundary) offer "Retry" and
  "Reload page" buttons instead of reloading on their own; a chunk-loading
  failure is recognised by its text and ends in that banner or screen instead of
  a stuck spinner.
- A lint rule forbids a static `xlsx` import in client modules, so the Excel
  library stays in the lazy chunk.
- `npm run verify` now checks CRLF in the index and in the working tree
  (`npm run eol:check`; the tree is fixed by `npm run eol:fix`).

### Fixed

- The tab no longer reloads itself on forms: the creation wizard, the stats
  editor and any focused input count as unsaved state and only get the banner,
  so the player does not lose input mid-edit.
- D&D 5e takes the experience label from its own dictionary, and DH1/DH2 drop
  leftover edition-split rudiments.

## [0.10.1] - 2026-11-19

Plugin scaffolding, contract alignment and the decision canon.

### Added

- `npm run plugins:scaffold -- <id> [--game] [--order] [--title] [--title-ru]`
  copies the reference fixture into `src/games/<id>/` with the same rules the
  template gate enforces and regenerates the registry, so a new edition starts
  from a passing plugin instead of a copy with stale ids.
- `docs/decisions.md`: the canon of decisions D1–D21 plus troubleshooting and
  language rules, so plugin authors read one page instead of the commit log.

### Changed

- The plugin contract marks `normalize` and `merge` as required (SDK v1) and
  `game.description` as mandatory, matching what the schema and the registry
  gate already enforced. `docs/plugin-sdk.md` lists the fields to rename when
  the template is copied, and the test map is aligned with the code.
- Host plugin tests take the plugin list from the registry instead of a
  hard-coded list, so a newly scaffolded edition is picked up automatically.

### Fixed

- The generated registry sorts imports the way Prettier does, so
  `plugins:generate` no longer leaves a formatting diff.
- The reference fixture keeps the host service fields in its schema and passes
  the contract as a full plugin, including a copy under another id.

## [0.10.0] - 2026-11-18

Server-side derived values, declared migration chains and an honest API schema.

### Added

- The server recalculates derived sheet values (`DCS_SERVER_DERIVE`, on by
  default; `=0` is the emergency brake): creating or updating a sheet runs the
  plugin's `derive` hook before the diff and the write, so level and
  proficiency bonus (or DH characteristics and their consequences) can no
  longer contradict each other in the stored file. Documents written by older
  versions are recalculated when they are read or normalized.
- Plugins declare a full migration chain: D&D 5e ships 1→2 and Dark Heresy
  1→5 (`from`/`to`/`entry` per step). The chain validator now also runs for a
  manifest that declares no steps, and applied steps are reported.
- `derive` and `derived` in the plugin manifest: a plugin names its derivation
  entry point and the field paths it owns. The manifest fields are additive,
  `PLUGIN_API_VERSION` stays `1.3.0`.
- Negative conformance tests: schemas reject out-of-range values (D&D level
  1–20, characteristics 1–30; DH characteristics and Influence 0–100) and an
  empty sheet name in a request, with `issues[].path = "name"`.

### Changed

- Plugin versions: `dh1` 1.4.0, `dh2` 1.4.0, `dnd5e` 1.2.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- `openapi.json` derives `Sheet_<systemId>` and `SheetInput_<systemId>` from the
  registry zod schemas, so the documented `required` fields match what the API
  really accepts; `Character` is an `anyOf` over editions and the component
  description carries the manifest `schemaVersion`.
- Excel export loads SheetJS on demand instead of shipping it in the initial
  client graph.
- The core no longer formats game fields: the admin character list shows a
  generic Details column (labels come from the plugin `CardSummary` slot), and
  the game dictionaries own their Excel captions and import-preview fields.
- UI slot names are normalized, and the manifest check fails on an unsupported
  `pluginApi` range instead of silently ignoring it.

### Fixed

- A Dark Heresy sheet without `systemId` (or with only
  `gameSystem: "Dark Heresy"`) no longer opens as DH1: the bare alias is gone
  and such a sheet opens read-only as "plugin missing" until its edition is
  known (ADR 0004).

## [0.9.1] - 2026-11-18

Plugin lifecycle guard and sheet access for a removed game.

### Changed

- `npm start` now runs `plugins:check` first (`prestart`): the server refuses to
  boot with a stale generated registry instead of failing later on import.
  Adding or removing a game is still: plugin folder → `npm run plugins:generate`
  → rebuild → restart (see [game-modules.md](docs/game-modules.md)).
- Plugin test suites moved next to the plugins: host specs no longer know about
  a specific game, and `test:plugin`, `test:visual:plugin` and `test:layout`
  run per-plugin checks with a layout budget.

### Fixed

- Removing a game plugin no longer breaks the app: sheets of the removed game
  stay in the list, open in a read-only "plugin missing" view instead of a 500,
  and are still exported as JSON and in a full backup.

## [0.9.0] - 2026-11-18

Import review mode, partial plugin locales and a cleaner creation flow.

### Added

- Imported sheets open in a review mode: a banner lists the empty required
  creation fields (DH1 home world and career, DH2 home world, background and
  role) and lifts the creation locks until the player confirms. It works for a
  single sheet and for a package import and does not change the sheet schema.
- A plugin may declare a subset of the site languages and extra locales (`i18n`
  is a map, `en` or `ru` is required): a plugin that ships only RU is shown on
  EN through the site-language fallback instead of raw keys. Plugin SDK is now
  1.3.0.
- Every game ships its own favicon in `src/games/<id>/assets/`, so the tab icon
  follows the open sheet; the shared `public/favicon-dh*` / `favicon-dnd*`
  files are gone.
- DH1 creation requires only the character name: home world, career and
  divination can be chosen later on the sheet.

### Changed

- Plugin versions: `dh1` 1.3.0, `dh2` 1.3.0, `dnd5e` 1.1.0; Plugin API 1.3.0.
  The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- DH2 creation no longer highlights empty required choices in red — the form
  validation reports them on submit — and the starting-package hint lists the
  variants without the "Choose…" placeholder.
- DH1 "Current/Spent XP" are editable only in Edit mode (like DH2), and a
  negative free XP is highlighted in both editions.
- Dashboard cards show the full "game · edition" name again; the short code
  stays in the admin list only.
- Character history labels values from the game dictionaries: no raw codes or
  JSON paths in the timeline, boolean characteristic-advance lists render as
  `0/4 → 1/4`, and the shared history fields are an explicit allowlist.

### Fixed

- Deleting a DH2 elite advance also removes its journal line and its cost from
  spent XP, so the two delete paths stay symmetric.

## [0.8.0] - 2026-11-17

Canonical gender, locked creation choices, elite requirements and sheet UX
polish.

### Added

- Dark Heresy 1e/2e store the gender as a canonical code (`male`, `female`,
  `unspecified` or empty for "not chosen") instead of a localized label. Old
  labels in RU/EN are migrated on read; an unrecognized value becomes
  `unspecified` and the original text is kept in the notes as a
  `[gender migration] …` line.
- DH2 elite advances carry structured requirements (characteristic minimum,
  background, gender, another elite). The sheet shows the conflicts in red
  with the reason, while the purchase stays possible for GM exceptions.
- DH2 aptitude choices are locked once made: the ones chosen at creation and
  the ones filled on the sheet are read-only and marked with a lock; the
  aptitude profile is rebuilt from them.
- Password fields have a show/hide toggle on the login, registration,
  recovery, settings, admin edit and account deletion forms.

### Changed

- Plugin versions: `dh1` 1.2.0, `dh2` 1.2.0; `dnd5e` stays 1.0.0. Dark Heresy
  sheet `schemaVersion` is now `5` (D&D 5e stays `2`).
- DH2 creation shows the Adepta Sororitas background as a gender lock: the
  gender becomes Female and the select is disabled until the background
  changes.
- DH1 creation moves the gender select into the Details block; after creation
  the gender is read-only in both editions.
- `Dialog`/`AlertDialog` open in place with fade+zoom instead of sliding in
  from the top-left corner, are capped at the viewport height with internal
  scrolling, and keep a 1rem gutter on mobile. The right-side sheet is
  unchanged.
- The DH Info "Backstory" button uses a book icon instead of an eye.
- Character history labels gender values from the dictionaries instead of
  showing raw codes.

### Fixed

- The gender no longer changes meaning when the sheet language changes, and
  rule checks (Sister of Battle) compare a code instead of a translated
  string.
- Excel exports show the localized gender label, while the portable JSON keeps
  the code.

## [0.7.0] - 2026-11-17

Dark Heresy 2e supplements, creation hints in notes and share-page ownership.

### Added

- Dark Heresy 2e: options from *Enemies Within*, *Enemies Without* and
  *Enemies Beyond* — 15 home worlds, 13 backgrounds and 12 roles, with
  aptitudes, skills, talents and full EN/RU bonus texts.
- Elite advances for DH2: Sister of Battle (750 XP) and Astropath (300 XP).
- Creation hints are written to the character's notes as markdown; the Notes
  sheet opens once after creation so the player can copy them (any game may
  request this via the Plugin SDK).
- Guest share sheets show the owner's display name.
- DH1/DH2: history entries for structured conditions are labelled instead of
  showing raw `conditions.0.*` paths.

### Changed

- Plugin SDK 1.2: `manifestVersion` 2 (`game.description` is now required),
  `CreateFormCompletion` for post-creation panels, and game families generated
  from plugin manifests instead of a hand-written core list.
- Plugin versions: `dh1` 1.1.0, `dh2` 1.1.0; `dnd5e` stays 1.0.0. Sheet
  `schemaVersion` is unchanged (DH1/DH2 4, D&D 5e 2).
- Login and landing copy no longer name specific games.
- DH Info section no longer duplicates the Notes entry; Notes are opened from
  the header icon or compact navigation.
- Insanity and Corruption cards show their values without −/+ steppers; edit
  stays in the card's edit button. Characteristic checkboxes use a filled
  state without an overflowing tick.

### Fixed

- DH2 generated data drift is now caught by `npm run verify`
  (`dh2e:check`), so supplements cannot silently diverge from the catalog.
- Characteristic checkbox ticks no longer look broken on mobile and desktop.

## [0.6.9] - 2026-11-16

### Changed

- Deployment/caching: HTML responses are not cached and the `/:path*` proxy
  rule is restored, so a rebuild no longer breaks hydration.

## [0.6.8] - 2026-11-16

Notes, structured conditions, XP journal and sheet polish.

### Added

- Markdown Notes and Backstory in a right-side sheet.
- Structured Insanity/Corruption conditions for DH1 and DH2.
- XP journal sheet and an "Add XP" button on DH sheets.
- Short edition code in the admin character list.

### Changed

- DH1/DH2 Info block regrouped; "Fate points" is labelled on the sheet.
- DH2 can edit empty creation fields and gender.

### Fixed

- `playerName` removed from the DH1 schema/history; equipment "Not equipped"
  opens after adding a weapon.

## [0.6.7] - 2026-11-16

DH2 second-edition content and sheet depth.

### Added

- DH2 psychic rating, elite advances, aptitude block, Influence/Requisition,
  creation choices and wound/Fate ranges.
- Talent hints during DH2 creation; divinations and RU terms aligned with the
  RU book.
- Guest draft banner on creation.

### Fixed

- DH2 starter skills no longer contain `undefined`; RU sheet terms and skill
  names corrected.

## [0.6.6] - 2026-11-16

### Fixed

- DH2 starter skills no longer contain `undefined` entries.

## [0.6.5] - 2026-11-15

DH1 sheet blocks and DH2 progression.

### Added

- DH1: new sheet blocks, world features, starting profiles and career starting
  packages; three "Inquisitor's Handbook" worlds.
- DH2: purchase skills/talents with XP using the 2-2/2-4/2-6 cost tables;
  experience journal window; manual XP purchases and hidden wealth.
- Documentation for per-edition sheet schema versions.

### Fixed

- Nested history fields and array items are labelled; DH1/DH2 armour types and
  history labels translated.

## [0.6.1] - 2026-11-13

Change history and read-only sharing.

### Added

- Character change history: diff engine, 30-minute sessions, timeline, history
  API (`GET/DELETE /api/characters/{id}/history`) and an optional history view
  in guest links.
- Share links: revocable/expiring read-only sheet links, optionally including
  history.

### Security

- Owner-only history API; token-only guest access; history values sanitized for
  guests.

## [0.5.3] - 2026-11-13

### Added

- Offline Firebase migrator moved into the repository; dev/prod deploy scripts.

### Fixed

- Deploy scripts no longer overwrite themselves and run from their own
  directory.

## [0.5.2] - 2026-11-13

### Changed

- Character sheet moved to `/character/[id]`.
- `/api/version` reports the local git commit.

## [0.5.1] - 2026-11-13

Security hardening.

### Security

- scrypt password hashing, server-side session registry (`jti`), recovery-flow
  takeover protection, path-traversal fix in character API, request schema
  validation, security headers and same-origin API docs.

## [0.4.2] - 2026-11-12

### Changed

- Repository conventions (AGENTS.md), English docs, stricter TypeScript and
  atomic legacy import with `schemaVersion` protection.

### Fixed

- Form validation errors are visible and focus the first invalid field; screens
  no longer hang on a spinner; import errors are translated.

## [0.4.1] - 2026-11-12

Plugin architecture and licensing.

### Added

- Plugin SDK: manifests, generated registry/dictionaries, game modules, UI
  slots, bulk editor and admin plugin catalog.
- MIT license.

## [0.3.0] - 2026-11-12

Modular games and portable export.

### Added

- Game → edition → character creation wizard; independent D&D 5e, DH1 and DH2
  modules; export envelope 3.0 with per-module adapters; character schema
  migrations; i18n namespacing and per-module dictionaries; OpenAPI docs,
  `/api/health` and `/api/version`; admin roles and tester visibility; tablet
  visual baselines.

## Before 0.3.0

Early self-hosted prototype: local accounts, D&D 5e and Dark Heresy sheets,
character creation, export/import, themes and the first visual regression set.
