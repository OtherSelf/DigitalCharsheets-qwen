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
    types.ts                game-agnostic sheet types
    schema.ts / defaults.ts helpers for schemas and factories
    excel.ts                Excel section writer used by all modules
  dh-shared/                code shared by both Dark Heresy editions
    types.ts, schema.ts, defaults.ts
    capabilities.ts         influence / +30 / fatigueField per edition
    stats.ts                edition-agnostic stat view
    export.ts, excel.ts     shared JSON fields and Excel sections
    i18n/{en,ru}.ts         dh.* keys
    create-form.tsx         parameterized creation form
    sheet.tsx               shared sheet component
  dnd5e/
    types.ts, schema.ts, defaults.ts, demo.ts
    export.ts, excel.ts
    i18n/{en,ru}.ts
    create-form.tsx, sheet.tsx, index.ts
  dh1/  dh2/                same set; thin wrappers over dh-shared
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
| `capabilities` | Feature flags for shared DH components. |
| `createDefaults()` | Character draft (no `id`) for forms/tests. |
| `createDemo()` | Demo character for `/demo` (no `id`). |
| `components.loadCreateForm` / `loadSheet` | Lazy UI entry points (dynamic import). |
| `export.toPortableJson` | JSON field selection for export 3.0. |
| `export.buildExcelSections` | Localized Excel sections. |
| `migrations` | Per-module chain placeholder; data migration lives in `character-version.ts`. |

## Adding a new edition (example: `dh3`)

1. **Module folder** `src/games/dh3/`:
   - `types.ts` — `DH3Character` extends the shared DH base and adds only 3e
     fields; `systemId: 'dh3'`.
   - `schema.ts` — full zod schema, typed `z.ZodType<DH3Character>`.
   - `defaults.ts` — `createDh3Defaults(input)`; reuse `dh-shared/defaults`.
   - `demo.ts` — `createDh3Demo()`.
   - `i18n/en.ts`, `i18n/ru.ts` — `games.dh3.*` plus 3e-only keys.
   - `export.ts` — `buildDh3PortableJson` (or reuse the shared DH builder).
   - `excel.ts` — `buildDh3ExcelSections` (or reuse `dh-shared/excel.ts`
     with a capability config).
   - `create-form.tsx`, `sheet.tsx` — thin wrappers over shared DH components.
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
- Editions are independent types: no optional “shared + edition” fields, no
  runtime edition switch. Shared code belongs to `dh-shared` and is configured
  by `capabilities`.
- Export JSON fields and Excel sections are part of the module; the core only
  writes the technical envelope/block.
- Every module declares `defaultStatus` and `createDemo`; hiding a module in the
  catalog affects creation and menus, not opening existing sheets.
- Keep `LANDMARK` comments at the module boundary, registry, catalog and
  migration points.

## Related

- [architecture.md](architecture.md) — overall layout and startup
- [data-storage.md](data-storage.md) — sheet/profile schemas and the game catalog
- [export-format.md](export-format.md) — envelope 3.0 and module adapters
- [i18n.md](i18n.md) — dictionary layers and rules
- [`src/games/types.ts`](../src/games/types.ts),
  [`src/games/registry.ts`](../src/games/registry.ts)
