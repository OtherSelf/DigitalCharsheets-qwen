# HTTP API

The API is served by Next.js route handlers under `src/app/api/`. It uses JSON
over the same origin as the UI and authenticates with a signed HttpOnly cookie.

## Interactive docs

| URL | What it is |
| --- | --- |
| **`/api/docs`** | Scalar reference for the OpenAPI document. |
| **`/api/openapi.json`** | The OpenAPI 3.1 document itself. |

The source of truth is [`src/lib/openapi.ts`](../src/lib/openapi.ts). The Scalar
UI is served by [`src/app/api/docs/route.ts`](../src/app/api/docs/route.ts); its
bundle is loaded from jsDelivr at a pinned version
(`@scalar/api-reference@1.78.0`). The API is served by the same self-hosted app.
For an offline/air-gapped setup, vendor the bundle into `public/` and point
`cdn` at it.

`tests/unit/openapi.test.ts` validates the document (refs, `operationId`s,
responses) and compares its paths/methods with every `src/app/api/**/route.ts`.
Adding an endpoint without documenting it fails the unit tests.

## Authentication

- `POST /api/auth` (login) and `POST /api/auth/register` set the
  `dcs_session` cookie: `<uid>.<exp>.<hmac>`, `HttpOnly; SameSite=Lax`, 30 days.
- Send the cookie with every request that touches user data. The browser does
  this automatically for same-origin requests.
- The server resolves the uid from the cookie only; `userId` in a query/body is
  ignored.
- An account that is deleted or blocked has no valid session: requests answer
  `401`.
- `GET /api/auth/session` returns the current profile snapshot and is the
  canonical way for the client to refresh role/block state.

## Endpoints

### System

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Liveness/readiness for Docker, reverse proxies and monitoring. `200` when the data directory is writable, `503` with `status: degraded` otherwise. No paths or secrets; `Cache-Control: no-store`. |
| `GET` | `/api/version` | — | Application name, version, commit/build date (from env, otherwise `null`), 7-character `commitShort` and Node runtime. No dependency list. |

`commit`/`buildDate` on `/api/version` come from `DCS_GIT_COMMIT` (or
`GIT_COMMIT` / `VERCEL_GIT_COMMIT_SHA`) and `DCS_BUILD_DATE`; without them the
fields are `null`. `commitShort` is the first 7 characters of `commit`,
lowercased — the form the UI shows in the profile menu (`v0.3.0 · a077aef`);
it is `null` whenever `commit` is.

The menu label is the only consumer: `src/components/layout/app-version.tsx`
fetches `/api/version` once per session and renders nothing if the request
fails, so a broken API never produces a half-empty badge.

The application `version` comes from the root `package.json`
(`APP_VERSION` in [`src/lib/app-info.ts`](../src/lib/app-info.ts)). The OpenAPI
contract version in [`src/lib/openapi.ts`](../src/lib/openapi.ts)
(`info.version`) is a separate number.

### Authentication

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth` | — | Log in; unknown login → 404, wrong password → 401, blocked → 403, too many attempts → 429. Password length is not checked here. |
| `POST` | `/api/auth/register` | — | Create an account with a recovery phrase and sign in; password policy 12–128 characters. |
| `POST` | `/api/auth/exists` | — | Check whether a login is taken (rate limited: 20 / 10 minutes per IP + login). |
| `GET` | `/api/auth/session` | cookie | Current profile snapshot (role, block state, etc.). |
| `GET` | `/api/games` | optional cookie | Games/editions visible to the current role; also the site-title override. |
| `POST` | `/api/auth/logout` | — | Clear the session cookie. |
| `PUT` | `/api/auth/profile` | cookie | Update own login, display name, password, recovery phrase. |
| `DELETE` | `/api/auth/profile` | cookie | Delete own account and all sheets; requires the current password. |
| `POST` | `/api/auth/phrase` | cookie | Set own recovery phrase. |
| `POST` | `/api/auth/recover/verify` | — | Check the whole recovery phrase; on success return a single-use token (`{token, expiresAt}`). No session cookie is set. |
| `POST` | `/api/auth/recover/update` | — | Exchange that token for a new password (and optionally a new phrase); the token is burned. |
| `POST` | `/api/auth/recover` | — | Legacy alias of `recover/update`; requires a token. The old `username` + three-words body was removed because words from sheets do not prove account ownership. |

Recovery flow:

1. `POST /api/auth/recover/verify` with `{ username, recoveryPhrase }` →
   `200 { token, expiresAt }`, or `400 { reason: "recovery_failed" }`. Failures
   are indistinguishable (same status, same text, fixed delay) so the response
   cannot be used to enumerate accounts.
2. `POST /api/auth/recover/update` with `{ token, newPassword,
   newRecoveryPhrase }` → `200`; the token is single-use and dies after
   15 minutes. `401 { reason: "invalid_token" }` for a missing, expired or
   already used token.
3. Sign in normally — recovery never creates a session.

Both endpoints are rate limited per IP + login: 5 attempts per 15 minutes, then
`429` with `Retry-After`. Recovery phrases are stored as hashes, so neither a
`user.json` copy nor the API response reveals them.

### Characters

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/characters` | cookie | List the current user's sheets. |
| `POST` | `/api/characters` | cookie | Create a sheet; the server assigns `id`/`userId`. |
| `PUT` | `/api/characters/{id}` | cookie | Partial update; optional `__page`/`__seq` tokens drop late writes. |
| `DELETE` | `/api/characters/{id}` | cookie | Delete a sheet. |

`{id}` must match `^[A-Za-z0-9_-]{1,64}$`; any other value (for example
`..%2Fuser`) is rejected with `400` before the file system is touched. See
[security.md](security.md) § Invariants.

### Import / export

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/export` | cookie | Portable JSON of one sheet (`?characterId=…`) or all sheets. |
| `GET` | `/api/import` | — | Legacy Firestore import from `<data-dir>/import-source.json`. |

Export/import format: [export-format.md](export-format.md).

### Admin

All admin endpoints go through `requireAdmin()`: no session → `401`, non-admin
role → `403` (`tester` is not an administrator).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/users` | Users, roles, block state, last login, sheet counts, stats. |
| `GET` | `/api/admin/games` | Game catalog with default/current visibility and site title. |
| `PUT` | `/api/admin/games` | Set one edition status (`published`/`test`/`hidden`) and/or the site title. |
| `PATCH` | `/api/admin/users/{uid}` | Update fields / password / role / block state. |
| `DELETE` | `/api/admin/users/{uid}` | Delete the account, its sheets and index entries. |
| `GET` | `/api/admin/users/{uid}/characters` | Read-only sheet summaries for one user. |

Rules and invariants: [admin.md](admin.md).

## Response conventions

- Success responses are JSON; most use `{ "success": true, ... }`.
- Errors are JSON. Session/profile routes use
  `{ "success": false, "error": "...", "reason": "..." }`; character/export
  routes may use `{ "error": "..." }`.
- Common status codes: `400` invalid input, `401` no/expired/blocked session,
  `403` wrong role or wrong password, `404` not found, `409` conflict (taken
  login, last administrator), `429` rate limited (with `Retry-After`),
  `500` unexpected server error.
- Passwords: stored as salted `scrypt`; the policy is **12–128 characters** and
  applies when a password is set (registration, recovery, profile, admin).
  Login accepts any non-empty password and only checks the credential, so
  accounts created before the policy keep working.
- The exact schemas live in `/api/openapi.json`.

## Related

- [architecture.md](architecture.md) — auth/session implementation
- [admin.md](admin.md) — admin endpoints and invariants
- [export-format.md](export-format.md) — portable JSON/Excel envelope
- [`src/lib/openapi.ts`](../src/lib/openapi.ts) — spec source
