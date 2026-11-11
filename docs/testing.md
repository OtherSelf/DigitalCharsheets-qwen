# Testing

Four layers: unit tests, an HTTP smoke test, Playwright visual regression, and
the pre-deploy gate that ties them together. None of them touch your real
`./data` directory.

## Commands

```bash
npm test                    # unit tests (Vitest)
npm run verify              # full pre-deploy gate
npm run test:visual         # Playwright screenshot regression (full)
npm run test:visual:fast    # screenshots tagged @fast
npm run test:visual:update  # rewrite baselines
npm run test:visual:report  # open the HTML report
npm run test:dev            # dev-proxy hydration + health/version smoke
```

## Unit tests

- Runner: Vitest (`tests/unit/*.test.ts`), Node environment.
- They create a temporary data directory (`DCS_DATA_DIR`) per test and remove it
  afterwards; they never read or write the real data directory.
- API route handlers are imported and called as ordinary functions with a
  `Request`; no HTTP server is started.
- Covered areas: auth and profile updates, account deletion, recovery, file
  storage/locks/atomic writes, export/import, translations parity, OpenAPI
  document and route coverage, admin API and bootstrap, health/version.
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
`/api/version`, and — with `--data-dir` — the on-disk `user.json`, login index
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

Useful flags:

```bash
bash scripts/visual.sh --skip-build
bash scripts/visual.sh --grep "admin"
bash scripts/visual.sh --update-snapshots
bash scripts/visual.sh --base-url http://127.0.0.1:3000
```

### Admin screenshots

[`tests/visual/admin.spec.ts`](../tests/visual/admin.spec.ts) covers the user
list (en/ru), edit dialog, sheet list, block dialog and delete dialog on desktop
and mobile. It uses three deterministic `visual-admin-*` demo accounts with
fixed dates/roles/blocks and sheet mtimes, seeded by `scripts/visual.sh` into the
temporary data directory. When running against an external server
(`--base-url`) there is no data directory to seed, so only the admin tests are
skipped.

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
