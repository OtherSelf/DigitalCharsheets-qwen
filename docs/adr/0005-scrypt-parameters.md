---
title: "ADR 0005 — Scrypt parameters and transparent rehashing"
description: "ADR: scrypt N=2^15 and transparent rehashing of old hashes"
---

# ADR 0005 — Scrypt parameters and transparent rehashing

Status: **accepted** (2026-11-23). Scope: password and recovery-phrase hashing
parameters, and how old hashes are upgraded. Related:
[ADR 0001](0001-credentials-and-sessions.md), [security.md](../security.md)
§ Credentials, `src/lib/security/scrypt.ts`, `src/lib/security/password.ts`.

## Context

ADR 0001 chose salted `scrypt` (`N=16384, r=8, p=1`) and rejected Argon2id
because it would add a native dependency. The security audit (SEC-17) noted
that `N=2^14` is below the OWASP recommendation (`N=2^17`) and that the hash
format was versioned, so raising the cost was cheap.

A separate problem was found during the SEC2 review: `needsRehash` was `false`
for every scrypt hash. Only legacy SHA-256 values were rehashed, so raising `N`
would have left existing hashes at the old cost forever. Recovery phrases had
the same gap.

## Decision

1. Keep **scrypt** (Node `crypto`, no dependency). Argon2id is not introduced:
   the threat model is a single self-hosted process, and the project rule
   forbids a new native dependency without explicit approval.
2. Raise `N` to **2^15** (32 MiB per hash, `r=8, p=1`); `maxmem` stays 64 MiB.
   On the reference machine a verification takes about **67–93 ms** (median
   ~71 ms), against ~33–100 ms (median ~57 ms) at `N=2^14`. `N=2^16` would need
   at least 64 MiB and roughly double the time; it is left for a future ADR.
3. `needsRehash` for a scrypt hash is `true` when its `N`/`r`/`p` differ from
   the current constants. A successful login rewrites the password hash with
   the current parameters (the existing `rehashPassword` path).
4. A successful recovery-phrase check rewrites an old scrypt phrase hash with
   the current parameters (and still migrates legacy plaintext to a hash).
5. The hash string keeps the versioned format `scrypt$N$r$p$salt$hash`, so old
   values are verified with their own parameters before being upgraded.

## Consequences

- Existing accounts keep working: no password reset is needed, and the first
  successful login pays one extra hash computation.
- Login cost roughly doubles (still well under the 300 ms failure delay and the
  rate limiter). The async path keeps scrypt in the libuv pool.
- Old hashes remain on disk until the user logs in or verifies the phrase; a
  dormant account can stay at the old cost. This is a deliberate trade-off
  against a forced migration at startup.
- If `N` is raised again, the same mechanism applies; no schema change and no
  data migration are required.
