# claude-code-up — Claude Code Up
![Claude Code Up demo](assets/claude-code-up-demo-90.gif)

> The fastest way to bootstrap a Claude Code project with the **right** skills, agents, MCPs, and hooks — pre-curated, project-scope only, fully JSON-driven.

[![npm version](https://img.shields.io/npm/v/claude-code-up.svg?color=cb3837)](https://www.npmjs.com/package/claude-code-up)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-up.svg)](https://www.npmjs.com/package/claude-code-up)
[![CI](https://github.com/steph-frtech/claude-code-up/actions/workflows/ci.yml/badge.svg)](https://github.com/steph-frtech/claude-code-up/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/steph-frtech/claude-code-up.svg)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](#requirements)
[![Claude Code ≥2.1.32](https://img.shields.io/badge/Claude%20Code-%E2%89%A52.1.32-purple.svg)](https://claude.com/claude-code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub stars](https://img.shields.io/github/stars/steph-frtech/claude-code-up.svg?style=social)](https://github.com/steph-frtech/claude-code-up/stargazers)

---

```sh
npx claude-code-up
```

That's it. One command. Interactive prompts. Your project is ready to ship — with battle-tested agents, the right MCPs, runtime hooks, a working statusline, and the scaffolding for your stack.

---
## Démo


## What it does (in 60 seconds)

Most "Claude Code best practice" docs are 30-page Notion pages and a Twitter thread. **claude-code-up turns them into one prompt.** It asks 6 questions, then it:

1. **Bootstraps your framework** — `npx create-expo-app@latest` / `create-next-app` / `create-vue` / 7 more, picked based on what you answered.tt
2. **Curates the agents and skills** that match — 131 items from [wshobson/agents](https://github.com/wshobson/agents) + [obra/superpowers](https://github.com/obra/superpowers) + [Matt Pocock skills](https://github.com/mattpocock), filtered to ~16 defaults + the conditionals that fit your stack. The other ~50 noisy ones are skipped.
3. **Writes `.mcp.json`** with the MCP servers your project actually uses — GitHub, Context7, Postgres, Supabase, Stripe, RevenueCat, Better Auth, Playwright. Credentials prompted (masked), `.env` written, `gitignore`d. Then each MCP is **smoke-tested end-to-end** with a real JSON-RPC `initialize` handshake.
4. **Installs the harness** — Karpathy's CLAUDE.md, optional Superpowers/Pocock skills, agent-teams flag (research preview), pretty 256-color statusline, agentshield audit hook, project-scope `settings.json`.
5. **Creates the GitHub repo** (or clones an existing one), commits, pushes.
6. **Runs `claude /init`** headless to verify everything is wired correctly. Then offers `claude doctor` for the official diagnostic.

Everything is **project-scope** — nothing ever touches `~/.claude/`.

---

## Quick start

```sh
# Just run it
npx claude-code-up

# Or with a target directory
npx claude-code-up my-new-app

# Or force-overwrite a non-empty dir (with confirmation)
npx claude-code-up ../legacy-project --force
```

You'll go through a funnel of prompts:

1. **Project name, target directory** — sensible defaults (sibling dir, not a subdirectory).
2. **Git? GitHub?** — `gh` is detected and reused. claude-code-up checks if the repo exists on GitHub; if not, creates it empty so the remote is ready. If it exists, offers to clone it as the starting point.
3. **Funnel (the entonnoir)** — Category (Web / Mobile / Backend / Fullstack / Data / CLI / Generic) → Language (TS / Py / Go / Rust / Dart / Swift / …) → Framework (Next.js / Expo / FastAPI / Django / Rails / 30+ more) → Database (Postgres / Supabase / Mongo / Vector / …) → ORM (Prisma / Drizzle / SQLAlchemy / …).
4. **Scaffolder** — if the framework has one (Expo, Next.js, Vite, Vue, SvelteKit, Remix, Astro, NestJS, FastAPI), claude-code-up offers to run `npx create-X@latest .` for you. Output is streamed live.
5. **Stack components** — tri-state multi-select: ● fully on, ◐ partial (orange — press **D** to drill into specifics), ○ off. The defaults are computed from a JSON-driven decision tree based on your funnel answers.
6. **MCPs** — preselected by `applyWhen` rules. Credentials prompted via masked input, written to `.env`, validated by a real MCP `initialize + tools/call` handshake.

Then a clear plan recap (with `◐` orange for partial selections and `⚠` warnings for missing env vars), confirm, and claude-code-up runs:

```
✓ Scaffold complete                        npx create-expo-app@latest .
✓ Claude Code 2.1.142 detected
✓ .claude/ skeleton created
✓ Karpathy CLAUDE.md fetched
✓ CLAUDE.md written
✓ .gitignore preserved (scaffolder generated)
✓ Stack applied — installed: 2 files, 14 agents, 7 skills, 4 scripts, 1 hooks
✓ MCP initialize handshake: 5 ok · 0 failed · 2 skipped
✓ git repository initialized
✓ Pushed initial commit to steph-frtech/my-app
✓ /init completed
✓ claude doctor: clean
```

---

## Why claude-code-up

| Without claude-code-up | With claude-code-up |
|---|---|
| Manually curate which of [wshobson's 100 agents](https://github.com/wshobson/agents) you actually need | Decision tree filters them by your funnel choices |
| Cross-reference Superpowers + Pocock for duplicates (`tdd` exists in both) | The 49 conflicting items are pre-classified as `skip` |
| Discover `skillListingBudgetFraction` after seeing "192 skill descriptions dropped" | Auto-set to `0.05` when wshobson is installed |
| Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in 3 locations | One checkbox, written to `.claude/settings.json` |
| Read the MCP docs to figure out which env vars Stripe needs | Masked prompt + `.env` write + handshake verification |
| Forget to test the MCP servers before launching `claude` | Each MCP is smoke-tested with `initialize` + `tools/call` |
| Edit settings.json by hand for the `statusLine` command | Bundled colorful statusline with tokens/limits/diff/cost |

---

## What gets installed

| Source | What | When |
|---|---|---|
| **wshobson/agents** (100 agents) | Code-reviewer, security-auditor, debugger, test-automator (defaults). Plus conditionals like `typescript-pro` (TS), `fastapi-pro` (FastAPI), `mobile-developer` (Mobile), `database-architect` (Backend+DB), `mobile-security-coder` (Mobile) — picked by your funnel | 4 defaults + 8–15 conditionals typical |
| **obra/superpowers** (14 skills) | TDD, brainstorming, writing-plans, using-git-worktrees, code-review, subagent-driven-development, systematic-debugging (defaults) | 7 defaults |
| **Matt Pocock skills** (21 skills, via mp-skills mirror) | caveman (-75% tokens), qa, zoom-out, improve-codebase-architecture (defaults) | 4 defaults |
| **MCPs** (8 servers) | GitHub, Context7, Playwright, Postgres, Supabase, Stripe, RevenueCat, Better Auth — preselected based on funnel | 2–7 typical |
| **Bundled skills** | `octo-issue-tracker`, `octo-scenario-tester` (scenarios-before-code TDD discipline) | Opt-in |
| **Bundled subagents** | `code-reviewer`, `security-auditor`, `test-writer` (short, focused) | Opt-in default |
| **Project files** | `CLAUDE.md` (Karpathy), `.claude/statusline.sh` (executable, 256-color), `.claude/scripts/audit.sh` (agentshield), `.claude/settings.json`, `.claude/stack.json` (inventory), `STACK.md` (human-readable report) | Auto |

All metadata lives in `catalog/*.json`. **Adding a new tool = editing one JSON file**, no TypeScript needed.

---

## The decision tree (JSON-driven)

Every catalog item carries a tier and an optional `applyWhen` rule:

```json
{
  "id": "mobile-security-coder",
  "kind": "agent",
  "container": "frontend-mobile-security",
  "tier": "conditional",
  "description": "XSS, CSP, secure storage for mobile",
  "applyWhen": { "categories": ["mobile"] }
}
```

Semantics:

- `tier: "default"` → always installed, no `applyWhen`.
- `tier: "skip"` → never offered, has a `reason`.
- `tier: "conditional"` with rules → installed when the funnel matches.
- `tier: "conditional"` with `applyWhen: {}` → opt-in only.

Inside `applyWhen`:
- Multiple sections (`categories`, `languages`, `frameworks`, `databases`, `orms`) are **AND**'d.
- Multiple values in a section are **OR**'d.
- Omitted section = wildcard.

So `{ "categories": ["backend"], "databases": ["postgres", "supabase"] }` means "Backend AND (Postgres OR Supabase)".

Each item's activation rule is shown live in the prompt as a label:

```
◆  Pick wshobson items (default + matching conditional pre-checked):
│
│ ❯ ◼ code-reviewer [General] — security/prod review
│   ◼ security-auditor [General] — OWASP, vulnerabilities
│   ◼ debugger [General] — Error resolution
│   ◼ test-automator [General] — unit + integration + e2e
│   ◼ python-pro [PY] — Python expert
│   ◼ fastapi-pro [fastapi] — Async Python backend
│   ◼ database-architect [Backend + Fullstack + Data] — Schema from scratch
│   ◼ backend-security-coder [Backend + Fullstack] — API sec
│   ◯ rust-pro [RUST] — CLI perf
│   ◯ flutter-expert [flutter] — Flutter / Dart
│   ...
└  space toggle · d details · enter confirm · esc cancel
```

The `[General]` / `[PY]` / `[Backend + Fullstack + Data]` chips tell you exactly **why** each item is pre-checked.

---

## Architecture

```
claude-code-up/
├── catalog/                          ← JSON, the single source of truth
│   ├── project-types.json            ← funnel options (categories/langs/frameworks/dbs/orms)
│   ├── stack.json                    ← stack components
│   ├── mcps.json                     ← MCP servers + applyWhen rules
│   ├── subagents.json                ← bundled subagent content (.md inline)
│   ├── skills.json                   ← bundled skills (octo-*)
│   ├── scaffolders.json              ← framework→scaffolder mapping (Expo, Next, Vite, …)
│   └── items/
│       ├── wshobson.json             ← 100+ agents, each tiered + conditioned
│       ├── superpowers.json          ← 14 skills
│       └── pocock.json               ← 21 skills
├── src/
│   ├── cli.ts                        ← entry point
│   ├── commands/init.ts              ← orchestrator
│   ├── prompts/                      ← @clack/prompts + custom tri-state prompt
│   │   ├── tristate-multiselect.ts   ← ●/◐/○ with D-key drill-down (built on @clack/core)
│   │   ├── funnel.ts                 ← cascading category→lang→framework→db→orm
│   │   ├── scaffolder.ts             ← propose npx create-X@latest
│   │   ├── stack.ts                  ← uses decision tree resolver
│   │   └── mcp.ts                    ← applyWhen-driven preselection
│   ├── stack/
│   │   ├── decision-tree.ts          ← matchesApplyWhen + resolveForSource
│   │   ├── wshobson.ts               ← clone + file-level agent extraction
│   │   ├── superpowers.ts            ← clone + filtered skill flatten
│   │   ├── pocock.ts                 ← clone + filtered skill flatten
│   │   └── karpathy.ts               ← fetch CLAUDE.md with bundled fallback
│   ├── generators/
│   │   ├── stack.ts                  ← orchestrates per-component install + report
│   │   ├── mcp.ts                    ← writes .mcp.json + .env + MCP handshake test
│   │   ├── github.ts                 ← create-new / clone-existing flow
│   │   └── ...
│   ├── lib/gh.ts                     ← gh CLI wrapper (repo exists, create, clone, login)
│   └── catalog.gen.ts                ← AUTO-GENERATED from catalog/*.json by tsup pre-build
└── scripts/gen-templates.mjs         ← JSON → typed TS gen + schema validation
```

**Mechanism in TS, policy in JSON.** The TS code is generic — match logic, install dispatch, prompt rendering. Adding tools means JSON edits + `npm run gen`.

---

## MCP handshake (real e2e verification)

When you add an MCP, claude-code-up doesn't just write `.mcp.json` and hope. It actually:

1. Spawns the MCP server with the env vars you provided.
2. Sends a JSON-RPC `initialize` request.
3. Waits for the `result` envelope.
4. Sends `notifications/initialized`.
5. If the catalog has a `test` field for that MCP, runs `tools/call <test.tool>` with `test.args`, validates the response (`expectField` / `expectPattern`).
6. Kills the subprocess, reports `ok` / `failed: <stage>: <reason>` / `skipped: missing <env vars>`.

So instead of seeing the MCP fail silently when `claude` launches, you see it during claude-code-up:

```
MCP initialize handshake: 3 ok · 1 failed · 1 skipped
    ✓ github
    ✓ context7
    ✓ stripe
    ✗ postgres — tools/call query: connect ECONNREFUSED 127.0.0.1:5432
    ○ supabase — Missing env vars: SUPABASE_SERVICE_ROLE_KEY
```

---

## Requirements

- Node ≥ 18
- Git
- [`gh` CLI](https://cli.github.com/) (for GitHub flow — optional but recommended)
- [Claude Code](https://claude.com/claude-code) ≥ 2.1.32 (auto-installed/upgraded by claude-code-up if missing — stable channel by default)

---

## Roadmap

- [x] ~~Publish to npm so `npx claude-code-up` works without a GitHub clone~~ — shipped in `0.1.1`
- [ ] Live D-key drill within the prompt (currently submits-and-redraws — works, but a single-frame interaction would be slicker)
- [ ] User-local overrides (`~/.claude-code-up/items-override.json`) to promote/demote items per personal preference
- [ ] More scaffolders: T3, Astro, Tauri, Solid Start, Remix Vite
- [ ] More MCPs: Slack, Notion, Linear, Sentry — with funnel-driven preselection
- [ ] Translate the bundled `octo-scenario-tester` skill content to English
- [ ] `claude-code-up add` command — apply claude-code-up to an existing project mid-way
- [ ] `claude-code-up doctor` — diagnose an existing claude-code-up-bootstrapped project

---

## Contributing

**95% of contributions = a single JSON edit. No TypeScript required.**

| You want to add | Edit | Time |
|---|---|---|
| A new **MCP server** (Stripe, Linear, Sentry…) | `catalog/mcps.json` | ~5 min |
| A new **agent / skill / command** from a source | `catalog/items/<source>.json` | ~3 min |
| A new **bundled skill** with inline `.md` content | `catalog/skills.json` | ~5 min |
| A new **framework scaffolder** (T3, Tauri…) | `catalog/scaffolders.json` | ~3 min |
| A new **command bundle** (lib installs for a stack) | `catalog/command-bundles.json` | ~5 min |

The full guide with templates, the `applyWhen` semantics, validation, and the PR checklist is in [**CONTRIBUTING.md**](CONTRIBUTING.md).

When you click **New Issue**, pick the right 🆕 template — it pre-fills the JSON shape we expect, mergeable in minutes.

```sh
git clone https://github.com/steph-frtech/claude-code-up
cd claude-code-up
npm install
npm run dev   # iterate
npm run typecheck && npm run build
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- [Anthropic](https://www.anthropic.com/) for Claude Code and the MCP protocol
- [wshobson](https://github.com/wshobson) for the 100-agent marketplace
- [Jesse Vincent (obra)](https://github.com/obra) for the Superpowers harness
- [Matt Pocock](https://www.mattpocock.com/) for the process skills (via [`ismaelJimenez/mp-skills`](https://github.com/ismaelJimenez/mp-skills) mirror)
- [Andrej Karpathy](https://x.com/karpathy) for the [coding pitfalls observations](https://github.com/multica-ai/andrej-karpathy-skills) that inspired the default CLAUDE.md
- [iamhenry](https://github.com/iamhenry/revenuecat-mcp), [Stripe](https://github.com/stripe/agent-toolkit), [nahmanmate](https://github.com/nahmanmate/better-auth-mcp-server) for the community MCPs

Built with [@clack/prompts](https://github.com/bombshell-dev/clack), [tsup](https://github.com/egoist/tsup), [execa](https://github.com/sindresorhus/execa).
