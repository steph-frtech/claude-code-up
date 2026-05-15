# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral guidelines

Bias toward caution over speed. For trivial tasks, use judgment.

- **Think before coding.** State assumptions explicitly; surface tradeoffs; ask when unclear. Don't pick silently between interpretations.
- **Simplicity first.** Minimum code that solves the problem. No speculative abstractions, configurability, or error handling for impossible scenarios.
- **Surgical changes.** Touch only what the task requires. Match existing style. Remove imports/vars *your* changes orphaned — don't delete pre-existing dead code unprompted.
- **Goal-driven.** Restate the task as a verifiable outcome before implementing. For multi-step work, write a brief plan with a verification step for each.

## Project at a glance

`claude-code-up` (npm package `claude-code-up`, bin `claude-code-up`) is an interactive CLI that bootstraps a Claude Code project: it runs a funnel of prompts (category → language → framework → database → ORM), then writes `.claude/`, `.mcp.json`, `CLAUDE.md`, optional scaffolder output, and pushes to GitHub. The end-of-flow runs `claude /init` headless to verify wiring.

It is **project-scope only** — never touches `~/.claude/`. Anything user-scope is documented in `STACK.md` rather than auto-run.

## Commands

```sh
npm run gen          # regenerate src/{catalog,templates}.gen.ts from catalog/*.json and src/scripts/*.sh
npm run dev          # tsx src/cli.ts — run the CLI from source (runs `gen` first via predev)
npm run typecheck    # tsc --noEmit (runs `gen` first via pretypecheck)
npm run build        # tsup → dist/cli.js (runs `gen` first via prebuild)
npm test             # the husky pre-commit hook runs this — currently no test suite is wired up, so the hook just calls `npm test` which exits with whatever npm's default behavior is
```

There is no lint script; Biome is the configured formatter/linter (`biome.json`, tab indent, double quotes) but it's not bound to a script — run `npx biome check .` or `npx biome format --write .` directly when needed.

## Architecture: mechanism in TS, policy in JSON

The core invariant: **the TypeScript code is generic, all data lives in `catalog/*.json`.** Adding a new MCP / agent / skill / scaffolder is a JSON edit, not a TS change.

### Code generation pipeline

`catalog/*.json` + `src/scripts/*.sh` → `scripts/gen-templates.mjs` → `src/catalog.gen.ts` + `src/templates.gen.ts` → imported through `src/catalog/loader.ts`.

- The `.gen.ts` files are **auto-generated** — do not edit. They're checked in but regenerated on every `dev` / `typecheck` / `build` via npm pre-hooks.
- `gen-templates.mjs` also validates the JSON: every item must have a tier (`default` / `conditional` / `skip`); `skip` requires a `reason`; `default` must not have `applyWhen`; `project-types.json` must be `schemaVersion: "2"`.
- After editing any `catalog/*.json`, run `npm run gen` (the pre-hooks pick this up automatically for the standard scripts).

### Funnel → decision tree → installation

1. **Prompts** (`src/prompts/`) collect funnel answers, scaffolder choice, stack components, MCPs, command bundles. The custom tri-state multiselect (`tristate-multiselect.ts`) gives ● / ◐ / ○ with a D-key drill-down — it's built on `@clack/core`, not `@clack/prompts`.
2. **Decision tree** (`src/stack/decision-tree.ts`) resolves each catalog source (`wshobson` / `superpowers` / `pocock`) against the funnel via `matchesApplyWhen` and `resolveForSource`. `applyWhen` semantics:
   - Missing field → always matches (default-like).
   - `{}` empty object → opt-in only, never auto-matches.
   - With rules → all present sections must intersect with the funnel (AND across sections, OR within a section).
3. **Generators** (`src/generators/`) write the artifacts: `claude-dir.ts` builds `.claude/`, `claude-md.ts` writes `CLAUDE.md` (preserves existing if scaffolder/clone/merge ran), `mcp.ts` writes `.mcp.json` + `.env` and runs a real JSON-RPC `initialize` + optional `tools/call` handshake against each MCP server before reporting success.
4. **Orchestrator**: `src/commands/init.ts` is the single entry point that wires preflight (Claude Code version check, install prompt) → prompts → confirm → generators → optional `claude /init` headless run → `claude doctor` offer → optional child shell.

### Important behavior to preserve

- **Scaffolder runs BEFORE `.claude/` is written**, in an empty target dir, because most scaffolders (Expo, Next, Vite…) refuse to run otherwise. `init.ts` handles both shapes: scaffolders that take `.` (cwd is target) and scaffolders with a `{{name}}` placeholder (cwd is parent, scaffolder creates the subdir). When a scaffolder ran, `generateClaudeMd` / `generateGitignore` are called with `preserveExisting: true`.
- **MCP handshake is end-to-end**, not just config-writing. Failures are surfaced with the stage that failed (`tools/call query: connect ECONNREFUSED…`). Missing env vars produce `skipped`, not silent success.
- **Project-scope only.** No code should write to `~/.claude/`. User-scope tools (`claude-mem`, `cc-lens`) get documented in `STACK.md` with a copy-pasteable install line.

## Adding catalog entries

The high-frequency edit. See `CONTRIBUTING.md` for full templates. Quick map:

| Adding… | Edit | After |
|---|---|---|
| MCP server | `catalog/mcps.json` + extend `McpServerId` in `src/types.ts` | `npm run gen && npm run typecheck` |
| Agent / skill (from a source) | `catalog/items/<source>.json` | `npm run gen` |
| Bundled skill with inline `.md` | `catalog/skills.json` | `npm run gen` |
| Framework scaffolder | `catalog/scaffolders.json` | `npm run gen` |
| Command bundle (lib installs per stack branch) | `catalog/command-bundles.json` | `npm run gen` |

Always pick a `tier`: `default` (always installed, no `applyWhen`), `conditional` (with `applyWhen` rules), or `skip` (requires `reason`). The `gen` script throws if these rules are violated.

## Misc

- **Husky pre-commit** runs `npm test`. There's no test suite yet — keep this in mind before adding one, and update `.husky/pre-commit` accordingly.
- **The bundled MCP server stub** at `src/index.ts` is unrelated to the CLI — it's a placeholder MCP server scaffold and is not wired into the build (`tsup.config.ts` only bundles `src/cli.ts`).
- **Bumping the CLI version** requires editing both `package.json` and the `VERSION` constant in `src/cli.ts`.
