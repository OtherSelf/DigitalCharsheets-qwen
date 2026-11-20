# Changelog

All notable player-facing and operator-facing changes to Digital Character
Sheets. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/),
versions follow [Semantic Versioning](https://semver.org/), and the released
version is the `version` field in `package.json`.

Plugin versions are separate from the app version. A release note lists them
when they change; sheet `schemaVersion` only changes when the stored character
format changes.

## [Unreleased]

### Added

- Games can theme their own sheet (`plugin.json#ui.theme`): a fixed list of
  host tokens for the light and dark modes, rendered as CSS variables on the
  sheet page only. No selectors or arbitrary CSS — the rest of the site and the
  other games stay untouched. An optional plugin font (1.4) is loaded lazily
  and applied to the same scope without entering the shared bundle. `pluginApi`
  is now 1.4; the reference fixture and the DH2 demo theme exercise the
  contract.

### Changed

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
