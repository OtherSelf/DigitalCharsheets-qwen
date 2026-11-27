---
title: "ADR 0003 — The server decides derived values"
description: "ADR: the server recomputes derived values (derive), the client never diverges"
---

# ADR 0003 — The server decides derived values

Status: **accepted** (2026-11-18). Scope: who computes derivative fields of a
sheet (proficiency bonus, save and skill values, spell save DC, training tiers)
and what happens to sheets that already disagree with the rules. Related:
[plugin-sdk.md](../plugin-sdk.md) § Module contract, [data-storage.md](../data-storage.md)
§ Derived values, `src/lib/character-derive.ts`.

## Context

Derivative fields were calculated only in React components: the sheet knew
`proficiencyBonus = floor((level - 1) / 4) + 2` and the dice modifiers, while
the server stored whatever the client sent. HTTP probes on a production-shaped
build showed the consequences:

- `POST { level: 1, proficiencyBonus: 99 }` stored `99`;
- `PUT { level: 5 }` kept the stale bonus;
- `PUT { stats: { strength: 20 } }` left saves and skills at `0`;
- `GET /api/export` returned the same inconsistent document.

The alternatives were: keep client authority (no work, data drifts silently),
never persist derivatives (breaks export, print and share), or move the rules
into the plugin contract and recompute on the server. The last one was chosen.

## Decision

1. The plugin contract gains `derive(doc)`: a **pure, idempotent** function that
   recomputes derivative values from primary ones. It is declared in the
   manifest (`derive.entry` + the `derived` field list) and validated by TCK
   (`tests/unit/plugins-derive.test.ts`): no input mutation, idempotence, no
   `schemaVersion` change, no fields added or removed, no dependence on key
   order.
2. The **server is authoritative**: `derive` runs in the save pipeline
   (`normalize → derive → diff → withDataLock(writeJsonAtomic)`) and, for the
   create path, before the response leaves the server. The client calls the same
   function, so client and file cannot diverge by construction.
3. Sheets saved under an older `schemaVersion` are recomputed on read and
   persisted by the startup scan, which writes a `.bak` next to the sheet and a
   migration marker into its history.
4. Only purely computed fields are derived. `armorClass`, `speed`,
   `hitPoints`, `spellAttackBonus` (top level) stay user-owned, and manual
   `manualModifier` values are respected — homebrew must keep working.

## Consequences

- Saved sheets are self-consistent regardless of the client version; export,
  print and share show what the rules say.
- A plugin that changes a formula must bump its `version`, not `schemaVersion`
  (unless the sheet shape changes too) — the recalculation is not a migration.
- Rolling out recalculation changes stored values, so it shipped behind
  `DCS_SERVER_DERIVE` (default on, `=0` is the emergency brake).
- Dark Heresy 1e has few persisted derived numbers, but they are real: its
  `derive` enforces the cumulative training tiers (`+10` implies `skilled`, and
  so on) and recomputes `rank`/`characterClass` from the career, spent XP and
  the chosen paths, so the header, card, export and the file agree.
