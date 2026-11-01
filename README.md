# DnD and Dark Heresy digital charsheet app

My AI-slop-web app that I'm making for the fun (and potential usability) of it.

Feel free to use it as you wish.

Working with Google Firebase Studio gave me a mental trauma and irreplacible brain damage, so just ignore the files descriptions. 

Qwen helped me finish this. All hail AI.

## Tests (before deploying)

```bash
npm test            # 76 unit tests (vitest), ~6 s
npm run verify      # full pre-deploy gate: typecheck + tests + build + HTTP smoke test
```

`npm run verify` runs `scripts/predeploy.sh`: it builds, starts a throwaway
production server on a free port with a temporary `DCS_DATA_DIR`, runs
`scripts/smoke.mjs` against it (pages, auth, character CRUD, export, on-disk
files) and shuts it down. Your real `./data` is never touched.

Details (in Russian): `RUN_INSTRUCTIONS.md` §2.5. Smoke against a running
server: `npm run test:smoke -- -u http://localhost:3000`.
