import { MCP_SERVERS } from "../catalog/loader.js";
import type { McpServerId, GitHubVisibility } from "../types.js";

export interface McpToolTest {
  tool: string;
  args?: Record<string, unknown>;
  expectField?: string;
  expectPattern?: string;
}

export interface ApplyWhenRule {
  categories?: string[];
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  orms?: string[];
}

export interface McpServerDef {
  id: McpServerId;
  name: string;
  description: string;
  rating: number;
  tags: string[];
  preselectFor: string[];
  applyWhen?: ApplyWhenRule;
  config: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  requiresEnvVars?: string[];
  envHint?: string;
  test?: McpToolTest;
}

// `GitHubVisibility` is referenced in types but unused here; the export keeps
// the previous module surface stable.
export type { GitHubVisibility };

export const MCP_CATALOG: McpServerDef[] = MCP_SERVERS.map((raw) => ({
  id: raw.id as McpServerId,
  name: raw.name,
  description: raw.description,
  rating: raw.rating,
  tags: raw.tags,
  preselectFor: raw.preselectFor,
  applyWhen: raw.applyWhen,
  config: raw.config,
  requiresEnvVars: raw.requiresEnvVars,
  envHint: raw.envHint,
  test: raw.test,
}));

export function findMcpServer(id: McpServerId): McpServerDef {
  const def = MCP_CATALOG.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown MCP server: ${id}`);
  return def;
}
