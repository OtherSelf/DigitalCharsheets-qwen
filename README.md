# DnD and Dark Heresy digital charsheet app

My AI-slop-web app that I'm making for the fun (and potential usability) of it.

Feel free to use it as you wish.

Working with Google Firebase Studio gave me a mental trauma and irreplacible brain damage, so just ignore the files descriptions. 

Qwen helped me finish this. All hail AI.

## Export format

Both JSON exports (one character and the full backup) use the same envelope:

```json
{
  "metadata": {
    "appName": "DigitalCharsheets-qwen",
    "format": "dcs-export",
    "version": "2.0",
    "kind": "character",
    "exportDate": "2026-11-08T21:32:41.717Z",
    "characterCount": 1,
    "config": { "...": "..." }
  },
  "character": { "id": "…", "gameSystem": "Dungeons & Dragons", "name": "…" }
}
```

A full backup uses `"kind": "backup"`, `"characters": [...]` and `"account": "<login>"`.
Files are named `dcs_character_<name>_<YYYY-MM-DD>.json` and
`dcs_characters_all_<login>_<YYYY-MM-DD>.json`. The Excel export follows the same
base name (`dcs_character_<name>_<YYYY-MM-DD>.xlsx`) and starts with the same
technical block (`App`, `Format`, `Format version`, `Kind`, `Export date`,
`Character ID`, `Character`, `Game system`) before the human-readable sections;
the sheet is named after the character. Import accepts only this format and
validates `appName`, `format`, version, `kind`, character fields and `characterCount`;
legacy files (a bare array, a bare character or a v1 envelope) are rejected with a
"re-export" message.

## Administration

The admin panel lives at **`/admin`**. It is a normal Next.js page, but every
admin API call is guarded on the server: `GET /api/admin/users` answers 401
without a session and 403 for a non-admin, so opening the URL as a regular user
redirects to `/`. The role is read from `users/<uid>/user.json` — the client-side
copy in localStorage only controls whether the menu item is visible.

What the panel can do:

- list users with role / block status / character-sheet count and search them;
- edit display name and login, reset a password, promote or demote;
- block or unblock — blocking invalidates existing sessions on the next request;
- delete an account together with all of its sheets (typed-login confirmation);
- open a read-only list of a user's character sheets (name, system, class,
  level/rank, file date).

### First administrator and startup checks

`src/instrumentation.ts` runs `src/lib/startup.ts` once per server start (dev and
production). It:

1. checks every `users/<uid>/user.json` against schema v3 and fills in missing
   fields (`schemaVersion`, `role`, `isBlocked`, timestamps) without overwriting
   existing values;
2. rebuilds the derived `index/logins.json`;
3. creates a service administrator if there is no active one.

The generated account:

- login — `DCS_ADMIN_USERNAME` (default `admin`; if taken, `admin-2`, `admin-3`, …);
- password — 16 random base64url characters, printed to the server console and
  written to `<data-dir>/.initial-admin.txt` (mode 0600);
- role — `admin`, plus a `mustChangePassword` flag shown on `/settings`.

The credentials file and password stay as they are on later restarts while an
active admin exists. Change the password after the first login and delete the
file.

Known limitation: changing a password does not revoke already issued sessions
(cookies are stateless signed values). Use **Block** to cut a user off
immediately.

Admin screenshot tests live in `tests/visual/admin.spec.ts`. They use three
deterministic `visual-admin-*` demo accounts with fixed dates/roles/blocks,
seeded by `scripts/visual.sh` into the temporary data directory. When visual
tests run against an external server (`--base-url`) there is no data directory
to seed, so only the admin tests are skipped.

## Code style

The Python equivalent of `isort --profile black .; black .` here is:

```bash
npm run format         # prettier --write . — import sorting + formatting
npm run format:check   # prettier --check . — CI / pre-commit gate
npm run lint           # eslint . — hooks, async, React/Next correctness
npm run lint:fix       # eslint . --fix — safe autofixes only
```

- `prettier` — formatting (the `black` part), config in `prettier.config.mjs`.
- `@ianvs/prettier-plugin-sort-imports` — the `isort` part: groups imports as
  builtin → `react`/`next` → third-party → `@/…` → relative, and sorts them.
- `prettier-plugin-tailwindcss` — sorts Tailwind classes inside `className`.
- `.prettierignore` keeps `.next`, `node_modules`, Playwright reports, `data/`,
  `public/` and `*.md` out of the run.
- `eslint` (flat config, `next/core-web-vitals` + `next/typescript`) — the part
  neither Prettier nor `tsc` covers: `react-hooks/exhaustive-deps`, async
  handlers in `onClick`/`onSubmit`, a11y and Next-specific rules. Errors block
  `npm run verify`, warnings (known `exhaustive-deps` and unused locals) are
  printed but do not.

## Tests (before deploying)

```bash
npm test            # unit tests (vitest)
npm run verify      # full pre-deploy gate: format + lint + typecheck + tests + build + HTTP smoke test
npm run test:visual # Playwright screenshot regression: desktop + mobile
```

`npm run verify` runs `scripts/predeploy.sh`: it builds, starts a throwaway
production server on a free port with a temporary `DCS_DATA_DIR`, runs
`scripts/smoke.mjs` against it (pages, auth, character CRUD, export, on-disk
files) and shuts it down. Your real `./data` is never touched.

`npm run test:visual` renders the app in Chromium at 1440×900 and Pixel 7,
compares screenshots with the baselines in `tests/visual/__screenshots__/`,
and also checks for JS errors, horizontal overflow and mobile navigation.
Run `npx playwright install chromium` once first.
