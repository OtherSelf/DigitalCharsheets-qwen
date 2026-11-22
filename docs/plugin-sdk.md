# Plugin SDK (v1.4)

How to add a game or an edition to Digital Character Sheets. Everything
game-specific lives in one folder under `src/games/<id>/`; the core only talks
to the generated registry and the plugin contracts. A plugin is a folder plus a
manifest plus a rebuild — no runtime code loading (D1), no ZIP/upload (D5).

Status: **v1.4**, manifest `manifestVersion: 2`, `pluginApi: ^1.0.0`
(1.1 added optional history labels; 1.2 adds `CreateFormCompletion` and
generated game metadata; 1.3 allows a plugin to declare only one of the site
languages and additional locale dictionaries; 1.4 adds the scoped
`ui.theme` block. `manifestVersion 2` makes `game.description` required —
manifests without it must be updated).

## Quick start (new plugin in an evening)

A complete working example ships with the app: `src/games/sandbox` (visible to
testers and admins only, `defaultStatus: "test"`) — own CSS module, scoped
theme, slots, demo and export. Use it next to the scaffold when you want to see
a finished plugin instead of a template.

1. **Copy a template.** The smallest complete plugin is the conformance fixture
   [`tests/fixtures/example-plugin/`](../tests/fixtures/example-plugin): types,
   zod schema, defaults, demo, export/Excel, JSON dictionaries, a custom React
   sheet and form, UI slots and `plugin.json`.
2. **Create the folder** `src/games/<id>/` (the folder name must equal `plugin.json#id`).
3. **Write `plugin.json`** (see [Manifest](#manifest)): `id`, `gameId`,
   `version`, `order`, `name`/`description` (at least one of `en`/`ru`),
   `schemaVersion`, the family block `game`, entry points, `sheet`, `i18n`,
   `demo`, `export`, `migrations`.
4. **Implement the module** in `index.ts` and export it from the `entry.module`
   point: `index.ts#<id>Module`. Export the other entry points the manifest
   references (`createDemo`, `toPortableJson`, `buildExcelSections`, …).
5. **UI**: `sheet.tsx` and `create-form.tsx`; optional `ui.ts` with the UI slots.
6. **Dictionaries**: `i18n/<locale>.json` for every declared locale (at least
   one of `en`/`ru`) with the same key set, keys namespaced `<id>.*`. Extra
   locales are allowed but only `en`/`ru` are shown by the site. Family
   metadata (`game.*`) comes from the manifest, not from these dictionaries.
7. **Generate and check**:
   ```bash
   npm run plugins:generate     # registry/i18n/games.generated.ts
   npm run plugins:check        # manifests ↔ registry
   npm run plugins:boundaries   # import rules
   npm run plugins:conformance  # plugin contract (unit set)
   npm run verify               # everything together
   ```
   The plugin appears in `/new`, `/demo`, `/admin` (per catalog/F) and its
   sheets open via `/api/...` and `/<characterId>`.
8. **Do not edit the core.** If the plugin needs a new host capability, add it
   to `src/games/plugin-api.ts` + `types.ts` and to the docs here; otherwise
   only the plugin folder changes.

## Renaming the template

Copying the fixture is half the job: the fields below are part of the contract,
not styling. `npm run plugins:scaffold -- <id>` performs exactly these
replacements (the same `scripts/plugins/rename-plugin.mjs` drives the
`plugin-template` gate), so a manual copy has a checklist instead of a guess.

```bash
npm run plugins:scaffold -- mygame            # folder + rename + plugins:generate
npm run plugins:scaffold -- mygame --game myFamily --order 60 --title "My Game"
```

| Where | Fixture value | Becomes |
| --- | --- | --- |
| Folder | `tests/fixtures/example-plugin/` | `src/games/<id>/` (the name must equal `plugin.json#id`) |
| `plugin.json#id`, module `id`, draft `systemId` | `example` | `<id>` (one constant, not three literals) |
| `plugin.json#gameId`, `game.id`, module `gameId` | `exampleGame` | the family id (`<id>Game` for a new family) |
| `plugin.json#game.name` / `game.description` | `Example Game` | your family text, both `en` and `ru` |
| `plugin.json#order`, `game.order` | `90` | unique across plugins (the generator rejects a duplicate) |
| `plugin.json#defaultStatus` | `hidden` | `published`, `test` or `hidden` |
| `plugin.json#version` | `0.2.0` | `0.1.0` for a new plugin |
| `entry.module` and the export in `index.ts` | `index.ts#exampleModule` | `index.ts#<id>Module` |
| `nameKey`, `descriptionKey` | `example.name` | `<id>.name` |
| Dictionary keys and every `t('…')` | `example.*` | `<id>.*` (full namespace, no bare keys) |
| `shortCode` | `example` | `<id>` (unique, lowercase) |
| `author`, `tags`, `aliases` | `tests`, `example` | yours |
| `schemaVersion` + `migrations` | `2`, one step | your version with steps `1 → … → schemaVersion` |

After renaming run `npm run plugins:generate`, `npm run plugins:check` and
`npm run verify`; the fixture gate (`tests/unit/plugin-template.test.ts`) does
the same on a renamed copy, so a rename that misses a field fails CI.

Four values are declared **twice** — in the manifest and in the module object —
and the generator plus `plugins-registry.test.ts` compare them field by field:
`id`, `gameId` (and `game.id`), `order`, `defaultStatus`. Change both, or the
contract fails with `expected 'published' to be 'hidden'`. `schemaVersion` is
the same story (`plugin.json` and the module).

Display names and descriptions must be genuinely translated: the i18n suite
fails on a `ru` value that is byte-identical to `en` (`ZZ Probe` works as a
placeholder, but not as a translation).

If you edited `plugin.json` (or any file) by hand, run `npm run format` before
`verify`: the gate starts with `prettier --check`, and formatting is not a
contract change. `plugins:scaffold` formats its output itself.

## Folder layout

```text
src/games/<id>/
  plugin.json          manifest (source of truth for metadata)
  index.ts             GameModule + named entry points (manifest `entry`)
  types.ts             sheet type (extends CharacterRecord)
  schema.ts            zod schema (schemaVersion matches the manifest)
  defaults.ts          createDefaults() (no id)
  demo.ts              createDemo() (no id)
  export.ts            toPortableJson() fields for export 3.0
  excel.ts             buildExcelSections()
  normalize.ts         legacy/imported sheet → your type (+ warnings), required
  merge.ts             import merge (partial patch over an existing sheet), required
  create-form.tsx      custom creation form
  sheet.tsx            custom sheet, forwardRef<SheetHandle>
  ui.ts                optional UI slots (manifest `ui.entry`)
  slots/*.tsx          slot components/functions imported by ui.ts
  assets/*             icons and images imported by the plugin (favicon)
  bulk-editor.ts       tables for /stats-editor (ui.BulkEditor)
  i18n/en.json, ru.json
  legacy-import.ts     optional Firestore/2.x importer for your game
```

Rules summary: keep everything game-specific inside the folder; do not import
`next/*`, `@/app`, `@/lib/*` (except `@/lib/utils`, `@/lib/i18n`, `@/lib/form-validation`), `fs` or
`child_process`; resolve host services through `@/games/plugin-api` (types) and
`@/games/plugin-host` (hooks) and the UI kit. `npm run plugins:boundaries`
enforces this and the `legacy` allowlist is now **empty** (see
[game-modules.md](game-modules.md) § Import boundaries).

## Host API (runtime hooks)

`@/games/plugin-host` (`'use client'`) is the only allowed way to reach host
state from a plugin component:

| Hook | Purpose |
| --- | --- |
| `useCharacterContext()` | read/update sheets (`getCharacter`, `updateCharacter`, `addCharacter`, `deleteCharacter`, `showEditButtons`, `hideNotes`, `isCompactView`, `toast`, …) |
| `useTranslation()` | `t(key)` for the current language (always full `ns.key`) |
| `useToast()` | host toasts |
| `NarrativeSheet` | right-hand Sheet for `notes`/`backstory`: markdown view, smart mode (empty opens in edit), Edit/Save/Cancel inside the Sheet |
| `ConditionsList` | structured conditions list (kind/name/severity/effect/notes/source) with add/remove; labels come from the plugin dictionary, the shapes live in the edition types |
| `ExperienceLogSheet` | right-hand XP journal Sheet: rows are prepared by the plugin adapter (`label/cost/createdAt`, optional `kind`), deletion is delegated to the plugin callback |

The module re-exports the host hooks and the shared sheet components (`NarrativeSheet`,
`ConditionsList`, `ExperienceLogSheet`), so plugin internals stay decoupled from
`@/context/*` / `@/hooks/*` and the boundary test keeps zero legacy entries.
Types come from `@/games/types` / `@/games/plugin-api`; only the plugin's own
`types.ts` describes the sheet shape.

## Manifest

Authoritative JSON Schema: [`src/games/plugin.schema.json`](../src/games/plugin.schema.json).
Validated by `scripts/plugins/generate.mjs` (Ajv) on every generation/verify.

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
  "ui": { "slots": ["HeaderActions", "HeaderSubtitle", "CompactNav", "BulkEditor", "CardSummary", "HouseRulesDialog"], "entry": "ui.ts" },
  "aliases": [{ "gameSystem": "Dark Heresy", "edition": "1st" }],
  "derive": { "entry": "index.ts#deriveCharacter" },
  "derived": ["skills[].training.skilled", "skills[].training.plus10"],
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

- `id` equals the folder and the sheet `systemId`; `version` is semver.
- `order` is the display position of an edition and must be **unique across all
  plugins**; a duplicate fails the generator (`validateCollection`), not just
  the sort. The family order lives in `game.order` and is unique per family.
- `name`/`description` are the display source (admin, wizard); they declare at
  least one of `en`/`ru` and may carry extra locales. Other strings live in
  `i18n/<locale>.json`. `tags` are stored but not shown in UI (D15).
- `game` is the family block (D17): every edition of one `gameId` declares the
  same `id`/`order`/`name`/`description`; the generator fails on mismatch.
  These fields are the only source of the game list and of its UI labels.
- Entry points are `<file>#<export>`. `entry.module` points at the module
  object; `demo`/`export`/`derive`/`migrations` at functions. The generator
  checks the files, the conformance test checks the exports against the module
  namespace.
- Exports are checked by `npm run deadcode:check`: an export that nothing
  references (and that `plugin.json` does not name) fails the gate. The public
  surface of a plugin is its manifest entry points plus what host code imports;
  everything else stays private.
- `derive` and `derived` come in pairs: a declared entry point without a field
  list (or the other way round) fails the generator. Paths use `[]` for array
  items (`skills[].value`); every declared path must exist in the sheet.
- `sheet.mode` is currently `"custom"` only; the plugin owns its React sheet and
  form (D3).
- `schema.ts` is the only description of sheet fields the host has (OpenAPI is
  generated from it), so numeric and text domains must be **bounded in zod**
  (`min`/`max`/`length`): the negative conformance check
  (`plugin-conformance.test.ts`) saves an out-of-range value and expects the
  schema to reject it. A schema without bounds accepts `stats.might: 999`.
  The top-level object must be **`z.looseObject`**: the host stores service
  fields (`userId`, timestamps) that are not part of your type, and a strict
  `z.object` strips them when the sheet is written.
- `i18n` is a locale map (`"en": "i18n/en.json"`): declare at least one of
  `en`/`ru`, extra locale codes are validated. It may point at `.json`
  (preferred, D13) or `.ts` (legacy). Every declared locale must expose the same
  key set.
- `ui.entry` is a module exporting `uiSlots: GameUiSlots`; it is loaded lazily
  (dynamic import) so React components never enter the shared bundle.
- `aliases` resolve legacy `gameSystem`/`edition` values to your `systemId`; the
  most specific alias wins. A sheet whose legacy fields match no alias (and that
  has no `systemId`) is **not** guessed: it opens read-only with the
  `plugin_missing` banner (ADR 0004). Declare a bare `gameSystem` alias only if
  that name really is unambiguous for your game.
- `dependencies.host` is the Plugin API range checked by the generator;
  `dependencies.plugins` is reserved (D14).
- `migrations` order is the apply order; the chain must cover
  `1 → … → schemaVersion` without gaps. **`schemaVersion > 1` with an empty
  chain is a manifest error**, so `npm run plugins:check` fails the build instead
  of silently accepting a versioned sheet format without a path from v1. The
  runner applies steps in order, only to sheets older than the step, and writes
  a `.bak` before the first migrated rewrite. Unknown future versions are never
  overwritten. A step may declare `removes: ["edition"]` — the top-level fields
  it deletes on purpose (values must be carried over, usually into `notes`);
  the lossless check in `tests/unit/plugins-migration-chain.test.ts` allows only
  those keys to disappear.
- `tests.conformance` is metadata for CI/admin, never executed at runtime (D7).

## Game families and the generated list

- A game family is defined **only** by the `game` blocks of manifests. The
  generator emits three files: `registry.generated.ts` (editions),
  `i18n.generated.ts` (module dictionaries plus `games.generated.<id>.*`
  labels) and `games.generated.ts` (family list). Core has no hand-written
  list of games.
- Adding or removing a game/edition = add/remove the folder + `plugin.json`,
  run `npm run plugins:generate`, then `npm run verify` and rebuild. No core
  edits are needed; `npm run plugins:check` (part of verify) fails on drift.
- The registry is **build-time** (D1): `npm start` serves the compiled `.next`
  output, so regenerate before the build, not at server start. The same applies
  to dictionaries and the family list.

## Module contract

`GameModule<TCharacter>` ([`src/games/types.ts`](../src/games/types.ts)) — see
[game-modules.md](game-modules.md#contract) for the field table. Key points:

- `createDefaults()` / `createDemo()` return drafts without `id`.
- `normalize(raw, options)` — **required.** Idempotent legacy normalization;
  with `options.applyDefaults` it also fills missing structures (import path).
  Every registered plugin must expose it as a function
  (`plugins-registry.test.ts`).
- `merge(target, source, config)` — **required.** Import merge; the host only
  checks that both sides are the same edition. Same gate as `normalize`.
- `migrations` — ordered chain (see above).
- `derive` — optional pure function that recomputes derivative fields from the
  primary ones (`index.ts#deriveCharacter`). It is declared in the manifest as
  an entry point plus an explicit `derived` list of field paths, and the host
  calls it when a sheet is written, so a document saved by any client stays
  consistent (`level: 5` always comes with `proficiencyBonus: 3`). The same
  function is what the plugin itself calls on the client: formulas live in one
  place. Requirements: no input mutation, idempotent, no `schemaVersion`
  change, no fields added or removed at the top level, no dependence on key
  order. `tests/unit/plugins-derive.test.ts` enforces all of them for every
  discovered plugin.
- `findEmbedded` / `updateEmbedded` — optional nested entities (D&D companions)
  addressed by a virtual id (`companion-*`); the core only knows the id format.
- `matchesLegacyImport` / `legacyImportName` / `convertLegacyImport` — optional
  Firestore/2.x converter for your game, used by the offline migration (the old
  `/api/import` endpoint was removed).
- `ui` is not set on the module object anymore — slots live in `ui.ts`.
- `history` (SDK 1.1, optional) — `labels` (`path → i18n key`), `collections`
  (array path → title key), `itemLabelFields`, `valueLabels` (code → key), an
  optional `formatValue(path, value, t)` for values that need a parser (arrays
  of ids, nested objects, enums) and `tokens` (yes/no, quest/item status keys).
  All keys must live in the module dictionary; shared sheet/quest fields may
  use the documented `HISTORY_SHARED_KEYS` allowlist. Unknown paths fall back
  to a humanised path; unknown values fall back to a readable representation.

## UI slots

The host renders a slot when it is present and a neutral fallback otherwise, so
no `if (gameSystem === …)` is needed in the core (D11).

| Slot | Shape | Host place |
| --- | --- | --- |
| `HeaderActions` | component `{ character, isCompactView }` | sheet header |
| `HeaderSubtitle` | `(character, t) => string` | header subtitle |
| `CompactNav` | `(character) => { id, labelKey, icon }[]` | mobile sidebar |
| `BulkEditor` | `BulkEditorTable[]` (data, see below) | `/stats-editor` |
| `CardSummary` | `(character, t) => { text, badgeVariant? }` | dashboard card |
| `HouseRulesDialog` | component `{ characterId, open, onOpenChange }` | rules dialog |
| `favicon` | `string` (URL of an asset imported from `assets/`) | tab icon |

The sheet itself is loaded lazily (`components.loadSheet` = dynamic import) and
wrapped in `Suspense` + `ErrorBoundary`: a render error shows the *sheet
unavailable* card, while the header, dialogs and JSON export keep working. The
sheet receives `ref: SheetHandle` and must implement `saveAll()`.

### Bulk editor (`/stats-editor`)

`ui.BulkEditor` is an array of tables; the host owns the page, tabs, edit state
and save buttons:

```ts
interface BulkEditorTable<T> {
  id: string;
  tab: { id, labelKey, order, showCount?, saveAllLabelKey, saveAllDoneKey, emptyKey? };
  order: number;                 // card order inside the tab
  titleKey: string; descriptionKey: string;
  editionNameKey?: string;       // «Dark Heresy · 1st Edition (3)»
  minWidth: number; gridTemplate?: string; gap?: 1 | 2;
  saveOneKey: string;
  columns: { key, labelKey, type?, min?, max?, value(character) }[];
  apply(character, values): Partial<T>;
}
```

`stats` is a shared tab; vitals tabs are per game/edition. Values are unioned
across columns for the save patch — the host never inspects game mechanics.

## Sheet and form

`sheet.tsx` — a client component with the props of `GameSheetProps<T>` and a
`ref` to `SheetHandle`:

```tsx
export const MySheet = React.forwardRef<SheetHandle, GameSheetProps<MyCharacter>>(
  ({ character, isCompactView, activeCompactSection }, ref) => {
    React.useImperativeHandle(ref, () => ({ saveAll }));
    return <div className={isCompactView ? 'is-compact' : undefined}>…</div>;
  },
);
```

Sections (`sections/*.tsx`) and accordions are ordinary React; use the host UI
kit (`@/components/ui/*`) and `useTranslation()`. If a section is part of the
compact navigation, its `id` must match the `CompactNav` item id: the page
scrolls `main` to exactly that element. The rule is enforced, not assumed — the
mobile scenario `контракт CompactNav` in `tests/visual/basic-pages.spec.ts`
walks the rail buttons (`data-section-id`), checks that every id resolves to a
non-empty element and that it lands in the frame, so a new edition is covered
without test edits.

`create-form.tsx` — receives one optional prop,
`onCreated(characterId, completion?)`. It reads `useCharacterContext()`
(addCharacter), calls `createDefaults()` and calls `onCreated` after the server
created the sheet. Navigation belongs to the host, so `next/navigation` is not
imported by plugins at all.

`completion` is an optional `CreateFormCompletion` (any game may use it):
`openNotes: true` asks the host to open the new sheet's Notes panel once. The
host removes that request from the URL after opening, so a refresh does not
reopen the panel. Core does not inspect game data to decide this — the plugin
knows whether it wrote something worth showing.

The only shared piece of this flow is `@/games/shared/creation-review` (allowed
by the import boundaries): a tab-scoped store of sheets being reviewed after
import, written by the core's import dialog. The banner itself is the edition's
own `creation-review-banner.tsx` — UI and rules are not shared between editions
(D10). Both are opt-in: the plugin decides which fields are required and
supplies the translated strings; a plugin that never calls the helper renders as
before.

## i18n

- Dictionaries live in `i18n/<locale>.json` (JSON, D13). A plugin may ship only
  one of the site languages, and may add extra locales.
- All **declared** locales must have the same key set; keys are namespaced
  `<id>.*`. `name`/`description` of the plugin come from the manifest.
- The host merges dictionaries in `src/lib/i18n` from the generated
  `i18n.generated.ts` (dictionaries only — no React/registry imports there).
  For each site language it takes that dictionary, or the other site language
  when the first is not declared; extra locales are stored but not shown.
  Duplicate keys across layers are a startup error.
- `t()` never guesses: a missing key renders as the key itself, so always pass
  the full `namespace.key`.
- Every dictionary key must be referenced by code: each edition's
  `tests/unit/i18n-labels.test.ts` scans static literal keys and template
  prefixes and fails on an unused key. Keys built at runtime are declared
  explicitly in that test's `DYNAMIC_PREFIXES`, so a new dynamic family is
  added together with the code that needs it.

## Tests (conformance)

There is no separate package yet; the conformance set runs in Vitest:

```bash
npm run plugins:conformance
```

`npm run plugins:conformance` runs **only**
`tests/unit/plugin-conformance.test.ts`. The contract is split across several
host suites, and each line below names the file that actually checks it:

| Check | Where |
| --- | --- |
| Generated `registry.generated.ts`, `i18n.generated.ts`, `games.generated.ts` match the manifests byte-for-byte | `npm run plugins:check` (`generate.mjs --check`); the unit suite re-renders `registry.generated.ts` |
| Generator output is prettier-clean for any plugin id | `tests/unit/plugins-generator.test.ts` |
| Manifest ↔ module: id/gameId/order/defaultStatus/schemaVersion, entry points as real named exports, migration chain matches the module | `tests/unit/plugins-registry.test.ts` |
| Defaults and demo pass the module's zod schema; en/ru dictionaries have the same keys; declared UI slots are implemented and non-empty; out-of-range data is rejected (negative TCK); portable JSON round-trip | `tests/unit/plugin-conformance.test.ts` |
| UI slots are exactly the declared set (no extras), load lazily, `CompactNav` items carry `icon` and full i18n keys | `tests/unit/plugin-slots.test.ts` |
| Every plugin declares `BulkEditor`; the `stats` tab comes first; table ids are unique and prefixed with the plugin id; every label key exists in both languages; the save patch does not mutate the sheet | `tests/unit/bulk-editor.test.ts` |
| A copy of the reference fixture under another id passes the folder, collection, registry and module contract (the "folder + manifest is enough" promise) | `tests/unit/plugin-template.test.ts` |
| The reference fixture itself implements the module contract | `tests/unit/example-plugin.test.ts` |

Host-side behaviour is covered by `tests/unit/game-catalog.test.ts`
(visibility/enabled, v1→v2 migration), `games-api.test.ts` (role matrix,
disabled plugin, admin metadata), `character-system.test.ts` (aliases,
read-only state) and the Playwright visual suite.

## Runtime states (catalog)

State is stored in `<data-dir>/settings/game-catalog.json` (v2, D6/D16):

- `visibility` (`published|test|hidden`) — who sees the plugin in creation,
  menus and `/demo`;
- `enabled` — whether it can be used to create new sheets. `false` → hidden
  from creation/menus/demo, existing sheets open **read-only** with a banner,
  JSON export still works (D9). A plugin removed from the build renders as raw
  JSON with export.

`/api/games` exposes the per-role catalog plus a `disabled` id list; the sheet
page uses it to switch to read-only mode.

## API schema

The plugin's `schema` (zod) is the only description of sheet fields the host
has, so the OpenAPI document is generated from it: `Sheet_<systemId>` is the
stored shape, `SheetInput_<systemId>` the request shape, and the `schemaVersion`
in each component description comes from your manifest. Changing `schema.ts`
without bumping `schemaVersion` is therefore visible in `/api/docs`, and
`tests/unit/openapi.test.ts` fails if a demo sheet stops matching the published
schema.

## Troubleshooting

The generator prints Russian diagnostics (repository convention; the code, test
names and tool messages are Russian, these pages are English). The most common
ones:

| Message | Cause | Fix |
| --- | --- | --- |
| `id "x" не совпадает с именем папки "y"` | The folder name and `plugin.json#id` differ | Rename the folder or the manifest `id`; they are one `systemId` |
| `i18n: нужна хотя бы одна из локалей en или ru (SDK 1.3)` | The `i18n` map declares only extra locales | Declare `en` and/or `ru`; extra locales are allowed on top |
| `migrations: schemaVersion N, но цепочка пуста` | Versioned sheet format without a path from v1 | Add steps `1 → … → N`, or keep `schemaVersion: 1` |
| `migrations: ожидался шаг с N, найден с M` | A gap in the chain | Start at `from: 1` and increment by one |
| `migrations: шаг N должен вести в N+1` | A jump (`1 → 3`) | Split the step; each one moves exactly one version |
| `migrations: цепочка заканчивается на N, а schemaVersion = M` | The chain and the manifest disagree | The last `to` must equal `schemaVersion` |
| `дублирующийся id` / `дублирующийся order` | Two plugins share an id or the display order | Make `order` unique across plugins |
| `блок game отличается` | Editions of one `gameId` declare different `game` blocks | Copy the same `id/order/name/description` into every edition |
| `Неподдерживаемый диапазон pluginApi: "…"` | An unsupported range form | Use `*`, `1.2.3`, `^1.2.3`, `~1.2.3` or `>=1.2.3` |
| `<field>: файл не найден (path#export)` | An entry point points at a missing file | Fix the path; it must stay inside the plugin folder |
| `entry.module должен содержать имя экспорта` | `entry.module` is a bare file | Write `index.ts#<id>Module` |
| `✗ src/games/registry.generated.ts устарел` | A manifest changed without regeneration | `npm run plugins:generate` and commit the generated files |
| `prettier --check` warns about a generated file | A generator bug, not a formatting nit | Do not hand-format: fix `renderRegistry` and add the case to `plugins-generator.test.ts` |

## Theming (`ui.theme`)

1.4 lets a plugin give its own sheet a restrained theme without touching the
core. It is data in the manifest, not code and not selectors:

```json
"ui": {
  "slots": ["HeaderActions"],
  "entry": "ui.ts",
  "theme": {
    "tokens": {
      "light": { "primary": "18 62% 40%", "radius": "0.25rem" },
      "dark": { "primary": "18 62% 58%" }
    },
    "font": "fonts.ts#pluginFont"
  }
}
```

- The token list belongs to the host: `background`, `foreground`, `card`,
  `card-foreground`, `primary`, `primary-foreground`, `accent`,
  `accent-foreground`, `muted`, `border`, `ring`, `radius`
  (`GAME_THEME_TOKENS` in `src/games/types.ts`, mirrored by
  `plugin.schema.json`). An unknown token fails generation.
- Colour values are HSL triplets (`8 70% 45%`), exactly like `globals.css`;
  `radius` is a length (`0.25rem`, `4px`, `0`).
- `tokens.light` and `tokens.dark` are independent: the host renders
  `[data-system="<id>"]` for the light set and `html.dark [data-system="<id>"]`
  for the dark one (`src/lib/game-theme.ts`). A missing set or token keeps the
  host value in that mode, so declare both sets if the sheet should look
  themed in both.
- The scope is the sheet page: header plus `<main>` (and the shared, read-only
  page). The dashboard, settings, dialogs and other games never see the
  tokens. Without a theme the host renders the page exactly as before.
- `font` (optional, 1.4) is an entry point exporting a `PluginFont` — the
  shape `next/font/local` returns (`variable`, `className`), or just
  `{ className }`. The generator emits a lazy loader in
  `generatedFontLoaders`; the host applies the returned class on the same
  wrapper and sets `data-font-ready` once it is applied. If the chunk fails,
  the wrapper keeps the host fonts.

A static `woff2` is not an npm dependency: keep the used subsets and the
`OFL.txt` license in the plugin's `assets/`. Declare both subsets in the game's
CSS module with one family; the Cyrillic face is limited by `unicode-range`, so
the files load with the sheet chunk, not with every page:

```css
/* src/games/<id>/sheet.module.css */
@font-face {
  font-family: '<PluginFont>';
  src: url('./assets/<font>-latin.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: '<PluginFont>';
  src: url('./assets/<font>-cyrillic.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
```

```ts
// src/games/<id>/fonts.ts
import type { PluginFont } from '@/games/plugin-api';

export const pluginFont: PluginFont = { className: '<id>-theme-font' };
```

- The class must be non-empty: the host marks the wrapper with
  `data-font-expected` from the manifest and with `data-font-ready` once the
  class is applied; the plugin's CSS decides where the family applies.
- Two subsets, one family: a Latin-only file silently falls back to the host
  face in Cyrillic, so both `en` and `ru` need a face with Cyrillic coverage.
- `next/font/local` is allowed by `scripts/plugins/boundaries.json` (the rest of
  `next/*` is not), but Turbopack hoists the CSS and preload links of a font
  module imported from a lazy chunk into every page. Prefer `@font-face` in the
  game's CSS module when the font belongs to the sheet only.
- Visual tests wait for `data-font-expected` → `data-font-ready` **and**
  `document.fonts.ready`: the ready attribute arrives when the chunk is
  applied, the `woff2` may still load, and a screenshot taken earlier keeps the
  host face.
- DH1, DH2 and D&D 5e are the shipped games that declare `font`;
  `tests/fixtures/example-plugin` still covers the object shape on its own.

The core cannot be reached from a theme: there is no way to pass CSS, class
names or selectors. `tests/unit/game-theme.test.ts` checks the CSS generator
and that the schema token list matches the types.

## Versioning

- `manifestVersion` — the manifest format understood by the host (2).
- `pluginApi` — compatible Plugin API range, and only in these forms: `*`,
  exact `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`. Anything else (`>1.0.0`,
  `<1.0.0`, `<=2.0.0`, `=1.2.3`, `1.x`, `>=1.0 <2`, `^0.x.y`) fails the
  generation step with an explicit error instead of being reinterpreted; `^`
  is defined for major >= 1 only, because npm's `0.x` caret means something
  else. The check runs at generation time (`npm run plugins:check`), so an
  unsupported range cannot reach a build. Host **1.4** remains compatible with
  a `^1.0.0` manifest; partial locales (1.3), `history` labels (1.1),
  `CreateFormCompletion` (1.2) and `ui.theme` (1.4) are additive and do not
  change the manifest format.
- `schemaVersion` — the sheet format written by the plugin; bump it together
  with a migration step when the sheet shape changes.
- `version` — the plugin's own semver, shown in admin. It is a plugin axis:
  any change inside the plugin folder bumps it by one minor per release, even
  when `schemaVersion` does not change (and vice versa: a sheet-format bump
  alone is still a plugin change).
