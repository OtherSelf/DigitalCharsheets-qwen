# Plugin SDK (v1)

How to add a game or an edition to Digital Character Sheets. Everything
game-specific lives in one folder under `src/games/<id>/`; the core only talks
to the generated registry and the plugin contracts. A plugin is a folder plus a
manifest plus a rebuild — no runtime code loading (D1), no ZIP/upload (D5).

Status: **v1**, manifest `manifestVersion: 1`, `pluginApi: ^1.0.0`.

## Quick start (new plugin in an evening)

1. **Copy a template.** The smallest complete plugin is the conformance fixture
   [`tests/fixtures/example-plugin/`](../tests/fixtures/example-plugin): types,
   zod schema, defaults, demo, export/Excel, JSON dictionaries, a custom React
   sheet and form, UI slots and `plugin.json`.
2. **Create the folder** `src/games/<id>/` (the folder name must equal `plugin.json#id`).
3. **Write `plugin.json`** (see [Manifest](#manifest)): `id`, `gameId`,
   `version`, `order`, `name`/`description` (en/ru), `schemaVersion`, the family
   block `game`, entry points, `sheet`, `i18n`, `demo`, `export`, `migrations`.
4. **Implement the module** in `index.ts` and export it from the `entry.module`
   point: `index.ts#<id>Module`. Export the other entry points the manifest
   references (`createDemo`, `toPortableJson`, `buildExcelSections`, …).
5. **UI**: `sheet.tsx` and `create-form.tsx`; optional `ui.ts` with the UI slots.
6. **Dictionaries**: `i18n/en.json`, `i18n/ru.json` with the same key set, keys
   namespaced `<id>.*` (plus shared `games.<id>.*` metadata keys if needed).
7. **Generate and check**:
   ```bash
   npm run plugins:generate     # registry.generated.ts + i18n.generated.ts
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
  normalize.ts         legacy/imported sheet → your type (+ warnings)
  merge.ts             import merge (partial patch over an existing sheet)
  create-form.tsx      custom creation form
  sheet.tsx            custom sheet, forwardRef<SheetHandle>
  ui.ts                optional UI slots (manifest `ui.entry`)
  slots/*.tsx          slot components/functions imported by ui.ts
  bulk-editor.ts       tables for /stats-editor (ui.bulkEditor)
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

The module re-exports the host hooks, so plugin internals stay decoupled from
`@/context/*` / `@/hooks/*` and the boundary test keeps zero legacy entries.
Types come from `@/games/types` / `@/games/plugin-api`; only the plugin's own
`types.ts` describes the sheet shape.

## Manifest

Authoritative JSON Schema: [`src/games/plugin.schema.json`](../src/games/plugin.schema.json).
Validated by `scripts/plugins/generate.mjs` (Ajv) on every generation/verify.

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
  "i18n": { "en": "i18n/en.json", "ru": "i18n/ru.json" },
  "demo": { "entry": "index.ts#createDemo" },
  "export": { "json": "index.ts#toPortableJson", "excel": "index.ts#buildExcelSections" },
  "ui": { "slots": ["HeaderActions", "HeaderSubtitle", "CompactNav", "BulkEditor", "CardSummary", "HouseRulesDialog"], "entry": "ui.ts" },
  "aliases": [{ "gameSystem": "Dark Heresy", "edition": "1st" }],
  "migrations": [],
  "tests": { "conformance": ">=1" }
}
```

Rules:

- `id` equals the folder and the sheet `systemId`; `version` is semver.
- `name`/`description` are the display source (admin, wizard); other strings
  live in `i18n/*.json`. `tags` are stored but not shown in UI (D15).
- `game` is the family block (D17): every edition of one `gameId` declares the
  same `id`/`order`/`name`; the generator fails on mismatch.
- Entry points are `<file>#<export>`. `entry.module` points at the module
  object; `demo`/`export`/`migrations` at functions. The generator checks the
  files, the conformance test checks the exports against the module namespace.
- `sheet.mode` is currently `"custom"` only; the plugin owns its React sheet and
  form (D3).
- `i18n` may point at `.json` (preferred, D13) or `.ts` (legacy). Both files
  must export/contain the same key set.
- `ui.entry` is a module exporting `uiSlots: GameUiSlots`; it is loaded lazily
  (dynamic import) so React components never enter the shared bundle.
- `aliases` resolve legacy `gameSystem`/`edition` values to your `systemId`; the
  most specific alias wins.
- `dependencies.host` is the Plugin API range checked by the generator;
  `dependencies.plugins` is reserved (D14).
- `migrations` order is the apply order; a non-empty chain must cover
  `1 → … → schemaVersion` without gaps. The runner applies steps in order, only
  to sheets older than the step, and writes a `.bak` before the first migrated
  rewrite. Unknown future versions are never overwritten.
- `tests.conformance` is metadata for CI/admin, never executed at runtime (D7).

## Module contract

`GameModule<TCharacter>` ([`src/games/types.ts`](../src/games/types.ts)) — see
[game-modules.md](game-modules.md#contract) for the field table. Key points:

- `createDefaults()` / `createDemo()` return drafts without `id`.
- `normalize(raw, options)` — idempotent legacy normalization; with
  `options.applyDefaults` also fills missing structures (import path).
- `merge(target, source, config)` — import merge; the host only checks that both
  sides are the same edition.
- `migrations` — ordered chain (see above).
- `findEmbedded` / `updateEmbedded` — optional nested entities (D&D companions)
  addressed by a virtual id (`companion-*`); the core only knows the id format.
- `matchesLegacyImport` / `legacyImportName` / `convertLegacyImport` — optional
  Firestore/2.x converter for your game, used by the offline migration (the old
  `/api/import` endpoint was removed).
- `ui` is not set on the module object anymore — slots live in `ui.ts`.

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
| `favicon` | `string` (path in `public/`) | tab icon |

The sheet itself is loaded lazily (`components.loadSheet` = dynamic import) and
wrapped in `Suspense` + `ErrorBoundary`: a render error shows the *sheet
unavailable* card, while the header, dialogs and JSON export keep working. The
sheet receives `ref: SheetHandle` and must implement `saveAll()`.

### Bulk editor (`/stats-editor`)

`ui.bulkEditor` is an array of tables; the host owns the page, tabs, edit state
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
compact navigation, its `id` must match the `CompactNav` item id.

`create-form.tsx` — receives one optional prop, `onCreated(characterId)`; it
reads `useCharacterContext()` (addCharacter), calls `createDefaults()` and calls
`onCreated` after the server created the sheet. Navigation belongs to the host,
so `next/navigation` is not imported by plugins at all.

## i18n

- Dictionaries live in `i18n/en.json` and `i18n/ru.json` (JSON, D13).
- Key set must be identical in both languages; keys are namespaced `<id>.*`.
- `name`/`description` of the plugin come from the manifest, not from i18n.
- The host merges dictionaries in `src/lib/i18n` from the generated
  `i18n.generated.ts` (dictionaries only — no React/registry imports there).
  Duplicate keys across layers are a startup error.
- `t()` never guesses: a missing key renders as the key itself, so always pass
  the full `namespace.key`.

## Tests (conformance)

There is no separate package yet; the conformance set runs in Vitest:

```bash
npm run plugins:conformance
```

What it checks (`tests/unit/plugins-registry.test.ts`,
`plugin-slots.test.ts`, `bulk-editor.test.ts`, `example-plugin.test.ts`):

- generated `registry.generated.ts`/`i18n.generated.ts` match the manifests
  byte-for-byte;
- manifest ↔ module: id/gameId/order/defaultStatus/schemaVersion, every entry
  point is a real named export, migrations match;
- defaults and demo pass the module's own zod schema;
- en/ru dictionaries have the same keys;
- UI slots load lazily, are exactly the ones declared in `ui.slots`, and give
  non-empty labels / valid i18n keys;
- `BulkEditor` tables have unique ids, known label keys and produce the expected
  patches;
- the reference fixture plugin is copied into a temporary `src/games/` and goes
  through the same generator — proof that a folder + manifest is enough.

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

## Versioning

- `manifestVersion` — the manifest format understood by the host (1).
- `pluginApi` — compatible Plugin API range (`^1.2.3`, `~1.2.3`, `>=1.0.0`,
  exact, `*`); the host checks it at generation time.
- `schemaVersion` — the sheet format written by the plugin; bump it together
  with a migration step when the sheet shape changes.
- `version` — the plugin's own semver, shown in admin.
