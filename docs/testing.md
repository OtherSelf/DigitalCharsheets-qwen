# Testing

Four layers: unit tests, an HTTP smoke test, Playwright visual regression, and
the pre-deploy gate that ties them together. None of them touch your real
`./data` directory.

## Commands

```bash
npm test                    # unit tests (Vitest)
npm run test:plugin -- dh1  # unit tests of one plugin (id, fixture name or path)
npm run verify              # full pre-deploy gate
npm run test:visual         # Playwright screenshot regression (full)
npm run test:visual:full    # explicit alias for the full visual run
npm run test:visual:fast    # screenshots tagged @fast (~30 tests)
npm run test:visual:changed # only specs affected by the current diff
npm run test:visual:prune   # list obsolete PNG baselines
npm run test:visual:update  # rewrite baselines
npm run test:visual:report  # open the HTML report
npm run test:dev            # dev-proxy hydration + health/version smoke
npm run check:build-id -- <url>  # HTML/dpl/buildId contract of a running server
```

## Test kit

Shared helpers live in `tests/support/` and are imported as `@tests/support`
(alias in `tsconfig.json` and `vitest.config.ts`):

- `data-dir.ts` — `useTempDataDir()`, `removeDir()`, `readJson()`, `userPaths()`,
  `loginIndexPath()`;
- `auth.ts` — `sessionCookie()`, `sessionHeaders()` (uid always comes from a
  signed session);
- `fixtures.ts` — minimal `makeDndCharacter()` / `makeDhCharacter()`.

Game plugins carry their own tests next to the code:

```text
src/games/<id>/tests/
  unit/*.test.ts             # schema, defaults, demo, export, i18n, rules
  visual/*.visual.spec.ts    # plugin screens (tag @plugin:<id>)
  fixtures/visual.ts         # seeded characters (default export)
```

Plugins never import the kit from production files: ESLint
(`no-restricted-imports`) and `scripts/plugins/check-boundaries.mjs` allow
`vitest`, `@playwright/test`, `@tests/*` and `node:fs` only under
`src/games/<id>/tests/**`. Cross-plugin imports are forbidden there too, so a
DH1 test cannot build on DH2's internals. The reference fixture
(`tests/fixtures/example-plugin/tests`) proves that a plugin can ship its own
test and run from the repo root.

## Test layout

Host tests are split by domain: `tests/unit/api/`, `auth/`, `characters/`,
`admin/`, `export/`, `storage/`, `history/`. A file must stay within **400
lines**: a 1,500-line `api-routes.test.ts` hides which route broke and makes
review meaningless. `npm run test:layout` (also a step of `npm run verify`)
enforces the limit and fails in both directions:

- a file over 400 lines must be split by domain or listed as an exception with a
  reason and a ceiling in `scripts/tests/check-test-layout.mjs` (a ceiling is a
  ratchet: the file may shrink but not grow; an unused exception is an error);
- a test that imports the modules of exactly one game belongs in
  `src/games/<id>/tests/unit/`, not in the host. A test that imports two
  editions (DH1/DH2 parity, shared labels) stays in `tests/unit` — it checks the
  contract between editions, and a plugin may not import another plugin.

## Plugin conformance

`npm run plugins:conformance` runs `tests/unit/plugin-conformance.test.ts`, which
discovers plugins by `src/games/*/plugin.json` — there is no file list in
`package.json`:

- folder ↔ manifest ↔ generated registry agree, and every manifest passes the
  same folder/schema validation as the generator;
- manifest ↔ module: id, gameId, schemaVersion; default and demo pass the
  module's own zod schema; en/ru dictionaries have the same keys;
- declared UI slots exist (runtime field names match manifest slot names);
- out-of-range values are rejected (negative TCK) and portable JSON round-trips;
- the reference fixture is installed into a temporary `src/games/` and goes
  through the same generator, so a folder + manifest is still enough.

The rest of the contract lives in sibling host suites, not in this file:
entry points, `order`/`defaultStatus` and the migration chain —
`plugins-registry.test.ts`; the exact slot set — `plugin-slots.test.ts`;
`BulkEditor` — `bulk-editor.test.ts`; a renamed copy of the fixture under
another id — `plugin-template.test.ts`; byte-for-byte drift of the generated
files — `npm run plugins:check`. The full mapping is in
[`plugin-sdk.md`](plugin-sdk.md#tests-conformance).

Plugin-specific checks (bulk-editor table columns, custom slots) belong in
`src/games/<id>/tests/`; the dedicated host suites for them remain part of
`npm test`.

## Unit tests

- Runner: Vitest, Node environment. It picks up `tests/**/*.test.ts` (host) and
  `src/games/*/tests/**/*.test.ts` (plugins); Playwright specs are not part of
  this run.
- They create a temporary data directory (`DCS_DATA_DIR`) per test and remove it
  afterwards; they never read or write the real data directory.
- API route handlers are imported and called as ordinary functions with a
  `Request`; no HTTP server is started.
- Covered areas: auth and profile updates, account deletion, recovery, file
  storage/locks/atomic writes, character schema v2 migration, export/import 3.0
  (JSON and Excel), the game registry/module contract, game catalog visibility
  and module-access matrix, translations parity and hardcoded-UI checks, unused
  dictionary keys per edition,
  OpenAPI document and route coverage, admin API and bootstrap, health/version,
  the read-only share registry/API (`shares.json`, rotation, expiry,
  revocation, cleanup), and the character history (diff engine, JSONL store,
  compaction, recording, owner-only API, labels).
- `tests/unit/openapi.test.ts` compares the OpenAPI spec with every
  `src/app/api/**/route.ts`; a new endpoint without documentation fails it.
- Tests of one edition live in `src/games/<id>/tests/unit/` (for example
  `dh1-fields`, `dh2-psy`) and are found by the same `npm test`. Tests that
  import two editions at once (DH parity, shared labels, schema versions) stay
  in `tests/unit`: a plugin test may not import another plugin.

### Writing a unit test

- Name the file `tests/unit/<topic>.test.ts` or, for an edition-specific
  scenario, `src/games/<id>/tests/unit/<topic>.test.ts`. Anything that writes
  to disk creates a temporary data directory in `beforeEach`
  (`useTempDataDir()`) and removes it in `afterEach` (`removeDir(dataDir)`).
  The real `./data` is never touched. Import the helpers from `@tests/support`,
  not from a neighbouring file: copies drift.
- Assert behaviour, not internals: statuses, bodies and the files on disk. If a
  module persists data, read the file back — that is how the "200 but nothing was
  saved" class of bugs is caught.
- For expected errors, stub `console.error` (`vi.spyOn(console, 'error')`) and
  restore it, otherwise the output is noise.
- Wait for background work explicitly (`await queue.idle()` for the save queue).
  The queue accepts `setTimeoutFn`/`clearTimeoutFn`, so fake timers are not
  needed.
- `describe`/`it` names are Russian imperatives with the expected result
  ("отбрасывает запоздавшую запись"). Usernames are unique per file
  (`api-user`, `gm-dnd`), never real data.
- There is no component layer yet: no `jsdom`, no Testing Library, so UI
  behaviour belongs to the visual specs.

A full run takes roughly 30–60 s. `testTimeout` is 40 s and `hookTimeout` is
20 s: `plugin-slots.test.ts` dynamically imports every game sheet, and on a
loaded machine those imports alone exceed 20 s (observed at ~10 s standalone
and >20 s in the full suite). Do not run heavy jobs (another full suite, a build)
in parallel with `npm test`.

### Common failures

| Symptom | Cause / fix |
| --- | --- |
| `DCS_DATA_DIR` leaks between tests; a sheet is visible to another account | Missing `useTempDataDir()` in `beforeEach` / `removeDir(dataDir)` in `afterEach` |
| `FileReader is not defined` | The file is outside the Vitest include, or `setupFiles` lost `tests/support/setup.ts` |
| `console.error` noise from expected errors | Stub it with `vi.spyOn(console, 'error')` and restore it |
| `visual-naming` reports a missing section or baseline | Add the screenshot with the right name (see Visual regression) or extend `src/games/<id>/tests/visual.json` (`requiredLangs`/`requiredSections`) |
| Passes locally, times out elsewhere | Raise `testTimeout`/`hookTimeout` in `vitest.config.ts`, or lighten the test |
| A coverage report is wanted | `@vitest/coverage-v8` is not installed: `npm i -D @vitest/coverage-v8`, then `npx vitest run --coverage` |

## HTTP smoke test

[`scripts/smoke.mjs`](../scripts/smoke.mjs) runs against an already started
server (default `http://localhost:3000`):

```bash
npm run test:smoke
node scripts/smoke.mjs -u http://127.0.0.1:3001 --data-dir /path/to/data
```

It checks pages, login/registration, character CRUD, export, recovery, account
deletion, admin role enforcement, OpenAPI/docs availability, `/api/health`,
`/api/version`, the guest share link (create, open without a cookie, headers,
hashed token on disk, revoke), the history API (read, clear, owner-only), and —
with `--data-dir` — the on-disk `user.json`, login index
and sheet files. It creates a disposable `smoke-*` account and removes it
afterwards.

`npm run test:dev` starts `next dev`, verifies the proxy/hydration setup for the
known dev hosts, and checks `/api/health` and `/api/version` directly.

`npm run verify` starts its own throwaway production server on a free port with
a temporary `DCS_DATA_DIR`, so the smoke test never touches your real data.

## New-build detection

The build-identity contract (see
[deployment.md](deployment.md#new-build-and-stale-tabs)) is checked on three
levels, and the tab reload itself only in a browser:

- `tests/unit/build-guard.test.ts` — when to show the banner, when to wait, and
  the 15/60 s intervals;
- `tests/unit/chunk-error.test.ts` — the error texts recognised as a chunk-load
  failure;
- `tests/unit/health-version.test.ts` — every `buildId` source (deployment id,
  `.next/BUILD_ID`, per-process id in development);
- `scripts/smoke.mjs` — the running server's `buildId` is non-empty and matches
  `data-dpl-id` in the HTML;
- `npm run check:build-id -- <url>` — the same contract against any deployment,
  including a remote stand.

To watch it by hand, open the app, restart the server that serves it, and wait
one interval: the tab shows the "the app has been updated" banner. Nothing
reloads automatically — reload the tab yourself.

## Visual regression

Playwright renders the app in Chromium and compares screenshots with the
baselines in `tests/visual/__screenshots__/`.

- Projects: `desktop` (1440×900) and `mobile` (Pixel 7); host `tablet`
  (1024×768) only for `tests/visual/tablet.spec.ts` (dashboard, settings).
  Plugin specs run in `desktop-games` / `mobile-games` / `tablet-games`: their
  own `testDir` is `src/games`, a project-level `snapshotPathTemplate` keeps
  the baselines under the same `tests/visual/__screenshots__/` root, and the
  projects filter by tag (`@desktop`, `@mobile`, `@tablet`) so a screenshot is
  compared only in the width it was taken in. A sheet scenario at 1024×768
  belongs to the plugin (`tablet-games`), not to the host.
- Game scenarios live in the plugin: screens in
  `src/games/<id>/tests/visual/*.visual.spec.ts`, the seeded character in
  `src/games/<id>/tests/fixtures/visual.ts`. The host (`tests/visual/`) keeps
  only host screens and host fixtures (auth, dashboard, settings, admin,
  share, history, guest drafts) and never imports a game fixture, so deleting a
  game folder removes its specs/baselines/fixture without touching the host.
- Game scenarios are tagged `@plugin:<id>` (`@plugin:dh1`, `@plugin:dh2`,
  `@plugin:dnd5e`): `npm run test:visual:plugin -- dh1` runs only that plugin
  through `playwright --grep`. A new game adds
  `src/games/<id>/tests/visual/*.visual.spec.ts` and `tests/visual.json`
  (name segment, required languages/sections) — no host edits.
- Data is isolated per **project and worker**: `workerIndex` is unique only
  within a project, so the same index in `desktop` and `mobile` would share one
  account and parallel scenarios would clear each other's history or add sheets.
  global-setup creates a canonical `visual-tests` account, one account per
  (project, worker) pair and a separate `visual-tests-guest` account that owns
  the `/share/<token>` snapshots, each with the same fixtures. Fixtures are
  discovered, not imported: global-setup scans
  `src/games/<id>/tests/fixtures/visual.ts`, imports the default export and
  seeds one character per found game in plugin-registry order (`plugin.json` →
  `order`). `state.characters` maps the game segment (`dnd`, `dh`, the same
  `nameSegment` used in baseline names) to the created id; a game without a
  fixture is simply skipped. The legacy `dndId` / `dhId` fields stay as
  aliases of `characters.dnd` / `characters.dh` for host specs.

- `scripts/visual.sh` builds the app (unless `--skip-build`), starts a temporary
  production server with a temporary data directory, and runs Playwright.
- The script also checks for JS errors, horizontal overflow and mobile
  navigation.
- Run `npx playwright install chromium` once if the browser is missing.

Coverage is intentionally tiered instead of a full
theme × language × mode × viewport cross-product:

- EN is the full baseline; RU covers the layout-sensitive screens (login,
  dashboard, sheet top, dense sections, settings, admin, profile menu).
- Themes are sampled: dark dashboard (en/ru), dark/warm sheet tops on desktop,
  one mobile dark sheet and one mobile warm sheet; the switcher itself covers
  Light / Dark / Light (Warm).
- Edit mode is full on desktop EN and sampled on mobile; compact/tablet views
  stay in their own specs.
- `/` and `/demo`, `/new` and `/new/manual` are checked by assertions but
  share one baseline pair instead of duplicating identical PNGs.
- Tests that only make sense in one project are tagged `@desktop`/`@mobile`;
  `playwright.config.ts` filters them with `grepInvert`, so there are no
  skipped duplicates in the report.
- `share.spec.ts` covers the public read-only link (desktop/mobile), the optional
  history tab (`includeHistory`), the invalid link and the owner dialog. Its link is seeded directly into the temporary
  data directory; with `--base-url` there is no data directory, so the share
  screenshots are skipped like the admin ones.
- `history.spec.ts` covers the owner timeline (desktop/mobile), the empty
  state after clearing, and functional DH1/DH2 timelines on temporary accounts:
  labels and code values are localised and no raw JSON reaches the page.
  History fixtures are written into the temporary data directory with fixed
  dates, so PNGs do not drift.

`test:visual:changed` maps the current diff (committed vs `--base`, plus
staged/unstaged/untracked files) to specs. It is deliberately conservative:
unknown UI code and `package.json` changes fall back to `@fast`, helper/config
changes run the full set, and backend/docs-only diffs skip visuals.

```bash
npm run test:visual:changed -- --dry-run
npm run test:visual:changed -- --base origin/main
npm run test:visual:changed -- --skip-build
```

Removing a test or a screenshot does not delete its PNG automatically:

```bash
npm run test:visual:prune
npm run test:visual:prune -- --write
```

`@full` is not a separate tag: the full suite is the default run;
`test:visual:full` is an explicit alias. `@fast` is the small PR/pre-commit
subset.

Useful flags:

```bash
bash scripts/visual.sh --skip-build
bash scripts/visual.sh --grep "admin"
bash scripts/visual.sh --update-snapshots
bash scripts/visual.sh --base-url http://127.0.0.1:3000
```

### Mobile sheets (below 768 px)

- The sheet is a compact React view, not a CSS adaptivity layer: below 768 px
  one section and the icon rail are rendered at a time. Sheet layout rules for
  that range belong to the plugin (`src/games/<id>/sheet.module.css`); a
  `.dh-sheet`-style selector in `globals.css` is a core-knows-games violation
  caught by `npm run plugins:purity`.
- Mobile baselines live in two projects: `mobile` (host screens) and
  `mobile-games` (plugin sheets). A screenshot taken in one width is never
  compared in another, so a sheet scenario at 412 px belongs to `mobile-games`
  even when the host owns the page around it.
- Thresholds live in `src/lib/viewport.ts`; `tests/unit/viewport.test.ts` guards
  the numbers at 767/768/1299/1300 and the fractional width under browser zoom.
- The compact navigation contract: every `CompactNav` item id has an element
  with the same id in the DOM. The page scrolls `main` to it, and the
  `контракт CompactNav` scenario in `basic-pages.spec.ts` walks the rail
  buttons (`data-section-id`), asserts the element exists, is not collapsed and
  lands in the frame. A missing id logs `[sheet]` on the console in dev and
  fails that test.
- `openMobileSection(page, label, sectionId)` requires the id and scrolls to
  that section; it never resets the scroll to the top of the page. A screenshot
  named after a section must contain the section. When the sheet is shorter than
  the viewport the scroll stops at the end: the section stays visible, which is
  what the test asserts instead of an exact zero offset.
- The guest page `/share/<token>` renders outside the compact mode: there is no
  section rail, so the guest gets the whole sheet, and below 768 px the panels
  are stacked by a rule in the plugin's `sheet.module.css`. `share.spec.ts`
  asserts that neither the document nor `main` overflows and that all sections
  are present, for both seeded sheets.
- Inputs take `font-size: 16px` on focus below 768 px (`globals.css`), so iOS
  does not zoom the page; the mobile editing scenario asserts the computed size
  on a focused field and blurs it before taking the screenshot.
- Dense screens (admin games, bulk editor) render cards below 768 px and the
  table from `md` up. The switch is `useViewportFlags()` and only one tree is in
  the DOM, so text queries and labels are not duplicated.
- The tab icon is part of the shell, not of a screen: `src/app/favicon.ico` is
  served at `/favicon.ico` and injected by Next on every page, and
  `DynamicFavicon` keeps one `#dynamic-favicon` link that it updates instead of
  removing React-owned links (removing them made the next client navigation
  crash with `removeChild of null`). The mobile scenario `иконка вкладки`
  checks the core pages, that both sheets serve their own icon with 200 and
  that the icon switches back after a client-side navigation.
- Touch targets: ordinary buttons are at least 32×32 px below 768 px; the
  dialog and sheet close buttons (test ids `dialog-close` / `sheet-close`) and
  destructive icon buttons are at least 40×40 px. The DH characteristic dots
  keep their 12 px look but have a 24×24 hit box (the `dot` prop of `Checkbox`):
  the compact grid does not fit a bigger square, so a click test checks the edge
  of the enlarged box.

### Admin screenshots

[`tests/visual/admin.spec.ts`](../tests/visual/admin.spec.ts) covers the user
list (en/ru), edit dialog, sheet list, block dialog, delete dialog and the
Games & editions section on desktop and mobile. It uses three deterministic `visual-admin-*` demo accounts with
fixed dates/roles/blocks and sheet mtimes, seeded by `scripts/visual.sh` into the
temporary data directory. When running against an external server
(`--base-url`) there is no data directory to seed, so only the admin tests are
skipped.

The profile dropdown in the header is covered separately by
[`tests/visual/user-menu.spec.ts`](../tests/visual/user-menu.spec.ts): regular
user (en/ru) and administrator (with the Administration item), desktop and
mobile. The same spec covers the Display Settings modal and the dashboard at
80% UI scale; the theme switcher is in `themes.spec.ts`, and the import dialog
is in `pages.spec.ts`; the creation wizard (game → edition → form), `/demo`
with one character per edition, and the dashboard game/edition badges also live
there.

### Determinism

- Viewport, DPR, `locale: 'en-US'`, `timezoneId: 'UTC'`, `colorScheme: 'light'`
  and `reducedMotion: 'reduce'` are fixed; animations are disabled, the caret is
  hidden, `document.fonts.ready` is awaited, and screenshots use `scale: 'css'`,
  so PNGs do not depend on the device pixel ratio.
- `fullyParallel: false` (tests inside a file share one scenario), `workers: 4`
  (`DCS_VISUAL_WORKERS` overrides it), `retries: 2`, `timeout: 90 s`,
  `expect.timeout: 15 s`, `threshold: 0.2`, `maxDiffPixelRatio: 0.002`.
- Host fonts ship only the `latin` subset (`src/app/layout.tsx`), so Cyrillic
  UI text falls back to the system `sans-serif` face. The baselines were
  captured with DejaVu Sans as that fallback; installing Arial-metric fonts
  (`fonts-liberation`, often pulled in by `playwright install-deps`) makes
  `Arial` resolve to Liberation Sans and shifts every RU screenshot. Check with
  `fc-match Arial` before updating or comparing baselines.
- The app lives in `h-dvh` + `overflow: hidden`, so Chromium draws content below
  the viewport non-deterministically. `screenshotElement` pins an element that is
  taller than its scroll container to the top of `<main>` and captures the
  visible part via `clip`.
- Fixtures carry fixed dates and ids; a dynamic block (counter, avatar, date) is
  `mask`ed instead of being baked into the baseline.

### Baselines

Names encode `<page>-[dnd|dh]-[field]-<en|ru>` (the game token only on game
screens); `snapshotPathTemplate` in `playwright.config.ts` defines the directory
`tests/visual/__screenshots__/<project>/<spec>/`. A static guard,
`tests/unit/visual-naming.test.ts`, fails on a wrong name, an orphaned PNG, a
screenshot without a baseline and on missing required coverage. Coverage is not
hardcoded in the test: each plugin declares its name segment and required
languages/sections in `src/games/<id>/tests/visual.json`, the host keeps only the
game-agnostic screens — that test, not this page, is the source of truth for
what has to exist.

The set is a few hundred PNGs (~11 MB): most screens have a desktop and a mobile
baseline, and `tablet.spec.ts` owns the eight tablet ones. There is deliberately
no hand-written list of names or counts here — `npm run test:visual -- --list`
prints the specs and tests, and the HTML report shows current coverage, so the
numbers cannot drift away from the code.

Updating, only when the layout changed on purpose:

1. `npm run test:visual:update` (or `--update-snapshots` for one spec).
2. Review `git diff --stat tests/visual/__screenshots__` and the PNGs themselves.
   On failure Playwright leaves `<name>-expected.png`, `<name>-actual.png`,
   `<name>-diff.png` and `trace.zip` in `test-results/visual/<test>/`
   (`npx playwright show-trace …`).
3. Commit sources and baselines together. Never re-baseline a failing test
   without looking at the diff — that diff is the signal the suite exists for.

Baselines are sensitive to the OS and fonts: capture and compare them in one
environment (Linux, ideally the official Playwright Docker image matching
`npx playwright --version`). A diff "out of nowhere" usually means a different
OS or missing fonts.

### Spec map

| Spec | Covers |
| --- | --- |
| `pages.spec.ts` | Login (sign-in, registration, recovery), dashboard, `/demo`, settings, creation wizard, import dialog and the post-import creation review |
| `basic-pages.spec.ts` | Guest header, adaptivity, compact vs normal sheet view, cross-tab sync, functional checks without PNGs |
| `creation.spec.ts` | UI sign-in and the guest draft → account flow (host-level, no game blocks) |
| `form-validation.spec.ts` | Invalid create-form submit: toast, `aria-invalid`, focus on the first field |
| `locale.spec.ts` | Russian locale for both sheets |
| `dialogs.spec.ts` | Host-level dialog geometry only (centered, inside the viewport); the dialog screens themselves live with the games |
| `themes.spec.ts` | Light / dark / warm themes |
| `user-menu.spec.ts` | Profile menu (user, admin, RU), display settings, 80% UI scale |
| `admin.spec.ts` | `/admin`: users, edit/block/delete dialogs, sheet list, games & editions |
| `share.spec.ts` | Guest read-only share link, optional history tab, invalid link, owner dialog |
| `history.spec.ts` | Character history timeline, empty state, and DH1/DH2 label/code checks |
| `robustness.spec.ts` | Load failures: not-found and retry screens |
| `i18n-raw.spec.ts` | No raw translation keys in the rendered UI |
| `tablet.spec.ts` | Host-only tablet 1024×768 screens: dashboard and settings |

Game sheets are hosted by the plugins, not by `tests/visual`:

| Plugin spec | Covers |
| --- | --- |
| `dnd5e/tests/visual/dialogs.visual.spec.ts` | D&D 5e quest journal (en/ru), house rules (desktop/mobile, ru), notes (desktop/mobile), divine boons (desktop/mobile, ru) |
| `dh1/tests/visual/dialogs.visual.spec.ts` | DH1 quest journal (en/ru), house rules (desktop/mobile), notes (desktop/mobile, ru), the XP-log sheet and notes saving from the Sheet |
| `dnd5e/tests/visual/sheets.visual.spec.ts` | D&D 5e sheet in read mode (desktop elements, mobile sections, tablet 1024×768) |
| `dnd5e/tests/visual/editing.visual.spec.ts` | D&D 5e edit mode |
| `dnd5e/tests/visual/creation.visual.spec.ts` | D&D 5e creation form → sheet |
| `dh1/tests/visual/sheets.visual.spec.ts` | Dark Heresy 1e sheet in read mode, tablet top/compact and the notes dialog |
| `dh1/tests/visual/editing.visual.spec.ts` | DH1 edit mode, creation locks, conditions, free experience |
| `dh1/tests/visual/creation.visual.spec.ts` | DH1 creation, weapons, XP awards |
| `dh2/tests/visual/sheets.visual.spec.ts` | DH2 sheet in read mode (own segment `dh2`): desktop elements, RU, mobile sections, edit mode, tablet top/compact, notes and house-rules dialogs |
| `dh2/tests/visual/creation.visual.spec.ts` | DH2 creation choices, Enemies options, gender/background, guest draft, weapons, XP awards |
| `dh2/tests/visual/editing.visual.spec.ts` | DH2 creation locks, free experience |

Tests that only make sense in one project are tagged `@desktop`/`@mobile` and
filtered with `grepInvert`, so the report has no skipped duplicates.
`npm run test:visual:fast` (`@fast`, ~30 tests) is the iteration subset.

### Limits

- Pixel comparison does not judge meaning: a "correct" baseline can come from an
  already broken layout. Review the first run by eye.
- Not every state is covered (tooltips, long names, empty lists, API errors);
  extend the suite as bugs appear.
- Baselines are binary and grow with the matrix; if the set outgrows a few
  hundred megabytes, Git LFS is the escape hatch.
- A full run is sequential within a file and takes several minutes even with
  four workers — the price of stable screenshots. Use `--skip-build` and
  `--grep` for iteration.

## Pre-deploy gate

`npm run verify` runs [`scripts/predeploy.sh`](../scripts/predeploy.sh):

1. lockfile check (`npm ci --dry-run`);
2. line endings: LF in the index and the working tree (`npm run eol:check`);
3. Prettier check;
4. ESLint, plugin boundaries/registry, core purity and reverse imports;
5. TypeScript;
6. unit tests;
7. production build;
8. HTTP smoke test against a temporary server.

Useful flags: `--skip-build`, `--skip-unit`, `--skip-smoke`, `--base-url URL`,
`--keep` (keep the temp data/logs). The real `./data` is never touched.

## Performance checks

These checks are **not** part of `npm run verify`: load, race and fsync-heavy
benchmarks are noisy and slow. Run them on demand from a built checkout.

```bash
npm run bench                 # microbenchmarks (vitest bench, report only)
npm run test:race -- --assert # HTTP correctness races, exit 1 on failure
npm run test:load -- --vus 50 --sheets 10 --duration 10 --warmup 3
npm run test:load -- ... --assert
npm run test:perf             # Playwright @perf: web-vitals, chunk budget, Excel worker
```

`test:perf` runs against a throwaway production server, like `test:load`. It
uses the local `.playwright-browsers` bundle when present, measures LCP/CLS and
first-input on `/demo` and `/login`, sums initial JS chunks, and starts the
built Excel worker directly to prove it returns a non-empty xlsx. Budgets live in
`tests/perf/web-vitals.spec.ts` (LCP 4 s, CLS 0.1, first-input 500 ms, JS 5 MiB).

`test:load` starts a throwaway production server with a temporary
`DCS_DATA_DIR`, seeds 50 users × 10 sheets over HTTP, and runs six autocannon
scenarios: `read-list`, `save-own`, `save-parallel`, `mixed`, `login-storm`,
`share-page`. It records p50/p95/p99, RPS, status codes, and the server's event
loop delay (`perf_hooks.monitorEventLoopDelay`, loaded through a preload probe).
Reports land in `.perf-results/` (gitignored), as JSON plus a markdown summary.

The working copy lives on a 9p mount (`D:\` under WSL), which makes fsync and
small-file I/O unrepresentative. For measurements, make a full copy on ext4 and
build there, then point the runner at it:

```bash
tar -C . -cf - --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=.perf-results . | tar -C /tmp/dcs-perf-app -xf -
cd /tmp/dcs-perf-app && npm ci && npm run build
cd - && npm run test:load -- --app-dir /tmp/dcs-perf-app --assert --warmup 3
```

Calibrated gate (50 VU × 10 sheets, warmup 3 s; baseline and reasons are in the
perf tracker): all scenarios 0 errors/non-2xx; `save-parallel` RPS ≥ 239
(2× baseline, fsync ceiling ≈ 256 rps); p95 ≤ baseline for read-list/save/
login/mixed; event-loop p99 ≤ 75 ms for the API scenarios and ≤ 200 ms for the
HTML `share-page`. Without `--assert` the runner is report-only.

`npm run bench` is report-only too: compare the medians with the figures in the
perf tracker; a ±20–30 % drift is the review signal. Re-run `--warmup 3` before
comparing load numbers: without warm-up the first seconds are JIT/GC noise.

## Related

- [development.md](development.md) — scripts and code style
- [admin.md](admin.md) — admin behaviour covered by the tests
- [api.md](api.md) — endpoints covered by smoke/OpenAPI tests

## Test layout ratchet

`npm run test:layout` (`scripts/tests/check-test-layout.mjs`) keeps tests of a
single edition out of the host and caps file size. It also ratchets **game
mentions** in `tests/visual/**` and `tests/support/**`: the number of
identifiers and string literals that name an edition may only go down
(`GAME_MENTION_ALLOWANCE`, each entry with a reason and a removal deadline).
An empty entry is an error — debt has to be removed, not parked.
