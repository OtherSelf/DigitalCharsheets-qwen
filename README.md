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
`dcs_characters_all_<login>_<YYYY-MM-DD>.json`. Import accepts only this format and
validates `appName`, `format`, version, `kind`, character fields and `characterCount`;
legacy files (a bare array, a bare character or a v1 envelope) are rejected with a
"re-export" message.

## Tests (before deploying)

```bash
npm test            # unit tests (vitest)
npm run verify      # full pre-deploy gate: typecheck + tests + build + HTTP smoke test
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
