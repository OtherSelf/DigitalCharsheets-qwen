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
