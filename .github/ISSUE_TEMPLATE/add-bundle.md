---
name: "🆕 Add a command bundle"
about: Propose a new lib-install bundle for a stack branch
title: "[Bundle] Add <bundle-id>"
labels: ["catalog", "command-bundle"]
---

## Bundle to add

**Name**: <!-- e.g. Next.js + tRPC + Drizzle -->
**Target funnel branch**: <!-- e.g. Web + TS + Next.js + Postgres + Drizzle -->

## Proposed JSON entry for `catalog/command-bundles.json`

```json
{
  "id": "<bundle-id>",
  "name": "<Display Name>",
  "description": "<what it sets up>",
  "applyWhen": {
    "frameworks": ["nextjs"],
    "databases": ["postgres"],
    "orms": ["drizzle"]
  },
  "commands": [
    { "exec": "npm install drizzle-orm postgres", "desc": "Drizzle + pg client" },
    { "exec": "npm install -D drizzle-kit", "desc": "Drizzle CLI" }
  ]
}
```

## Why this bundle

Describe the stack scenario in plain English. Example: "Anyone bootstrapping Next.js + Drizzle on Postgres needs these 4 deps before they can write their first query."

## Verification

- [ ] All `exec` commands run successfully in an empty dir after the scaffolder runs
- [ ] No interactive prompts (use `--yes`, `--defaults`, env vars)
- [ ] Timeouts are reasonable (`execa` default 300s)
- [ ] No conflict with another bundle that might run in the same scenario
