# Changelog — Dark Heresy 1st Edition

Player-facing, operator-facing and plugin-contract changes to the `dh1` game
plugin. The format follows
[Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0) and
[Semantic Versioning](https://semver.org/); the released version is
`plugin.json#version`, independent of the app version in the
[root changelog](../../../CHANGELOG.md). A sheet `schemaVersion` changes only
when the stored character format changes, and the migration is listed with the
release that introduced it.

## [Unreleased]

## [1.22.0] - 2026-11-28

### Added

- The Adepta Sororitas as a ninth, optional career from the Inquisitor's
  Handbook: `Novice` through `Legatine`, three branches at 2000 XP and
  convergence at `Superior` 8000, with the starting package and `70+2d10`
  starting wealth. The creation form hard-locks only the gender (female) and
  filters the four native worlds (Feral, Imperial, Schola Progenium, Noble
  Born); the book's ban on Corruption and the GM permission are hints, not a
  blocked submit. Insanity is not restricted.
- The 15 alternate career ranks from the Inquisitor's Handbook (Table 2-3),
  including Black Priest of Maccabeus, Calixian Xeno-Arcanist, Metallican
  Gunslinger and Sister Oblatia. Each is offered where the book allows it, at
  its minimum rank, with a “Requires GM approval” mark. The standard rank stays
  the default and the choice is locked like any other career path. Later ranks,
  structured prerequisites and unique advances are intentionally not modelled.

### Changed

- The current rank is derived everywhere — header, dashboard card, sheet,
  JSON/Excel — from the career, spent XP and the chosen advanced/alternate
  paths instead of the snapshot stored at creation. The experience block and
  the header can no longer disagree. `schemaVersion` is now `8`: the startup
  pass recomputes stale values, leaves a `.bak` next to the sheet and appends a
  `migration` marker to its history. A sheet without a known career keeps its
  legacy rank (`Acolyte`).
- Career path choices are stored in `rankChoices` (`schemaVersion` is now `9`)
  and locked once chosen: the sheet opens a dialog when experience reaches a
  mandatory fork, keeps the previous rank until a branch is picked, and offers
  an “Alternate Rank” button where a standard path already works. The choice
  survives an experience drop and can be changed only while reviewing an
  imported sheet. Old `advancedPath`/`alternatePath` values are migrated into
  the map and stay in the document for old exports.
- Character creation no longer asks for “XP spent”: a new sheet starts at 0 and
  the field remains on the sheet, in the API and in imported sheets.
- Rank names follow the English book: `Savant Warrant`, `Preceptor-Savant`,
  `Shock Trooper` and `Storm Trooper` (Russian labels are unchanged). The
  career ladder is one generated rank graph, so mandatory forks keep the
  previous rank until a branch is picked and the Adept Chirurgeon alternate
  returns to Scholar at 3000 XP.
- The sheet's layout bands are container queries on the app shell instead of
  media queries, so «UI scale» no longer leaves the desktop grid in a narrower
  box: at 150% the sheet reflows to the tablet band. Dense labels use the shared
  `text-8px`…`text-15px` theme tokens, so «Font size» reaches them.

### Fixed

- The chosen career-path chip no longer shows a lock icon while an imported
  sheet is being reviewed: the choice is editable then, so the chip shows the
  “Change” action without the lock, and the lock returns after the review is
  confirmed.
- Deleting an experience entry no longer pushes `experience` or `totalExpSpent`
  below zero after a manual edit. The sheet used to send a negative number and
  the API rejected the save with `invalid_payload`.

## [1.18.0] - 2026-11-27

### Changed

- The sheet reads `isCompactView` (one-column layout) and `isPhoneView` (phone
  presentation) separately. A tablet or desktop compact sheet keeps every
  section, normal type and normal tables; the phone layout requires a real
  phone width.
- The experience block is called «Опыт»/«Experience» (1e used to say
  «Прогресс»), and its three actions are icon buttons with tooltips, so they
  stay on one row in a narrow panel. English labels use XP consistently.
- Skill training checkboxes («Умелый», +10, +20, +30) save without edit mode;
  unchecking a level clears it together with every higher level.

## [1.17.0] - 2026-11-25

### Changed

- Divination and role texts are replaced with invented examples. The sheet
  shows the frozen `divinationText`/`divinationEffectText` (both locales) when
  the frozen-text backfill filled them, otherwise the example with a “Sample”
  badge.
- Divination is edited as text in the sheet; the row picker stays for creation
  and import review and resets the frozen text when the row changes.
- Divination options show the d100 range (`02–03 · …`); 1e ranges come from
  table 1-18.
- Startup logs a warning when a sheet from before the frozen text still has a
  divination id without `divinationText`.

## [1.16.0] - 2026-11-25

### Added

- `divinationText` and `divinationEffectText`: optional localized (`en`/`ru`)
  copies of the phrase and effect shown in the sheet. A sheet that has them
  renders them instead of the dictionary text.

### Changed

- Sheet `schemaVersion` is now `7`. The new migration step is a no-op; older
  sheets stay valid and are migrated on first open. The bump keeps an older
  build that does not know the fields from stripping them on save.
- Portable JSON export carries the frozen text next to the divination id.

## [1.15.0] - 2026-11-25

### Added

- `Skill.characteristic` (a code from `stats`) replaces the `(Инт)` suffix in
  the name. The skill table gained a “Хар.” column, notes became an icon next
  to the name, the Excel export carries the characteristic and history shows
  its code. An old suffix is parsed for display only and moved into the field
  by the next edit.
- Weapons reorder by dragging: melee and ranged are one visible list, dropping
  onto the other group moves the weapon and flips “Equipped”, and the array
  stays grouped. In edit mode “Add weapon” sits above the list.

### Changed

- Sheet `schemaVersion` is now `6`: `migrateDh1V5toV6` moves `traits`,
  `eliteAdvances`, Insanity degree/modifier and Corruption degree/test into a
  “Наследие” notes tab (`noteTabs`, id `dh1-legacy`) and removes them from the
  sheet, the UI and the JSON export; importing an older file still accepts
  them.

## [1.14.0] - 2026-11-25

### Changed

- The armour type reads `Flak`, and a legacy `Flack` value is translated.

## [1.13.0] - 2026-11-24

### Added

- Wounds accept negative values down to `-max`.

### Changed

- Rank is readable and asks for the advanced path once in a dialog.

## [1.12.0] - 2026-11-23

### Added

- `plugin.json#shortCode` is `dh1e`, the required edition code used by the
  generated registry.

### Fixed

- A negative experience cost is accepted again: the UI stores a penalty as a
  negative `cost`, but the schema required `>= 0`, so the write failed and the
  experience did not change. The field now accepts down to `-10 000 000`.

## [1.11.0] - 2026-11-22

### Added

- A **Collect salary** button adds the monthly income to the character's
  thrones in one operation and stays hidden while the income is zero. The
  payout is additive and clamped to whole non-negative thrones below the field
  ceiling; the capital and income inputs clamp too, and the edit snapshot is
  taken from the current sheet so a save cannot roll the payout back.

## [1.10.0] - 2026-11-22

### Fixed

- On the phone the hit-location block is its own full-width card in the
  Information column instead of being squeezed inside the Info card, where its
  heading dropped to 9 px and wrapped. The compact-navigation anchor still
  points at the column, so scrolling to “Info” includes the locations.

## [1.9.0] - 2026-11-22

### Fixed

- The sheet exposes a skills/talents anchor, so compact navigation and guest
  links land on the section instead of doing nothing. The page scrolls to it
  after the layout settles and warns in development when an id does not
  resolve.

## [1.8.0] - 2026-11-21

### Added

- A gold accent palette for both modes, a matching border and focus ring, and a
  smaller radius. 1e was the last shipped game still drawn in the host indigo.
- Cormorant Garamond as the sheet typeface: two `woff2` subsets and the
  `OFL.txt` licence in `assets/`, declared with a Cyrillic `unicode-range` in
  the sheet CSS module and opted in through `ui.theme.font`.

### Changed

- Inventory totals multiply a row's weight and price by the row's quantity: the
  stored numbers are per unit. A row without a quantity reads as 1, so only
  rows already at 2 or more change their totals.
- The inventory edit fields are labelled “Qty / Weight, kg / Price, thrones”
  instead of three bare numbers.

## [1.7.0] - 2026-11-20

### Changed

- The sheet layout lives in its own CSS module inside the plugin instead of
  `globals.css`; the core keeps a gate that fails on game selectors in core
  CSS.
- Alike Dark Heresy mechanics (stat arithmetic, cumulative skill training, the
  import-review banner) are copies inside the edition instead of a shared
  layer. A parity test compares behaviour and skips when one edition is absent.

## [1.6.0] - 2026-11-20

### Added

- Inventory rows show quantity, weight and price, with totals under the
  columns, a “Lost” checkbox that greys the row out, a compact grid on mobile
  and numeric fields in edit mode. A sheet from an older version is not
  rewritten: quantity defaults to 1, weight and price read as “not set”.
- Hit locations and AP are visible on mobile: the armour scheme is its own
  section and, in compact view, is also rendered at the end of the “Info” card.

### Changed

- The armour scheme returns to the bottom of “Info” (no separate compact tab,
  the sidebar is back to six tabs); body-part labels wrap instead of being
  clipped.

### Fixed

- Toggling “Equipped” in read mode no longer rolls back when a neighbouring
  section saves: the equipment list is read from the current sheet and saved as
  one patch.
- Armour-piercing is shown for the unequipped ranged weapon too, and weapon
  `weight` is gone from the types and forms (a legacy value is cleaned up on
  the next save).

## [1.5.0] - 2026-11-19

### Changed

- Removed leftover edition-split code. The sheet format is unchanged.

## [1.4.0] - 2026-11-18

### Added

- A declared migration chain 1→5 (`from`/`to`/`entry` per step), with chain
  validation and applied-step reporting.
- Server-side derived characteristics and their consequences: creating or
  updating a sheet runs the plugin's `derive` hook before the diff and the
  write, so the stored file cannot contradict itself.
- Negative conformance tests: the schema rejects out-of-range characteristics
  and an empty sheet name in a request.

## [1.3.0] - 2026-11-18

### Added

- Creation requires only the character name: home world, career and divination
  can be chosen later on the sheet.
- Current/Spent XP are editable only in Edit mode, and a negative free XP is
  highlighted.

## [1.2.0] - 2026-11-17

### Added

- Gender is stored as a canonical code (`male`, `female`, `unspecified` or
  empty for “not chosen”) instead of a localized label. Old labels in RU/EN
  are migrated on read; an unrecognized value becomes `unspecified` and the
  original text is kept in the notes as a `[gender migration] …` line.

### Changed

- Creation moves the gender select into the Details block; after creation the
  gender is read-only.
- The Info “Backstory” button uses a book icon instead of an eye.
- History labels gender values from the dictionaries instead of showing raw
  codes, and Excel exports show the localized label while portable JSON keeps
  the code.

## [1.1.0] - 2026-11-17

### Added

- First versioned 1e plugin after the Plugin SDK 1.2 migration: manifest
  version 2 and the edition code used by the generated game family.
- The Info section no longer duplicates the Notes entry; Notes open from the
  header icon or the compact navigation.
- Insanity and Corruption cards show their values without −/+ steppers; edit
  stays in the card's edit button. Characteristic checkboxes use a filled
  state without an overflowing tick.
- History entries for structured conditions are labelled instead of showing
  raw `conditions.0.*` paths.

### Fixed

- Characteristic checkbox ticks no longer look broken on mobile and desktop.