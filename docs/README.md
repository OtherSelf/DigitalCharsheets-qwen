# Documentation

Project documentation for **Digital Character Sheets**. The root
[`README.md`](../README.md) stays short: what the project is, its features, a
quick start and links. Everything that is useful while developing, testing or
deploying lives here, one topic per page.

## Map

| File | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Stack, application layout, auth/session flow, startup checks, client state |
| [game-modules.md](game-modules.md) | How a game/edition module is added, the registry contract and module layout |
| [data-storage.md](data-storage.md) | On-disk data layout, user schema, locks, atomic writes, backups |
| [api.md](api.md) | HTTP API, OpenAPI/Scalar docs, auth, endpoint map |
| [admin.md](admin.md) | `/admin`, roles, first administrator, profile checks, block/delete rules |
| [export-format.md](export-format.md) | Portable JSON/Excel export envelope and import rules |
| [development.md](development.md) | Local setup, npm scripts, code style, formatting, lint, typecheck |
| [i18n.md](i18n.md) | Translation keys, naming conventions, RU/EN rules and i18n tests |
| [testing.md](testing.md) | Unit, smoke, visual regression and the pre-deploy gate |
| [deployment.md](deployment.md) | Production start, environment variables, data dir, HTTPS, backups |
| [blueprint.md](blueprint.md) | Original app concept (historical, kept as-is) |
| [backend.json](backend.json) | Original Firebase Studio entity schema (historical, kept as-is) |

## What belongs where

- **`README.md`** — product-facing only: what the app is, feature bullets, quick
  start, production one-liner and links. No process details, no test recipes, no
  code-style rules.
- **`docs/`** — engineering details: architecture, storage, API, admin,
  development, testing, deployment, formats. This is the place for "how it
  works" and "how to work on it".
- **Do not** put transient status, progress logs, audit dumps or a backlog here.
  Those belong in issues / the external backlog. Docs describe the current
  state, not the history of getting there.
- **No secrets.** Never paste tokens, passwords, session values, real user data
  or production hostnames into docs.
- **One topic per file**, kebab-case filename (`data-storage.md`, not
  `DataStorageFinal.md`). Add every new page to the map above.
- **Link to code** with relative paths, e.g.
  [`src/lib/session.ts`](../src/lib/session.ts). Prefer linking a file over
  pasting large code blocks; keep only small, illustrative snippets.
- **Keep it in sync.** If a change alters behaviour, update the relevant page in
  the same change. If a page becomes obsolete, remove it or mark it historical.
- **Historical files** (`blueprint.md`, `backend.json`) are the original
  concept/schema. Don't rewrite them to match the current app; link to them when
  context is useful.

## Page template

````markdown
# Title

One or two sentences: what this page answers and who it is for.

## Overview

Short context, key terms, the main idea.

## Details

The actual behaviour, rules, formats, tables.

## Examples

Commands, payloads or a minimal walkthrough.

## Related

- [Other page](other-page.md)
- [`src/path/to/file.ts`](../src/path/to/file.ts)
````

## Conventions

- Language: **English**, matching the README and the existing blueprint. Code
  identifiers, file names and API fields stay as-is.
- Commands go in fenced `bash` blocks; environment variables and paths go in
  backticks.
- Dates use ISO 8601 (`2026-01-01T00:00:00.000Z`).
- Tables are fine for schemas and endpoint maps; keep the columns short.
- When in doubt, prefer a smaller page with links over one giant document.
