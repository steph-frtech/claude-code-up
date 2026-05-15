export type GitHubVisibility = "public" | "private";

export type GitHubMode = "create-new" | "clone-existing";

export interface GitHubAnswers {
  mode: GitHubMode;
  owner: string;
  repoName: string;
  visibility?: GitHubVisibility;
  description?: string;
  url?: string;
}

export type StackComponent =
  | "karpathy"
  | "superpowers"
  | "claude-mem"
  | "subagents"
  | "wshobson"
  | "cc-lens"
  | "agentshield"
  | "statusline"
  | "agent-teams"
  | "octo-issue-tracker"
  | "octo-scenario-tester"
  | "pocock";

export type StackScope = "project" | "user-documented";

export interface StackAnswers {
  components: StackComponent[];
  wshobsonAgents?: string[];
  wshobsonTotal?: number;
  superpowersSkills?: string[];
  superpowersTotal?: number;
  pocockSkills?: string[];
  pocockTotal?: number;
}

export type McpServerId =
  | "github"
  | "context7"
  | "playwright"
  | "postgres"
  | "supabase"
  | "stripe"
  | "revenuecat"
  | "better-auth";

export interface McpAnswers {
  servers: McpServerId[];
  envVars: Record<string, string>;
}

export interface McpVerification {
  server: McpServerId;
  status: "ok" | "failed" | "skipped";
  error?: string;
}

export type ItemKind =
  | "file"
  | "agent"
  | "script"
  | "skill"
  | "command"
  | "plugin"
  | "hook"
  | "bulk";

export interface InstalledItem {
  kind: ItemKind;
  name: string;
  path: string;
  exists: boolean;
  executable?: boolean;
  bytes?: number;
  count?: number;
}

export interface ComponentReport {
  id: StackComponent;
  name: string;
  source: string;
  scope: StackScope;
  installed: boolean;
  items: InstalledItem[];
  available?: Record<string, number>;
  instructions?: string[];
  error?: string;
}

export interface StackReport {
  version: "1";
  createdBy: string;
  createdAt: string;
  components: ComponentReport[];
  totals: {
    project: Record<string, number>;
    available: Record<string, number>;
  };
}

export type WipeMode = "wipe" | "merge";

export type { FunnelAnswers } from "./prompts/funnel.js";

export interface ScaffolderAnswer {
  id: string;
  command: string;
  args: string[];
}

export interface ProjectAnswers {
  name: string;
  dir: string;
  initGit: boolean;
  funnel?: import("./prompts/funnel.js").FunnelAnswers;
  scaffolder?: ScaffolderAnswer;
  github?: GitHubAnswers;
  stack?: StackAnswers;
  mcp?: McpAnswers;
  wipeMode?: WipeMode;
  existingEntries?: number;
}

export interface InitOptions {
  targetDir?: string;
  force?: boolean;
}
