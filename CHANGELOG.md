# Changelog

All notable player-facing and operator-facing changes to Digital Character
Sheets. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/),
versions follow [Semantic Versioning](https://semver.org/), and the released
version is the `version` field in `package.json`.

Plugin versions are separate from the app version. A release note lists them
when they change; sheet `schemaVersion` only changes when the stored character
format changes.

## [0.25.0] - 2026-11-26

The public instance gets a privacy policy and an explicit consent step.

### Added

- `/privacy`: versioned privacy policy in RU and EN, linked from the footer.
- Registration requires an explicit consent checkbox; the accepted policy
  version is stored in `data/consents.jsonl` (uid, time, version, source).
- `npm run legal:scan`: fails when a phrase from a private marker list appears
  in tracked files; the pre-deploy gate runs it when `DCS_LEGAL_MARKERS` is
  set and skips it otherwise.

### Changed

- `POST /api/auth/register` rejects a request without consent or with a stale
  policy version (`consent_required`, `privacy_version_mismatch`).

### Operator

- `data/consents.jsonl` is append-only proof of consent; back it up with the
  rest of `data/`. Deleting an account does not delete its consent record yet —
  see `_NEW_PRIVACY_PROMPT.md` stage 2.

## [0.24.1] - 2026-11-26

### Fixed

- Four epic boon descriptions (Fortitude, Irresistible Offense, Skill
  Proficiency, Truesight) still carried rulebook wording; they are now short
  mechanical statements like the other boons.

### Plugin versions

- dnd5e 1.15.0.

## [0.24.0] - 2026-11-26

The catalog keeps the rules, not the book prose.

### Changed

- DH2 home world and background bonuses (15 + 14) are written as short
  mechanical statements instead of book wording; ids, numbers and prerequisites
  are unchanged.
- D&D 5e epic boon descriptions (22) are short mechanical statements; names and
  keys are unchanged.

### Plugin versions

- dh2 1.19.0, dnd5e 1.14.0.

## [0.23.0] - 2026-11-25

Dark Heresy sheets keep the phrase a player saw, while the built-in text
becomes an example.

### Changed

- DH1/DH2 divination and role texts are replaced with invented examples. A
  sheet shows `divinationText`/`divinationEffectText` (both locales) when the
  0.22.0 backfill filled them, otherwise the example with a "Sample" badge.
- Divination is edited as text in the sheet; the row picker stays for creation
  and import review and resets the frozen text when the row changes.
- Divination options show the d100 range (`02–03 · …`); DH1 ranges come from
  table 1-18.
- Startup logs a warning when a pre-0.23.0 sheet still has a divination id
  without frozen text.

### Fixed

- `divinationText`/`divinationEffectText` were dropped by the API allowlist on
  save; the zod schemas now include them.

### Plugin versions

- dh1 1.17.0, dh2 1.18.0.

## [0.22.0] - 2026-11-25

Dark Heresy sheets keep the divination text a player already sees, ahead of
removing book text from the build.

### Added

- `divinationText` and `divinationEffectText` on Dark Heresy sheets: optional
  localized (`en`/`ru`) copies of the phrase and effect shown in the sheet. A
  sheet that has them renders them instead of the dictionary text.
- `npm run legal:backfill`: freezes the phrase and effect in existing sheets in
  both locales, skips demo sheets, resolves legacy sheets by manifest aliases
  and by phrase, supports `--dry-run`, `--backup`, `--explain`. Idempotent.
- Deployment notes describe the order: run the backfill after 0.22.0 and again
  right before 0.23.0.

### Changed

- Sheet `schemaVersion`: DH1 6 → 7, DH2 5 → 6. The new migration steps are
  no-ops; older sheets stay valid and are migrated on first open. The bump keeps
  a pre-0.22.0 build from stripping the frozen fields on save.
- Portable JSON export carries the frozen text next to the divination id.

### Plugin versions

- dh1 1.16.0, dh2 1.17.0.

## [0.21.0] - 2026-11-25

Dark Heresy sheets can be ordered by hand, and the 1e legacy block moves into
the notes.

### Added

- A skill characteristic: `Skill.characteristic` (a code from `stats`) replaces
  the `(Инт)` suffix in the name, the DH1/DH2 skill table gained a "Хар."
  column, notes became an icon next to the name, the Excel export carries the
  characteristic and history shows its code. An old suffix is parsed for display
  only and moved into the field by the next edit.
- Reordering where it matters: skills (basic and advanced lists separately),
  talents, inventory and quest journal rows drag with a shared `sortable-rows`
  helper — pointer with an 8 px threshold, keyboard sensor, screen-reader
  announcements, a 24×24 handle on the desktop and 32 px on the phone. The order
  is saved as an ordinary sheet update, and the journal's up/down arrows are
  gone.
- Weapons reorder by dragging: melee and ranged are one visible list, dropping
  onto the other group moves the weapon and flips "Equipped", and the array
  stays grouped. In edit mode "Add weapon" now sits above the list.
- Conditions have their own Edit/Save button independent of "Info", and `kind`
  gained `implant`/`blessing` with a positive badge driven by a prop, so the core
  does not name games.
- Custom resources in compact edit mode can change the name and "Max"; on the
  desktop the notes icon moved next to the name.
- Quest cards: the title is editable in the expanded card (before, only at
  creation), notes default to three rows and the field has a label.

### Changed

- The DH1 sheet format is now `schemaVersion` 6: `migrateDh1V5toV6` moves
  `traits`, `eliteAdvances`, Insanity degree/modifier and Corruption degree/test
  into a "Наследие" notes tab (`noteTabs`, id `dh1-legacy`) and removes them
  from the sheet, the UI and the JSON export; importing an older file still
  accepts them.
- Panels collapse towards the edge they will occupy, so the cursor does not
  travel across the screen; house rules write to the sheet immediately and lost
  their "Save changes" button; the sort handle is a narrow cell without a box
  (a thin frame on hover/focus), and guest links render no handles and no gutter
  column.
- "Hide notes" and "Hide edit buttons" now also cover the DH characteristics in
  the middle panel and the compact bar, the D&D compact bar and the companion
  sheet.
- Plugin versions: `dh1` 1.15.0, `dh2` 1.16.0, `dnd5e` 1.13.0 (`sandbox` stays
  1.5.0). `PLUGIN_API_VERSION` (`1.4.0`) is unchanged.

### Fixed

- The skills table no longer logs a hydration error: the drag wrapper wraps the
  table instead of putting a `div` inside `<tbody>`.
- Table headers line up with their content again, the inventory label aligns
  with the name instead of the handle, and compact columns narrow to 24 px so
  all flags fit at 412 px.

## [0.20.0] - 2026-11-25

The interface speaks the user's language from the first frame, and the dashboard
becomes a workspace.

### Added

- The interface language is known on the server: a `dcs_language` cookie,
  `Accept-Language` with q-weights, `<html lang>` and a first frame that is
  already in the right language — no flash and no mismatched tabs. The choice is
  stored in the profile (schema v6, `language`) and survives clearing the cookie;
  `PUT /api/auth/preferences` sets it, sign-in copies the profile language into
  the cookie, and an old `localStorage` choice migrates with one reload.
- Translation keys are typed: `TranslationKey` covers core and plugin keys
  (`i18n.keys.generated.ts`), a typo now fails `tsc`, `t(key, vars)`
  interpolates and `tPlural` picks an `Intl.PluralRules` form
  (`_one`/`_few`/`_many`/`_other`), so Russian counts read correctly. Plugins
  keep an untyped `t` because they build keys from their own data. Quest dates
  follow the UI locale instead of a hardcoded one.
- Drag-and-drop card ordering: a handle on each card (on hover on desktop,
  always visible on the phone, Space/arrows from the keyboard), an optimistic
  reorder through `PUT /api/characters/order` with a rollback on failure, and the
  order stored in the profile; the default list is "freshest first". Unknown ids
  are dropped and the order is capped at 500 entries.
- One tools menu in the header (stats editor, backup of all sheets) instead of
  three duplicate entry points.
- The admin "Show on demo" switch per edition: the demo list is built from
  published, enabled and marked editions, at most `DEMO_MAX = 3`, and no longer
  depends on who is looking.
- An accessibility gate: axe `wcag2a`/`wcag2aa` on `/`, `/demo`, `/login`,
  `/settings`, `/admin`, `/docs` and the D&D sheet, part of the fast set, with an
  allowlist and a ceiling for the known sheet debt. Card actions are 44 px on the
  phone and carry names, D&D section buttons, checkboxes and numeric fields are
  labelled, and the DH `EditSaveButton` takes its name from the dictionary.
- A "back to top" button at the end of a documentation article, and a unit test
  that compares the endpoint map in `docs/api.md` with the OpenAPI document
  (archive, trash and `buildId` included).

### Changed

- Typography: the headline font is Manrope with Latin and Cyrillic subsets —
  Space Grotesk had no Cyrillic, so Russian headings fell back to a system font.
  The scale now reads `--text-*` from `@theme`, so adaptive variants work again
  and the 22 `!important` overrides are gone; `--breakpoint-xl` is 1300 px,
  matching `viewport.ts`. Muted text and primary buttons were darkened to AA
  (4.97:1 and 5.47:1).
- Layout: content width is capped at `--content-max` (1760 px) for the frame and
  the header, the dashboard grid is `auto-fill minmax(18rem, 1fr)` (5/4/3/2/1
  columns instead of breakpoint steps), and cards in a row share one height.
- Character cards take their accent from the edition theme — a left bar, the
  badge backdrop and a hover ring (`--card-accent`, with a darker strong tone for
  small text) — and the badge shows the game and the edition on two lines. The
  accent respects the admin "core styles" flag.
- The header's home icon is a house instead of a shield; the shield stays for the
  admin entry in the profile menu.
- Dark Heresy armour type reads `Flak` and a legacy `Flack` value is translated;
  D&D alignment wraps to two lines instead of being cut.
- Repository links point to `https://github.com/digitalcharsheets/digital-character-sheets`.
- New dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  (runtime) and `@axe-core/playwright` (dev).
- Plugin versions: `dh1` 1.14.0, `dh2` 1.15.0, `dnd5e` 1.12.0, `sandbox` 1.5.0.
  Sheet `schemaVersion` (Dark Heresy `5`, D&D 5e `2`, sandbox `3`) and
  `PLUGIN_API_VERSION` (`1.4.0`) are unchanged.

### Fixed

- `notFound()` from a route answers `404` instead of `200` (the root Suspense
  boundary masked the status), `/error/404` renders the real not-found page again
  (a type guard narrowed a string to a number), and `predeploy` checks the 404
  route through `_not-found`. The old `src/app/loading.tsx` is replaced by
  `PageLoader`.

## [0.19.0] - 2026-11-24

Two-factor sign-in, an archive with a 14-day trash, and a security pass.

### Added

- Two-factor authentication (TOTP, RFC 6238 on `node:crypto`): `POST
  /api/auth/totp/setup` returns the base32 secret, an `otpauth://` URI and a QR
  generated on the server (`src/lib/qr-codegen.ts`, the vendored Project Nayuki
  encoder, MIT), so the secret never leaves the installation; `enable` returns
  ten one-time backup codes, and `disable`/`backup-codes` need the current
  password. The secret is AES-256-GCM ciphertext keyed by `DCS_TOTP_KEY` or by a
  key created at `<data-dir>/.totp-key` (0600), `lastStep` blocks a replayed
  code, and recovery or an admin reset switches 2FA off. Sign-in without the code
  answers `401 totp_required`, with a wrong one `401 totp_invalid`.
- Archive and trash: `archive/` and `trash/` inside every account, `GET
  /api/characters/archive`, `POST /api/characters/{id}/archive`, `POST
  /api/characters/{id}/restore`, `GET|DELETE /api/characters/trash`, an
  `/archive` page with both lists and an "Archive" action on character cards.
  Deleted sheets stay for 14 days with `deletedAt`/`expiresAt` metadata and are
  purged automatically; account deletion leaves a shadow copy in
  `data/.trash/users/<uid>-<timestamp>/` for the same 14 days. `npm run trash`
  (`scripts/trash.mjs`) lists, purges and restores by hand.
- Note tabs: an additive `noteTabs` field (up to 10) in every edition schema,
  tabs in the notes sheet, and coverage in JSON/Excel export and history.
- "Keep the screen on" in display settings (Screen Wake Lock API, re-requested
  after `visibilitychange`, a no-op without support), remembered across reloads.
- `npm run test:stand` (`scripts/stand-smoke.mjs`), an opt-in eight-step check
  against a real stand, plus `SECURITY.md` and ADR 0005 for the scrypt
  parameters.

### Changed

- Security pass (SEC2): changing the recovery phrase requires the current
  password on `/api/auth/phrase` and `PUT /api/auth/profile`; one phrase policy
  on every path (at least 6 words or 24 characters, max 256) while old short
  phrases still open their accounts; the client IP is the last hop of
  `X-Forwarded-For` and nginx overwrites the header; the rate limiter keeps a
  debounced snapshot in `<data-dir>/.state/rate-limit.json` and also counts per
  account, so rotating the IP does not reset the window; CSRF checks (`Origin` +
  `Sec-Fetch-Site`) live in `src/proxy.ts`; the session cookie is
  `__Host-dcs_session` in production (the old `dcs_session` is still read for 14
  days); `/api/search` is rate limited and `/login` answers `X-Robots-Tag:
  noindex`; quotas are 100 sheets and 50 MiB per account, grandfathered for
  accounts already over them; `user.json` moves to schema v5 and scrypt to
  N=2^15, parameters are rehashed on the next successful sign-in. A nonce CSP
  was prototyped and rejected with a measurement (p95 6–10 → 21–22 ms), and the
  residual risk is written down in `docs/security.md`.
- The phone `/share` page uses the same read-only compact rail as the owner
  instead of a full desktop sheet.
- The import dialog has a localized drop zone instead of a native file input, so
  no Russian browser strings leak into the English UI; confirmation dialogs are
  `role="alertdialog"`, and Esc or a click outside closes them.
- Dark Heresy wounds accept negative values down to `-max`; DH1 Rank is readable
  and asks for the advanced path once in a dialog; DH2 ranged weapons carry
  armour penetration in the type, schema, cards, Excel and demo; the quest
  journal has a visible delete-target action, quest confirmation and a progress
  bar; the creation wizard has one header per step and "Back" outside the card;
  a session's history changes are listed newest first with a line-by-line diff
  for text values.
- Plugin versions: `dh1` 1.13.0, `dh2` 1.14.0, `dnd5e` 1.11.0, `sandbox` 1.4.0.
  Sheet `schemaVersion` (Dark Heresy `5`, D&D 5e `2`, sandbox `3`) and
  `PLUGIN_API_VERSION` (`1.4.0`) are unchanged.

### Fixed

- TOTP setup no longer answers `503 totp_unavailable` when `DCS_TOTP_KEY` is
  unset: the key is created on first use. A broken environment value or a broken
  key file still fails at startup.
- `scripts/trash.mjs` restores an account on 9p and overlayfs, where `rename`
  between `.trash` and `users/` fails with `EXDEV`; the copy-and-remove fallback
  matches the runtime.
- The read cache no longer stores a parsed value when the file signature does not
  match.
- The TOTP QR renders at 240×240 with `#1f2937` modules and a quiet zone instead
  of an unstyled black square.

## [0.18.4] - 2026-11-23

### Added

- `plugin.json#shortCode` — a required, unique and untranslated short code per
  edition (`dh1e`, `dh2e`, `dnd5e`, `sandbox`). The generator rejects a
  duplicate, conformance compares the manifest with the module constant, and the
  core gates (purity, test layout) read the code from the manifest instead of
  keeping their own list of game ids.

### Changed

- Game visual screens moved into the plugin folders: locale, sheet themes, `/new`
  forms, demo previews, stats-editor vitals and form validation now live under
  `src/games/<id>/tests/visual/` together with their baselines. The host keeps
  login, dashboard, admin, history, share, settings and docs, and the sheet i18n
  cycle iterates the editions seeded by the registry instead of a hardcoded list.
- Character fixtures belong to the editions: the `dh1`/`dh2` legacy JSON moved to
  `src/games/dh{1,2}/tests/fixtures/`, `makeCharacter` builds a sheet through the
  plugin's `createDefaults`, and the per-edition factories
  `makeDndCharacter`/`makeDhCharacter` are gone.
- Plugin versions: `dh1` 1.12.0, `dh2` 1.13.0, `dnd5e` 1.10.0, `sandbox` 1.3.0.
  Sheet `schemaVersion` (Dark Heresy `5`, D&D 5e `2`, sandbox `3`) and
  `PLUGIN_API_VERSION` (`1.4.0`) are unchanged.

### Fixed

- DH1 rejected a negative experience cost: the UI stores a penalty as a negative
  `cost`, but the schema required `>= 0`, so the write failed and the experience
  did not change. The field now accepts down to `-10 000 000`, and the visual
  scenario for an award plus a penalty starts from 100 XP.
- The sandbox sheet on a phone: `#info-section` now exists, so the
  compact-navigation item lands on the section instead of a `console.warn`;
  rank and notes are read-only outside edit mode like the real editions, the
  rank field has a label, and stat values carry hover titles.
- The notes preview no longer pushes Save/Cancel off the screen: the header and
  the bottom bar keep their size and the scroll area may shrink, so a long
  markdown document leaves both buttons in the viewport at 412×500.
- `scripts/quality/check-duplicates.mjs` is stored as `100644`: the executable
  bit produced a permanent mode-only diff on Windows and network shares.

## [0.18.3] - 2026-11-22

### Added

- `npm run dedupe:check`, step 6 of `npm run verify` next to the dead-code gate:
  jscpd over `src` (game folders excluded), `tests` and `scripts`, with an
  allowlist for editions, dictionaries, generated files, fixtures and vendored
  code, and a threshold that may only go down (baseline 45 clones / 720 lines;
  the tree is at 20 / 320). `jscpd@4.3.0` is a dev-only dependency.

### Changed

- Thirteen page shells share one `AppFrame` (`h-dvh` + header + `main` + footer,
  variants for wide, compact, stats, sheet, centered, plain, document and demo
  layouts, a `sidebar` rail and `after` overlays, plus a skip link), so the
  header and footer now exist in one place instead of thirteen.
- API routes use shared `jsonError` and `withOwnedCharacter`/`withOwner`
  helpers: 56 inline `success: false` envelopes across 14 routes went through
  them, with response shapes and `Retry-After` unchanged.
- The DH2 data pack is decoupled from a local checkout: `generate.mjs` reads
  only `DCS_CONTENT_DIR` (default `./content/dh2`), the freshness test skips
  without it, and the regenerated `dh2e-*` files no longer mention a workspace.
- Duplicated helpers are now single: password/secret verification shares one
  hash parser and constant-time compare, `derive` apply and heal share one
  scenario, history diff and session share `deepEqual`, the delete dialog,
  share actions and `postAuth` have one implementation each, and the scripts
  share `common.sh`, `wait-http.sh`, `self-copy.sh` and one source scanner.
- Plugin versions: `dh2` 1.12.0 (regenerated data pack); `dh1` 1.11.0,
  `dnd5e` 1.9.0 and `sandbox` 1.2.0 are unchanged. Sheet `schemaVersion` and
  `PLUGIN_API_VERSION` (`1.4.0`) are unchanged.

### Fixed

- The bulk stats editor keeps what the player typed: `modules` is memoized and
  the init effect no longer recreates `characters`/`tables` on every render, so
  input and Save no longer snap back to the server value; numbers are clamped to
  the column `min`/`max` and a value cannot become `NaN`.
- `/api/auth/*` rejects a body over 16 KiB with `413` before `JSON.parse` and
  answers `400` for malformed JSON instead of `500`. `safeInternalPath` keeps
  `/settings?from=` on a single leading `/` (no `//host`, no backslashes), and
  `listCharactersForAdmin` validates the uid before touching the directory, so
  a path traversal through `/api/admin/users/<uid>/characters` is closed.
- `/about` no longer repeats the footer: the header lost the MIT badge and the
  version label, and the links block keeps documentation, API reference and
  changelog only.

## [0.18.2] - 2026-11-22

### Fixed

- `scripts/dcs-dev.bat` on Windows: `cmd.exe` misparsed the multi-line batch
  with LF line endings and executed fragments of comments instead of the script.
  The launcher is now a single line that runs `scripts/dcs-dev.mjs`, which keeps
  the same commands and flags.

## [0.18.1] - 2026-11-22

### Added

- `scripts/dcs-dev.bat`: a Windows launcher for the local dev server that needs
  neither bash, WSL nor `screen`. It checks Node.js, installs dependencies,
  starts `npm run dev` in a separate window, waits for `/api/health` and can
  stop, restart, show status and follow the log.

## [0.18.0] - 2026-11-22

A one-click salary, a branded page for every error status, and a sandbox that
shows the whole SDK.

### Added

- Dark Heresy 1e: a **Collect salary** button adds the monthly income to the
  character's thrones in one operation and stays hidden while the income is
  zero. The payout is additive and clamped to whole non-negative thrones below
  the field ceiling; the capital and income inputs clamp too, and the edit
  snapshot is taken from the current sheet so a save cannot roll the payout
  back. No new fields, `schemaVersion` stays `5`.
- Branded error pages for every status the app can answer — 400, 401, 403, 404,
  409, 413, 429, 500 and 503 — each with an explanation, the code and a sensible
  action (`src/lib/error-pages.ts`, `error-screen.tsx`). An unknown route gets a
  branded 404 instead of the English Next stub, `/error/<code>` serves static
  pages and `/error/404` answers a real `404`; `/admin` sends a non-admin to
  `/error/403`; a chunk-load failure ends in 503 with reload, a render error is
  500 with retry and the digest, and a root-layout crash still renders
  `global-error`.
- Field limits shared by the server and the forms: `src/games/shared/limits.ts`
  sets bounds for ids, names, notes, arrays, money, experience, wounds,
  quantities and weights, and all four edition schemas apply them (`max` on
  strings, `int`/`min`/`max` on numbers, array sizes). A violation answers
  `400 invalid_payload` with issues, and the create forms carry the same limits
  (`min`/`max`/`step`/`maxLength`, `noValidate`), so the player sees the
  localized message instead of the browser bubble.
- The sandbox is now the full SDK reference: `schemaVersion` 3 with a 2→3
  migration, `import`/`derive`/`derived`, all six UI slots, the complete theme
  token set, a derived total, a nested companion entity, history, a legacy
  import, a house-rules dialog and `CreateFormCompletion.openNotes` — one small
  game that exercises every optional branch of the contract.
- `npm run plugins:layout`, a gate over the canonical skeleton documented in the
  new `docs/plugin-layout.md`: required files, test names without the edition
  prefix, visual fixtures and a favicon. It runs in `npm run verify`, and the
  three shipped editions were aligned to it — D&D 5e gained `schema-version.ts`,
  DH tests dropped the `dh1-`/`dh2-` prefixes, `slots.tsx` became
  `slots/index.tsx`.

### Changed

- Plugin versions: `dh1` 1.11.0, `dh2` 1.11.0, `dnd5e` 1.9.0, `sandbox` 1.2.0 —
  the sandbox also moved its `schemaVersion` from 2 to 3 with a migration. The
  Dark Heresy (`5`) and D&D 5e (`2`) sheet formats and `PLUGIN_API_VERSION`
  (`1.4.0`) are unchanged.

## [0.17.0] - 2026-11-22

The documentation now ships with the app: `/docs`, with search, on the same
origin.

### Added

- A documentation site at `/docs`: the existing `docs/*.md` and the four ADRs
  are rendered in the app (Fumadocs) with the site's own header, footer and
  language. There is no copy of the content and no external CDN, so the strict
  `script-src 'self'` holds; `docs/README.md` becomes the index at `/docs`,
  `/docs/<slug>` is a page, an unknown slug is a `404`, and each page keeps
  exactly one `h1`.
- Search over the documentation: a dialog in the docs header queries
  `/api/search`, an index built over the pages' structured data. Only the
  matches (3–20 KB per query) leave the server, not the ~450 KB of all indexes,
  and the endpoint is limited to the same origin.
- `/about` gained "Documentation" and "API reference" links, so the docs are
  reachable from the app and not only from the repository README.
- `npm run docs:generate` and `npm run docs:check`: `docs/meta.json` and
  `docs/adr/meta.json` are generated from the map in `docs/README.md` and
  checked by step 4 of `npm run verify`, so the sidebar order, the map and the
  files cannot drift apart.
- Coverage for the docs pipeline: every map row has a file and there are no
  orphans, `meta.json` matches the generator, the frontmatter `title` repeats
  the `# H1`, `description` repeats the map row and relative `*.md` links
  resolve; the link-rewriting plugin is tested on a synthetic tree. Smoke
  checks `/docs`, `/docs/architecture` (no `href="../"`, no external assets), an
  unknown slug (`404`) and `/api/search`.

### Changed

- Every documentation page starts with YAML frontmatter (`title`,
  `description`), which Fumadocs needs to build a page. The `# H1` stays, so the
  site renders exactly one heading and GitHub keeps showing the title.
- Links keep working in both views: `[api.md](api.md)` becomes `/docs/api`, an
  ADR's `../data-storage.md` becomes `/docs/data-storage`, and paths to code
  such as `../src/lib/session.ts` render as inline code instead of a dead link.
- New dependencies: `fumadocs-core` 16.19.7, `fumadocs-ui` 16.19.7,
  `fumadocs-mdx` 15.6.4 and `@types/mdx` 2.0.14 (84 transitive packages, no
  second React or Next). `next.config.ts` wraps the existing config with
  `createMDX()`, and the generated `.source/` types are ignored by git,
  Prettier and ESLint.
- Plugin versions are unchanged (`dh1` 1.10.0, `dh2` 1.10.0, `dnd5e` 1.8.0,
  `sandbox` 1.1.0) because `src/games` was not touched. The sheet `schemaVersion`
  (Dark Heresy `5`, D&D 5e `2`) and `PLUGIN_API_VERSION` (`1.4.0`) are
  unchanged too.

## [0.16.2] - 2026-11-22

A dead-code gate, a lighter repository and three phone fixes.

### Added

- `npm run deadcode:check`, step 6 of `npm run verify`: a TypeScript program over
  `tsconfig` classifies every export as used, dead, export-only or test-only,
  finds files nobody imports, and fails on a dead export, an allowlist entry
  without a reason or a stale entry. Entry points (Next, plugin manifests,
  `<file>#<export>`), dynamic `import()` targets, the generated DH2 data and the
  shadcn kit are exempt; `test-only` has a ceiling (81) so a new test-only
  symbol is a deliberate change. At the moment of the release 5 exports remain
  dead and all of them are the allowlisted public `plugin-api` surface.
- A D&D 5e dictionary guard: every `dnd.*`/`dnd5e.*` key must be used somewhere
  in the code (literals, template prefixes, the `…Desc` family by rule). Nine
  unused keys were removed, including `dnd.neutralGood`, whose Russian value
  carried a typo.

### Changed

- `src/games/*.generated.ts` (registry, i18n, games) are no longer tracked: they
  are the output of `scripts/plugins/generate.mjs` from the manifests and are
  regenerated by `postinstall`, `predev`, `prebuild`, `pretest`, `pretypecheck`,
  `predeadcode:check` and step 4 of `npm run verify`, so a manifest diff no
  longer drags 151 lines of generated code along.
- Dead code and files removed: `export-import-dialog.tsx` (270 lines, superseded
  by `import-character-dialog.tsx`), the `security/index.ts` barrel, the
  byte-identical `public/favicon-default.ico`, the localStorage sheet CRUD left
  from the pre-server era, unused schemas and export types, DH2 aptitude and
  divination helper exports, and `use-host-theme.ts`. The test-only
  server-storage factories moved to `tests/support/server-storage.ts`.
- Plugin versions: `dh1` 1.10.0, `dh2` 1.10.0, `dnd5e` 1.8.0 (`sandbox` stays
  1.1.0). The sheet `schemaVersion` (Dark Heresy `5`, D&D 5e `2`) and
  `PLUGIN_API_VERSION` (`1.4.0`) are unchanged.

### Fixed

- The plugin theme no longer flashes on the first frame when an administrator
  has switched the game to the core styles: the flag arrives with the
  `/api/games` response the page already fetches, and `/share` computes it on
  the server, instead of a second client request that started too late.
- Closing a right sheet with a swipe no longer jerks back first: the panel
  animates to the edge of the screen (150 ms), Radix closes it after 180 ms and
  its exit animation is off. A short swipe still returns the panel in place.
- After a swipe-close the next opening shows the panel again: Radix keeps
  `SheetContent` mounted, so the drag offset and the dismissing state outlived
  the gesture and the panel opened off-screen; both are reset after the close
  and on `onOpenAutoFocus`.
- On the phone the Dark Heresy hit-location block is its own full-width card in
  the Information column instead of being squeezed inside the Info card, where
  its heading dropped to 9 px and wrapped. The compact-navigation anchor still
  points at the column, so scrolling to "Info" includes the locations.

## [0.16.1] - 2026-11-22

### Fixed

- The login page no longer fails with "The original argument must be of type
  Function". It imported the password-length constant from the server module,
  which calls `promisify(crypto.scrypt)` while loading and has no `crypto.scrypt`
  in a browser; the policy now lives in `security/password-policy.ts`, and a
  unit test forbids client modules from importing `security/{password,scrypt,
  phrase}`, `server-*` and `node:fs`/`node:crypto`. The API was never affected —
  only the client bundle, so `/login` was the only broken screen.

## [0.16.0] - 2026-11-22

Reads and writes stop queueing, and the sheet list revalidates instead of
re-downloading.

### Added

- `GET /api/characters?view=summary` returns one card per sheet (`id`, `name`,
  `systemId`, `updatedAt`) instead of full bodies — the measured list drops from
  31.3 KB to 1.0 KB (30×). The response carries an `ETag` and
  `Cache-Control: private, no-cache`, and a matching `If-None-Match` answers
  `304` with no body. The default response is unchanged, and HTML, `/share/*`
  and the other API routes stay `no-store`.
- Excel export runs in a Web Worker: the page builds the rows and hands them
  over, the worker loads the vendored SheetJS from `public/vendor/xlsx` with
  `importScripts`, serializes the workbook off the main thread and returns an
  `ArrayBuffer`. Exporting a large sheet no longer freezes typing or scrolling;
  the file format and name are unchanged, `script-src 'self'` needs no
  exception, and a browser without Worker support falls back to the previous
  dynamic import.
- Performance checks, none of which are part of `npm run verify`:
  `npm run bench` (vitest microbenchmarks), `npm run test:load` (six autocannon
  scenarios on a throwaway server, `--assert` with calibrated thresholds),
  `npm run test:race` (registration, one-sheet PUTs, logout and deletion during
  a write) and `npm run test:perf` (Playwright `@perf`: LCP/CLS/first-input and
  a JS chunk budget on `/demo` and `/login`, plus a check that the built worker
  returns a non-empty xlsx). `autocannon` is a dev-only dependency.
- A `no-emoji` unit test rejects pictographs in `src/`, `tests/` and `scripts/`;
  arrows and `✓`/`⚠` are allowed.

### Changed

- Storage is asynchronous: file operations and the data lock use `fs/promises`
  and a FIFO queue with a 5 ms step instead of blocking `Atomics.wait`, and
  `updateCharacterOnServer` reads, checks `__seq` and writes under one lock.
- Single-sheet writes take a per-sheet lock instead of the global one; the
  global `mkdir` lock still covers registration, account deletion, the catalog
  and sessions, and it has priority over new per-sheet locks.
  `save-parallel` reached 325.6 rps against a 120 rps baseline (2.7×), the
  fsync ceiling being about 256 rps.
- `scrypt` runs in the libuv pool (`hashSecretAsync`/`verifySecretHashAsync`;
  the hash format, N/r/p and salt are unchanged), so a login no longer holds the
  event loop for ~50 ms: `login-storm` went from 21.7 to 46.7 rps.
  `UV_THREADPOOL_SIZE=8`–`16` is now documented for the service unit.
- Parsed JSON is cached per file and revalidated by `(ino, mtimeMs, size)`:
  sessions, profiles, the login index, the game catalog and every sheet are
  parsed once, `writeJsonAtomic` invalidates the entry, and an external edit is
  picked up by the signature. Session revocation and account blocking stay
  immediate, a corrupt `sessions.json` is still fail-closed, the history journal
  parse is cached the same way, and guest requests no longer copy an unchanged
  sheet.
- Data files are written as compact JSON (same schema and fields; pretty files
  are still read): a character file drops from 4.6 KB to 3.1 KB, while the
  user-facing export stays pretty.
- **One process per data directory** is a requirement, not a recommendation:
  the read cache only knows this process's writes and per-sheet locks are
  in-process, so `pm2 cluster`, several systemd instances or workers on one
  data dir are unsupported.
- Plugin versions are unchanged: `dh1` 1.9.0, `dh2` 1.9.0, `dnd5e` 1.7.0,
  `sandbox` 1.1.0 — only their unit and visual tests were touched. The sheet
  `schemaVersion` (Dark Heresy `5`, D&D 5e `2`) and `PLUGIN_API_VERSION`
  (`1.4.0`) are unchanged.

### Fixed

- A burst of parallel writes no longer answers `500 Data directory is locked`
  or stalls the event loop: the lock wait is a FIFO queue, not 50 pollers
  colliding on `mkdir` (event-loop p99 fell from 729 ms to 12 ms at 50 virtual
  users).

## [0.15.0] - 2026-11-22

A public about page and a core footer, and the phone gets layouts that fit.

### Added

- A core footer on all 11 screens: version, short commit, branch (from `md` up),
  repository, MIT license and a link to `/about`. It sits in the flow at the end
  of each page's scrollable `main` and is pinned to the bottom of a short page,
  so it no longer leaves a gap under the content.
- A public `/about` page, readable without signing in: what the project is, the
  stack, where `data/` lives and that it stays on your own server, the
  intellectual-property disclaimer, links to the source, changelog, license and
  issue tracker, and the running version.
- The tab icon is served on every page: `app/favicon.ico` covers `/login`,
  `/settings` and `/admin`, where the dynamic component is not mounted, so
  `/favicon.ico` no longer answers 404, and a plugin icon returns to the core
  one after an SPA transition.
- Below 768 px the admin games list and the bulk stats editor render a card per
  row instead of a table cropped halfway: the status select, the visibility
  checkbox and the gear stay reachable, card fields are labelled from the
  column headers, and the table is kept from `md` up with inner scroll.

### Changed

- The version label lives only in the footer: it is gone from the login card,
  the demo landing and the profile menu, and the footer shares one
  `/api/version` request per tab through `useAppVersion()`.
- The 768 and 1300 px thresholds are declared once in `src/lib/viewport.ts` and
  read through `useViewportFlags()`; the unused `ui/sidebar.tsx` and
  `use-mobile.tsx` (a second copy of 768) were removed, and the manual
  `viewport`/`title` tags in the root layout gave way to the `metadata` and
  `viewport` exports.
- Plugin versions: `dh1` 1.9.0, `dh2` 1.9.0, `dnd5e` 1.7.0 (`sandbox` stays
  1.1.0). The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`),
  and `PLUGIN_API_VERSION` stays `1.4.0`.

### Fixed

- Compact navigation scrolls again. D&D had no section anchors at all and Dark
  Heresy lacked skills/talents, so tapping the rail did nothing; the page now
  scrolls `main` to the section after the layout settles, with padding and
  clamping, repeats the scroll on a second tap, and warns in development when an
  id does not resolve.
- The rail itself scrolls on a short screen: on 360×640 the last buttons used to
  sit outside the window.
- Guest links use the mobile layout on the phone: the DH and D&D share pages no
  longer scroll sideways, their panels stack in a column, and no compact rail
  appears — a guest has no rail to switch sections with.
- iOS no longer zooms the page when a field gets focus: fields below 768 px use
  16 px on focus.
- Touch targets on the phone: dialog and sheet close buttons and destructive
  icons are 40×40, the D&D inspiration `±` and the rail buttons are at least
  32×32 with accessible names, and the DH characteristic dots keep their 12 px
  look inside a 24×24 hit area, so a tap 10 px off centre still counts.
- D&D "Add Companion" no longer covers the "Companions" heading and stays on its
  own line when the width is short; the inspiration pill is a labelled group;
  captions that were clipped ("FATE POIN…", "Passive Wisdom (Perception)",
  "Proficiency Bonus") wrap or get a hover title.
- The demo buttons on the landing wrap their captions, so the Russian
  "Dungeons & Dragons · 5-я редакция" no longer pushes the grid 8 px past
  `main`.
- The document no longer carries two `viewport` meta tags, and removing the
  `<link>` nodes in `DynamicFavicon` no longer breaks the next SPA transition
  (`removeChild of null`).

## [0.14.0] - 2026-11-21

Every shipped game gets its own typeface, and right sheets close with a swipe.

### Added

- Dark Heresy 1e gets its own theme: a gold accent palette for both modes, a
  matching border and focus ring, and a smaller radius. It was the last shipped
  game still drawn in the host indigo.
- Theme fonts in the shipped games: Cormorant Garamond (DH1), Cormorant SC
  (DH2), Forum (D&D 5e and the sandbox). Each plugin keeps two `woff2` subsets
  and the `OFL.txt` licence in `assets/`, declares `@font-face` with a Cyrillic
  `unicode-range` in its sheet CSS module and opts in through `ui.theme.font`,
  so the files load with the sheet chunk instead of every page. The theme wrapper
  exposes `data-font-expected` and `data-font-ready`, and a screenshot waits for
  both plus `document.fonts.ready`, so a baseline never catches the host face.
- A plugin may import `next/font/local` (exact match; the rest of `next/*` stays
  forbidden) when it prefers that route. `@font-face` in the game's CSS module
  remains the recommendation: Turbopack hoists the CSS and preload links of a
  font module imported from a lazy chunk into every page.
- The admin Games table has a gear per edition that opens **Game settings**: a
  "Use the game's theme" switch stored as `useHostTheme` in
  `game-catalog.json`, applied without a rebuild to the sheet, `/share` and
  `/demo`; a reset back to the game theme; and a link to the demo. The first
  column now shows the game family and the second the edition.
- Right sheets — notes, quest journal, experience log, narrative and backstory —
  close with a rightward swipe on touch screens: the panel follows the finger and
  closes past `max(80 px, 25% of the width)` or faster than 0.5 px/ms. Text
  fields, selects and contenteditable areas are exempt, and vertical scrolling
  stays with the browser; the close button, Escape and the overlay still work.

### Changed

- Plugin versions: `dh1` 1.8.0, `dh2` 1.8.0, `dnd5e` 1.6.0, `sandbox` 1.1.0.
  The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`), and
  `PLUGIN_API_VERSION` stays `1.4.0`.
- DH1 and DH2 inventory totals multiply a row's weight (and, for DH1, its price)
  by the row's quantity: the stored numbers are per unit. There is no migration
  — a row without a quantity reads as 1, so only rows already at 2 or more
  change their totals.

### Fixed

- A guest share link is interactive again. The sheet is no longer `inert`:
  inputs and textareas are read-only, checkboxes and switches are disabled, and
  the narrative and experience log stay in view mode, so collapsing a section,
  opening info popovers and switching the history tab work again. Server-side
  write protection and the no-op mutations are unchanged.
- The inventory edit fields are labelled "Qty / Weight, kg / Price, thrones"
  (DH1) and "Qty / Weight, kg" (DH2) instead of three bare numbers that differed
  only by their order.

## [0.13.0] - 2026-11-20

Each game gets its own palette, and the sandbox game ships.

### Added

- `ui.theme` in the plugin manifest: a plugin declares scoped light/dark design
  tokens (12 fixed tokens, colors as HSL triplets, `radius` as a length) and the
  sheet page applies them for that game only. Plugin API is now 1.4.0, and a
  plugin may ship a theme font that is loaded lazily (a failed chunk keeps the
  host fonts).
- Dark Heresy 2e (terracotta on parchment), D&D 5e (deep carmine with pink
  frames and a matching focus ring) and the sandbox game (green) no longer use
  the host indigo palette on their sheets; cards stay as they were and the
  radius comes from the token set.
- The permanent test game "Sandbox" (`defaultStatus: test`): a real plugin in
  the shipped build with its own schema, defaults, demo, export/Excel, migration,
  dictionaries, UI slots, scoped theme and favicon. Testers and admins see it,
  regular users do not by default, and its visibility is managed like any game.
- Two core-purity gates: the core may not import a game folder
  (`check-core-imports.mjs`), and core CSS or string literals may not name a
  game (`check-core-purity.mjs`, with a ratchet for the current debt).

### Changed

- Plugin versions: `dh1` 1.7.0, `dh2` 1.7.0, `dnd5e` 1.5.0 (`sandbox` ships at
  1.0.0). The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- Games are independent copies: Dark Heresy family rules live inside each
  edition instead of `src/games/shared`, sheet styles are CSS modules per game,
  and the 2e data generator moved to `src/games/dh2/scripts` — no game scripts
  or game paths remain in the repo root or in `predeploy.sh`.
- Visual specs and baselines moved into the plugin folders; the host specs check
  only geometry, so the host test suite stays green without any stock edition.

### Fixed

- The compact characteristics block on mobile and tablet no longer draws Radix
  checkmarks inside the 10 px step boxes.
- The import review mode survives a hard navigation (the mark lives in the tab's
  sessionStorage), so an imported sheet keeps its review banner after the
  segment reloads.

### Added

- Games can theme their own sheet (`plugin.json#ui.theme`): a fixed list of
  host tokens for the light and dark modes, rendered as CSS variables on the
  sheet page only. No selectors or arbitrary CSS — the rest of the site and the
  other games stay untouched. An optional plugin font (1.4) is loaded lazily
  and applied to the same scope without entering the shared bundle. `pluginApi`
  is now 1.4; the reference fixture and the DH2 demo theme exercise the
  contract.

### Changed

- Each shipped game now has its own restrained sheet palette through
  `plugin.json#ui.theme`: Dark Heresy 2e is terracotta on parchment, D&D 5e is
  crimson with rose frames, the sandbox is green. Only accents, frames and (for
  2e) card tint change; the rest of the site and the other games keep the host
  palette.
- The sheet layout of every game now lives in its own CSS module inside the
  plugin folder (`dnd5e/sheet.module.css`, `dh1/…`, `dh2/…`) instead of
  `globals.css`; the core keeps a gate that fails on game selectors in core
  CSS. Two dead rules (`.dcs-info-grid`, `.dnd-stretch-card`) were removed with
  it.
- Alike Dark Heresy mechanics (stat arithmetic, cumulative skill training, the
  import-review banner) are copies inside each edition instead of a shared
  layer; a parity test compares their behaviour and skips when one edition is
  absent. The DH2 data-pack generator moved into `src/games/dh2/scripts/` and
  the game-specific `dh2e:*` npm scripts are gone.
- Host unit tests no longer require a specific edition: the game catalog,
  slots, translations, admin badge and password helpers read the registry and
  files, and edition scenarios are guarded with `it.runIf(hasPlugin(id))`.
  Removing `src/games/dh2` now leaves `npm run verify` green (build and a
  temporary-server smoke test included).

### Fixed

- An imported sheet keeps its choice-review mode when the transition to the
  sheet page ends up as a full document load (Next.js hard-navigation
  fallback). The flag now lives in the tab's `sessionStorage` instead of module
  memory, so the creation locks open and the review banner appears again; the
  unit test reproduces the module reload.

## [0.12.0] - 2026-11-20

Inventory with quantities and totals, hit locations on the phone.

### Added

- DH1/DH2 inventory rows show quantity, weight and (DH1 only) price, with
  totals under the columns, a "Lost" checkbox that greys the row out, a compact
  grid on mobile and numeric fields in edit mode. A sheet from an older version
  is not rewritten: quantity defaults to 1, weight and price read as "not set".
- Hit locations and AP are visible on mobile: the armor scheme is its own
  section and, in compact view, is also rendered at the end of the "Info" card.
- Custom resources sit inside "Items" with their own plus/minus; the schema and
  `customResources` are unchanged.
- Madness and Corruption are edited with `−`/`+` buttons around the value
  (step 1, not below zero, saved immediately) instead of a modal and the
  points edit mode; notes stay in the popover.

### Changed

- Plugin versions: `dh1` 1.6.0, `dh2` 1.6.0, `dnd5e` 1.4.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- The inventory model is split per game: `InventoryItem` no longer lives in the
  shared types — DH1 has quantity/weight/price, DH2 quantity/weight, D&D 5e
  keeps its previous shape — and the core no longer re-exports the item type.
- The armor scheme returns to the bottom of "Info" (no separate compact tab,
  the sidebar is back to six tabs); body-part labels wrap instead of being
  clipped.

### Fixed

- Toggling "Equipped" in read mode no longer rolls back when a neighbouring
  section saves: the equipment list is read from the current sheet and saved as
  one patch.
- DH1 shows armour-piercing for the unequipped ranged weapon too, and weapon
  `weight` is gone from the types and forms (a legacy value is cleaned up on the
  next save).

## [0.11.0] - 2026-11-19

Stale tabs notice a new build, error screens stop reloading silently.

### Added

- `/api/version` reports `buildId`: the deployment id in production
  (`deploymentId` comes from the build commit, with `.next/BUILD_ID` as the
  fallback) and a per-process id in development. `next.config.ts` sets
  `deploymentId`, so Next itself appends `?dpl=` to static assets.
- A tab notices a new server: it polls `/api/version` every 60 s in production
  (15 s in development), only while visible, and immediately on focus,
  `visibilitychange` and `online`. When the build differs it shows an
  "application updated" banner instead of silently running stale JS.
- `npm run check:build-id` probes any stand from outside; `docs/deployment.md`
  gained a "New build and stale tabs" section.

### Changed

- Plugin versions: `dh1` 1.5.0, `dh2` 1.5.0, `dnd5e` 1.3.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- Error screens (`app/error.tsx`, the sheet error boundary) offer "Retry" and
  "Reload page" buttons instead of reloading on their own; a chunk-loading
  failure is recognised by its text and ends in that banner or screen instead of
  a stuck spinner.
- A lint rule forbids a static `xlsx` import in client modules, so the Excel
  library stays in the lazy chunk.
- `npm run verify` now checks CRLF in the index and in the working tree
  (`npm run eol:check`; the tree is fixed by `npm run eol:fix`).

### Fixed

- The tab no longer reloads itself on forms: the creation wizard, the stats
  editor and any focused input count as unsaved state and only get the banner,
  so the player does not lose input mid-edit.
- D&D 5e takes the experience label from its own dictionary, and DH1/DH2 drop
  leftover edition-split rudiments.

## [0.10.1] - 2026-11-19

Plugin scaffolding, contract alignment and the decision canon.

### Added

- `npm run plugins:scaffold -- <id> [--game] [--order] [--title] [--title-ru]`
  copies the reference fixture into `src/games/<id>/` with the same rules the
  template gate enforces and regenerates the registry, so a new edition starts
  from a passing plugin instead of a copy with stale ids.
- `docs/decisions.md`: the canon of decisions D1–D21 plus troubleshooting and
  language rules, so plugin authors read one page instead of the commit log.

### Changed

- The plugin contract marks `normalize` and `merge` as required (SDK v1) and
  `game.description` as mandatory, matching what the schema and the registry
  gate already enforced. `docs/plugin-sdk.md` lists the fields to rename when
  the template is copied, and the test map is aligned with the code.
- Host plugin tests take the plugin list from the registry instead of a
  hard-coded list, so a newly scaffolded edition is picked up automatically.

### Fixed

- The generated registry sorts imports the way Prettier does, so
  `plugins:generate` no longer leaves a formatting diff.
- The reference fixture keeps the host service fields in its schema and passes
  the contract as a full plugin, including a copy under another id.

## [0.10.0] - 2026-11-18

Server-side derived values, declared migration chains and an honest API schema.

### Added

- The server recalculates derived sheet values (`DCS_SERVER_DERIVE`, on by
  default; `=0` is the emergency brake): creating or updating a sheet runs the
  plugin's `derive` hook before the diff and the write, so level and
  proficiency bonus (or DH characteristics and their consequences) can no
  longer contradict each other in the stored file. Documents written by older
  versions are recalculated when they are read or normalized.
- Plugins declare a full migration chain: D&D 5e ships 1→2 and Dark Heresy
  1→5 (`from`/`to`/`entry` per step). The chain validator now also runs for a
  manifest that declares no steps, and applied steps are reported.
- `derive` and `derived` in the plugin manifest: a plugin names its derivation
  entry point and the field paths it owns. The manifest fields are additive,
  `PLUGIN_API_VERSION` stays `1.3.0`.
- Negative conformance tests: schemas reject out-of-range values (D&D level
  1–20, characteristics 1–30; DH characteristics and Influence 0–100) and an
  empty sheet name in a request, with `issues[].path = "name"`.

### Changed

- Plugin versions: `dh1` 1.4.0, `dh2` 1.4.0, `dnd5e` 1.2.0. The sheet
  `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- `openapi.json` derives `Sheet_<systemId>` and `SheetInput_<systemId>` from the
  registry zod schemas, so the documented `required` fields match what the API
  really accepts; `Character` is an `anyOf` over editions and the component
  description carries the manifest `schemaVersion`.
- Excel export loads SheetJS on demand instead of shipping it in the initial
  client graph.
- The core no longer formats game fields: the admin character list shows a
  generic Details column (labels come from the plugin `CardSummary` slot), and
  the game dictionaries own their Excel captions and import-preview fields.
- UI slot names are normalized, and the manifest check fails on an unsupported
  `pluginApi` range instead of silently ignoring it.

### Fixed

- A Dark Heresy sheet without `systemId` (or with only
  `gameSystem: "Dark Heresy"`) no longer opens as DH1: the bare alias is gone
  and such a sheet opens read-only as "plugin missing" until its edition is
  known (ADR 0004).

## [0.9.1] - 2026-11-18

Plugin lifecycle guard and sheet access for a removed game.

### Changed

- `npm start` now runs `plugins:check` first (`prestart`): the server refuses to
  boot with a stale generated registry instead of failing later on import.
  Adding or removing a game is still: plugin folder → `npm run plugins:generate`
  → rebuild → restart (see [game-modules.md](docs/game-modules.md)).
- Plugin test suites moved next to the plugins: host specs no longer know about
  a specific game, and `test:plugin`, `test:visual:plugin` and `test:layout`
  run per-plugin checks with a layout budget.

### Fixed

- Removing a game plugin no longer breaks the app: sheets of the removed game
  stay in the list, open in a read-only "plugin missing" view instead of a 500,
  and are still exported as JSON and in a full backup.

## [0.9.0] - 2026-11-18

Import review mode, partial plugin locales and a cleaner creation flow.

### Added

- Imported sheets open in a review mode: a banner lists the empty required
  creation fields (DH1 home world and career, DH2 home world, background and
  role) and lifts the creation locks until the player confirms. It works for a
  single sheet and for a package import and does not change the sheet schema.
- A plugin may declare a subset of the site languages and extra locales (`i18n`
  is a map, `en` or `ru` is required): a plugin that ships only RU is shown on
  EN through the site-language fallback instead of raw keys. Plugin SDK is now
  1.3.0.
- Every game ships its own favicon in `src/games/<id>/assets/`, so the tab icon
  follows the open sheet; the shared `public/favicon-dh*` / `favicon-dnd*`
  files are gone.
- DH1 creation requires only the character name: home world, career and
  divination can be chosen later on the sheet.

### Changed

- Plugin versions: `dh1` 1.3.0, `dh2` 1.3.0, `dnd5e` 1.1.0; Plugin API 1.3.0.
  The sheet `schemaVersion` is unchanged (Dark Heresy `5`, D&D 5e `2`).
- DH2 creation no longer highlights empty required choices in red — the form
  validation reports them on submit — and the starting-package hint lists the
  variants without the "Choose…" placeholder.
- DH1 "Current/Spent XP" are editable only in Edit mode (like DH2), and a
  negative free XP is highlighted in both editions.
- Dashboard cards show the full "game · edition" name again; the short code
  stays in the admin list only.
- Character history labels values from the game dictionaries: no raw codes or
  JSON paths in the timeline, boolean characteristic-advance lists render as
  `0/4 → 1/4`, and the shared history fields are an explicit allowlist.

### Fixed

- Deleting a DH2 elite advance also removes its journal line and its cost from
  spent XP, so the two delete paths stay symmetric.

## [0.8.0] - 2026-11-17

Canonical gender, locked creation choices, elite requirements and sheet UX
polish.

### Added

- Dark Heresy 1e/2e store the gender as a canonical code (`male`, `female`,
  `unspecified` or empty for "not chosen") instead of a localized label. Old
  labels in RU/EN are migrated on read; an unrecognized value becomes
  `unspecified` and the original text is kept in the notes as a
  `[gender migration] …` line.
- DH2 elite advances carry structured requirements (characteristic minimum,
  background, gender, another elite). The sheet shows the conflicts in red
  with the reason, while the purchase stays possible for GM exceptions.
- DH2 aptitude choices are locked once made: the ones chosen at creation and
  the ones filled on the sheet are read-only and marked with a lock; the
  aptitude profile is rebuilt from them.
- Password fields have a show/hide toggle on the login, registration,
  recovery, settings, admin edit and account deletion forms.

### Changed

- Plugin versions: `dh1` 1.2.0, `dh2` 1.2.0; `dnd5e` stays 1.0.0. Dark Heresy
  sheet `schemaVersion` is now `5` (D&D 5e stays `2`).
- DH2 creation shows the Adepta Sororitas background as a gender lock: the
  gender becomes Female and the select is disabled until the background
  changes.
- DH1 creation moves the gender select into the Details block; after creation
  the gender is read-only in both editions.
- `Dialog`/`AlertDialog` open in place with fade+zoom instead of sliding in
  from the top-left corner, are capped at the viewport height with internal
  scrolling, and keep a 1rem gutter on mobile. The right-side sheet is
  unchanged.
- The DH Info "Backstory" button uses a book icon instead of an eye.
- Character history labels gender values from the dictionaries instead of
  showing raw codes.

### Fixed

- The gender no longer changes meaning when the sheet language changes, and
  rule checks (Sister of Battle) compare a code instead of a translated
  string.
- Excel exports show the localized gender label, while the portable JSON keeps
  the code.

## [0.7.0] - 2026-11-17

Dark Heresy 2e supplements, creation hints in notes and share-page ownership.

### Added

- Dark Heresy 2e: options from *Enemies Within*, *Enemies Without* and
  *Enemies Beyond* — 15 home worlds, 13 backgrounds and 12 roles, with
  aptitudes, skills, talents and full EN/RU bonus texts.
- Elite advances for DH2: Sister of Battle (750 XP) and Astropath (300 XP).
- Creation hints are written to the character's notes as markdown; the Notes
  sheet opens once after creation so the player can copy them (any game may
  request this via the Plugin SDK).
- Guest share sheets show the owner's display name.
- DH1/DH2: history entries for structured conditions are labelled instead of
  showing raw `conditions.0.*` paths.

### Changed

- Plugin SDK 1.2: `manifestVersion` 2 (`game.description` is now required),
  `CreateFormCompletion` for post-creation panels, and game families generated
  from plugin manifests instead of a hand-written core list.
- Plugin versions: `dh1` 1.1.0, `dh2` 1.1.0; `dnd5e` stays 1.0.0. Sheet
  `schemaVersion` is unchanged (DH1/DH2 4, D&D 5e 2).
- Login and landing copy no longer name specific games.
- DH Info section no longer duplicates the Notes entry; Notes are opened from
  the header icon or compact navigation.
- Insanity and Corruption cards show their values without −/+ steppers; edit
  stays in the card's edit button. Characteristic checkboxes use a filled
  state without an overflowing tick.

### Fixed

- DH2 generated data drift is now caught by `npm run verify`
  (`dh2e:check`), so supplements cannot silently diverge from the catalog.
- Characteristic checkbox ticks no longer look broken on mobile and desktop.

## [0.6.9] - 2026-11-16

### Changed

- Deployment/caching: HTML responses are not cached and the `/:path*` proxy
  rule is restored, so a rebuild no longer breaks hydration.

## [0.6.8] - 2026-11-16

Notes, structured conditions, XP journal and sheet polish.

### Added

- Markdown Notes and Backstory in a right-side sheet.
- Structured Insanity/Corruption conditions for DH1 and DH2.
- XP journal sheet and an "Add XP" button on DH sheets.
- Short edition code in the admin character list.

### Changed

- DH1/DH2 Info block regrouped; "Fate points" is labelled on the sheet.
- DH2 can edit empty creation fields and gender.

### Fixed

- `playerName` removed from the DH1 schema/history; equipment "Not equipped"
  opens after adding a weapon.

## [0.6.7] - 2026-11-16

DH2 second-edition content and sheet depth.

### Added

- DH2 psychic rating, elite advances, aptitude block, Influence/Requisition,
  creation choices and wound/Fate ranges.
- Talent hints during DH2 creation; divinations and RU terms aligned with the
  RU book.
- Guest draft banner on creation.

### Fixed

- DH2 starter skills no longer contain `undefined`; RU sheet terms and skill
  names corrected.

## [0.6.6] - 2026-11-16

### Fixed

- DH2 starter skills no longer contain `undefined` entries.

## [0.6.5] - 2026-11-15

DH1 sheet blocks and DH2 progression.

### Added

- DH1: new sheet blocks, world features, starting profiles and career starting
  packages; three "Inquisitor's Handbook" worlds.
- DH2: purchase skills/talents with XP using the 2-2/2-4/2-6 cost tables;
  experience journal window; manual XP purchases and hidden wealth.
- Documentation for per-edition sheet schema versions.

### Fixed

- Nested history fields and array items are labelled; DH1/DH2 armour types and
  history labels translated.

## [0.6.1] - 2026-11-13

Change history and read-only sharing.

### Added

- Character change history: diff engine, 30-minute sessions, timeline, history
  API (`GET/DELETE /api/characters/{id}/history`) and an optional history view
  in guest links.
- Share links: revocable/expiring read-only sheet links, optionally including
  history.

### Security

- Owner-only history API; token-only guest access; history values sanitized for
  guests.

## [0.5.3] - 2026-11-13

### Added

- Offline Firebase migrator moved into the repository; dev/prod deploy scripts.

### Fixed

- Deploy scripts no longer overwrite themselves and run from their own
  directory.

## [0.5.2] - 2026-11-13

### Changed

- Character sheet moved to `/character/[id]`.
- `/api/version` reports the local git commit.

## [0.5.1] - 2026-11-13

Security hardening.

### Security

- scrypt password hashing, server-side session registry (`jti`), recovery-flow
  takeover protection, path-traversal fix in character API, request schema
  validation, security headers and same-origin API docs.

## [0.4.2] - 2026-11-12

### Changed

- Repository conventions (AGENTS.md), English docs, stricter TypeScript and
  atomic legacy import with `schemaVersion` protection.

### Fixed

- Form validation errors are visible and focus the first invalid field; screens
  no longer hang on a spinner; import errors are translated.

## [0.4.1] - 2026-11-12

Plugin architecture and licensing.

### Added

- Plugin SDK: manifests, generated registry/dictionaries, game modules, UI
  slots, bulk editor and admin plugin catalog.
- MIT license.

## [0.3.0] - 2026-11-12

Modular games and portable export.

### Added

- Game → edition → character creation wizard; independent D&D 5e, DH1 and DH2
  modules; export envelope 3.0 with per-module adapters; character schema
  migrations; i18n namespacing and per-module dictionaries; OpenAPI docs,
  `/api/health` and `/api/version`; admin roles and tester visibility; tablet
  visual baselines.

## Before 0.3.0

Early self-hosted prototype: local accounts, D&D 5e and Dark Heresy sheets,
character creation, export/import, themes and the first visual regression set.
