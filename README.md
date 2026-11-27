# Digital Character Sheets

A **self-hosted** web app for creating, editing and playing with **Dungeons &
Dragons 5e** and **Dark Heresy** character sheets. Run it on your own server or
local machine — your data stays under your control.

It started as a Firebase Studio prototype, was finished with Qwen assistance, and
is now a Next.js App Router application that keeps everything in JSON files in a
data directory on the host you control.

## Features

- Full character sheets for D&D 5e and Dark Heresy (stats, skills, combat,
  inventory, spells, psychic powers, quest journal, notes).
- **Games are plugins:** a game/edition is a folder + `plugin.json` + custom
  React sheet/form, discovered at build time. Adding one needs no core edits —
  see [docs/plugin-sdk.md](docs/plugin-sdk.md).
- Local accounts with a recovery phrase, password change and account deletion.
- **Read-only guest links:** share one sheet with a game master or friend; the
  link needs no account, is revocable and expires, and the sheet cannot be
  edited. History can be included per link (off by default). See
  [docs/sharing.md](docs/sharing.md).
- **Change history:** every save leaves a readable diff, grouped by game
  sessions, for long campaigns. It is owner-only and bounded; see
  [docs/character-history.md](docs/character-history.md).
- Admin panel at `/admin`: users, roles, password resets, blocking, deletion, a
  read-only list of a user's sheets, and plugin management (visibility,
  enabled, versions, conformance, demo links).
- Portable JSON export/import for one sheet or a full backup, plus Excel export.
- Optional two-factor authentication (TOTP) with QR enrollment and one-time
  backup codes.
- English/Russian UI, light/dark/warm themes, compact sheet view, independent
  text and UI scaling, and an optional «keep the screen on» toggle in the display
  settings for long sessions.
- **Self-hosted:** run it on your own server or local machine. The app itself
  needs no database, cloud account or external service.

## Quick start

Requirements: **Node.js >= 22.12** and npm 11 (`.nvmrc` points to 24).

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

- Data lives in `./data` and is gitignored. Point the app elsewhere with
  `DCS_DATA_DIR=/path/to/data`.
- On the first start the app creates a service administrator if there is no
  active one. The generated login and password are printed to the server console
  and written to `data/.initial-admin.txt` (mode `0600`) — change the password
  after the first login. See [docs/admin.md](docs/admin.md).

## Production

```bash
npm run build
npm start
```

Set `DCS_DATA_DIR` to a persistent writable directory and run behind HTTPS; the
session cookie is `Secure` and uses the `__Host-` prefix in production by
default. `DCS_COOKIE_INSECURE=1` is a local-http opt-out only. The full
environment-variable table and backup notes are in
[docs/deployment.md](docs/deployment.md).

## Documentation

Start at **[docs/README.md](docs/README.md)** — it explains the structure and
rules for adding documentation. The same pages are rendered by the app at
`/docs` (no sign-in), and the API reference stays at `/api/docs`. Useful pages:

- [Plugin SDK](docs/plugin-sdk.md) — how to add a game/edition (`plugin.json`,
  UI slots, i18n, migrations, conformance).
- [Architecture](docs/architecture.md) — stack, auth/session, startup checks.
- [Data storage](docs/data-storage.md) — on-disk layout and `user.json` schema.
- [HTTP API](docs/api.md) — endpoints and the `/api/docs` / `/api/openapi.json`
  reference; human-readable docs are at `/docs`.
- [Administration](docs/admin.md) — `/admin`, roles, first administrator.
- [Export format](docs/export-format.md) — portable JSON/Excel envelope.
- [Development](docs/development.md) — setup, scripts, code style, release versions.
- [Changelog](CHANGELOG.md) — released app and plugin SDK versions. Game
  plugins have their own: [DH1](src/games/dh1/CHANGELOG.md),
  [DH2](src/games/dh2/CHANGELOG.md), [D&D 5e](src/games/dnd5e/CHANGELOG.md),
  [sandbox](src/games/sandbox/CHANGELOG.md).
- [Testing](docs/testing.md) — unit, smoke, visual and pre-deploy checks.
- [Deployment](docs/deployment.md) — production start, env vars, backups.
- [Security policy](SECURITY.md) — reporting a vulnerability, scope, secure
  configuration and known residual risks.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix/shadcn ·
local JSON storage · Vitest · Playwright.

## License

The source code is MIT — see [LICENSE](LICENSE). The license covers the code,
not game rules, names or trademarks; the boundaries are in [NOTICE](NOTICE),
and the content rules are in [CONTENT-POLICY.md](CONTENT-POLICY.md).

Source code: <https://github.com/digitalcharsheets/digital-character-sheets>.

This project is not affiliated with, sponsored or endorsed by Wizards of the
Coast or Games Workshop. D&D, Dungeons & Dragons, Dark Heresy and Warhammer
40,000 are trademarks of their respective owners. The build ships no text from
the rulebooks: game data is limited to names, numbers and short mechanical
statements, example phrases are invented for the demo, and the player's own
text stays in the player's sheet.
