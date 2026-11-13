# HTTP API

The API is served by Next.js route handlers under `src/app/api/`. It uses JSON
over the same origin as the UI and authenticates with a signed HttpOnly cookie.

## Interactive docs

| URL | What it is |
| --- | --- |
| **`/api/docs`** | Scalar reference for the OpenAPI document. |
| **`/api/openapi.json`** | The OpenAPI 3.1 document itself. |

The source of truth is [`src/lib/openapi.ts`](../src/lib/openapi.ts). The Scalar
UI is served by [`src/app/api/docs/route.ts`](../src/app/api/docs/route.ts) and
builds itself in the browser from a pinned bundle vendored in
[`public/vendor/scalar/`](../public/vendor/scalar/README.md)
(`@scalar/api-reference@1.78.0`). It is served from the app's own origin because
the CSP allows scripts only from `'self'`, and the same choice keeps `/api/docs`
working in an air-gapped installation. Update instructions live in the vendor
README.

`tests/unit/openapi.test.ts` validates the document (refs, `operationId`s,
responses) and compares its paths/methods with every `src/app/api/**/route.ts`.
Adding an endpoint without documenting it fails the unit tests.

## Authentication

- `POST /api/auth` (login) and `POST /api/auth/register` set the
  `dcs_session` cookie: `<uid>.<exp>.<jti>.<hmac>`, `HttpOnly; SameSite=Lax`,
  `Secure` in production, 14 days. `jti` names a server-side session record, so
  logout and credential changes revoke the cookie immediately.
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

`commit`/`branch` on `/api/version` come from `DCS_GIT_COMMIT` /
`DCS_GIT_BRANCH` (or `GIT_COMMIT` / `VERCEL_GIT_COMMIT_SHA` and
`GIT_BRANCH` / `VERCEL_GIT_COMMIT_REF`). When the commit env is absent and the
application runs from a checkout, they are read from the local `.git`: `HEAD` →
`refs/heads/<branch>` (or `packed-refs`, or a detached SHA, or a
`gitdir:`-file of a worktree). `buildDate` comes from `DCS_BUILD_DATE`; without
any source the fields are `null`. `commitShort` is the first 7 characters of `commit`,
lowercased — the form the UI shows in the profile menu (`v0.3.0 · a077aef`);
it is `null` whenever `commit` is.

The label (`v0.5.1 · a077aef`) is rendered in the profile menu and on `/login`
and `/demo`; `src/components/layout/app-version.tsx` fetches `/api/version` once
per tab and renders nothing if the request fails, so a broken API never produces
a half-empty badge. The full commit, branch and build date live in the tooltip.

The application `version` comes from the root `package.json`
(`APP_VERSION` in [`src/lib/app-info.ts`](../src/lib/app-info.ts)). The OpenAPI
contract version in [`src/lib/openapi.ts`](../src/lib/openapi.ts)
(`info.version`) is a separate number.

### Authentication

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth` | — | Log in; unknown login and wrong password share one `401` (no account enumeration), blocked → 403, too many attempts → 429. Password length is not checked here. |
| `POST` | `/api/auth/register` | — | Create an account with a recovery phrase and sign in; password policy 12–128 characters. |
| `POST` | `/api/auth/exists` | — | Check whether a login is taken (rate limited: 20 / 10 minutes per IP + login). |
| `GET` | `/api/auth/session` | cookie | Current profile snapshot (role, block state, etc.). |
| `GET` | `/api/games` | optional cookie | Games/editions visible to the current role; also the site-title override. |
| `POST` | `/api/auth/logout` | optional cookie | Revoke the current session and clear the cookie. Body `{ "all": true }` revokes every session of the account («sign out everywhere»). |
| `PUT` | `/api/auth/profile` | cookie | Update own login, display name, password, recovery phrase. Changing the password requires `currentPassword` (`403 invalid_password` otherwise) and revokes the account's other sessions. |
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
| `POST` | `/api/characters` | cookie | Create a sheet; the server assigns `id`/`userId`, fills missing fields from the edition defaults and validates the payload by the edition schema. |
| `PUT` | `/api/characters/{id}` | cookie | Partial update; optional `__page`/`__seq` tokens drop late writes. |
| `DELETE` | `/api/characters/{id}` | cookie | Delete a sheet. |
| `GET` | `/api/characters/{id}/share` | cookie | Status of the read-only link, without the token (`active`, `createdAt`, `expiresAt`). |
| `POST` | `/api/characters/{id}/share` | cookie | Create or rotate the read-only link. Body `{ "expiresInDays": 7/30/90/null }`; the token is returned once and only its hash is stored. |
| `DELETE` | `/api/characters/{id}/share` | cookie | Revoke the link; idempotent. |
| `GET` | `/api/characters/{id}/history` | cookie | Change-history sessions, newest first (`limit`, `before` cursor). |
| `DELETE` | `/api/characters/{id}/history` | cookie | Clear the change log; the sheet is untouched. |

`{id}` must match `^[A-Za-z0-9_-]{1,64}$`; any other value (for example
`..%2Fuser`) is rejected with `400` before the file system is touched. See
[security.md](security.md) § Invariants.

Request bodies for sheets are validated against the edition schema
(`src/games/<id>/schema.ts`): server-owned fields (`id`, `userId`, `systemId`)
and fields the schema does not declare are ignored, an invalid structure answers
`400 { reason: "invalid_payload", issues: [...] }`, and a body larger than
**1 MiB** answers `413 { reason: "payload_too_large" }`.

A share link is a bearer token for read-only viewing: anyone with
`/share/<token>` can open the sheet without a session, so treat the URL as
sensitive. The token is 32 random bytes (43 base64url characters), shown once by
`POST`; `GET` cannot recover it. One active link exists per sheet, the default
lifetime is 30 days, and revocation, expiry, a blocked/deleted owner or a deleted
sheet make it invalid. Link management always uses the owner's session; the
public page itself is not part of the JSON API.

### Export

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/export` | cookie | Portable JSON of one sheet (`?characterId=…`) or all sheets. |

The legacy Firestore import (`GET /api/import`) was an unauthenticated runtime
endpoint that created accounts with a shared default password; it is **removed**
(the path answers `404`) and migration is done offline. Export format:
[export-format.md](export-format.md).

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
