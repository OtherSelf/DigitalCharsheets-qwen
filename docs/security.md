# Security model

Threat model, trust boundaries and the invariants every change must preserve.
Read it before touching authentication, sessions, storage paths or the public
HTTP surface.

## Overview

The application is a single-process Next.js server with no database and no
external identity provider. Everything that decides «who is this user» lives in
the process: an httpOnly session cookie, the profiles under `<data-dir>/users/`
and a few files in the data directory root. Consequently the whole security
model rests on three things:

- **identity comes from the session, never from the request payload** — uid is
  read from the signed cookie, only `requireAdmin` decides roles;
- **the data directory is the only store** — every path built from a
  request-supplied value must be validated and confined to it;
- **secrets live outside the repository** — the session signing key and user
  files are data, not code.

Rules below are normative. Each rule links the module that enforces it; a rule
without a link is a requirement of the model rather than a guarantee of the
current code.

## Assets

| Asset | Where | Why it matters |
| --- | --- | --- |
| Account credentials (`passwordHash`, `recoveryPhrase`) | `users/<uid>/user.json` | Account takeover |
| Session signing key | `DCS_SESSION_SECRET` or `<data-dir>/.session-secret` | Forgery of any session |
| Character sheets | `users/<uid>/characters/<id>.json` | Private game data of every player |
| Read-only share links | `<data-dir>/shares.json` (SHA-256 only) | Bearer access to one sheet without a session; the raw tokens live only in the owner's dialog/browser |
| Login index | `index/logins.json` | Maps a login to a uid (the uid is the file path) |
| Ability to sign in as another user | `/api/auth*` | Everything else follows |

## Trust boundaries

```
browser / curl
   │  untrusted: every header, cookie, query value, JSON field
   ▼
nginx (TLS, reverse proxy)          ← x-forwarded-for is trusted only here
   ▼
Next route handlers (src/app/api)   ← the only authorization point
   ▼
src/lib (session, storage, auth)    ← path and format validation
   ▼
<data-dir> on disk                  ← trusted, owned by the service account
```

- The client is **always** untrusted. Nothing in the React tree is a security
  control: a hidden «Админка» item is UX, `requireAdmin` is the control.
- `src/lib` trusts its callers only for values that already passed validation
  (uid from `getSessionUid`, ids checked by `assertSafeId`).
- The data directory is trusted for integrity but every external id used to
  build a path in it is validated first.
- The public git repository is **untrusted output**: no profile, phrase or
  password may ever be committed, and history counts as output.

## Threat catalogue

| Threat | Control |
| --- | --- |
| Reset another account's password without any proof | Recovery must prove possession of the phrase and hand out a single-use token; `recover/update` accepts only that token ([`src/lib/security/tokens.ts`](../src/lib/security/tokens.ts)) |
| Guess the recovery phrase word by word | Whole-phrase comparison after normalization; ownership words from sheets are not a factor |
| Read or overwrite files outside `users/<uid>/characters` (`../user`, absolute ids) | One validator for request ids and one containment check ([`src/lib/security/paths.ts`](../src/lib/security/paths.ts)) |
| Offline cracking of a leaked password hash | Salted `scrypt` with a versioned format and `timingSafeEqual` |
| Online password guessing | Shared limiter per IP + login, `429` with `Retry-After` ([`src/lib/security/rate-limit.ts`](../src/lib/security/rate-limit.ts)) |
| Account enumeration (login / `exists`) | Identical status and text for «no account» and «wrong password»; existence checks are rate limited |
| Stolen session cookie replayed after logout or password change | Sessions carry a `jti` that is stored (and revocable) server-side |
| Guessed or leaked share link replayed after revoke, expiry, block or account deletion | The link is a 256-bit token stored only as SHA-256; every open re-checks expiry, the owner profile and the block state; deleting a sheet/account revokes the record ([`src/lib/shares.ts`](../src/lib/shares.ts)) |
| Share page leaking the owner or becoming editable | The public page derives the owner from the token, strips `userId`/`__*`, has no public write API, and renders through a no-op read-only context |
| Cross-site scripting and framing | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, no third-party image optimizer |
| Import route abused to create accounts | The Firestore import is not part of the public runtime |
| Oversized or malformed JSON breaking a sheet | Module schema validation on write, request body limit |

## Invariants

🔒 Breaking one of these is a security regression, not a refactor.

1. **uid is never taken from a request.** `?userId=`, `body.userId` and
   `body.username`-derived uids are ignored; the only source is
   [`getSessionUid`](../src/lib/session.ts). Profiles are only reachable through
   a UUID-shaped uid (`isUid` in [`src/lib/ids.ts`](../src/lib/ids.ts)). The one
   exception is the public share page: it derives the uid from a hashed bearer
   token, never from a request field.
2. **Roles are checked on the server.** `requireAdmin`
   ([`src/lib/admin-auth.ts`](../src/lib/admin-auth.ts)) guards every `/api/admin`
   route and the admin page.
3. **Recovery never mints a session.** `POST /api/auth/recover/verify` answers
   with a single-use token; only `POST /api/auth` and `POST /api/auth/register`
   set the cookie.
4. **Recovery phrase is a full-match secret.** Comparison is
   `normalize → compare all words`, never «any single word», and the stored
   value is a hash.
5. **Paths derived from request data stay inside the data directory.** Every
   id matches `^[A-Za-z0-9_-]{1,64}$` and the resolved path is checked against
   its base directory.
6. **Secrets are never in the repository** and never in an API response:
   `passwordHash`, `recoveryPhrase`, `DCS_SESSION_SECRET` and the generated
   session secret are data-dir/server-only. A share token is shown once by
   `POST`; `GET` and the data directory expose only its hash.
7. **Writes are atomic and profile mutations are locked.**
   [`writeJsonAtomic`](../src/lib/fs-atomic.ts) and `withDataLock`
   ([`src/lib/data-lock.ts`](../src/lib/data-lock.ts)) keep truncated JSON and
   lost index entries out of the data directory.
8. **A share link is read-only and revocable.** It never grants writes, never
   exposes `userId`, and stops working on revoke, expiry, blocked/deleted owner,
   deleted sheet or deleted account. The public page is `noindex`, `no-store`
   and `no-referrer`.

## Authentication

`POST /api/auth` verifies the password and sets `<uid>.<exp>.<jti>.<hmac>`
([`src/lib/session.ts`](../src/lib/session.ts)). Blocking is enforced on every
request: `getSessionUid` rejects a blocked or deleted profile even when the
signature is still valid.

Password hashing rules
([`src/lib/security/password.ts`](../src/lib/security/password.ts)):

- new passwords and password changes are stored as salted `scrypt` with an
  explicit format version, compared with `timingSafeEqual`;
- legacy unsalted `sha256` values are verified once and re-hashed on the same
  successful login — nobody has to change a password because of the migration;
- the policy (12–128 characters) is enforced wherever a password is **set**:
  registration, recovery, profile update, admin edit, service-admin bootstrap.
  Login deliberately does not check the length, otherwise accounts created
  before the policy could not sign in; guessing is bounded by the limiter. The
  minimum is a length rule only — no composition requirements.

## Sessions

- The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` by default in
  production (`DCS_COOKIE_INSECURE=1` is a deliberate, documented opt-out for
  local development). The expiry is covered by the HMAC.
- Every login creates a `jti` record in `<data-dir>/sessions.json`
  ([`src/lib/security/sessions.ts`](../src/lib/security/sessions.ts)), and
  `getSessionUid` accepts a cookie only while that record is alive.
- Revocation is immediate and covers logout, password change, phrase change,
  recovery (all sessions) and an administrator setting a new password. The
  password change itself requires the current password — one live session is not
  enough to take an unlocked device's account away.
- Session lifetime is 14 days. «Sign out everywhere» on `/settings` calls
  `POST /api/auth/logout` with `{ "all": true }` and revokes every session of the
  account.
- Upgrading from a version without `jti` invalidates old cookies once: users
  sign in again, which is expected after a session-format change.

## Recovery

`recover/verify` proves possession of the phrase, then returns a token whose
hash is stored for a short time; `recover/update` accepts **only** the token,
burns it and changes the password and phrase. Recovery never returns a session,
so the user signs in normally afterwards. Failed attempts share one response and
one delay, and are rate limited.

The phrase itself is stored as a salted `scrypt` hash
([`src/lib/security/phrase.ts`](../src/lib/security/phrase.ts)) and compared as
a whole: case and extra spaces are normalized away, the set and order of words
are not. Plaintext values written by older versions are re-hashed on the first
successful verification and by the startup pass, so a copied `user.json` no
longer reveals the phrase.

## Rate limiting and anti-enumeration

[`src/lib/security/rate-limit.ts`](../src/lib/security/rate-limit.ts) is a
sliding-window limiter keyed by `IP + login`. Storage is an interface: the
default is in-process memory, which is correct for the single-process
deployment and can be swapped for a file-backed store when several instances
share a data directory.

Current windows (sliding, per `IP + login`; a successful attempt clears the
window, so only failures count):

| Endpoint | Limit | On excess |
| --- | --- | --- |
| `POST /api/auth` | 10 failures / 10 min | `429`, `Retry-After` |
| `POST /api/auth/register` | 10 / 10 min | `429`, `Retry-After` |
| `POST /api/auth/exists` | 20 / 10 min | `429`, `Retry-After` |
| `POST /api/auth/recover/verify` | 5 failures / 15 min | `429`, `Retry-After` |
| `POST /api/auth/recover/update` | 5 / 15 min | `429`, `Retry-After` |
| `PUT /api/auth/profile`, `POST /api/auth/phrase` | 10 / 10 min | `429`, `Retry-After` |

The client IP is taken from `x-forwarded-for` / `x-real-ip`; behind nginx the
proxy must overwrite those headers, otherwise everyone shares one bucket.
[api.md](api.md) lists the contract per endpoint.

## Browser-side boundaries

Every response carries the headers from `next.config.ts`:

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, inline styles/scripts for Next, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` | XSS containment: no third-party script host, no plugin objects, no form posts elsewhere |
| `X-Frame-Options` | `DENY` | Clickjacking: the app cannot be embedded in someone else's page |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing of uploads/responses |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No full URL (and no sheet ids) leaks to external hosts |
| `Permissions-Policy` | camera/microphone/geolocation/payment/usb disabled | The app needs none of them |
| `X-Robots-Tag` on `/share/*` | `noindex, nofollow, noarchive` | The share token is in the URL; it must not enter search indexes |
| `Cache-Control` on `/share/*` | `no-store` | Revocation takes effect immediately; no CDN/proxy copy of a sheet |
| `Referrer-Policy` on `/share/*` | `no-referrer` | The token must not leak to an external host through a referer |

`X-Powered-By` is disabled (`poweredByHeader: false`) and the image optimizer is
off (`images: { unoptimized: true }`): with no `next/image` in the app the
`/_next/image` endpoint was an unused way to make the server fetch third-party
URLs.

`/share/*` gets stricter values on top of the global headers (`noindex`,
`no-store`, `no-referrer`), because the bearer token is part of the URL. See
[sharing.md](sharing.md) and [`next.config.ts`](../next.config.ts).

## Secret rotation and incident response

Secrets and where they live:

| Secret | Location | Rotate by |
| --- | --- | --- |
| Session signing key | `DCS_SESSION_SECRET` or `<data-dir>/.session-secret` | Replace the value/file and restart: every cookie and every `sessions.json` record becomes unusable (users sign in again) |
| Account passwords | `users/<uid>/user.json` (`passwordHash`) | `PUT /api/auth/profile` (current password required), recovery flow, or the administrator |
| Recovery phrases | `users/<uid>/user.json` (`recoveryPhrase`) | Profile/phrase endpoints or the recovery flow (both rotate the hash and revoke other sessions) |
| Recovery tokens | `<data-dir>/tokens.json` | `recover/update` burns the used token; `revokeRecoveryTokensForUser` / password reset kills the rest; deleting the file is always safe |
| Sessions | `<data-dir>/sessions.json` | Logout (`{ "all": true }`), password/phrase change, admin password change; deleting the file logs everyone out |
| Share links | `<data-dir>/shares.json` (hashes only) | `DELETE /api/characters/{id}/share` (owner), deleting the sheet/account, or deleting the file revokes every link |

If an account may be compromised:

1. Sign in and use «Sign out everywhere» on `/settings` (or change the
   password — both revoke every session of the account).
2. Change the recovery phrase.
3. Check `/admin` for unexpected role/block changes; `lastLoginAt` shows the
   latest successful login.
4. If the sign-in key itself leaked, rotate `DCS_SESSION_SECRET` (all sessions
   are invalidated) and restart.
5. A leaked `data/` copy contains profile fields and password/phrase hashes:
   rotate both kinds of credentials; the hashes are salted `scrypt`, so they
   cannot be used directly, but user e-mails are exposed.

Startup logs report profile/password-hash migrations and recovery-phrase
re-hashing; anything unexpected there is worth reading after an upgrade.

## Data directory privacy

- Commit only code. `<data-dir>` — profiles, sheets, indexes, secrets — is
  runtime state and is never versioned.
- Backups copy `<data-dir>` as a whole and are stored with the same care as
  credentials.
- Rotating `.session-secret` (or `DCS_SESSION_SECRET`) invalidates every
  outstanding cookie; see [deployment.md](deployment.md).

## Related

- [architecture.md](architecture.md) — request flow and module layout
- [data-storage.md](data-storage.md) — on-disk layout, locks, atomic writes
- [api.md](api.md) — endpoints and statuses
- [admin.md](admin.md) — roles, first administrator, block/delete rules
- [deployment.md](deployment.md) — environment variables, secrets, backups
