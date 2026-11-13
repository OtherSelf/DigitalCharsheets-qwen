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
npm run test:visual:fast    # screenshots tagged @fast (~28 tests)
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
  and the read-only share registry/API (`shares.json`, rotation, expiry,
  revocation, cleanup).
- `tests/unit/openapi.test.ts` compares the OpenAPI spec with every
  `src/app/api/**/route.ts`; a new endpoint without documentation fails it.

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
hashed token on disk, revoke), and — with `--data-dir` — the on-disk
`user.json`, login index
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
- `share.spec.ts` covers the public read-only link (desktop/mobile), the invalid
  link and the owner dialog. Its link is seeded directly into the temporary
  data directory; with `--base-url` there is no data directory, so the share
  screenshots are skipped like the admin ones.

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
