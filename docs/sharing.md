# Sharing a character sheet

A read-only guest link lets a game master, another player or a friend open one
sheet without an account. Link management is part of the core, not a game
module: every edition uses the same `/share/<token>` page and the same
`/api/characters/{id}/share` endpoints.

## Overview

- One active link per sheet. Creating a new link revokes the previous one.
- The token is a bearer credential: anyone with the URL can view the sheet.
- The token is 32 random bytes (43 base64url characters). Only its SHA-256 is
  stored in `<data-dir>/shares.json`.
- The token is returned **once** by `POST /api/characters/{id}/share`. It cannot
  be recovered later; if it is lost, issue a new link (the old one stops
  working).
- Lifetime: 7, 30 or 90 days, or “until revoked”. The default is 30 days.
- The guest sees the whole sheet, including notes, backstory and the quest
  journal. There is no per-field selection yet.

## Owner flow

1. Open a sheet and press the share button.
2. Choose a lifetime and create the link.
3. Copy the shown URL. It is displayed only in this dialog session.
4. Later the same dialog shows whether a link is active, when it was created
   and when it expires.
5. “Issue a new link” rotates the token; “Revoke link” removes it immediately.

The API:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/characters/{id}/share` | Status without the token (`active`, `createdAt`, `expiresAt`, `includeHistory`). |
| `POST` | `/api/characters/{id}/share` | Create or rotate. Body `{ "expiresInDays": 7 \| 30 \| 90 \| null }`. |
| `DELETE` | `/api/characters/{id}/share` | Revoke; idempotent. |

All three require the owner's session. The uid comes from the signed cookie and
the sheet id is validated before any disk access.

## Public page

`GET /share/<token>` is a server component:

1. validate the token shape;
2. hash it and find the record in `shares.json`;
3. check the expiry, that the owner profile exists and is not blocked, and that
   the sheet still exists;
4. read and normalize the sheet through its edition plugin;
5. strip `userId` and every `__*` key recursively;
6. render the same sheet dispatcher as `/character/<id>`, but read-only.

The page is `force-dynamic`: revoking a link takes effect on the next request,
there is no page cache. Invalid, expired, revoked or otherwise unusable tokens
all render the same “link is invalid” screen, so the URL cannot be used to
confirm that a link once existed. Next may answer `200` for that screen because
the root loading boundary streams the shell before the page resolves; the
response contains no sheet data, no uid and the `noindex`/`no-store` headers.

Read-only is enforced at two levels:

- UI: a dedicated character context with no-op mutations, `inert` around the
  sheet, no notes/journal dialogs and no edit/share controls;
- server: there is no public mutation API, and every owner endpoint requires the
  session cookie.

## Privacy and security notes

- The token is in the URL: it may appear in browser history, proxy access logs
  and bookmarks. Treat `/share/*` logs like the data directory.
- `/share/*` responses carry `X-Robots-Tag: noindex, nofollow, noarchive`,
  `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- The owner's uid, login and email are not rendered; only the sheet data and
  the character name in the page title.
- A blocked owner invalidates the link while the block is active; after an
  unblock it works again unless it expired or was revoked. Deleting the account
  or the sheet revokes it permanently.
- There is no password on the link (Q9 in the plan) and no view counter in v1.

## Related

- [api.md](api.md) — endpoint table and status codes
- [data-storage.md](data-storage.md) — `shares.json` and cleanup rules
- [security.md](security.md) — threat model and invariants
- [`src/lib/shares.ts`](../src/lib/shares.ts) — token store
- [`src/app/share/[token]/page.tsx`](../src/app/share/[token]/page.tsx) — public page
