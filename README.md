# DnD and Dark Heresy digital charsheet app

My AI-slop-web app that I'm making for the fun (and potential usability) of it.

Feel free to use it as you wish.

Working with Google Firebase Studio gave me a mental trauma and irreplacible brain damage, so just ignore the files descriptions. 

Qwen helped me finish this. All hail AI.

## Tests (before deploying)

```bash
npm test            # 116 unit tests (vitest), ~14 s
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

Details (in Russian): `RUN_INSTRUCTIONS.md` §2.5. Smoke against a running
server: `npm run test:smoke -- -u http://localhost:3000`.
