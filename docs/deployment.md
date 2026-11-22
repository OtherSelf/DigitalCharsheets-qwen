# Deployment

The app ships as a **self-hosted Next.js server** with a data directory on
infrastructure you control. There is no database, no external queue and no
required cloud service.

## Build and start

```bash
npm ci
npm run build
npm start
```

The server listens on port `3000` by default; set `PORT` to change it.

The build needs the dev dependencies; the runtime needs the production
dependencies and the generated `.next/` directory.

## Deploy scripts

Two operator scripts live in `scripts/` and are versioned with the code; run them
as `bash scripts/<name>.sh` (scripts carry no executable bit). They replace the
manual command chains and print what they did and what failed.

`scripts/dcs-prod.sh` automates the production update that used to be
`git pull && npm ci && npm run build && sudo systemctl restart dcs-prod`:

- refuses a dirty checkout (`--allow-dirty` overrides) and only fast-forwards
  (`git merge --ff-only`), so production history is never rewritten;
- if `npm ci` or `npm run build` fails, the service is **not** restarted and the
  previous version keeps serving;
- after `systemctl restart` it waits for `200` from `/api/health` and prints the
  resulting branch, commit, unit state and health;
- flags `--dir`, `--branch`, `--service`, `--health-url`, `--skip-pull`,
  `--skip-build`, `--no-restart`, `--no-health`, `--allow-dirty`; commands
  `deploy`, `status`, `logs [N]`, `restart`;
- it may be started from the production checkout itself: when the script file
  sits inside the updated tree, it copies itself to a temporary file first, so
  the merge cannot rewrite the script while it runs.

`scripts/dcs-dev.sh` keeps the test bench in a `screen` session: it
clones/updates a separate checkout (`/opt/dcs-dev`, port `3001` by default), runs
`npm run dev`, and can stop, restart, show logs, reset data and run smoke tests
against the bench. It can be started from any checkout, including the bench
directory itself: in that case it copies itself to a temporary file before
updating, so `git reset` does not rewrite the script while it runs.

`deploy` and `restart` delete the bench's `.next` before starting the server: the
Turbopack cache belongs to one dev-server process, and a tab opened before the
restart dies with `module factory is not available` when it patches the previous
module graph. Only `.next` is removed — `data/` and `node_modules/` stay. The
first page after such a restart compiles from scratch, so it is slower than a
plain `start`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DCS_DATA_DIR` | `./data` | Directory with users, sheets and the login index. Must be writable. |
| `DCS_GIT_COMMIT` | local `.git` (HEAD) | Commit SHA shown by `/api/version` and the UI version line, and the source of `deploymentId` for production builds (see below). `GIT_COMMIT` / `VERCEL_GIT_COMMIT_SHA` are accepted too. Without env the local checkout is read, so a plain `next start` from a clone already reports its commit; in an image without `.git` set this explicitly at build time. |
| `DCS_GIT_BRANCH` | `.git` HEAD branch | Branch shown in the version tooltip (`GIT_BRANCH` / `VERCEL_GIT_COMMIT_REF` are accepted). Only the tooltip displays it. |
| `DCS_BUILD_DATE` | unset | Build date shown in the version tooltip (`null` when unset). |
| `DCS_SESSION_SECRET` | `<data-dir>/.session-secret` | HMAC key for session cookies. Set explicitly if several instances/processes share one data dir or if the data dir is ephemeral. |
| `DCS_HISTORY_MAX_BYTES` | `2097152` (2 MiB) | Per-sheet history limit, clamped to 64 KiB … 64 MiB. Older revisions are dropped with a truncation marker. |
| `DCS_COOKIE_SECURE` | unset | `1` forces the `Secure` flag on the session cookie. It is already on by default in production; this variable is a compatible way to enable it in development. |
| `DCS_COOKIE_INSECURE` | unset | `1` explicitly disables the `Secure` flag (local plain-HTTP development only). |
| `DCS_ADMIN_USERNAME` | `admin` | Preferred login for the bootstrap administrator; `admin-2`, … if taken. |
| `UV_THREADPOOL_SIZE` | `4` (Node default) | libuv pool for async fs and scrypt. `8`–`16` measured better under load (`8` gave 71 rps on login-storm vs 66.8 at the default); set it in the service unit. |
| `PORT` | `3000` | HTTP port. |

See [data-storage.md](data-storage.md) for the directory layout.

## Health checks

`GET /api/health` is meant for Docker `HEALTHCHECK`, reverse proxies and
monitoring:

- `200` with `status: "ok"` — process is up and the data directory is writable;
- `503` with `status: "degraded"` — the data directory is missing/read-only;
- no authentication, no filesystem paths, `Cache-Control: no-store`.

`GET /api/version` returns the application version and build metadata (see
`DCS_GIT_COMMIT` / `DCS_BUILD_DATE` above), including the `buildId` that the
browser uses to notice a new build — see
[New build and stale tabs](#new-build-and-stale-tabs). Both endpoints are
documented in [api.md](api.md) and in `/api/docs`.

The route is dynamic, so `DCS_GIT_COMMIT` is read at request time: exporting it
before `next start` is enough, no rebuild required. The value (shortened to
seven characters, `commitShort`) is what the profile menu shows as
`v0.3.0 · a077aef`; without the variable the menu prints the version alone.

The application version is `version` from the root `package.json`. Bump it and
rebuild:

```bash
npm version patch --no-git-tag-version   # updates package.json + package-lock.json
npm run build
```

`commit`/`buildDate` are build metadata, not part of the package version.

Example:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

## New build and stale tabs

A tab left open across a deploy or a dev-server restart must not keep running
old client code: the HTML it loaded points at content-hashed chunks that the new
build has already replaced, so the tab gets 404s, a dead "sheet unavailable"
card, or `module factory is not available` in development. Two mechanisms cover
that.

**Server side: `deploymentId`.** Production builds set `deploymentId` in
`next.config.ts` from `DCS_GIT_COMMIT`, then `GIT_COMMIT`, then the checkout's
HEAD; `next start` re-reads the same config, so the baked and the runtime value
agree. Next appends `?dpl=` to static-asset URLs, injects `data-dpl-id` into the
HTML and hard-navigates when the browser still runs an older build. In an image
without `.git` set `DCS_GIT_COMMIT` at build time, or expect no `?dpl=` (the
watcher below still works).

**Client side: the watcher.** A component mounted in the root layout compares
the `buildId` it was rendered with against the running server — every 15 s on a
dev server, every 60 s in production, only while the tab is visible, and
immediately on focus, visibility change and `online`. When the ids differ it
shows a banner: the app has been updated, save your changes and reload the page.
Nothing reloads automatically — the tab may hold unsaved input, and
`beforeunload` would cancel the navigation anyway. Chunk-load failures
(`ChunkLoadError`, `Failed to fetch dynamically imported module`, `module
factory is not available`, a request to `/_next/static/`) show the same banner
through `error.tsx`, `global-error.tsx`, `SheetErrorBoundary` and the `window`
listeners.

Check a running server from outside:

```bash
npm run check:build-id -- https://<host>
```

It requires `buildId`, `data-dpl-id` and at least one `?dpl=` static URL to
match; a server without a deployment id says so instead of failing.

What this does not do: no blue-green deploys and no `?dpl=` routing on the proxy
(hosting level), no service worker or offline mode, and no fix for the
framework's own Turbopack bug — it gives the tab a way out and lowers the chance
of hitting it. A `restart` after the checkout moved **without** a rebuild gives
the runtime a different id than the one in the build, so after `git pull` run
`deploy`, not `restart`.

## Data directory

- Point `DCS_DATA_DIR` at a persistent, writable location, e.g.
  `/var/lib/dcs/data`.
- Back it up like a database: stop writes and copy the whole directory,
  including hidden files (`.session-secret`, `.initial-admin.txt`).
- `index/logins.json` is derived and can be deleted; it will be rebuilt.
- Do not commit it to git (`data/*` is ignored).

## First administrator

On the first start with a fresh data directory, the app creates a service
administrator if none exists:

- credentials are printed to the server console and written to
  `<data-dir>/.initial-admin.txt` (mode `0600`);
- log in with them, change the password on `/settings`, and delete the file.

See [admin.md](admin.md) for the bootstrap rules.

## HTTPS and reverse proxy

The app does not terminate TLS itself. Run it behind a reverse proxy (nginx,
Caddy, Traefik, …) and:

- forward `Host` and `X-Forwarded-Proto`;
- keep `NODE_ENV=production` so the session cookie is `Secure` (`DCS_COOKIE_SECURE=1`
  is equivalent, `DCS_COOKIE_INSECURE=1` is for local development only);
- proxy with **HTTP/1.1** and pass `Upgrade`/`Connection`;
- allow long-lived responses (long `proxy_read_timeout`).

Security headers (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`) are set by the application (`next.config.ts`). Do not add
conflicting copies in nginx: a second `Content-Security-Policy` header is
intersected by browsers and can silently break the UI.

### nginx (Next 16)

Next serves pages as a stream (RSC/HTML + client chunks). With the default
upstream protocol (`HTTP/1.0`) and no upgrade handling, the browser can receive
the page shell and stay on `app/loading.tsx` **forever**, even though `/api/*`
answers `200` — the page never hydrates. Working `location /`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

location / {
    proxy_pass http://127.0.0.1:3000;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_connect_timeout 10s;
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;
}
```

`map` must live in the `http {}` context (an included `conf.d/*.conf` file is
fine). If nginx already defines `$connection_upgrade`, drop the `map` block and
keep only the `proxy_set_header` lines. A stale proxy config can look exactly
like an application crash — check it before suspecting data migrations.

The reference configs live in the workspace `nginx/` directory
(`dcs.conf` for production, `dcs-dev.conf` for the dev bench); update both when
the proxy setup changes.

### Caching

`next.config.ts` splits the cache policy by response class, because the two age
differently (`LANDMARK: HTML_MUST_REVALIDATE`):

- `/_next/static/*` has a content hash in the file name and is served as
  `public, max-age=31536000, immutable`;
- everything else, including prerendered HTML (`/`, `/login`, `/demo`), is
  served as `no-store`.

The HTML must not be cached. It references the hashed chunks above, and a
rebuild replaces them; a cached HTML document then asks for files that no longer
exist. The browser receives `404` with an HTML body, `nosniff` forbids
executing it as a script, hydration never starts, and the prerendered shell
stays on screen — on `/` that is a permanent spinner. For the same reason do not
put HTML into a reverse-proxy `proxy_cache`; caching `/_next/static` is fine.

## Upgrades

Startup maintenance runs once per process:

1. normalizes every `user.json` to the current schema (fills missing fields,
   keeps existing values);
2. rebuilds the login index;
3. creates a bootstrap admin if there is no active one.

Take a data-directory backup before a major upgrade. Startup work is best-effort
and does not block the server if a single profile is broken; check the startup
log for warnings.

## Scaling notes

- **One app instance per data directory.** Reads are cached in process memory
  (sessions, profiles, catalog, sheets); write-through invalidation only knows
  this process's writes, and per-sheet locks are in-process (see
  [architecture.md](architecture.md#process-local-read-cache)). Do not run
  `pm2 cluster`, multiple systemd instances or workers on one data dir.
- The global file lock still serializes multi-file writes (registration,
  account deletion, catalog, sessions); single-sheet writes use per-key locks
  and do not wait for each other.
- `DCS_SESSION_SECRET` is only needed if the data dir is ephemeral or you
  migrate it; with one process the generated `.session-secret` is enough.

## API documentation

`/api/docs` and `/api/openapi.json` are served by the same app. The Scalar UI is
built in the browser from a pinned bundle vendored in
[`public/vendor/scalar/`](../public/vendor/scalar/README.md) and served from our
own origin, so an offline installation needs no extra step. See
[api.md](api.md).

## Related

- [data-storage.md](data-storage.md) — what to back up
- [admin.md](admin.md) — bootstrap admin and access control
- [testing.md](testing.md) — pre-deploy verification
