# Game modules

How a game or an edition is plugged into the app. Everything game-specific
(sheet type, validation, creation defaults, demo character, translations,
export fields, Excel sections, UI) lives in one module under
`src/games/<systemId>/`; the core only talks to the registry.

## Layout

```text
src/games/
  types.ts                  GameModule contract, SystemId/GameId, statuses
  registry.ts               the single list of modules (createGameRegistry)
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
    types.ts, schema.ts, defaults.ts, demo.ts
    export.ts, excel.ts, epic-boons.ts
    i18n/{en,ru}.ts
    create-form.tsx, sheet.tsx, index.ts
    sections/*.tsx          sheet sections (D&D moved here at plugin stage 0)
  dh1/                      fully self-contained edition module
    types.ts, schemas.ts, schema.ts, defaults.ts, demo.ts
    capabilities.ts, stats.ts
    export.ts, excel.ts
    dark-heresy-data.ts, dark-heresy-ranks.ts, divination-i18n.ts
                            edition data pack (own copy, D10)
    i18n/{en,ru}.ts, i18n/core-{en,ru}.ts   (games.dh1.* + dh1.*)
    create-form.tsx, sheet.tsx
    sections/*.tsx          sheet sections (own copies)
    index.ts
  dh2/                      independent copy of dh1, actualized separately
    (same file set; keys dh2.*)
```

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
| `components.loadCreateForm` / `loadSheet` | Lazy UI entry points (dynamic import). |
| `export.toPortableJson` | JSON field selection for export 3.0. |
| `export.buildExcelSections` | Localized Excel sections. |
| `migrations` | Per-module chain placeholder; data migration lives in `character-version.ts`. |

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
   - `index.ts` — the `GameModule<DH3Character>` object.
2. **Register** in `src/games/registry.ts` (`gameRegistry = createGameRegistry([...])`).
   That is the only core edit.
3. **Game metadata** — only if it is a new game family: add a `GameDefinition`
   to `src/games/games.ts` (id, order, name/description keys).
4. **Translations** — the merge in `src/lib/i18n/index.ts` picks the module
   dictionaries up automatically. Add the same keys to `en` and `ru`.
5. **Data** — if the new system is not covered by the v2 migration, extend
   `resolveSystemId`/`normalizeCharacterRecord` in
   [`src/lib/character-version.ts`](../src/lib/character-version.ts) (or write a
   `v2 → v3` migration step). Never drop fields silently: move values into
   `notes` and report them.
6. **Visibility** — `defaultStatus` in the module is the default; admins can
   override it in `settings/game-catalog.json` via `/admin` (Games & editions).
7. **Tests**:
   - registry test (`tests/unit/game-registry.test.ts`) — add the module id to
     the expected sorted list; the contract test covers defaults vs schema;
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
