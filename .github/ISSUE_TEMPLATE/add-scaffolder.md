---
name: "🆕 Add a scaffolder"
about: Propose a new framework scaffolder (npm create / npx create-X)
title: "[Scaffolder] Add <framework>"
labels: ["catalog", "scaffolder"]
---

## Scaffolder

**Framework**: <!-- e.g. T3, Tauri, Solid Start, Astro Studio -->
**Command**: <!-- e.g. npm create t3-app@latest -->

## Proposed JSON entry for `catalog/scaffolders.json`

```json
{
  "id": "<framework-id>",
  "name": "<Display Name>",
  "description": "<what it bootstraps>",
  "command": "npx",
  "args": ["-y", "create-<framework>@latest", "."],
  "matchFrameworks": ["<framework-id-in-project-types>"]
}
```

## Framework match

The `matchFrameworks` ids must exist in [`catalog/project-types.json`](../catalog/project-types.json) under `frameworksByLangCategory`. If you're adding a brand-new framework, point to where in `project-types.json` it should appear:

- Category: <!-- web / mobile / backend / fullstack / data / cli -->
- Language: <!-- ts / py / go / rust / … -->
- New framework id: <!-- e.g. "tauri" -->

## Verification

- [ ] I ran the scaffolder in an empty dir locally — it works
- [ ] No interactive prompts that would freeze in `--yes`/`--defaults` mode (or document them)
- [ ] The scaffolder accepts `.` as the target (we run it inside the already-created project dir)
