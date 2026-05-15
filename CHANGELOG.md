# Changelog

All notable changes to **claude-code-up** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.3] — 2026-05-15

### Fixed

- **Statusline showed false `⚠` on agents and scripts.** Root cause was a double-count: `wshobson.json` ships `code-reviewer` and `security-auditor` as `tier: "default"`, which clashes with the bundled subagents that also write those names. Wshobson overwrote the files on disk but both components incremented their `count`, so `stack.json.totals.project.agents = 16` while disk had 14 → `14/16 ⚠`. `flattenSpecificAgents` now skips names already on disk and only counts what it actually wrote (first-writer-wins).
- **Statusline `📜 1/2 ⚠ scripts`** — the segment globbed `.claude/scripts/*.sh` only, missing the top-level `.claude/statusline.sh` that Claude Code's `statusLine.command` expects. Statusline now adds `+1` when `.claude/statusline.sh` exists, so `2/2 ✓` shows correctly.

---

## [0.1.2] — 2026-05-15

### Fixed

- **Framework matching was broken end-to-end.** The funnel emitted composite IDs (`mobile:ts:expo`) but every catalog match expects bare IDs (`expo`). Result: the Expo scaffolder never ran, and all framework-keyed command bundles (`expo-core-extras`, `expo-stripe-rn`, `expo-revenuecat`, `expo-state-zustand`, `expo-forms-libs`, `expo-icons-libs`, `expo-better-auth`) silently disappeared from the prompt. The funnel now stores bare framework IDs and surfaces category/language only in the display label, so applyWhen rules of the shape `frameworks: ["expo"]` actually fire.
- **Scaffolders now use the project name**, not `.`. `npx create-expo-app@latest my-app` instead of `npx create-expo-app@latest .` — the user sees the app name on the command line, and `create-expo-app` gets to create its own directory like upstream intends. Supports the `{{name}}` placeholder in `catalog/scaffolders.json` so new scaffolders can opt into the same behavior.

### Changed

- When a scaffolder uses `{{name}}`, claude-code-up runs it from the **parent** directory and does not pre-create the target dir (most scaffolders refuse to run otherwise). Empty pre-created target dirs are cleaned up before invocation; if the scaffolder errors, a fresh `mkdir` is performed so the rest of the flow still completes.
- **Biome is now the default formatter+linter**; Prettier+ESLint is downgraded to opt-in only (`applyWhen: {}`) so you don't end up with both tools fighting over the same files. The Prettier+ESLint bundle still appears in the command-bundles prompt — uncoloured/unchecked — so legacy projects can pick it explicitly.

---

## [0.1.1] — 2026-05-15

### Fixed

- Republished with a freshly built `dist/cli.js` reflecting the `ccup` → `claude-code-up` rename. The `0.1.0` tarball on npm still shipped the pre-rename bundle, so `npx claude-code-up --help` printed `ccup 0.1.0 — …` instead of the current branding.

### Changed

- README badges switched from "coming soon" to live npm version + downloads, CI status, and GitHub stars.

---

## [0.1.0] — 2026-05-15

Initial public release.

### Added

#### Funnel — cascading project setup prompt
- 7 project categories (Web, Mobile, Backend, Fullstack, Data, CLI, Generic)
- 35+ framework × language combinations with cascading sub-prompts
- 11 database options (Postgres, MySQL, SQLite, MongoDB, Redis, Supabase, PlanetScale, Neon, Elasticsearch, Vector, none)
- Per-language ORM picks (Prisma, Drizzle, TypeORM, Kysely, SQLAlchemy, Django ORM, Tortoise, GORM, sqlc, SQLx, Diesel, JPA, ActiveRecord)

#### Scaffolders — auto-bootstrap your framework
- `npx create-expo-app@latest` for Expo
- `npx create-next-app@latest` (TS + App Router + Tailwind + ESLint) for Next.js
- `npm create vite@latest` for Vite + React + TS
- `npm create vue@latest` for Vue 3
- `npm create svelte@latest` for SvelteKit
- `npx create-remix@latest` for Remix
- `npm create astro@latest` for Astro
- `npx @nestjs/cli new .` for NestJS
- `uvx fastapi[standard] dev` for FastAPI (uv-based)

#### Stack — 131-item curated decision tree
- **wshobson/agents** — 100 agents classified into default (4), conditional (~30), skip (~50). Cross-source duplicates marked `skip` with reasons.
- **Superpowers (obra/superpowers)** — 14 skills classified into default (7) + conditional (7).
- **Matt Pocock skills** (via `ismaelJimenez/mp-skills` mirror) — 21 skills classified into default (4), conditional (11), skip (6).
- Tri-state ●/◐/○ multi-select with **D-key drill-down** to customize per-source items.
- Item-level extraction for wshobson (file-by-file, not plugin-by-plugin) — only the agents you actually picked land in `.claude/agents/`.

#### MCP servers — 8 configured by funnel
- **GitHub**, **Context7** — always preselected (defaults)
- **Playwright** — preselected for web/mobile/fullstack
- **Postgres** — preselected when funnel databases include postgres/supabase/neon/planetscale
- **Supabase** — preselected when funnel databases include supabase
- **Stripe** — preselected for web/mobile/fullstack/backend
- **RevenueCat** — preselected for mobile
- **Better Auth** — preselected for TS + web/fullstack/backend
- Credentials prompted via masked input, written to `.env`, gitignored
- Each MCP server e2e-verified with a real JSON-RPC `initialize + tools/call` handshake before generation completes

#### Command bundles — 30 init-script bundles per stack branch
- **Mobile/Expo** (8) — core-extras, supabase-libs, stripe-rn, revenuecat, state-zustand, forms (rhf+zod), icons (lucide), better-auth
- **Web** (10) — Next.js tanstack/prisma/drizzle/better-auth/stripe/trpc/shadcn, Vite tailwind/vitest
- **Backend** (7) — Node zod/pino/vitest/prisma, Python FastAPI/SQLAlchemy+Alembic/Django
- **Cross-cutting** (5) — Prettier+ESLint, Biome, Husky+lint-staged, Playwright, Vitest+RTL

#### Quality of life
- **Multi-line statusline** — second line with `K/T skills · K/T agents · K/T MCPs ✓ · K/T hooks · K/T commands · K/T scripts` (live file count vs claimed)
- **Karpathy CLAUDE.md** — anti-bloat coding guidelines bundled with offline fallback
- **Agentshield** auto-Stop hook on settings.json when selected
- **skillListingBudgetFraction** auto-set to 0.05 when wshobson is installed (avoids the "192 descriptions dropped" warning)
- **Agent Teams** flag (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) with prereq warnings
- **GitHub flow** — existence check, create-new (early reservation) or clone-existing, push-at-end
- **`gh` auth flow** — auto-detect, refresh missing scopes, support OAuth + PAT
- **Bundled subagents** — code-reviewer, security-auditor, test-writer (focused, project-scope `.claude/agents/`)
- **Bundled skills** — `octo-issue-tracker`, `octo-scenario-tester` (scenarios-before-code TDD discipline)
- **Final shell drop-in** — optional `$SHELL` spawn in target directory after generation completes
- **claude doctor** integration as final diagnostic step
- **WIPE / MERGE** modes for non-empty target directories (with red/yellow banner in confirm recap)

#### Architecture
- **JSON-driven catalogues** — adding a tool = editing one JSON file in `catalog/`, no TypeScript required
- **`applyWhen` decision tree** — categories/languages/frameworks/databases/orms AND'd across sections, OR'd within
- **Tier system** — `default` (always installed) / `conditional` (when funnel matches) / `skip` (filtered out with documented reason)
- **`scripts/gen-templates.mjs`** — pre-build JSON validation + typed TS module emission
- **Project-scope only** — every file ccup writes is under `<project>/`, nothing in `~/.claude/`

#### Documentation
- README with feature matrix, architecture overview, decision tree explainer
- CONTRIBUTING.md — five contribution paths, all JSON-edit-only for catalog changes
- 5 issue templates (add MCP / add item / add scaffolder / add bundle / bug report / feature request)
- PR template with checklist
- CI Actions workflow (gen, typecheck, build, smoke decision tree)
- CODE_OF_CONDUCT.md (Contributor Covenant 2.1)

---

[0.1.3]: https://github.com/steph-frtech/claude-code-up/releases/tag/v0.1.3
[0.1.2]: https://github.com/steph-frtech/claude-code-up/releases/tag/v0.1.2
[0.1.1]: https://github.com/steph-frtech/claude-code-up/releases/tag/v0.1.1
[0.1.0]: https://github.com/steph-frtech/claude-code-up/releases/tag/v0.1.0
