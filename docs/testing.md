# Testing

Four layers: unit tests, an HTTP smoke test, Playwright visual regression, and
the pre-deploy gate that ties them together. None of them touch your real
`./data` directory.

## Commands

```bash
npm test                    # unit tests (Vitest)
npm run verify              # full pre-deploy gate
npm run test:visual         # Playwright screenshot regression (full)
npm run test:visual:full    # explicit alias for the full visual run
npm run test:visual:fast    # screenshots tagged @fast (~30 tests)
npm run test:visual:changed # only specs affected by the current diff
npm run test:visual:prune   # list obsolete PNG baselines
npm run test:visual:update  # rewrite baselines
npm run test:visual:report  # open the HTML report
npm run test:dev            # dev-proxy hydration + health/version smoke
```

## Plugin conformance

`npm run plugins:conformance` runs the plugin contract suite:

- `plugins-registry.test.ts` — generated registry/i18n match the manifests; every
  manifest ↔ module field and entry point; defaults/demo vs schema;
- `plugin-slots.test.ts` — lazy UI slots load and are exactly the declared ones;
  labels/keys, read-only boundary state;
- `bulk-editor.test.ts` — `/stats-editor` tables: columns, defaults, save patches;
- `example-plugin.test.ts` — the reference fixture (custom sheet/form/i18n/slots)
  installed into a temporary `src/games/` and run through the same generator.

`npm run plugins:boundaries` enforces the import rules (the legacy allowlist is
empty), `npm run plugins:check` fails when the generated files are stale.

## Unit tests

- Runner: Vitest (`tests/unit/*.test.ts`), Node environment.
- They create a temporary data directory (`DCS_DATA_DIR`) per test and remove it
  afterwards; they never read or write the real data directory.
- API route handlers are imported and called as ordinary functions with a
  `Request`; no HTTP server is started.
- Covered areas: auth and profile updates, account deletion, recovery, file
  storage/locks/atomic writes, character schema v2 migration, export/import 3.0
  (JSON and Excel), the game registry/module contract, game catalog visibility
  and module-access matrix, translations parity and hardcoded-UI checks,
  OpenAPI document and route coverage, admin API and bootstrap, health/version,
  the read-only share registry/API (`shares.json`, rotation, expiry,
  revocation, cleanup), and the character history (diff engine, JSONL store,
  compaction, recording, owner-only API, labels).
- `tests/unit/openapi.test.ts` compares the OpenAPI spec with every
  `src/app/api/**/route.ts`; a new endpoint without documentation fails it.

### Writing a unit test

- Name the file `tests/unit/<topic>.test.ts`; `vitest.config.ts` picks up
  `tests/**/*.test.ts` (Playwright specs are not part of this run). One file per
  module or one cross-cutting topic.
- Anything that writes to disk creates a temporary data directory in
  `beforeEach` (`useTempDataDir()`) and removes it in `afterEach`
  (`removeDir(dataDir)`). The real `./data` is never touched.
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

A full run takes roughly 30–60 s. `testTimeout` and `hookTimeout` are 20 s:
`plugin-slots.test.ts` dynamically imports every game sheet, and on a loaded
machine those imports alone can exceed 20 s. Do not run heavy jobs (another full
suite, a build) in parallel with `npm test`; if you have to, raise the timeout.

### Common failures

| Symptom | Cause / fix |
| --- | --- |
| `DCS_DATA_DIR` leaks between tests; a sheet is visible to another account | Missing `useTempDataDir()` in `beforeEach` / `removeDir(dataDir)` in `afterEach` |
| `FileReader is not defined` | The file is outside `tests/**/*.test.ts`, or `setupFiles` lost `tests/unit/setup.ts` |
| `console.error` noise from expected errors | Stub it with `vi.spyOn(console, 'error')` and restore it |
| `visual-naming` reports a missing section or baseline | Add the screenshot with the right name (see Visual regression) or extend `REQUIRED_*` in that spec |
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

## Visual regression

Playwright renders the app in Chromium and compares screenshots with the
baselines in `tests/visual/__screenshots__/`.

- Projects: `desktop` (1440×900) and `mobile` (Pixel 7); `tablet` (1024×768)
  only for `tests/visual/tablet.spec.ts`.
- Data is isolated per worker: global-setup creates a canonical `visual-tests`
  account and one account per worker, each with the same fixtures.
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
- `history.spec.ts` covers the owner timeline (desktop/mobile) and the empty
  state after clearing. History fixtures are written into the temporary data
  directory with fixed dates, so PNGs do not drift.

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
screenshot without a baseline and on missing required coverage
(`REQUIRED_LANGS`, `REQUIRED_SECTIONS`, `REQUIRED_EDIT_SECTIONS`) — that test,
not this page, is the source of truth for what has to exist.

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
| `pages.spec.ts` | Login (sign-in, registration, recovery), dashboard, `/demo`, settings, creation wizard |
| `basic-pages.spec.ts` | Guest header, adaptivity, compact vs normal sheet view, cross-tab sync, functional checks without PNGs |
| `creation.spec.ts` | UI sign-in, character creation for both editions, guest draft → account |
| `form-validation.spec.ts` | Invalid create-form submit: toast, `aria-invalid`, focus on the first field |
| `sheets.spec.ts` | Sheet reading, D&D and Dark Heresy |
| `editing.spec.ts` | Edit mode for both sheets |
| `locale.spec.ts` | Russian locale for both sheets |
| `dialogs.spec.ts` | Quest journal, house rules, notes, divine boons (D&D only) |
| `themes.spec.ts` | Light / dark / warm themes |
| `user-menu.spec.ts` | Profile menu (user, admin, RU), display settings, 80% UI scale |
| `admin.spec.ts` | `/admin`: users, edit/block/delete dialogs, sheet list, games & editions |
| `share.spec.ts` | Guest read-only share link, optional history tab, invalid link, owner dialog |
| `history.spec.ts` | Character history timeline and the empty state after clearing |
| `robustness.spec.ts` | Load failures: not-found and retry screens |
| `i18n-raw.spec.ts` | No raw translation keys in the rendered UI |
| `tablet.spec.ts` | Tablet 1024×768 project only |

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
2. Prettier check;
3. ESLint;
4. TypeScript;
5. unit tests;
6. production build;
7. HTTP smoke test against a temporary server.

Useful flags: `--skip-build`, `--skip-unit`, `--skip-smoke`, `--base-url URL`,
`--keep` (keep the temp data/logs). The real `./data` is never touched.

## Related

- [development.md](development.md) — scripts and code style
- [admin.md](admin.md) — admin behaviour covered by the tests
- [api.md](api.md) — endpoints covered by smoke/OpenAPI tests
