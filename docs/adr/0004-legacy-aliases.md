---
title: "ADR 0004 — Legacy game names never guess the edition"
description: "ADR: legacy game names never guess the edition; unknown sheets open read-only"
---

# ADR 0004 — Legacy game names never guess the edition

Status: **accepted** (2026-11-18). Scope: how a sheet without `systemId` is
resolved to a plugin, and what the bare `Dark Heresy` name means. Related:
[plugin-sdk.md](../plugin-sdk.md) § Manifest, [data-storage.md](../data-storage.md)
§ Legacy data, `src/games/character-system.ts`.

## Context

Sheets used to identify their game with human-readable fields
(`gameSystem: "Dark Heresy"`, optionally `edition: "1st" | "2nd"`). The edition
discriminator `systemId` was added later, and legacy names stayed supported
through `plugin.json#aliases`. The first edition declared a **bare** alias — the
game name without an edition — so an old sheet that said only
`{ gameSystem: "Dark Heresy" }` resolved to DH1 silently.

That default is a guess: the same legacy shape may come from a DH2 campaign,
and nothing in the file tells them apart. A wrong guess is not a crash — the
sheet opens as another edition, with different fields and rules.

## Decision

1. `systemId` is the only discriminator. Resolution order is: explicit
   `systemId` (authoritative; an unknown id is *not* re-guessed from legacy
   fields), then the most specific matching alias from the manifests.
2. The bare `{ gameSystem: "Dark Heresy" }` alias is **removed**. A sheet
   without `systemId` and without a recognised edition marker is not resolved:
   it opens **read-only** with the `plugin_missing` banner, and JSON export
   still works. Import asks for the edition explicitly.
3. Alias specificity is declared, not hard-coded: `{gameSystem, edition}`
   outranks `{gameSystem}`, and the core contains no game names.

## Consequences

- Production data is unaffected: the startup scan has been writing `systemId`
  into every resolvable sheet since the field appeared.
- Raw legacy dumps without an edition marker need a human decision instead of a
  silent guess; the `plugin_missing` banner explains why the sheet is read-only.
- Adding an edition never changes how an existing one resolves — a new plugin
  must declare an alias specific enough to be unambiguous.
