---
title: "Plugin layout standard"
description: "Canonical folder/file skeleton for a game plugin, naming rules for code and tests, and the automated layout gate"
---

# Plugin layout standard

How a game plugin folder is organised. The manifest and the module contract are
described in [plugin-sdk.md](plugin-sdk.md) and
[game-modules.md](game-modules.md); this page is about the **shape of the
folder** — which files every plugin has, how they are named, and which
divergences are intentional.

The standard is enforced by `npm run plugins:layout` (a step of
`npm run verify`), so it describes the current tree rather than an aspiration.

## Canonical tree

```text
src/games/<id>/
  plugin.json              manifest: metadata, entry points, slots, theme
  index.ts                 GameModule + named entry points from the manifest
  types.ts                 sheet type, extends CharacterRecord
  schema.ts                zod schema (loose top level, bounded domains)
  schema-version.ts        SANDBOX_SCHEMA_VERSION etc., one literal
  defaults.ts              createDefaults() (no id)
  demo.ts                  createDemo() (no id, used by /demo and tests)
  normalize.ts             legacy/imported sheet → own type (required)
  merge.ts                 import merge over an existing sheet (required)
  export.ts                portable JSON field selection
  excel.ts                 Excel sections
  create-form.tsx          custom creation form
  sheet.tsx                custom sheet, forwardRef<SheetHandle>
  sheet.module.css         sheet layout, responsive rules, @font-face
  ui.ts                    GameUiSlots object (manifest ui.entry)
  bulk-editor.ts           BulkEditor tables for /stats-editor
  fonts.ts                 PluginFont for ui.theme.font
  assets/favicon.png       tab icon (one per plugin)
  i18n/en.json             dictionary, keys `<id>.*`
  i18n/ru.json             same key set as en.json
  sections/*.tsx           sheet blocks and dialogs
  slots/*.tsx              slot components/functions used by ui.ts
  tests/unit/*.test.ts     plugin contract and mechanics tests (see below)
  tests/visual/*.visual.spec.ts  screenshots of this plugin (optional)
  tests/visual.json        visual coverage requirements (with visual specs)
  tests/fixtures/visual.ts seeded characters for the visual specs
```

Every path in the tree above is required by the gate except `sections/`,
`slots/`, and the visual trio (which becomes required as a set as soon as one
of its files exists). `tests/unit/module.test.ts` and
`tests/unit/contract.test.ts` are required once the plugin is visible
(`defaultStatus` is not `hidden`) or reaches version 1.0; a hidden `0.x`
scaffold may start without them.

## Required files and why

| File | What breaks without it |
| --- | --- |
| `plugin.json` | The folder is not discovered; no registry entry, no metadata |
| `index.ts` | The manifest entry points cannot resolve; no module object |
| `types.ts` | The sheet shape is implicit and `tsc` cannot check `schema.ts` |
| `schema.ts` | Import/export cannot validate; OpenAPI has no sheet shape |
| `schema-version.ts` | The version is duplicated between manifest and module |
| `defaults.ts`, `demo.ts` | Creation and `/demo` have no deterministic drafts |
| `normalize.ts`, `merge.ts` | Import/legacy data branches by game in the core |
| `export.ts`, `excel.ts` | Export falls back to raw JSON or loses sections |
| `create-form.tsx`, `sheet.tsx` | The plugin is not usable from `/new` or the sheet page |
| `sheet.module.css` | Layout rules leak into `globals.css` (blocked by `plugins:purity`) |
| `ui.ts`, `bulk-editor.ts`, `fonts.ts` | Slots, `/stats-editor` and the theme font stay empty |
| `assets/favicon.png` | The tab icon is shared or missing |
| `i18n/en.json`, `i18n/ru.json` | One site language falls back to raw keys |
| `tests/unit/module.test.ts` | Required once visible or 1.0+: manifest ↔ module and defaults/demo are not checked by the plugin |
| `tests/unit/contract.test.ts` | Required once visible or 1.0+: feature contract (sections, slots, bulk tables) has no owner |

## Naming rules

- **Folder = `plugin.json#id` = sheet `systemId`.** The generator rejects a
  mismatch; do not keep a second literal in code (`<ID>_SYSTEM_ID` is the
  source for the module and defaults).
- **Code files are `kebab-case` and name the concept, not the plugin.**
  `dh-stats.ts`, `skill-training.ts`, `influence.ts`, `psy.ts` — the folder
  already scopes the edition. A redundant `dh2-psy.ts` inside `dh2/` is the
  kind of name this rule removes.
- **Data packs may carry the edition code** (`dh2e-data.ts`,
  `dh2e-reference.ts`, `dh2e-rules.ts`) when they are generated or
  edition-specific references; hand-written feature modules stay unprefixed.
  Generated files carry an `AUTO-GENERATED` header and are never edited by
  hand.
- **Sections are `sections/<topic>.tsx`; slots are `slots/<slot>.tsx`.**
  `ui.ts` is the only place that assembles the `GameUiSlots` object.
- **Tests are `<topic>.test.ts` under `tests/unit/`.** The folder already says
  which edition it is, so `dh1-fields`/`dh2-psy` become `fields`/`psy`. Visual
  specs are `<page>.visual.spec.ts` under `tests/visual/`.
- **Plugin tooling lives in `scripts/` inside the plugin** (for example
  `dh2/scripts/generate.mjs`), not in the root `scripts/` and not in
  `package.json`.

## Intentional differences

The gate checks the skeleton, not the mechanics. Different rules produce
different files and are expected:

| Area | dh1 | dh2 | dnd5e | sandbox |
| --- | --- | --- | --- | --- |
| Data pack | `dark-heresy-data.ts`, `dark-heresy-ranks.ts`, `divination-i18n.ts` (hand-written) | `dh2e-*.ts` (generated from the workspace catalog) | `epic-boons.ts` (feature data) | inline demo data |
| Edition helpers | `capabilities.ts`, `stats.ts`, `dh-stats.ts`, `field-policy.ts`, `experience.ts`, `gender.ts`, `inventory.ts` | same concept names, own copies | `embedded.ts` (companions), `derive.ts` | `capabilities.ts`, `derive.ts`, `embedded.ts`, `history.ts`, `legacy-import.ts` |
| UI sections | eight DH sections | eight DH sections plus `requisition-block.tsx` | 14 5e sections | one small sheet |
| Tests | 19 files | 24 files | 6 files | 3 files |

Two editions of one family (`dh1`, `dh2`) keep **independent copies** of the
alike mechanics (`dh-stats.ts`, `skill-training.ts`,
`creation-review-banner.tsx`) — that is decision D10, not drift. What they must
share is the skeleton: the same concept files, the same test topics, the same
slot names. `tests/unit/dh-family-parity.test.ts` compares behaviour; the
layout gate compares shape.

## Sandbox as the full example

`src/games/sandbox` is the reference plugin that exercises every optional SDK
branch in one place:

- `derive`/`derived` (`derive.ts` and the computed `total` field);
- `import.normalize` / `import.merge` entry points;
- `history` labels and tokens;
- `matchesLegacyImport` / `legacyImportName` / `convertLegacyImport`;
- `findEmbedded` / `updateEmbedded` for a nested companion;
- all six UI slots (`HeaderActions`, `HeaderSubtitle`, `CompactNav`,
  `BulkEditor`, `CardSummary`, `HouseRulesDialog`) and its own favicon;
- a scoped theme with the full token set, `fonts.ts` and `@font-face` in the
  plugin CSS module.

Copy it when you need a working example of a capability; use
`tests/fixtures/example-plugin` (the target of `npm run plugins:scaffold`) when
you need the smallest starting point.

## Adding a plugin

```bash
npm run plugins:scaffold -- mygame --game myFamily --order 60 --title "My Game"
npm run plugins:generate
npm run plugins:layout
npm run verify
```

`plugins:scaffold` copies the fixture and renames it; the new folder already
has the required skeleton. Then replace types, schema, defaults, demo, form,
sheet, dictionaries and tests. The generator and the layout gate fail on a
missing file or a test named after the id, so the standard is not a checklist
to remember.

## Checks

| Command | What it verifies |
| --- | --- |
| `npm run plugins:generate` | registry, dictionaries and family list from manifests |
| `npm run plugins:check` | generated files are in sync with manifests |
| `npm run plugins:layout` | required skeleton, test names, visual config, favicon |
| `npm run plugins:boundaries` | plugin imports only the allowlisted host API |
| `npm run plugins:imports` | the core imports only the plugin contract |
| `npm run plugins:purity` | no game names/selectors in core code and CSS |
| `npm run plugins:conformance` | manifest ↔ module, schema, i18n, slots |
| `npm run test:plugin -- <id>` | plugin-specific unit tests |

## Related

- [plugin-sdk.md](plugin-sdk.md) — manifest, module contract, slots, theming
- [game-modules.md](game-modules.md) — registry, import boundaries, editions
- [testing.md](testing.md) — test layout and the pre-deploy gate
- [`scripts/plugins/check-layout.mjs`](../scripts/plugins/check-layout.mjs)
- [`src/games/sandbox/`](../src/games/sandbox/)
