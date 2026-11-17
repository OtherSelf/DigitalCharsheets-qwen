# Changelog

All notable player-facing and operator-facing changes to Digital Character
Sheets. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/),
versions follow [Semantic Versioning](https://semver.org/), and the released
version is the `version` field in `package.json`.

Plugin versions are separate from the app version. A release note lists them
when they change; sheet `schemaVersion` only changes when the stored character
format changes.

## [Unreleased]

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
