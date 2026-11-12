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
  games.ts                  game families (D&D, Dark Heresy) + order + i18n keys
  character-system.ts       systemId resolution and i18n name keys for UI
  i18n/{en,ru}.ts           registry/wizard metadata (games.*)
  shared/
    types.ts                game-agnostic primitives (CharacterBase, quests,
                            inventory) — no game mechanics or translations
    schemas.ts              shared zod primitives for those types
    defaults.ts             readNumber/readString defaults helpers
    excel.ts                generic Excel section writer used by all modules
  dnd5e/
    plugin.json             manifest: id, order, entry points, i18n, demo
    types.ts, schema.ts, defaults.ts, demo.ts
    normalize.ts, merge.ts   legacy normalization + import merge
    export.ts, excel.ts, epic-boons.ts
    i18n/{en,ru}.ts
    create-form.tsx, sheet.tsx, index.ts
    sections/*.tsx          sheet sections (D&D moved here at plugin stage 0)
    slots/*                 header/card/compact-nav slot components
  dh1/                      fully self-contained edition module
    plugin.json             manifest (own copy, not shared with dh2)
    types.ts, schemas.ts, schema.ts, defaults.ts, demo.ts
    normalize.ts, merge.ts   legacy normalization + import merge (own copies)
    capabilities.ts, stats.ts
    export.ts, excel.ts
    dark-heresy-data.ts, dark-heresy-ranks.ts, divination-i18n.ts
                            edition data pack (own copy, D10)
    i18n/{en,ru}.ts, i18n/core-{en,ru}.ts   (games.dh1.* + dh1.*)
    create-form.tsx, sheet.tsx
    sections/*.tsx          sheet sections (own copies)
    slots/*                 header/card/compact-nav slot components
    index.ts
  dh2/                      independent copy of dh1, actualized separately
    (same file set; keys dh2.*)
```

## Plugin manifest

Every module folder has a `plugin.json` (`src/games/plugin.schema.json`):

```json
{
  "manifestVersion": 1,
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
  "schemaVersion": 2,
  "game": { "id": "darkHeresy", "order": 20, "name": { "en": "…", "ru": "…" } },
  "dependencies": { "host": "^1.0.0", "plugins": {} },
  "entry": { "module": "index.ts#dh1Module" },
  "sheet": { "mode": "custom", "client": "sheet.tsx", "createForm": "create-form.tsx" },
  "i18n": { "en": "i18n/en.ts", "ru": "i18n/ru.ts" },
  "demo": { "entry": "index.ts#createDemo" },
  "export": { "json": "index.ts#toPortableJson", "excel": "index.ts#buildExcelSections" },
  "migrations": [],
  "tests": { "conformance": ">=1" }
}
```

Rules:

- `id` equals the folder name and the sheet `systemId`; `version` is semver.
- `name`/`description` are the display source (admin, creation wizard); other
  strings stay in `i18n/*`.
- `game` is the family block (D17): every edition of one `gameId` declares the
  same `id`/`order`/`name`, and the generator fails if they differ.
- `entry.module` is `<file>#<export>`; `demo`/`export`/`migrations` are entry
  points too. The manifest member must be a real named export — the
  `plugins-registry` test checks every reference against the module namespace.
- `dependencies.plugins` is reserved (D14); `dependencies.host` is the Plugin
  API range checked by the generator.
- `pluginApi` is checked against the host version (`^`, `~`, `>=`, exact, `*`).
- `aliases` maps legacy `gameSystem`/`edition` values to the plugin; the most
  specific alias wins (`{gameSystem, edition:'2nd'}` beats `{gameSystem}`).
- `migrations` order is the apply order; a non-empty chain must cover
  `1 → … → schemaVersion` without gaps (the generator checks it). Migrations
  still live in the core until stage 2, so all three manifests are empty today.
- `import` (normalize/merge), `ui.slots` and `aliases` are declared in the
  schema for stages 2–3 and are optional until then.

`registry.generated.ts` and `i18n.generated.ts` are produced by
`npm run plugins:generate` (also `predev`/`prebuild`) from the manifests;
`npm run plugins:check` is part of `npm run verify` and fails if either file is
stale. `registry.ts` no longer contains a hand-written list — it only
re-exports the generated plugins and helpers (`gameRegistry`,
`listGamePlugins`, `getPluginManifest`).

`i18n.generated.ts` exists because `src/lib/i18n` must be importable before the
registry is initialised (language context is imported by plugin UI slots); it
contains only dictionaries, no modules or UI.

UI slots are part of the module object (`ui`). The host components read them
through the registry:

```tsx
const plugin = getCharacterModule(character);
plugin?.ui?.HeaderSubtitle?.(character, t);
plugin?.ui?.CardSummary?.(character, t);
{plugin?.ui?.HeaderActions && (
  <plugin.ui.HeaderActions character={character} isCompactView={isCompactView} />
)}
```

The sheet itself is loaded lazily (`components.loadSheet`), so a render error in
a plugin shows the *sheet unavailable* card instead of breaking the page; the
header, sidebar, dialogs and JSON export keep working.

`BulkEditor` is data, not a component: the plugin returns
`BulkEditorTable[]` (`ui.bulkEditor`) and the host (`/stats-editor`) renders the
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
| `schemaVersion` | Current sheet schema version written by the module (2). |
| `schema` | Zod schema; `ZodType<TCharacter>` makes `tsc` check it against the type. |
| `i18n` | `{ en, ru }` dictionaries, merged by the core. |
| `capabilities` | Fixed feature flags of the module (influence, +30, fatigue field). |
| `createDefaults()` | Character draft (no `id`) for forms/tests. |
| `createDemo()` | Demo character for `/demo` (no `id`). |
| `components.loadCreateForm` / `loadSheet` | Lazy UI entry points; the host wraps the sheet in `Suspense` + `ErrorBoundary` and passes a typed `ref: SheetHandle` (`saveAll()`). |
| `ui` | Optional UI slots (stage 3): `HeaderActions`, `HeaderSubtitle`, `CompactNav`, `BulkEditor`, `CardSummary`, `HouseRulesDialog` + static `favicon`. The host renders a neutral fallback when a slot is missing. |
| `export.toPortableJson` | JSON field selection for export 3.0. |
| `export.buildExcelSections` | Localized Excel sections. |
| `normalize(raw, options?)` | Legacy normalization: remaps fields per edition and (with `applyDefaults`) fills missing structures. Replaces the core's `normalizeCharacter`/`normalizeCharacterRecord` branches (stage 2). |
| `merge(target, source, config)` | Import merge; replaces the core's `isDnd/isDh1/isDh2` branches (stage 2). |
| `migrations` | Per-module chain; the v1→v2 transformation itself lives in `normalize` (idempotent), the explicit chain runner is stage 4. |

## Adding a new edition (example: `dh3`)

1. **Module folder** `src/games/dh3/`:
   Start by copying `src/games/dh1/` as a template (that is how `dh2`
   began), then actualize it independently. Do **not** extract a shared
   DH core: each edition owns its types, schema, defaults, capabilities,
   stats, exports, translations, form, sheet and sections.
   - `types.ts` — base Dark Heresy types + `DH3Character`; `systemId: 'dh3'`.
   - `schemas.ts` / `schema.ts` — base schema + full `ZodType<DH3Character>`.
   - `defaults.ts` — base defaults + `createDh3Defaults(input)`.
   - `demo.ts` — `createDh3Demo()`.
   - `capabilities.ts`, `stats.ts` — fixed 3e flags and stat view.
   - `i18n/en.ts`, `i18n/ru.ts` + `i18n/core-{en,ru}.ts` — `games.dh3.*`
     and `dh3.*` keys.
   - `export.ts`, `excel.ts` — `buildDh3PortableJson` / `buildDh3ExcelSections`.
   - `create-form.tsx`, `sheet.tsx`, `sections/*` — own UI copies.
   - `index.ts` — the `GameModule<DH3Character>` object plus the named entry
     points the manifest references (`createDefaults`, `createDemo`,
     `toPortableJson`, `buildExcelSections`).
   - `plugin.json` — the manifest (see *Plugin manifest*).
2. **Manifest** — add `src/games/dh3/plugin.json` (see *Plugin manifest*
   above) and run `npm run plugins:generate`. The registry is generated; no
   core edit is needed.
3. **Game metadata** — only if it is a new game family: add a `GameDefinition`
   to `src/games/games.ts` (id, order, name/description keys).
4. **Translations** — the merge in `src/lib/i18n/index.ts` picks the module
   dictionaries up automatically. Add the same keys to `en` and `ru`.
5. **Data** — the edition owns its normalization: `normalize.ts` (defaults,
   field remapping) and `merge.ts` (import merge). Legacy identifiers are
   declared in `plugin.json#aliases`; the core
   [`src/lib/character-version.ts`](../src/lib/character-version.ts) only
   orchestrates. Never drop fields silently: move values into `notes` and
   return them as warnings.
6. **Visibility** — `defaultStatus` in the manifest is the default; admins can
   override it in `settings/game-catalog.json` via `/admin` (Games & editions).
7. **Tests**:
   - registry tests (`tests/unit/game-registry.test.ts` and
     `tests/unit/plugins-registry.test.ts`) — add the module id to the expected
     sorted list; the manifest↔module contract test then covers the new plugin
     automatically (entry points, demo vs schema, i18n parity, migrations);
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
  fields, quests, inventory, Excel writer); game mechanics and translations
  never live there.
- Export JSON fields and Excel sections are part of the module; the core only
  writes the technical envelope/block.
- Every module declares `defaultStatus` and `createDemo`; hiding a module in the
  catalog affects creation and menus, not opening existing sheets.
- Keep `LANDMARK` comments at the module boundary, registry, catalog and
  migration points.
- Game data belongs to the module: a `src/lib/*` file that only a game reads
  must move into `src/games/<id>/` (`epic-boons.ts` did in stage 0, the DH
  data packs started as copies in dh1/dh2).
- A module imports the core only through the lists in
  `scripts/plugins/boundaries.json` (`forbidden`, `allowed`, `legacy`) —
  see [Import boundaries](#import-boundaries).

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
| `allowed` | always importable: React, zod, react-hook-form, Radix primitives, lucide icons, `@/components/ui/*`, `@/lib/utils`, `@/lib/i18n`, and (from stage 1) `@/games/plugin-api`. |
| `legacy` | core imports that still exist while the core is being decoupled (stages 2–3). Every entry has `files` (how many module files import it), `removeBy` (plan stage) and `why`. |

`legacy` is a ratchet, not a permission list: adding an import of a listed
module from one more file fails the check, and so does a stale entry after the
imports were removed — fix it with
`npm run plugins:boundaries -- --update`, which recomputes the counters and
keeps the `why`/`removeBy` notes.

Relative imports are only allowed inside the module's own folder and inside
`src/games` core files (`types.ts`, `shared/*`); an import that resolves into
another module's folder fails (editions are independent copies, D10).

## Related

- [architecture.md](architecture.md) — overall layout and startup
- [data-storage.md](data-storage.md) — sheet/profile schemas and the game catalog
- [export-format.md](export-format.md) — envelope 3.0 and module adapters
- [i18n.md](i18n.md) — dictionary layers and rules
- [`src/games/types.ts`](../src/games/types.ts),
  [`src/games/registry.ts`](../src/games/registry.ts)
