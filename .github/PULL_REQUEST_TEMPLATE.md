<!-- Thanks for contributing 🚀 -->

## What this PR does

<!-- One sentence. e.g. "Adds Linear MCP server with applyWhen rule for web/mobile/backend." -->

## Type

- [ ] 🆕 Add an MCP server (`catalog/mcps.json`)
- [ ] 🆕 Add/reclassify an item (`catalog/items/<source>.json`)
- [ ] 🆕 Add a bundled skill (`catalog/skills.json`)
- [ ] 🆕 Add a scaffolder (`catalog/scaffolders.json`)
- [ ] 🆕 Add a command bundle (`catalog/command-bundles.json`)
- [ ] 🆕 Add a project type / language / framework (`catalog/project-types.json`)
- [ ] 🐛 Bug fix (TS code)
- [ ] ✨ Feature (TS code — mechanism, not catalog)
- [ ] 📚 Docs

## Checklist

- [ ] `npm run gen` succeeds (schema validation passes)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] (For catalog edits) tested at least one funnel combination via `npm run dev`
- [ ] (For MCP) verified the `npx` package + env vars against upstream docs
- [ ] (For scaffolder/bundle) ran the `exec` command in an empty dir locally
- [ ] (For item reclassification) checked cross-source duplicates

## Funnel scenarios I tested

<!-- e.g. "Backend + Python + FastAPI + Postgres" - the new item appeared pre-checked with the [Backend + PY] label. -->

## Notes for reviewers

<!-- Anything tricky? Anything follow-up? -->
