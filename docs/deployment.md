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

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DCS_DATA_DIR` | `./data` | Directory with users, sheets and the login index. Must be writable. |
| `DCS_SESSION_SECRET` | `<data-dir>/.session-secret` | HMAC key for session cookies. Set explicitly if several instances/processes share one data dir or if the data dir is ephemeral. |
| `DCS_COOKIE_SECURE` | unset | Set to `1` behind HTTPS so the session cookie gets the `Secure` flag. |
| `DCS_ADMIN_USERNAME` | `admin` | Preferred login for the bootstrap administrator; `admin-2`, … if taken. |
| `DCS_GIT_COMMIT` | unset | Commit shown by `/api/version`; falls back to `GIT_COMMIT` / `VERCEL_GIT_COMMIT_SHA`. |
| `DCS_BUILD_DATE` | unset | ISO build date shown by `/api/version`. |
| `PORT` | `3000` | HTTP port. |

See [data-storage.md](data-storage.md) for the directory layout.

## Health checks

`GET /api/health` is meant for Docker `HEALTHCHECK`, reverse proxies and
monitoring:

- `200` with `status: "ok"` — process is up and the data directory is writable;
- `503` with `status: "degraded"` — the data directory is missing/read-only;
- no authentication, no filesystem paths, `Cache-Control: no-store`.

`GET /api/version` returns the application version and build metadata (see
`DCS_GIT_COMMIT` / `DCS_BUILD_DATE` above). Both endpoints are documented in
[api.md](api.md) and in `/api/docs`.

The route is dynamic, so `DCS_GIT_COMMIT` is read at request time: exporting it
before `next start` is enough, no rebuild required. The value (shortened to
seven characters, `commitShort`) is what the profile menu shows as
`v0.1.0 · a077aef`; without the variable the menu prints the version alone.

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
- set `DCS_COOKIE_SECURE=1` so the session cookie is `Secure`;
- keep WebSocket/HMR out of the picture in production (not needed there).

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

- One app instance per data directory is the simplest and recommended setup.
- Multiple processes can share a data dir: the file lock serializes multi-file
  writes and the login index is derived, but the stale-write guard for sheets is
  in memory per process. Set `DCS_SESSION_SECRET` explicitly in that case so all
  processes accept the same cookies.

## API documentation

`/api/docs` and `/api/openapi.json` are served by the same app. The Scalar UI
bundle is loaded from jsDelivr at a pinned version; for an offline installation,
vendor the bundle into `public/` and point `cdn` in
`src/app/api/docs/route.ts` at it. See [api.md](api.md).

## Related

- [data-storage.md](data-storage.md) — what to back up
- [admin.md](admin.md) — bootstrap admin and access control
- [testing.md](testing.md) — pre-deploy verification
