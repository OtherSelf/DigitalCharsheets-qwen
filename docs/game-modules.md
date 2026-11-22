---
title: "Game modules"
description: "How a game/edition module is added, the registry contract and module layout"
---

# Game modules

How a game or an edition is plugged into the app. Everything game-specific
(sheet type, validation, creation defaults, demo character, translations,
export fields, Excel sections, UI) lives in one module under
`src/games/<systemId>/`; the core only talks to the registry.

## Layout

```text
src/games/
  types.ts                  GameModule contract, SystemId/GameId, statuses
  plugin-api.ts             plugin contract: manifests, entry points, UI slots
  plugin.schema.json        JSON Schema of plugin.json (validated at build time)
  registry.generated.ts     modules + manifests, generated from plugin.json
  i18n.generated.ts         plugin dictionaries, generated from plugin.json#i18n
  registry.ts               registry factory + helpers (createGameRegistry)
  games.ts                  game families: re-exports games.generated.ts
  character-system.ts       systemId resolution and i18n name keys for UI
  i18n/{en,ru}.ts           registry/wizard metadata (games.*)
  shared/
    types.ts                game-agnostic primitives (CharacterBase, quests,
                            combat resources) — no game mechanics or translations
    schemas.ts              shared zod primitives for those types; game item
                            shapes (inventory) are declared by each module
    defaults.ts             readNumber/readString defaults helpers
    excel.ts                generic Excel section writer used by all modules
  dnd5e/
    plugin.json             manifest: id, order, entry points, i18n, demo
    index.ts                module object + named entry points
    types.ts, schema.ts, schema-version.ts, defaults.ts, demo.ts
    normalize.ts, merge.ts  legacy normalization + import merge
    export.ts, excel.ts, epic-boons.ts, embedded.ts
    i18n/{en,ru}.json       dictionary (keys dnd.* and dnd5e.*)
    create-form.tsx, sheet.tsx, sheet.module.css, fonts.ts
    ui.ts, bulk-editor.ts   slots and bulk-editor tables
    sections/*.tsx          sheet sections
    slots/*                 header/card/compact-nav slot components
    tests/unit, tests/visual, tests/fixtures, tests/visual.json
  dh1/                      independent 1e edition module
    plugin.json             manifest (own copy, not shared with dh2)
    index.ts                module object + named entry points
    types.ts, schemas.ts, schema.ts, schema-version.ts, defaults.ts, demo.ts
    normalize.ts, merge.ts  legacy normalization + import merge (own copies)
    capabilities.ts, stats.ts, dh-stats.ts, field-policy.ts
    export.ts, excel.ts, history.ts, legacy-import.ts
    dark-heresy-data.ts, dark-heresy-ranks.ts, divination-i18n.ts
                            hand-written 1e reference data (own copy, D10)
    create-form.tsx, sheet.tsx, sheet.module.css, fonts.ts
    ui.ts, bulk-editor.ts, slots/*, sections/*
    i18n/{en,ru}.json       dictionary (keys games.dh1.* and dh1.*)
    tests/unit, tests/visual, tests/fixtures, tests/visual.json
  dh2/                      independent 2e edition module
    (same skeleton; keys games.dh2.* and dh2.*)
    dh2e-data.ts, dh2e-reference.ts, dh2e-rules.ts, dh2e-*.ts
                            generated 2e data pack (see below)
    scripts/generate.mjs    generator for the data pack, lives with the edition
```

The full skeleton, required files and naming rules are in
[plugin-layout.md](plugin-layout.md) and checked by `npm run plugins:layout`.
Two editions of one family are independent (D10): they share the skeleton, the
concept file names and the test topics, but not mechanics, dictionaries or UI
sections.

## Adding and removing a plugin

A plugin is discovered from `src/games/<id>/plugin.json`; the core never lists
games. The generated registry is still a static import graph, so both
directions rebuild it:

```sh
# add: copy a plugin folder (or tests/fixtures/example-plugin), then
npm run plugins:generate
npm run build && npm start

# remove: delete src/games/<id>, then
npm run plugins:generate
rm -rf .next && npm run build && npm start
```

`next start` never regenerates the registry: `prestart` runs `plugins:check`
and refuses to start with a clear error when a folder was added or removed
without `plugins:generate`.

Sheets of a removed game stay in the data directory — the server never deletes
data on its own. Such a sheet is still listed, opens as `UnknownSheetView`
(«plugin not installed», `resolveSheetReadOnly` → `plugin_missing`), and exports
as portable JSON or Excel; history and the dashboard label do not depend on the
module being present. `tests/unit/games/removed-plugin.test.ts` locks this
behaviour.

## Second-edition data pack (dh2)

`src/games/dh2/dh2e-*.ts` are generated files: they carry the 2e reference
data (home worlds, backgrounds, roles, aptitudes, divinations, skills,
talents, disciplines, psychic powers, elite advances, XP cost tables) taken
from an external content catalog (`catalog.json` and `rules.json`).

The module never reads that catalog at runtime; the generated files are
committed. The generator lives in the plugin folder — the data pack belongs to
the edition, not to the core tooling — so rebuild after the catalog changes
with:

```sh
DCS_CONTENT_DIR=/path/to/content/dh2 node src/games/dh2/scripts/generate.mjs
DCS_CONTENT_DIR=/path/to/content/dh2 node src/games/dh2/scripts/generate.mjs --check
```

Elite advances carry a structured `prereq` list (characteristic minimum,
background, gender, another elite, a trait). The generator validates every
reference and writes it as `requirements`; a typo fails the generator's
`--check` instead of producing a silent no-op. The sheet checks the
requirements it can compare (background, gender, characteristics, elites) and
shows red warnings, while a `trait` stays a hint because traits are free text
on the sheet.

`DCS_CONTENT_DIR` points to the external catalog (default `./content/dh2`).
The generator owns only the `dh2.catalog.*` slice of
`src/games/dh2/i18n/{en,ru}.json`; every other key is hand-written. Drift is
caught by the edition's own unit test
(`src/games/dh2/tests/unit/data-pack-freshness.test.ts`, part of `npm run verify`):
when the catalog is present, stale generated files fail the unit step; without
it the test is skipped with a reason.
Nothing in `scripts/predeploy.sh` or `package.json` mentions the edition.

## Edition differences (dh1 vs dh2)

The modules intentionally duplicate code (D10). Where the rules differ, the
sheet follows the edition instead of sharing a switch:

| Area | dh1 (1e) | dh2 (2e) |
| --- | --- | --- |
| Progression | career path, rank, alternate/advanced paths (`dark-heresy-ranks.ts`) | no ranks or paths; manual XP journal |
| Wealth | throne gelt and monthly income on the sheet; the "Collect salary" button adds the monthly income to the current capital | wealth hidden; Influence is the resource |
| Requisition | not a rule | Influence + availability/craftsmanship target (`influence.ts`) |
| Psychic | one discipline plus a power list (`psy.discipline`) | free-text disciplines/powers, psy rating purchase hint, elite advances |
| Identity | `identity.gender`/`build`/`handedness`; legacy `identity.playerName` is not a sheet field and is dropped from export | `gender` is shown; no player name |
| Creation hints | world starting profile and starting packages | aptitude choices, wound/fate ranges, Influence acquisition limit |

Common behaviour is mirrored on purpose: creation fields, the XP journal,
history labels, compact view and the export channels (JSON/Excel). Rules are
kept in the module, not in the core; see `docs/data-storage.md` for fields.

The experience block works the same in both editions: current and spent XP are
read-only text until Edit, and the derived free XP (`experience −
totalExpSpent`) turns `text-destructive` when negative. The value is a
computed number, not a stored field, and it is not clamped.

Both creation forms require only the character name. Home world, career or
background/role, divination and the rest may stay empty and be chosen later on
the sheet while the creation field is still empty.

### Creation review after import

An imported sheet opens in review mode: the creation locks are lifted until
the player confirms the choices. The flag lives in the browser tab only
(`src/games/shared/creation-review.ts`), so a reload returns the sheet to its
normal locked state and the sheet schema does not change. The confirm button
stays disabled until the required fields are filled (dh1: `homeWorld` and
`careerPath`; dh2: `homeWorld`, `background` and `role`). The banner and the
store are shared (`src/games/shared/`), so a plugin can opt in without a core
change; D&D 5e does not use them.

### Second-edition sheet rules

The 2e module owns the rules that only exist in that edition:

- **Aptitudes** — `deriveAptitudes` (`dh2e-aptitudes.ts`) builds the profile
  from world, background and role; `chosen` keeps the player's background/role
  picks and duplicate replacements. The sheet block with sources and
  duplicates is editable (`aptitudes-sheet.ts`).
- **Psychic** — free-text disciplines and powers; `psy.ts` computes the
  rating price (200 × new rating) and writes a `psy-rating` journal entry. The
  Focus Power hint shows Willpower with purchases.
- **Elite advances** — `elite.ts` lists available advances, their
  prerequisites and cost; purchase writes `elite-advance` to the journal.
  Removing the advance from the block or deleting its journal row is symmetric:
  both drop the id and the row and return the cost to `totalExpSpent` (a legacy
  sheet without a row loses only the id). Instant changes are a memo only.
- **Starting package** — `Dh2eBackground` may carry optional
  `startingTraits`, `startingCorruption` and `startingMalignancy`; the creation
  form shows them as hints and the player applies them to the sheet manually.
  DH1/DH2 also write a markdown hint sheet into `notes` and ask the host to
  open Notes once after creation (`CreateFormCompletion.openNotes`).
- **Influence / Requisition** — `influence.ts` caps creation acquisitions at
  the Influence bonus (Scarce −10 or better) and computes the Requisition
  target from the availability/craftsmanship tables (book p. 141).
- **Wounds/Fate** — `dh2e-starting-profile.ts` shows the world range and
  prefills the minimum; the player enters the roll.

All of these are mirrored in behaviour, not shared with `dh1` (D10).

## Plugin manifest

Every module folder has a `plugin.json` (`src/games/plugin.schema.json`):

```json
{
  "manifestVersion": 2,
  "pluginApi": "^1.0.0",
  "id": "dh1",
  "gameId": "darkHeresy",
  "version": "1.0.0",
  "order": 20,
  "defaultStatus": "published",
  "name": { "en": "Dark Heresy — 1st Edition", "ru": "Dark Heresy — 1-я редакция" },
  "description": { "en": "…", "ru": "…" },
  "tags": ["warhammer40k", "d100"],
  "author": "Digital Character Sheets",
  "license": "MIT",
  "schemaVersion": 5,
  "game": {
    "id": "darkHeresy",
    "order": 20,
    "name": { "en": "…", "ru": "…" },
    "description": { "en": "…", "ru": "…" }
  },
  "dependencies": { "host": "^1.0.0", "plugins": {} },
  "entry": { "module": "index.ts#dh1Module" },
  "sheet": { "mode": "custom", "client": "sheet.tsx", "createForm": "create-form.tsx" },
  "i18n": { "en": "i18n/en.json", "ru": "i18n/ru.json" },
  "demo": { "entry": "index.ts#createDemo" },
  "export": { "json": "index.ts#toPortableJson", "excel": "index.ts#buildExcelSections" },
  "migrations": [
    { "from": 1, "to": 2, "entry": "index.ts#migrateV1toV2" },
    { "from": 2, "to": 3, "entry": "index.ts#migrateV2toV3" },
    { "from": 3, "to": 4, "entry": "index.ts#migrateV3toV4" },
    { "from": 4, "to": 5, "entry": "index.ts#migrateV4toV5" }
  ],
  "tests": { "conformance": ">=1" }
}
```

Rules:

- `id` equals the folder name and the sheet `systemId`; `version` is semver.
- `name`/`description` are the display source (admin, creation wizard) and
  declare at least one of `en`/`ru`; other strings stay in `i18n/<locale>.*`.
- `game` is the family block (D17): every edition of one `gameId` declares the
  same `id`/`order`/`name`/`description`, and the generator fails if they
  differ. `name` and `description` are required on both `en` and `ru`.
- `order` is unique across all plugins (a duplicate is a generator error), not
  just a sort key; `game.order` is unique per family.
- `entry.module` is `<file>#<export>`; `demo`/`export`/`migrations` are entry
  points too. The manifest member must be a real named export — the
  `plugins-registry` test checks every reference against the module namespace.
- `dependencies.plugins` is reserved (D14); `dependencies.host` is the Plugin
  API range checked by the generator.
- `pluginApi` is checked against the host version (`^`, `~`, `>=`, exact, `*`).
- `aliases` maps legacy `gameSystem`/`edition` values to the plugin; the most
  specific alias wins (`{gameSystem, edition:'2nd'}` beats `{gameSystem}`).
- `migrations` order is the apply order; the chain must cover
  `1 → … → schemaVersion` without gaps, and **`schemaVersion > 1` with an empty
  chain is a manifest error**. Steps point at the module's own functions
  (`index.ts#migrateV1toV2`); the runner writes a `.bak` before the first
  migrated rewrite and never overwrites a newer version.
- `normalize` and `merge` are **required module fields** (SDK v1): the import
  and legacy-normalization path is the plugin's, not the core's. `ui.slots` and
  `aliases` are optional; `dependencies.plugins` is reserved (D14).

`registry.generated.ts`, `i18n.generated.ts` and `games.generated.ts` are
produced by `npm run plugins:generate` from the manifests. They are **not
tracked in git**: `postinstall`, `predev`, `prebuild`, `pretest` and the
pre-deploy gate regenerate them, so a clean checkout gets them from `npm ci`.
`npm run plugins:check` compares the files on disk with the manifests and is
useful after a manual edit; `npm run verify` regenerates instead, because there
is no committed copy to compare against. `registry.ts` no longer contains a
hand-written list — it only re-exports the generated plugins and helpers
(`gameRegistry`, `listGamePlugins`, `getPluginManifest`).

`i18n.generated.ts` exists because `src/lib/i18n` must be importable before the
registry is initialised (language context is imported by plugin UI slots); it
contains only dictionaries, no modules or UI.

UI slots live in a separate file (`ui.ts`, `plugin.json#ui.entry`) and are
loaded lazily through the registry — the module object itself stays free of
React components and host context, so the shared bundle/import graph is not
pulled into every page:

```tsx
const slots = useGameUiSlots(systemId);
slots?.HeaderSubtitle?.(character, t);
slots?.CardSummary?.(character, t);
{slots?.HeaderActions && (
  <slots.HeaderActions character={character} isCompactView={isCompactView} />
)}
```

`loadGameUiSlots(systemId)` caches the loaded object; if the chunk fails the
host keeps the neutral fallbacks (and logs the error).

The sheet itself is loaded lazily (`components.loadSheet`), so a render error in
a plugin shows the *sheet unavailable* card instead of breaking the page; the
header, sidebar, dialogs and JSON export keep working.

`BulkEditor` is data, not a component: the plugin returns
`BulkEditorTable[]` (`ui.BulkEditor`) and the host (`/stats-editor`) renders the
tabs, table markup, edit state and save buttons. Each table declares its tab,
title/description keys, grid template, columns (`key`, `labelKey`, `type`,
`value(character)`) and `apply(character, values) -> Partial<T>` for the save
patch. Tabs are merged across plugins: `stats` is shared, the vitals tabs come
from the game/edition. This is what keeps `DH_STATS`, `isDh1/isDnd` and the
per-game save handlers out of the page.

## Contract

`GameModule<TCharacter>` ([`src/games/types.ts`](../src/games/types.ts)):

| Field | Purpose |
| --- | --- |
| `id` | `SystemId` (`dnd5e`, `dh1`, `dh2`, …); stored as `systemId` in sheets. |
| `gameId` | Game family (`dnd`, `darkHeresy`). Editions are grouped by it. |
| `order` | Sort order in the creation wizard and admin lists. |
| `defaultStatus` | `published` / `test` / `hidden`; runtime override in the game catalog. |
| `nameKey`, `descriptionKey` | i18n keys; names are never stored in sheets. |
| `shortCode` | Locale-independent edition code for the admin character list (`dnd5e`, `dh1e`, `dh2e`); not translated, the full game + edition goes to the tooltip. |
| `schemaVersion` | Sheet format written by the module: `2` for `dnd5e`, `5` for `dh1`/`dh2`; manifests declare it and the migration chain ends here. |
| `schema` | Zod schema; `ZodType<TCharacter>` makes `tsc` check it against the type. |
| `i18n` | Declared locales (`en`/`ru` plus optional extras), merged by the core with an en↔ru fallback. |
| `capabilities` | Fixed feature flags of the module (edition, +30, fatigue field). |
| `createDefaults()` | Character draft (no `id`) for forms/tests. |
| `createDemo()` | Demo character for `/demo` (no `id`). |
| `components.loadCreateForm` / `loadSheet` | Lazy UI entry points; the host wraps the sheet in `Suspense` + `ErrorBoundary` and passes a typed `ref: SheetHandle` (`saveAll()`). |
| `ui` | Optional UI slots (stage 3): `HeaderActions`, `HeaderSubtitle`, `CompactNav`, `BulkEditor`, `CardSummary`, `HouseRulesDialog` + `favicon` (asset imported from the plugin's `assets/`). The host renders a neutral fallback when a slot is missing. |
| `export.toPortableJson` | JSON field selection for export 3.0. |
| `export.buildExcelSections` | Localized Excel sections. |
| `normalize(raw, options?)` | **Required.** Legacy normalization: remaps fields per edition and (with `applyDefaults`) fills missing structures. The core has no per-game branches. |
| `merge(target, source, config)` | **Required.** Import merge; the host checks only that both sides are the same edition. |
| `migrations` | Per-module chain; `schemaVersion > 1` requires a non-empty chain `1 → … → schemaVersion`. |

## Adding a new edition (example: `dh3`)

1. **Module folder** `src/games/dh3/`:
   Start from the scaffold, not from a neighbouring edition:
   `npm run plugins:scaffold -- dh3 --game darkHeresy --order 40`. The scaffold
   copies `tests/fixtures/example-plugin` and leaves the required skeleton
   (`index.ts`, `types.ts`, `schema.ts`, `schema-version.ts`, `defaults.ts`,
   `demo.ts`, `normalize.ts`, `merge.ts`, `export.ts`, `excel.ts`,
   `create-form.tsx`, `sheet.tsx`, `sheet.module.css`, `ui.ts`,
   `bulk-editor.ts`, `fonts.ts`, `i18n/{en,ru}.json`, `tests/unit/`) in place.
   Replace the fixture content with your edition; do **not** copy `dh1` or
   `dh2` wholesale, and do not extract a shared DH core: each edition owns its
   types, schema, defaults, capabilities, stats, exports, translations, form,
   sheet and sections (D10).
   - `types.ts` — base Dark Heresy types + `DH3Character`; `systemId: 'dh3'`.
   - `schemas.ts` / `schema.ts` — base schema + full `ZodType<DH3Character>`.
   - `defaults.ts` — base defaults + `createDh3Defaults(input)`.
   - `demo.ts` — `createDh3Demo()`.
   - `capabilities.ts`, `stats.ts` — fixed 3e flags and stat view.
   - `i18n/en.json`, `i18n/ru.json` — `games.dh3.*` and `dh3.*` keys (D13).
   - `export.ts`, `excel.ts` — `buildDh3PortableJson` / `buildDh3ExcelSections`.
   - `create-form.tsx`, `sheet.tsx`, `sections/*` — own UI copies.
   - `index.ts` — the `GameModule<DH3Character>` object plus the named entry
     points the manifest references (`createDefaults`, `createDemo`,
     `toPortableJson`, `buildExcelSections`).
   - `plugin.json` — the manifest (see *Plugin manifest*).
2. **Manifest** — add `src/games/dh3/plugin.json` (see *Plugin manifest*
   above) and run `npm run plugins:generate`. The registry is generated; no
   core edit is needed.
3. **Game metadata** — nothing to edit: the family block in `plugin.json`
   feeds `games.generated.ts` (id, order, name/description keys), and
   `src/games/games.ts` only re-exports it. A new family appears after
   `npm run plugins:generate`.
4. **Translations** — the merge in `src/lib/i18n/index.ts` picks the module
   dictionaries up automatically. Add the same keys to `en` and `ru`.
5. **Data** — the edition owns its normalization: `normalize.ts` (defaults,
   field remapping) and `merge.ts` (import merge); both are required module
   fields. Legacy identifiers are declared in `plugin.json#aliases`; the core
   [`src/lib/character-version.ts`](../src/lib/character-version.ts) only
   orchestrates. Never drop fields silently: move values into `notes` and
   return them as warnings.
6. **Visibility** — `defaultStatus` in the manifest is the default; admins can
   override it in `settings/game-catalog.json` via `/admin` (Games & editions).
7. **Tests**:
   - edition-specific unit tests live in `src/games/<id>/tests/unit/` and run
     from the repo root (`npm test`, `npm run test:plugin -- <id>`); the shared
     kit is `@tests/support`, and test-only dependencies are allowed under
     `src/games/<id>/tests/**` only;
   - `npm run plugins:conformance` discovers `src/games/*/plugin.json` and runs
     the manifest↔module contract (entry points, demo vs schema, i18n parity,
     UI slots) — no expected list to edit when a game is added;
   - a copy of `tests/fixtures/example-plugin` proves that a folder + manifest is
     enough — use it as the template (`docs/plugin-sdk.md`);
   - i18n parity (`tests/unit/translations.test.ts`) runs per module;
   - export tests — JSON round-trip and Excel sections for the new module;
   - migration test if legacy data exists;
   - a dummy module test in `game-registry.test.ts` proves that a new edition
     needs no core changes.
8. **Docs** — add the edition to `docs/data-storage.md` (if its fields differ)
   and mention it in the admin visibility table.

## Rules

- The core (`src/app`, `src/components`, `src/lib/export-utils.ts`,
  `src/lib/game-catalog.ts`) must not branch by `gameSystem`.
  UI resolves a module through `src/games/character-system.ts`; server checks go
  through `src/lib/module-access.ts` and `src/lib/game-catalog.ts`.
- Sheet types are discriminated by `systemId`; a sheet never stores a
  human-readable game name.
- Editions are **independent copies**: no `dh-shared`, no shared DH types,
  translations, form or sheet. Divergence between dh1 and dh2 is expected and
  edited in the respective module.
- `src/games/shared` is only a tiny game-agnostic kernel (base character
  fields, quests, combat resources, Excel writer, the tab-scoped
  `creation-review` store); game mechanics and translations never live there.
  Mechanics that look alike are **copies inside each edition** — dh1 and dh2
  each own `dh-stats.ts`, `skill-training.ts` and `creation-review-banner.tsx`
  (`tests/unit/dh-family-parity.test.ts` compares the behaviour of both copies,
  and skips when one edition is absent). Inventory items are per-edition: dh1
  has `quantity`/`weight`/`price`, dh2 has `quantity`/`weight`, dnd5e keeps the
  original `{id, name, status, notes}` shape. Missing numeric fields read as
  defaults (`quantity = 1`) and are not written back until the player saves.
- Export JSON fields and Excel sections are part of the module; the core only
  writes the technical envelope/block.
- Every module declares `defaultStatus` and `createDemo`; hiding a module in the
  catalog affects creation and menus, not opening existing sheets.
- Keep `LANDMARK` comments at the module boundary, registry, catalog and
  migration points.
- Game data belongs to the module: a `src/lib/*` file that only a game reads
  must live in `src/games/<id>/` (`epic-boons.ts`, the DH data packs).
  The folder skeleton and naming rules are in
  [plugin-layout.md](plugin-layout.md).
- A module imports the core only through the lists in
  `scripts/plugins/boundaries.json` (`forbidden`, `allowed`, `legacy`) —
  see [Import boundaries](#import-boundaries).

## Sandbox: a shipped test game

`src/games/sandbox` is a real plugin in the shipping build with
`defaultStatus: "test"`: only testers and admins see it in the creation wizard
and the admin list; an admin can change its visibility in `/admin` like any
other game. It is the executable answer to "what does a game get from the
core?" and is intentionally small:

- its own schema, defaults, demo, export/Excel, migrations and i18n
  (`sandbox.*` keys in its own dictionaries);
- all optional SDK branches: `derive`/`derived`, `import.normalize`/`merge`,
  `history`, a legacy-import converter and a nested companion
  (`findEmbedded`/`updateEmbedded`);
- a custom React sheet and creation form, all six UI slots and its own tab
  icon (`assets/favicon.png`);
- a layout CSS module (`sheet.module.css`) with its own breakpoints, and a
  scoped `ui.theme` (light and dark tokens) — both without a single line in
  `src/app/globals.css`;
- a custom font (Forum): two `woff2` subsets and `OFL.txt` in `assets/`,
  `@font-face` in `sheet.module.css` and `ui.theme.font` in the manifest; the
  sheet's `CardTitle`s opt in with `font-headline`.

The difference from the fixture below: `tests/fixtures/example-plugin` is
copied into temporary folders by unit tests and is never built by Next; the
sandbox is built, rendered by the real app and visible to staff.

## Reference plugin (fixture)

`tests/fixtures/example-plugin/` is a complete, hidden plugin with its own
types, zod schema, defaults, demo, export/Excel, i18n and **custom React sheet
and creation form**, plus `HeaderSubtitle`/`CompactNav`/`CardSummary` slots.
`tests/unit/example-plugin.test.ts` copies it into a temporary `src/games/` and
runs the same generator/conformance checks the shipped plugins go through.

It is the executable form of "new game = folder + `plugin.json` + `sheet.tsx` +
`create-form.tsx` + rebuild": the only core-facing API is
`@/games/plugin-api`, `@/games/types`, the UI kit and the host contexts.

## Import boundaries

`npm run plugins:boundaries` (also part of `npm run verify`) reads
`scripts/plugins/boundaries.json` and checks every file under
`src/games/<id>/`:

| List | Meaning |
| --- | --- |
| `forbidden` | never importable from a module: `@/app*`, `@/instrumentation`, `fs`, `path`, `child_process`, `os` (with `node:` variants). Saving goes through the host API, not the file system. |
| `allowed` | always importable: React, zod, react-hook-form, Radix primitives, lucide icons, `@/components/ui/*`, `@/lib/utils`, `@/lib/i18n`, `@/lib/form-validation`, `@/games/plugin-api` (types), `@/games/plugin-host` (host hooks), and `next/font/local` (exact match only; the rest of `next/*` stays forbidden). |
| `legacy` | debt ratchet. **Empty since stage 5**: plugins no longer import `@/context/*`, `@/hooks/*`, `@/lib/types` or `next/navigation`; the list is kept as the mechanism for future transitional debt. |

`legacy` is a ratchet, not a permission list: adding an import of a listed
module from one more file fails the check, and so does a stale entry after the
imports were removed — fix it with
`npm run plugins:boundaries -- --update`, which recomputes the counters and
keeps the `why`/`removeBy` notes.

Relative imports are only allowed inside the module's own folder and inside
`src/games` core files (`types.ts`, `shared/*`); an import that resolves into
another module's folder fails (editions are independent copies, D10).

### The reverse direction: the core never imports a plugin folder

`npm run plugins:imports` (`scripts/plugins/check-core-imports.mjs`, also in
`npm run verify`) checks that `src/lib`, `src/components`, `src/app`,
`src/context`, `src/hooks`, `src/games/shared` and `src/games/i18n` import only
the contract of `src/games` — `registry*`, `types`, `plugin-api*`,
`plugin-host`, `character-system`, `games*`, `i18n*`, `*.generated` and
`shared/*`. An `@/games/<id>/…` import (or a relative path that resolves into a
plugin folder) fails, because it restores the dependency the layers exist to
remove: removing the game would then break the core.

### Styles are part of the same rule

`npm run plugins:purity` scans the core `.ts/.tsx` files for game names, game
fields and exact game ids in string literals, and the core `.css` files for
game selectors (`.dnd-sheet`, `.dh-sheet`, `dcs-info-grid`, …). A layout
selector for one game in `src/app/globals.css` is the same violation as
`if (systemId === 'dh1')` in code: the layout belongs to the plugin. Current
CSS debt would be pinned by the `CSS_ALLOWLIST` ratchet in
`scripts/plugins/check-core-purity.mjs` (`max` lines per file, `removeBy`): the
number can only go down, and the entry is deleted with the last block. The list
is empty now — the sheet layout lives in the plugins' CSS modules.

## Related

- [architecture.md](architecture.md) — overall layout and startup
- [data-storage.md](data-storage.md) — sheet/profile schemas and the game catalog
- [export-format.md](export-format.md) — envelope 3.0 and module adapters
- [i18n.md](i18n.md) — dictionary layers and rules
- [`src/games/types.ts`](../src/games/types.ts),
  [`src/games/registry.ts`](../src/games/registry.ts)
