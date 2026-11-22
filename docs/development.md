---
title: "Development"
description: "Local setup, npm scripts, code style, formatting, lint, typecheck"
---

# Development

Local setup, the npm scripts that matter day to day, and the code-style rules.

## Requirements

- Node.js **>= 22.12.0** (`package.json` engines; `.nvmrc` currently points to
  24).
- npm 11 (`packageManager: npm@11.19.0`).
- A writable data directory. The default `./data` is created automatically.

## Local setup

```bash
npm ci
npm run dev
```

`npm ci` also generates `src/games/*.generated.ts` (registry, dictionaries,
game families) via `postinstall`; the files are derived from
`src/games/*/plugin.json` and are not tracked in git. If you removed them by
hand, run `npm run plugins:generate`.

Open <http://localhost:3000>. The first server start creates the data directory,
checks/normalizes profiles and, if there is no active administrator, creates the
bootstrap admin — watch the server console or
`data/.initial-admin.txt` (see [admin.md](admin.md)).

To keep development data out of the repository, point the app at another
directory:

```bash
DCS_DATA_DIR=/tmp/dcs-dev npm run dev
```

## Production-like run

```bash
npm run build
npm start
```

Deployment details, reverse proxy and environment variables:
[deployment.md](deployment.md).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server with Turbopack. |
| `npm run build` | Production build (`NODE_ENV=production`). |
| `npm start` | Start the production server. |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`). |
| `npm run lint:fix` | Safe ESLint autofixes. |
| `npm run format` | LF normalization, then Prettier: formatting + import sorting + Tailwind class sorting. |
| `npm run format:check` | Prettier check plus the line-ending check (CI/pre-commit gate). |
| `npm run eol:check` | LF in the index and the working tree; fails on CRLF (also a step of `npm run verify`). |
| `npm run eol:fix` | Rewrite CRLF → LF in the working tree; nothing else changes (`format` runs it first). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run deadcode:check` | Dead exports and files without importers; allowlist with reasons and a `test-only` cap (also a step of `npm run verify`). |
| `npm run plugins:generate` | Regenerate `src/games/*.generated.ts` from the manifests (also `postinstall`, `predev`, `prebuild`, `pretest`). |
| `npm run plugins:check` | Compare the generated files on disk with the manifests (drift check after manual edits). |
| `npm test` | Unit tests (Vitest). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:smoke` | HTTP smoke test against a running server (default `http://localhost:3000`). |
| `npm run test:dev` | Dev-proxy smoke: hydration through known dev hosts + `/api/health`/`/api/version`. |
| `npm run test:visual` | Playwright visual regression (full). |
| `npm run test:visual:full` | Explicit alias for the full visual run. |
| `npm run test:visual:fast` | Visual subset tagged `@fast` (~28 tests). |
| `npm run test:visual:changed` | Only visual specs affected by the current diff. |
| `npm run test:visual:prune` | List obsolete PNG baselines (`--write` to delete). |
| `npm run test:visual:update` | Rewrite visual baselines. |
| `npm run test:visual:report` | Open the Playwright HTML report. |
| `npm run verify` | Full pre-deploy gate: lockfile + line endings + format + lint + typecheck + dead code + unit + build + smoke. |

Testing details: [testing.md](testing.md).

### Dead code

`npm run deadcode:check` walks the TypeScript program and fails on an exported
symbol with no references outside its declaration file, and on a `src/` file
nobody imports. It also keeps two ratchets: every allowlist entry needs a
`reason` and must still be needed, and `test-only` exports may not exceed
`TEST_ONLY_MAX`.

Deliberate exclusions — entry points and vendored code, not dead code:

- Next entry points: `src/app/**`, `src/instrumentation.ts`,
  `src/middleware.ts`;
- plugin entry files (`games/<id>/{index,ui,sheet,create-form}`) and any
  `<file>#<export>` target named by `plugin.json`;
- files marked `AUTO-GENERATED` (DH2 rule data is written by
  `src/games/dh2/scripts/generate.mjs` from the workspace `content/dh2`);
- targets of a dynamic `import()` in production code;
- `src/components/ui/**` — the vendored shadcn kit: an unused `Dialog.close` is
  upstream API, not project dead code. A kit *file* without importers is still
  reported.

What it does not see: unused local variables (ESLint `no-unused-vars`), unused
npm dependencies, dead CSS, and binary assets such as `public/*.ico`.

## Code style

The Python equivalent of `isort --profile black .; black .` here is:

```bash
npm run format         # eol:fix + prettier --write . — LF, import sorting, formatting
npm run format:check   # eol:check + prettier --check . — CI / pre-commit gate
npm run lint           # eslint . — hooks, async, React/Next correctness
npm run lint:fix       # eslint . --fix — safe autofixes only
```

- **Prettier** — formatting (the `black` part), config in
  [`prettier.config.mjs`](../prettier.config.mjs).
- **`@ianvs/prettier-plugin-sort-imports`** — the `isort` part: groups imports
  as builtin → `react`/`next` → third-party → `@/…` → relative, and sorts them.
- **`prettier-plugin-tailwindcss`** — sorts Tailwind classes inside `className`.
- `.prettierignore` keeps `.next`, `node_modules`, Playwright reports, `data/`,
  `public/` and `*.md` out of the run, plus parser-less dotfiles such as
  `.nvmrc`: Prettier cannot format them, so their line endings are covered by
  `npm run eol:check` instead.
- **ESLint** (flat config, `next/core-web-vitals` + `next/typescript`) — the part
  neither Prettier nor `tsc` covers: `react-hooks/exhaustive-deps`, async
  handlers in `onClick`/`onSubmit`, a11y and Next-specific rules. Errors block
  `npm run verify`; warnings (known `exhaustive-deps` and unused locals) are
  printed but do not block.
- **Heavy client dependencies are loaded lazily.** A static `import` of `xlsx`
  anywhere under `src/` is an ESLint error (`no-restricted-imports`, plugin
  tests excepted): the parser is needed only when the user presses "Export to
  Excel", and a chunk that big is what dies as `module factory is not available`
  in a tab opened before a dev-server restart. Load it as
  `const XLSX = await import('xlsx')` inside the handler. Config:
  [`eslint.config.mjs`](../eslint.config.mjs).

Markdown files are not formatted by Prettier (`*.md` is ignored). Keep docs
readable manually and follow [docs/README.md](README.md).

## Line endings and file modes

Text is stored as **LF** in the repository and in every working tree;
[`.gitattributes`](../.gitattributes) sets `text=auto eol=lf`, so `core.autocrlf`
on Windows cannot produce CRLF-only diffs. `.editorconfig` makes editors keep
LF, UTF-8 and a final newline.

A checkout can still end up with CRLF: a Windows shell (`>` redirection in
`cmd`) or an editor without `.editorconfig` support (Notepad) writes it, and git
normalizes the content when reading, so `git status` and `git diff` show
nothing. GitHub Desktop instead puts a yellow banner on such a file: "This file
uses 'CRLF' line endings, but Git is configured to convert them to 'LF' the next
time the file is checked out". `npm run eol:check` (a step of `npm run verify`)
reads `git ls-files --eol` and fails when a tracked text file has CRLF in the
index or in the working tree, or when a text file has no `eol=lf` rule.
`npm run eol:fix` rewrites the working tree CRLF → LF (every other byte stays as
it was), and `npm run format` runs it first. Prettier cannot do this job for
`.nvmrc`, `.gitattributes` and `*.sh` (no parser), and `*.md` is in
`.prettierignore`, so `npm run format` silently skips those files.

The repository does **not** track the executable bit: every file is `100644`,
and scripts are started through their npm wrapper or explicitly
(`bash scripts/predeploy.sh`, `node scripts/smoke.mjs`). A tracked `100755`
entry on a Windows or network-share checkout shows up as a permanent
mode-only `M` in VS Code even though the content matches.

If a fresh checkout still reports files as modified, check `git diff`: a
mode/EOL-only difference is clone noise, not an edit — `git checkout -- .`
restores the stored version and `npm run eol:fix` removes the CRLF variant. A
CRLF committed before `.gitattributes` existed is in the index: `npm run
eol:check` names such files, and `git add --renormalize .` plus a commit brings
the index back to LF.

## Dependencies

- Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript 6.
- Lockfile is the source of truth; use `npm ci` for clean installs.
- The Scalar docs dependency lives in `dependencies` because `/api/docs` needs
  it at runtime.

## Versions and changelog

[`CHANGELOG.md`](../CHANGELOG.md) follows Keep a Changelog 1.1 and Semantic
Versioning. `Unreleased` collects changes until a release; the release commit
moves them to a dated version heading and bumps `package.json`/lockfile.

The app version follows the owner's rules, not "features vs fixes":

- **MAJOR** — releases only, and only with the owner's explicit approval.
  This includes `0.x → 1.0.0`: it is a release, not an ordinary bump.
- **MINOR** — only on the owner's instruction, when a batch of changes has
  accumulated; that release gets a dated `CHANGELOG.md` section. An agent
  never raises MINOR on its own.
- **PATCH** — free to bump for ordinary fixes; a PATCH does not need a
  CHANGELOG entry (the change is described in the commit message).
- With the owner's go-ahead, `0.x → 0.y` is an ordinary MINOR; no extra
  ceremony beyond the release note.

Versions are independent:

| Axis | Source | When to bump |
|---|---|---|
| App | `package.json#version` | By the MAJOR/MINOR/PATCH rules above; MAJOR and MINOR only with the owner. |
| Game edition (plugin) | `plugin.json#version` | Any change inside `src/games/<id>/`; one minor per release, even if several books are added. |
| Sheet format | `plugin.json#schemaVersion` and `schema-version.ts` | Only when the stored character format changes; migrations must follow. |
| Plugin API | `PLUGIN_API_VERSION` in `scripts/plugins/generate.mjs` | Additive SDK change → minor (1.2.0); breaking runtime contract → major. |
| Manifest format | `PLUGIN_MANIFEST_VERSION` + `plugin.schema.json` | Breaking manifest schema (e.g. a new required field) → next integer (2). |

Game families have no separate version: their id/order/name/description come
from the `game` block of the manifests and are regenerated. A release with
`CHANGELOG.md` changes is verified with `npm run verify` and the visual suite.

## Related

- [testing.md](testing.md) — unit/smoke/visual/pre-deploy
- [deployment.md](deployment.md) — production environment
- [architecture.md](architecture.md) — how the app is structured
