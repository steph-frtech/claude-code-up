import { STATUSLINE_SH as STATUSLINE_SH_GEN } from "./templates.gen.js";

export const CLAUDE_MD = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: {{projectName}}

This project was initialized with \`ccup\`. Expand this file with:

- **Common commands** — how to build, run, test, and lint the project, plus how to run a single test.
- **Architecture** — the big-picture structure (entry points, major modules, how data flows).
- **Project conventions** — anything non-obvious for a new contributor.
`;

export const SETTINGS_JSON = `{
  "permissions": {
    "allow": [],
    "deny": []
  }
}
`;

export const GITIGNORE = `node_modules/
dist/
.env
.env.local
.DS_Store
*.log
`;

export const AUDIT_SH = `#!/usr/bin/env bash
# ccup-generated security audit script.
# Scans this project's .claude/ directory using agentshield CLI.
# Source: https://github.com/affaan-m/agentshield
set -euo pipefail

cd "$(dirname "$0")/../.."
exec npx --yes ecc-agentshield scan "$@"
`;

export const STATUSLINE_SH = STATUSLINE_SH_GEN;
