# Changelog — Dungeons & Dragons 5th Edition

Player-facing, operator-facing and plugin-contract changes to the `dnd5e` game
plugin. The format follows
[Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0) and
[Semantic Versioning](https://semver.org/); the released version is
`plugin.json#version`, independent of the app version in the
[root changelog](../../../CHANGELOG.md). A sheet `schemaVersion` changes only
when the stored character format changes, and the migration is listed with the
release that introduced it.

## [Unreleased]

## [1.17.0] - 2026-11-28

### Changed

- The sheet's layout bands are container queries on the app shell instead of
  media queries, so «UI scale» no longer leaves the desktop grid in a narrower
  box: at 150% the sheet reflows to the tablet band. Dense labels use the shared
  `text-8px`…`text-15px` theme tokens, so «Font size» reaches them.

## [1.16.0] - 2026-11-27

### Changed

- The sheet reads `isCompactView` (one-column layout) and `isPhoneView` (phone
  presentation) separately. A tablet or desktop compact sheet keeps every
  section, normal type and normal tables; the phone layout requires a real
  phone width.

## [1.15.0] - 2026-11-26

### Fixed

- Four epic boon descriptions (Fortitude, Irresistible Offense, Skill
  Proficiency, Truesight) still carried rulebook wording; they are now short
  mechanical statements like the other boons.

## [1.14.0] - 2026-11-26

### Changed

- Epic boon descriptions (22) are short mechanical statements instead of book
  wording; names and keys are unchanged.

## [1.13.0] - 2026-11-25

### Changed

- Internal: version bump for the shared conditions and hide-notes changes;
  the sheet itself is unchanged.

## [1.12.0] - 2026-11-25

### Changed

- Alignment wraps to two lines instead of being cut.

## [1.11.0] - 2026-11-24

### Added

- The sheet schema accepts the additive `noteTabs` field (up to 10), and the
  notes sheet, JSON/Excel export and history cover it.

## [1.10.0] - 2026-11-23

### Added

- `plugin.json#shortCode` is `dnd5e`, the required edition code used by the
  generated registry.

## [1.9.0] - 2026-11-22

### Changed

- The sheet schema adopts the shared field limits: level is 1–20, abilities are
  1–30, and names, notes, arrays, money, experience, wounds, quantities and
  weights are bounded like the other editions.

## [1.8.0] - 2026-11-22

### Added

- A dictionary guard: every `dnd.*`/`dnd5e.*` key must be used somewhere in the
  code (literals, template prefixes, the `…Desc` family by rule). Nine unused
  keys were removed, including `dnd.neutralGood`, whose Russian value carried a
  typo.

## [1.7.0] - 2026-11-22

### Fixed

- The sheet exposes the expected section anchors, so compact navigation and
  guest links land on the section. The page scrolls to it after the layout
  settles and warns in development when an id does not resolve.
- “Add Companion” no longer covers the “Companions” heading and stays on its
  own line when the width is short; the inspiration pill is a labelled group.

## [1.6.0] - 2026-11-21

### Added

- Forum as the sheet typeface: two `woff2` subsets and the `OFL.txt` licence in
  `assets/`, declared with a Cyrillic `unicode-range` in the sheet CSS module
  and opted in through `ui.theme.font`.

## [1.5.0] - 2026-11-20

### Changed

- A deep carmine sheet palette with pink frames and a matching focus ring
  through `plugin.json#ui.theme`; the rest of the site keeps the host palette.
- The sheet layout lives in its own CSS module inside the plugin instead of
  `globals.css`.

## [1.4.0] - 2026-11-20

### Changed

- The inventory model moved into the plugin; the 5e shape is unchanged.

## [1.3.0] - 2026-11-19

### Fixed

- The experience label comes from the D&D dictionary instead of the host or
  another edition, and leftover edition-split rudiments were removed.

## [1.2.0] - 2026-11-18

### Added

- A declared migration chain 1→2 (`from`/`to`/`entry`), with chain validation
  and applied-step reporting.
- Server-side derived values: creating or updating a sheet runs the plugin's
  `derive` hook before the diff and the write, so level, proficiency bonus,
  saving throws, skills and spellcasting values can no longer contradict each
  other in the stored file.
- Negative conformance tests: the schema rejects a level outside 1–20 or an
  ability outside 1–30 and an empty sheet name in a request.

## [1.1.0] - 2026-11-18

### Added

- The plugin ships its own dictionary files and favicon; the sheet itself is
  unchanged.

## [1.0.0] - 2026-11-17

### Added

- First versioned 5e plugin after the Plugin SDK 1.2 migration: manifest
  version 2 and the edition code used by the generated game family.