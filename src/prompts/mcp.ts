import * as p from "@clack/prompts";
import pc from "picocolors";
import type { McpAnswers, McpServerId, FunnelAnswers } from "../types.js";
import { MCP_CATALOG, findMcpServer } from "../stack/mcp-catalog.js";
import { matchesApplyWhen } from "../stack/decision-tree.js";

export async function askMcp(
  funnel?: FunnelAnswers,
): Promise<McpAnswers | null> {
  // Preselection is fully JSON-driven via each MCP's optional `applyWhen` rule:
  //   - missing applyWhen → always preselected (default-like, e.g. github, context7)
  //   - applyWhen present → preselected iff funnel matches the rule
  //   - applyWhen = {} (no rules) → opt-in only, never auto-preselected
  const initialValues = MCP_CATALOG
    .filter((s) => matchesApplyWhen(s.applyWhen, funnel))
    .map((s) => s.id);

  const selected = await p.multiselect<McpServerId>({
    message: "MCP servers to configure (project-scope .mcp.json)?",
    options: MCP_CATALOG.map((s) => ({
      value: s.id,
      label: `${s.name} ${"★".repeat(s.rating)}`,
      hint: s.description,
    })),
    initialValues,
    required: false,
  });

  if (p.isCancel(selected)) return null;
  const servers = selected as McpServerId[];
  const envVars: Record<string, string> = {};

  for (const id of servers) {
    const def = findMcpServer(id);
    if (!def.requiresEnvVars || def.requiresEnvVars.length === 0) continue;

    p.log.step(`${def.name} requires credentials`);
    if (def.envHint) p.log.message(pc.dim(def.envHint));

    for (const varName of def.requiresEnvVars) {
      const value = await p.password({
        message: `${varName}? ${pc.dim("(enter to skip — server will be unverified)")}`,
      });
      if (p.isCancel(value)) return null;
      if (value) envVars[varName] = value;
    }
  }

  return { servers, envVars };
}
