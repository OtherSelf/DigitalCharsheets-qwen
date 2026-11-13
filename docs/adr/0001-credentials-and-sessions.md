# ADR 0001 — Credentials, sessions and recovery tokens

Status: **accepted** (2026-11-12). Scope: how the application stores passwords
and recovery phrases, how a session is represented and revoked, and how the
recovery flow exchanges `verify` for `update`. Context and invariants:
[security.md](../security.md).

## Context

The application is self-hosted: one Next.js process, no database, no mail
provider, state in a JSON data directory. Before this decision:

- passwords were unsalted SHA-256 (`sha256(password)`), the minimum length was
  4, and nothing limited repeated attempts;
- the recovery flow could change a password knowing only the login, and a
  recovery "verification" accepted one matching word of the phrase;
- the session cookie was a self-contained HMAC with no server-side record, so
  logout did not revoke it and a password change left other devices signed in;
- the recovery phrase was stored in plaintext in `user.json`.

## Decision

1. **Password hashing** — salted `scrypt` (Node `crypto`, no new dependency),
   format `scrypt$N$r$p$<salt>$<hash>` (`N=16384, r=8, p=1`), compared with
   `timingSafeEqual`. Argon2id was considered and rejected: it would add a
   native dependency while scrypt already satisfies the threat model
   (single-process self-hosted service).
2. **Hash migration** — legacy `sha256` values are verified once and rewritten
   as `scrypt` on the same successful login. Nobody has to reset a password
   because of the migration.
3. **Password policy** — 12–128 characters, enforced wherever a password is
   **set** (registration, recovery, profile, admin, service admin). Login does
   not check the length: accounts created before the policy must keep working.
   Length only — no composition rules.
4. **Rate limiting** — one sliding-window limiter keyed by `IP + login`, used by
   every `/api/auth*` mutation; a successful attempt clears the window. Limits:
   see the table in [security.md](../security.md).
5. **Sessions** — the cookie is `<uid>.<exp>.<jti>.<hmac>`; the HMAC covers
   `jti`, and `jti` must exist in `<data-dir>/sessions.json`. Records are
   deleted (not tombstoned) on revocation, so the file only lists live sessions.
   TTL 14 days, `Secure` by default in production, `HttpOnly`, `SameSite=Lax`.
6. **Revocation** — logout deletes the current record; password/phrase changes
   delete the account's other records but keep the current one;
   recovery and administrator password changes delete all of them. «Sign out
   everywhere» is `POST /api/auth/logout` with `{ "all": true }`.
7. **Re-acquire the password** — changing the password through the profile API
   requires `currentPassword`; one live session is not enough.
8. **Recovery tokens** — `recover/verify` compares the whole phrase (normalized
   casing/spacing, word order significant) and returns a random 32-byte token;
   only the SHA-256 of the token is written to `<data-dir>/tokens.json`, TTL 15
   minutes. `recover/update` accepts only that token, burns it and changes the
   credentials. Recovery never creates a session. The words-from-sheets factor
   is removed: sheet authorship does not prove account ownership.
9. **Recovery phrase storage** — salted `scrypt` hash, same format as passwords,
   re-hashed from plaintext by the startup maintenance pass and on the first
   successful verification.

## Consequences

- The data directory stays the only state; `tokens.json` and `sessions.json` are
  plain files written under the existing data lock, so no infrastructure is
  required. A multi-process deployment that shares one data directory keeps
  working (the lock is cross-process).
- Upgrading from a version without `jti` invalidates existing cookies: every
  user signs in once. This is a deliberate, documented one-time cost.
- Failed logins are the only thing that counts against the limiter, so a busy
  NAT or a user switching accounts repeatedly will not lock themselves out;
  brute force still hits `429` after ten failures.
- `scrypt` costs ~50 ms per verification on the reference machine. Login is the
  only hot path and the limiter caps the rate, so the cost is acceptable.
- Old `sha256` hashes remain readable only through the migration path; nothing
  writes them anymore.
- The CSP keeps `'unsafe-inline'` for scripts and styles because Next.js
  bootstraps with inline payloads. A nonce-based policy would require
  middleware and is a separate decision, not a regression of this one.

## Alternatives considered

- **Argon2id** — stronger against GPU cracking; rejected for now (native
  dependency, no measured attacker model that requires it).
- **Server-side sessions only (opaque id)** — simpler to revoke but requires a
  data-dir read per request anyway, and loses the ability to reject obviously
  malformed cookies before touching the disk.
- **Tombstoning revoked sessions** — rejected: the file would grow with every
  logout while providing no security benefit.
- **Keeping words-from-sheets as a second factor** — rejected: the words are
  visible to anyone who saw a sheet, so they prove nothing about ownership.

## Related

- [security.md](../security.md) — threat model, invariants, limits, runbook
- [data-storage.md](../data-storage.md) — on-disk layout of the new files
- [api.md](../api.md) — endpoint contract (statuses, `reason` codes)
- [`src/lib/security/password.ts`](../../src/lib/security/password.ts),
  [`src/lib/security/sessions.ts`](../../src/lib/security/sessions.ts),
  [`src/lib/security/tokens.ts`](../../src/lib/security/tokens.ts),
  [`src/lib/security/phrase.ts`](../../src/lib/security/phrase.ts)
