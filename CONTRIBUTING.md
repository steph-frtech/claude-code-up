# Contributing to claude-code-up

**95% of contributions = a single JSON edit.** No TypeScript required.

`claude-code-up`'s architecture separates **data** (catalogue JSONs) from **mechanism** (generic TS code that reads them). Adding an MCP, an agent, a skill, a scaffolder, or a command bundle means editing one JSON file and opening a PR. The CI validates the JSON schema, regenerates the typed exports, and you're done.

---

## TL;DR — five ways to contribute

| What you want to add | Edit this file | Time |
|---|---|---|
| A new **MCP server** (Stripe, Linear, Sentry…) | [`catalog/mcps.json`](catalog/mcps.json) | ~5 min |
| A new **agent** from wshobson / Superpowers / Pocock — or change a tier | [`catalog/items/<source>.json`](catalog/items/) | ~3 min |
| A new **bundled skill** with inline `.md` content | [`catalog/skills.json`](catalog/skills.json) | ~5 min |
| A new **framework scaffolder** (T3, Tauri, Solid…) | [`catalog/scaffolders.json`](catalog/scaffolders.json) | ~3 min |
| A new **command bundle** (lib install commands per stack branch) | [`catalog/command-bundles.json`](catalog/command-bundles.json) | ~5 min |

That's it. The TS code is generic — it reads the JSON, applies the decision tree (`applyWhen` rules), runs the prompts, executes the installers. New entries flow through automatically.

---

## Setup (one-time)

```sh
git clone https://github.com/steph-frtech/claude-code-up
cd claude-code-up
npm install
npm run gen         # regenerates src/catalog.gen.ts + src/templates.gen.ts from catalog/
npm run typecheck   # validates JSON schema + TS types
npm run build       # bundles to dist/
npm run dev         # interactive run (real prompts)
```

Every time you edit a JSON in `catalog/`, run `npm run gen` to refresh the typed exports. The pre-commit hooks (if you have Husky) call this automatically.

---

## How to add things

### 1. A new MCP server

Edit [`catalog/mcps.json`](catalog/mcps.json) and append an entry:

```json
{
  "id": "linear",
  "name": "Linear (issue tracker)",
  "description": "Read/write Linear issues, cycles, projects",
  "rating": 3,
  "tags": ["global"],
  "preselectFor": ["web", "mobile", "backend"],
  "applyWhen": {
    "categories": ["web", "mobile", "backend", "fullstack"]
  },
  "config": {
    "command": "npx",
    "args": ["-y", "@linear/mcp-server"],
    "env": { "LINEAR_API_KEY": "${LINEAR_API_KEY}" }
  },
  "requiresEnvVars": ["LINEAR_API_KEY"],
  "envHint": "Linear settings → API → Personal API keys."
}
```

**`applyWhen` semantics** (drives auto-preselection):
- Missing → always preselected (default-like).
- `{}` empty → opt-in only (never auto-preselected).
- With rules → preselected iff every present section intersects with the funnel.
  - Sections: `categories`, `languages`, `frameworks`, `databases`, `orms`.
  - Within a section: OR. Across sections: AND.

**Optional**: add `test: { tool: "<tool_name>", args: {...}, expectField: "content" }` to run a real `tools/call` after `initialize` during the e2e MCP handshake.

Then update `McpServerId` in [`src/types.ts`](src/types.ts) (one-line union extension):
```ts
export type McpServerId = "github" | "context7" | ... | "linear";
```

Run `npm run gen && npm run typecheck && npm run build`. Open a PR.

---

### 2. A new agent / skill / command (from a source repo)

Edit the relevant file under [`catalog/items/`](catalog/items/):
- `wshobson.json` — agents from [wshobson/agents](https://github.com/wshobson/agents)
- `superpowers.json` — skills from [obra/superpowers](https://github.com/obra/superpowers)
- `pocock.json` — skills from [Matt Pocock's mp-skills mirror](https://github.com/ismaelJimenez/mp-skills)

Append an item with the right **tier**:

```json
{
  "id": "graphql-architect",
  "kind": "agent",
  "container": "api-scaffolding",
  "tier": "conditional",
  "description": "GraphQL API design + federation",
  "applyWhen": {
    "categories": ["backend", "fullstack"],
    "frameworks": ["nextjs", "fastify", "hono", "nestjs"]
  }
}
```

**Tiers**:
- `default` → always installed. No `applyWhen`.
- `conditional` → preselected iff `applyWhen` matches the funnel.
- `skip` → never offered. Must have a `reason` field documenting why (typically a duplicate of another source's item or out-of-scope).

For **bundled skills with inline content** (like our `octo-issue-tracker`), edit [`catalog/skills.json`](catalog/skills.json):

```json
{
  "id": "your-skill-id",
  "name": "your-skill-name",
  "description": "What it triggers on — used by Claude Code's skill matcher",
  "content": "---\nname: your-skill-name\ndescription: ...\n---\n\n# Skill body in markdown\n..."
}
```

---

### 3. A new scaffolder

Edit [`catalog/scaffolders.json`](catalog/scaffolders.json):

```json
{
  "id": "tauri",
  "name": "Tauri (create-tauri-app)",
  "description": "Bootstrap a Rust + WebView desktop app",
  "command": "npm",
  "args": ["create", "tauri-app@latest", "."],
  "matchFrameworks": ["tauri"]
}
```

The `matchFrameworks` ids must exist in [`catalog/project-types.json`](catalog/project-types.json) under `frameworksByLangCategory`. If you're adding a new framework, add it there too.

---

### 4. A new command bundle

Edit [`catalog/command-bundles.json`](catalog/command-bundles.json):

```json
{
  "id": "nextjs-tailwind-shadcn-supabase",
  "name": "Next.js + Tailwind + shadcn + Supabase",
  "description": "Full UI + DB stack for Supabase-backed Next.js apps",
  "applyWhen": {
    "frameworks": ["nextjs"],
    "databases": ["supabase"]
  },
  "commands": [
    { "exec": "npm install @supabase/supabase-js", "desc": "Supabase JS client" },
    { "exec": "npx shadcn@latest init --yes --defaults", "desc": "shadcn init" },
    { "exec": "npm install @tanstack/react-query", "desc": "Server state" }
  ]
}
```

Each `commands[].exec` is run via `execa` in the target dir with `stdio: "inherit"`. Failures are logged but don't abort the rest of the bundle.

---

### 5. A new project type / language / framework

Edit [`catalog/project-types.json`](catalog/project-types.json). The file has 5 sections:
- `categories` — top-level (Web / Mobile / Backend / …)
- `languagesByCategory` — language options per category
- `frameworksByLangCategory` — keyed by `"<category>:<language>"`
- `databases` — flat list
- `ormsByLanguage` — per language

Adding a new framework? Add it under the right `<category>:<language>` key, then reference it in `scaffolders.json` / `command-bundles.json` if you want auto-init.

---

## Validation

`npm run gen` runs the schema validator. It will fail on:
- Missing required fields (`id`, `tier`, `commands`, etc.)
- Invalid tier values
- `tier: "skip"` without a `reason`
- `tier: "default"` with an `applyWhen` (defaults are unconditional)
- Bundle commands without `exec`

Catch errors locally before pushing:
```sh
npm run gen && npm run typecheck && npm run build
```

CI runs the same checks on every PR.

---

## Testing your contribution

### Smoke (the decision tree)

```sh
# In a Node REPL or tsx
import { resolveForSource, matchesApplyWhen } from "./src/stack/decision-tree.js";

const funnel = { categories: ["backend"], languages: ["py"], frameworks: ["fastapi"], databases: ["postgres"], orms: ["sqlalchemy"] };
console.log(resolveForSource("wshobson", funnel).preChecked.map(i => i.id));
// → should include your new item if applyWhen matches
```

### End-to-end (TTY required)

```sh
npm run dev
# Walk through the prompts with the funnel choices that should trigger
# your new entry. Verify it appears pre-checked in the relevant prompt.
```

---

## PR checklist

When you open a PR, the template asks you to confirm:

- [ ] JSON entry added in the right `catalog/...` file
- [ ] `npm run gen` succeeds (schema valid)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Tested at least one funnel combination manually via `npm run dev`
- [ ] (If MCP) handshake URL/env vars verified against the upstream repo
- [ ] (If scaffolder/bundle) the `exec` command runs successfully in an empty dir
- [ ] (If item) cross-source duplicates checked — same tool shouldn't compete with another already in `default`/`conditional`

---

## Bigger changes (new sources, new prompt steps)

If you want to:
- **Add a new skill source** (e.g., a new GitHub repo with curated agents) — touch `src/stack/<source>.ts` (clone + flatten), `catalog/items/<source>.json` (item classification), `src/generators/stack.ts` (dispatch), `src/types.ts` (StackComponent union).
- **Add a new prompt step** (e.g., "deployment target" cascade) — touch `src/prompts/*.ts` + wiring in `src/prompts/project.ts`.
- **Change the matcher semantics** — touch `src/stack/decision-tree.ts`. Behavior change → discuss in an issue first.

These are the "TS-required" contributions. Smaller in number but welcome.

---

## Issue templates

Before coding, the easiest contribution is **filing a well-formed issue** with the JSON snippet you'd like added. We have templates for:

- 🆕 **Add an MCP server**
- 🆕 **Add an agent / skill / command**
- 🆕 **Add a scaffolder**
- 🆕 **Add a command bundle**
- 🐛 **Bug report**
- 💡 **Feature request**

Pick one when you click "New Issue" — it pre-fills the JSON shape we expect.

---

## Code of Conduct

Be kind. Be specific. Tag people charitably. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## License

By contributing, you agree your contributions are MIT-licensed, same as the project.

---

## Questions?

Open a [Discussion](https://github.com/steph-frtech/claude-code-up/discussions) or comment on an existing issue. No question is too small.
