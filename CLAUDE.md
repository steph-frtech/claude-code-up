# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`ccup` (Claude Code Up) is a CLI that initializes a new project pre-configured for Claude Code: it generates `.claude/settings.json`, `CLAUDE.md`, `.mcp.json`, fetches selected skills from a remote registry, and optionally runs `git init`. Distributed via npm; runs via `npx ccup`.

Always operates in Claude Code's **project scope** — every file it writes lives in the user's project root (`.claude/`, `CLAUDE.md`, `.mcp.json`), never in user-level config.

## Commands

- `npm run dev` — run the CLI from source via `tsx` (use for iteration)
- `npm run build` — bundle with `tsup` to `dist/cli.js`
- `npm run typecheck` — `tsc --noEmit`
- `node dist/cli.js --help` — smoke-test a build

## Architecture

Entry point `src/cli.ts` parses `process.argv` directly (no parser dep) and dispatches. Single command in v0.1 (`init`), invoked by default when no command is given.

Three-layer flow:

1. **Prompts** (`src/prompts/*.ts`) — collect user input via `@clack/prompts`. Each prompt module is pure: receives options, returns an answer object or `null` on cancel. No file IO.
2. **Generators** (`src/generators/*.ts`) — take fully-resolved answers and write files. Each generator handles one concern (`.claude/` dir, `CLAUDE.md`, `.gitignore`, `git init`). Generators do not prompt; conflicts are pre-checked upstream.
3. **Command orchestrators** (`src/commands/*.ts`) — wire prompts → generators with spinners and error handling.

Templates are inlined as string constants in `src/templates.ts` (not separate files) so `tsup` produces a single self-contained `dist/cli.js`. If templates grow, switch to esbuild's text loader rather than runtime `fs` reads.

## Conventions

- ESM only. Imports use `.js` extension even for `.ts` source (required by `moduleResolution: bundler` + Node ESM output).
- `dependencies` is kept lean — tsup externalizes everything in `dependencies` from the bundle. Adding a runtime dep should be deliberate.
- Prompts return `null` on `p.isCancel(...)`. Orchestrators decide what to do (typically `p.cancel()` + `process.exit(0)`).
- No file IO for templates — inline them in `src/templates.ts` and import.

## Roadmap markers (not implemented yet)

- `src/registry/` — fetch skills/MCP from a remote registry. URL configurable via `CCUP_REGISTRY_URL`. Manifest format: `{ version, skills: [...], mcpServers: [...] }`. Skills are GitHub-hosted, fetched via `raw.githubusercontent.com`; each skill entry lists its files explicitly (no directory listing).
- `src/commands/add.ts` — `ccup add skill <name>` for adding to existing projects, idempotent.

When implementing the registry, keep `src/registry/client.ts` independent of prompts/generators — it should be testable in isolation against a mock HTTP layer.
