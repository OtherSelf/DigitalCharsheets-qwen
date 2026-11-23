# Security policy

Digital Character Sheets is a self-hosted application: every installation is
run by its owner, and the operator of an instance is responsible for its host,
TLS, network exposure and backups. This document covers the source code and the
default configuration shipped in this repository.

## Supported versions

Security fixes are made on the current release line (`0.18.x`) and on `main`.
Older versions are not supported; the operator should upgrade to the latest
release.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately**:

- Email: **ruslan@thfree.ru** — put `SECURITY` in the subject.
- Do not open a public issue, pull request or discussion for an unreported
  vulnerability.
- Include: affected version or commit, the endpoint/screen, steps to reproduce,
  the impact you expect, and whether the issue is reproducible on a clean
  installation.

If you cannot use email, open a GitHub *security advisory* for the repository
instead of a public issue.

Please give us a reasonable window to fix the issue before public disclosure.
We will coordinate the disclosure date with you.

## What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement of the report | within 3 working days |
| Initial triage and severity | within 7 working days |
| Fix or mitigation plan for High/Critical | within 30 days |
| Credit in the release notes | on request |

These are targets, not a contractual SLA: the project is maintained by a small
team.

## Scope

In scope:

- authentication, sessions, recovery phrase and recovery tokens;
- account isolation and path handling in the data directory;
- API authorization (uid and role checks), share-link tokens;
- browser boundaries: CSP, cookies, CSRF, security headers;
- rate limiting and account quotas;
- admin and service-administrator flows.

Out of scope:

- the host, nginx, systemd, firewall, TLS certificates and backups — these are
  operator responsibilities (see [deployment.md](docs/deployment.md));
- vulnerabilities that require an already compromised host or data directory;
- denial of service by flooding the public network interface;
- social engineering and physical access;
- third-party dependencies without a reachable path in this application
  (report them upstream, but tell us if the application exposes them).

## Secure configuration

The default configuration is conservative, but the operator must:

1. Run the application behind an HTTPS reverse proxy and bind it to loopback
   (`-H 127.0.0.1`). The proxy must **overwrite** `X-Forwarded-For` with
   `$remote_addr` (see [deployment.md](docs/deployment.md)); otherwise clients
   can rotate their rate-limit bucket.
2. Keep `NODE_ENV=production` so the session cookie is `Secure` and uses the
   `__Host-` prefix.
3. For TOTP, either set `DCS_TOTP_KEY` (32 random bytes, base64) and keep it out
   of data-directory backups, or rely on the generated `<data-dir>/.totp-key`
   (0600). Losing the key disables TOTP for enrolled users (backup codes,
   recovery phrase or an administrator reset remain).
4. Protect the data directory: it contains password and recovery-phrase hashes,
   TOTP secrets and account data. Backups must be encrypted.
5. Never commit `data/`, `.secrets/` or environment files; the repository
   `.gitignore` already excludes the data directory.

## Known residual risks

- The CSP keeps `script-src 'unsafe-inline'`: a strict nonce policy was measured
  and rejected because it forces dynamic rendering of every page (p95 grew from
  6–10 ms to 21–22 ms). See [security.md](docs/security.md) § CSP.
- TOTP is optional and disabled by default; accounts without it are protected by
  a password and a recovery phrase only.
- There is no email verification, password reset by email, CAPTCHA or
  invitation-only registration. The rate limiter and account quotas are the
  controls for abuse.
- The project is maintained by a small team; no bug bounty is offered.
