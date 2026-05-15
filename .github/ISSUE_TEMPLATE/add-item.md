---
name: "🆕 Add an agent / skill / command"
about: Propose adding (or reclassifying) an item in catalog/items/
title: "[Item] Add <item-id>"
labels: ["catalog"]
---

## Item to add (or reclassify)

**Source**: <!-- wshobson / superpowers / pocock -->
**Item id**: <!-- e.g. typescript-pro -->
**Kind**: <!-- agent / skill / command -->
**Container** (wshobson only): <!-- e.g. javascript-typescript (plugin folder) -->

## Proposed tier

- [ ] `default` — install on every project
- [ ] `conditional` — install when `applyWhen` matches
- [ ] `skip` — never install (must have a `reason`)

## Proposed JSON entry

For `catalog/items/<source>.json`:

```json
{
  "id": "<item-id>",
  "kind": "agent",
  "container": "<plugin-name>",
  "tier": "conditional",
  "description": "<one line>",
  "applyWhen": {
    "categories": ["..."],
    "languages": ["..."],
    "frameworks": ["..."]
  }
}
```

## Why this tier / why this applyWhen?

Explain the reasoning in plain English. Example: "typescript-pro should preselect whenever the project language is TypeScript, regardless of category — it's the TS expert."

## Conflicts / duplicates

- Does another source ship a similar item? (e.g. `tdd` exists in both Superpowers and Pocock — we kept Superpowers' and marked Pocock's as `skip`.)
- Should this be a `skip` with `reason` pointing at the canonical one?
