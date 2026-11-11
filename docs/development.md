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
| `npm run format` | Prettier: formatting + import sorting + Tailwind class sorting. |
| `npm run format:check` | Prettier check (CI/pre-commit gate). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Unit tests (Vitest). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:smoke` | HTTP smoke test against a running server (default `http://localhost:3000`). |
| `npm run test:dev` | Dev-proxy smoke: hydration through known dev hosts + `/api/health`/`/api/version`. |
| `npm run test:visual` | Playwright visual regression (full). |
| `npm run test:visual:fast` | Visual subset tagged `@fast`. |
| `npm run test:visual:update` | Rewrite visual baselines. |
| `npm run test:visual:report` | Open the Playwright HTML report. |
| `npm run verify` | Full pre-deploy gate: format + lint + typecheck + unit + build + smoke. |

Testing details: [testing.md](testing.md).

## Code style

The Python equivalent of `isort --profile black .; black .` here is:

```bash
npm run format         # prettier --write . — import sorting + formatting
npm run format:check   # prettier --check . — CI / pre-commit gate
npm run lint           # eslint . — hooks, async, React/Next correctness
npm run lint:fix       # eslint . --fix — safe autofixes only
```

- **Prettier** — formatting (the `black` part), config in
  [`prettier.config.mjs`](../prettier.config.mjs).
- **`@ianvs/prettier-plugin-sort-imports`** — the `isort` part: groups imports
  as builtin → `react`/`next` → third-party → `@/…` → relative, and sorts them.
- **`prettier-plugin-tailwindcss`** — sorts Tailwind classes inside `className`.
- `.prettierignore` keeps `.next`, `node_modules`, Playwright reports, `data/`,
  `public/` and `*.md` out of the run.
- **ESLint** (flat config, `next/core-web-vitals` + `next/typescript`) — the part
  neither Prettier nor `tsc` covers: `react-hooks/exhaustive-deps`, async
  handlers in `onClick`/`onSubmit`, a11y and Next-specific rules. Errors block
  `npm run verify`; warnings (known `exhaustive-deps` and unused locals) are
  printed but do not block.

Markdown files are not formatted by Prettier (`*.md` is ignored). Keep docs
readable manually and follow [docs/README.md](README.md).

## Dependencies

- Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript 6.
- Lockfile is the source of truth; use `npm ci` for clean installs.
- The Scalar docs dependency lives in `dependencies` because `/api/docs` needs
  it at runtime.

## Related

- [testing.md](testing.md) — unit/smoke/visual/pre-deploy
- [deployment.md](deployment.md) — production environment
- [architecture.md](architecture.md) — how the app is structured
