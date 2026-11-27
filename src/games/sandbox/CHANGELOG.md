# Changelog — Sandbox Test Game

Player-facing, operator-facing and plugin-contract changes to the `sandbox`
reference plugin. The format follows
[Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0) and
[Semantic Versioning](https://semver.org/); the released version is
`plugin.json#version`, independent of the app version in the
[root changelog](../../../CHANGELOG.md). A sheet `schemaVersion` changes only
when the stored character format changes, and the migration is listed with the
release that introduced it.

## [Unreleased]

## [1.7.0] - 2026-11-28

### Changed

- The sheet's layout bands are container queries on the app shell instead of
  media queries, so «UI scale» no longer leaves the reference sheet in a
  narrower box: at 150% it reflows to the tablet band.

## [1.6.0] - 2026-11-27

### Changed

- The sheet reads `isCompactView` (one-column layout) and `isPhoneView` (phone
  presentation) separately, like every shipped edition.
- The demo sheet collapses to one column in the compact view instead of
  switching to the phone presentation.

## [1.5.0] - 2026-11-25

### Changed

- Kept in sync with the host card, theme and typed-i18n changes. No
  player-facing sandbox behavior changed and the sheet format stayed `3`.

## [1.4.0] - 2026-11-24

### Added

- The sandbox schema accepts the additive `noteTabs` field (up to 10), and the
  notes sheet, JSON/Excel export and history cover it.

## [1.3.0] - 2026-11-23

### Added

- `plugin.json#shortCode` is `sandbox`, the required edition code used by the
  generated registry.

### Fixed

- On a phone `#info-section` exists, so the compact-navigation item lands on
  the section instead of a `console.warn`.
- Rank and notes are read-only outside edit mode like the real editions, the
  rank field has a label, and stat values carry hover titles.

## [1.2.0] - 2026-11-22

### Added

- The sandbox became the full SDK reference: `schemaVersion` `3` with a 2→3
  migration, `import`/`derive`/`derived`, all six UI slots, the complete theme
  token set, a derived total, a nested companion entity, history, a legacy
  import, a house-rules dialog and `CreateFormCompletion.openNotes`.

## [1.1.0] - 2026-11-21

### Added

- Forum as the sheet typeface: two `woff2` subsets and the `OFL.txt` licence in
  `assets/`, declared with a Cyrillic `unicode-range` in the sheet CSS module
  and opted in through `ui.theme.font`.

## [1.0.0] - 2026-11-20

### Added

- The permanent test game “Sandbox” (`defaultStatus: test`): a real plugin in
  the shipped build with its own schema, defaults, demo, export/Excel,
  migration, dictionaries, UI slots, scoped green theme and favicon. Testers
  and admins see it, regular users do not by default, and its visibility is
  managed like any game.
- `schemaVersion` `2` and the first `plugin.json#version`.