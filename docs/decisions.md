# Decisions (D)

Architectural decisions referenced from the other pages of the docs as `D<n>`.
The numbering is stable and does not move: a superseded decision keeps its
number and points to the replacement. Code comments do not cite the numbers —
they name the decision in words. This page is the legend those references
resolve to; decisions come from the plugin plan (now in the workspace archive)
and from the ADRs under [`adr/`](adr/).

| # | Decision | Enforced by |
| --- | --- | --- |
| D1 | **Plugins are build-time.** A plugin is a folder in the repository, discovered at build time; there is no runtime code loading. | `scripts/plugins/generate.mjs`, `src/games/registry.generated.ts` |
| D2 | **One plugin = one edition.** The family is an attribute (`gameId` plus the `game` block), not a package; see also D12. | `plugin.schema.json`, `validateCollection` |
| D3 | **A custom React sheet is the main mode.** Every game owns `sheet.tsx`, `create-form.tsx` and its UI slots; a universal declarative renderer is not part of the SDK. | `GameModule.components`, `plugin-sdk.md` § Sheet and form |
| D4 | **The manifest is the source of names/descriptions and of the migration order.** Steps are implemented in the module; a mismatch is a build error. | `plugin.schema.json`, `plugins-registry.test.ts` |
| D5 | **No ZIP/upload.** Appearing in the admin means deploying a new build. | `plugin-sdk.md` § Manifest |
| D6 | **Enablement state lives in `game-catalog.json`.** No extra state files; the catalog is versioned (v2, see D16/D20). | `src/lib/game-catalog.ts` |
| D7 | **Plugin tests are CI/conformance, never runtime.** The manifest only carries metadata. | `tests/unit/plugin-conformance.test.ts` |
| D8 | **`gameSystem` is a legacy mirror.** The manifest and the plugin work with `systemId`; removing the mirror is a separate data migration. | `aliases`, `src/lib/character-version.ts` |
| D9 | **A disabled plugin is read-only.** Existing sheets open read-only with a banner and JSON export still works; a plugin removed from the build renders as generic JSON. | `src/lib/module-access.ts`, `src/lib/game-catalog.ts` |
| D10 | **DH data is duplicated.** `dh1` and `dh2` own copies of the references, ranks and divinations; editions are independent even when they look alike. | `src/games/dh1/`, `src/games/dh2/` |
| D11 | **All UI slots ship together.** `sheet`, `createForm`, `HeaderActions`, `CompactNav`, `BulkEditor` and `CardSummary` are implemented in one stage with a neutral fallback, so the core stops knowing games at once. | `GameUiSlots`, `PLUGIN_UI_SLOTS` |
| D12 | **One `plugin.json` = one `systemId`.** Editions are separate plugins of one `gameId` family; a family is not a package. | `validatePluginFolder` |
| D13 | **i18n: JSON for new plugins, `.ts` only as legacy.** The manifest may point at `.json` or `.ts`; all shipped dictionaries are JSON now. | `plugin.schema.json#i18n`, `docs/i18n.md` |
| D14 | **`dependencies.plugins` is reserved.** The field exists in the manifest; the dependency graph is not implemented until there is a real case. | `plugin.schema.json` |
| D15 | **`tags` are stored but not displayed.** No UI filters or badges yet. | `manifest.tags`, admin data |
| D16 | **`enabled` and `visibility` are different axes.** `enabled` is activity (creation/menus/demo), `visibility` is `published|test|hidden`. | `src/lib/game-catalog.ts` |
| D17 | **`game.order` stays explicit.** The family order comes from the `game` block of every manifest; all editions of one `gameId` must declare the same `game.id/order/name/description`. | `validateCollection`, `games.generated.ts` |
| D18 | **Stage 2 was split:** data first, UI in stage 3. Normalize/merge, aliases and OpenAPI/layout moved with the data; sheet loading and slots waited for the UI contract from D11. | historical; completed by D11/D19 |
| D19 | **More slots than D11; dictionaries are generated.** `HeaderSubtitle` and `HouseRulesDialog` were added, the tab icon became a static `ui.favicon`, and plugin dictionaries moved to `src/games/i18n.generated.ts` so `src/lib/i18n` loads before the registry. | `PLUGIN_UI_SLOTS`, `i18n.generated.ts` |
| D20 | **Catalog v2: `enabled` and `visibility` are independent.** Turning a plugin off does not hide existing sheets; they open read-only with a banner and JSON export. | `src/lib/game-catalog.ts` |
| D21 | **`@/games/plugin-host` is the plugin runtime API.** Hooks are re-exported from one module, so plugin boundaries never import `@/context/*` or `@/hooks/*`; the creation form gets `onCreated` and the host owns navigation. | `src/games/plugin-host.ts`, `boundaries.json` |
| D22 | **A game theme is data, not CSS.** `plugin.json#ui.theme` sets a fixed host token list (`GAME_THEME_TOKENS`) for `light` and `dark`; the host renders them as CSS variables inside `[data-system="<id>"]` on the sheet page only. Plugins cannot pass selectors, class names or arbitrary CSS, so a theme can never leak into other pages or games. The optional `font` entry point is add-only. | `src/lib/game-theme.ts`, `src/components/layout/game-theme-scope.tsx`, `plugin.schema.json#ui.theme` |
| D23 | **Alike mechanics are copies, not a shared layer.** `dh-stats.ts`, `skill-training.ts` and `creation-review-banner.tsx` exist inside both DH editions; `src/games/shared` keeps only the game-agnostic kernel. `tests/unit/dh-family-parity.test.ts` compares behaviour (not files) and skips when one edition is absent. | `src/games/dh1/*`, `src/games/dh2/*`, purity over `src/games/shared` |
| D24 | **Host tests may use editions as fixtures, but must not break when one is deleted.** A scenario of one edition is guarded with `it.runIf(hasPlugin(id))` (conditional skip with a reason), or moved into the plugin. `GAME_MENTION_ALLOWANCE` in `scripts/tests/check-test-layout.mjs` is a ratchet over remaining id mentions in `tests/unit`, `tests/support` and `tests/visual`. | `scripts/tests/check-test-layout.mjs`, `tests/support/fixtures.ts` (`hasPlugin`, `makeCharacter`) |
| D25 | **Game tooling lives in the game's folder.** The DH2 data pack generator moved to `src/games/dh2/scripts/`; drift is caught by the edition's own unit test (`dh2e-freshness.test.ts`, skipped when the workspace catalog is absent), so `package.json` and `scripts/predeploy.sh` name no game. | `src/games/dh2/scripts/generate.mjs`, `scripts/predeploy.sh` |
| D26 | **The sandbox game ships with the app.** `src/games/sandbox` (`defaultStatus: "test"`) is a real, built plugin: a living example of the contract (CSS module, scoped theme, slots, favicon) that staff can open, and the thing CI proves stays buildable. It is not a second fixture — `tests/fixtures/example-plugin` remains the unit-test copy that Next never builds. | `src/games/sandbox/`, `plugin.schema.json` |
| D27 | **A theme font is two subsets in the game's CSS module.** A plugin keeps the latin and cyrillic `woff2` plus `OFL.txt` in its `assets/`, declares both `@font-face` blocks in its `sheet.module.css` (Cyrillic limited by `unicode-range`) and exports a non-empty `PluginFont.className` from `fonts.ts`. `next/font/local` stays allowed in `boundaries.json`, but its CSS and preload links are hoisted into every page when the module is imported from a lazy chunk; a sheet-only font therefore lives in the CSS module. The wrapper gets `data-font-expected` from the manifest and `data-font-ready` once the chunk applies; screenshots wait for both plus `document.fonts.ready`. | `src/games/<id>/fonts.ts`, `src/games/<id>/sheet.module.css`, `src/games/types.ts` (`PluginFont`), `src/components/layout/game-theme-scope.tsx`, `scripts/plugins/boundaries.json` |

## Related

- [plugin-sdk.md](plugin-sdk.md) — manifest, module contract, conformance.
- [game-modules.md](game-modules.md) — module layout, import boundaries.
- [adr/](adr/) — the four data/session decisions with their own reasoning.
