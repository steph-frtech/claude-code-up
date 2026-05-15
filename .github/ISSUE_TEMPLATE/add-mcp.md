---
name: "🆕 Add an MCP server"
about: Propose a new MCP server entry for the catalog
title: "[MCP] Add <server-name>"
labels: ["mcp", "catalog"]
---

## MCP server to add

**Name**: <!-- e.g. Linear, Sentry, Slack -->
**Repo / package**: <!-- e.g. @linear/mcp-server, github:foo/bar -->
**Official?**: <!-- yes / no — community? -->

## Proposed JSON entry for `catalog/mcps.json`

```json
{
  "id": "<short-id>",
  "name": "<Display Name>",
  "description": "<one line>",
  "rating": 3,
  "tags": ["global"],
  "preselectFor": ["..."],
  "applyWhen": {
    "categories": ["..."],
    "languages": ["..."]
  },
  "config": {
    "command": "npx",
    "args": ["-y", "<package-name>"],
    "env": { "API_KEY": "${API_KEY}" }
  },
  "requiresEnvVars": ["API_KEY"],
  "envHint": "Where to get the key."
}
```

## When should it auto-preselect?

Describe the funnel match rule in plain English. Example: "Backend or fullstack projects with Postgres". This translates to the `applyWhen` above.

## Verification

- [ ] I confirmed the package exists on npm (or `github:owner/repo` works via npx)
- [ ] I confirmed the env-var name matches the upstream MCP server's expectations
- [ ] (Optional) Suggested `test` block for the e2e handshake:

```json
"test": { "tool": "<safe_read_tool>", "args": {...}, "expectField": "content" }
```

## Conflicts / overlap

Does this duplicate an existing MCP or wshobson agent? If yes, explain why both should coexist (or which to mark `skip`).
