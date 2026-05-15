import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  GitHubAnswers,
  McpAnswers,
  StackAnswers,
  WipeMode,
  FunnelAnswers,
  ScaffolderAnswer,
} from "../types.js";
import { findComponent } from "../stack/manifest.js";
import { findMcpServer } from "../stack/mcp-catalog.js";

export interface ConfirmPlanOptions {
  projectName: string;
  targetPath: string;
  initGit: boolean;
  funnel?: FunnelAnswers;
  scaffolder?: ScaffolderAnswer;
  github?: GitHubAnswers;
  stack?: StackAnswers;
  mcp?: McpAnswers;
  wipeMode?: WipeMode;
  existingEntries?: number;
}

export async function confirmPlan(opts: ConfirmPlanOptions): Promise<boolean> {
  const lines: string[] = [
    `${pc.bold("Project")}    ${opts.projectName}`,
    `${pc.bold("Location")}   ${opts.targetPath}`,
  ];
  if (opts.funnel) {
    const f = opts.funnel;
    if (f.categories.length > 0) lines.push(`${pc.bold("Category")}   ${f.categories.join(", ")}`);
    if (f.languages.length > 0) lines.push(`${pc.bold("Language")}   ${f.languages.join(", ")}`);
    if (f.frameworks.length > 0) lines.push(`${pc.bold("Framework")}  ${f.frameworks.join(", ")}`);
    if (f.databases.length > 0) lines.push(`${pc.bold("Database")}   ${f.databases.join(", ")}`);
    if (f.orms.length > 0) lines.push(`${pc.bold("ORM")}        ${f.orms.join(", ")}`);
  }
  if (opts.scaffolder) {
    lines.push(
      `${pc.bold("Scaffold")}   ${pc.cyan(`${opts.scaffolder.command} ${opts.scaffolder.args.join(" ")}`)}`,
    );
  }

  if (opts.wipeMode === "wipe" && opts.existingEntries) {
    lines.push("");
    lines.push(
      `${pc.bgRed(pc.white(pc.bold(" WIPE ")))} ${pc.red(
        `Will remove ${opts.existingEntries} existing entries in ${opts.targetPath} before generating.`,
      )}`,
    );
  } else if (opts.wipeMode === "merge" && opts.existingEntries) {
    lines.push("");
    lines.push(
      `${pc.bgYellow(pc.black(pc.bold(" MERGE ")))} ${pc.yellow(
        `Will overlay ccup config on ${opts.existingEntries} existing entries (preserves CLAUDE.md and .gitignore if they exist).`,
      )}`,
    );
  }

  lines.push("");
  lines.push(`${pc.bold("Will create:")}`);
  lines.push(`  ${pc.dim("•")} .claude/settings.json`);
  lines.push(`  ${pc.dim("•")} .claude/skills/    ${pc.dim("(empty — registry coming in v0.2)")}`);
  lines.push(`  ${pc.dim("•")} .claude/agents/    ${pc.dim("(empty)")}`);
  lines.push(`  ${pc.dim("•")} CLAUDE.md`);
  lines.push(`  ${pc.dim("•")} .gitignore`);
  if (opts.initGit) lines.push(`  ${pc.dim("•")} git init`);

  if (opts.github) {
    lines.push("");
    lines.push(`${pc.bold("GitHub:")}`);
    const modeLabel =
      opts.github.mode === "clone-existing"
        ? pc.yellow("clone existing")
        : pc.green("create new");
    const visLabel = opts.github.visibility
      ? ` ${pc.dim(`(${opts.github.visibility})`)}`
      : "";
    lines.push(
      `  ${pc.dim("•")} ${opts.github.owner}/${opts.github.repoName}${visLabel} ${pc.dim(`[${modeLabel}]`)}`,
    );
    if (opts.github.description) {
      lines.push(`  ${pc.dim("•")} ${opts.github.description}`);
    }
    lines.push(
      opts.github.mode === "clone-existing"
        ? `  ${pc.dim("•")} clone now + push updates at the end`
        : `  ${pc.dim("•")} repo already created — will push initial commit at the end`,
    );
  }

  if (opts.stack && opts.stack.components.length > 0) {
    lines.push("");
    lines.push(`${pc.bold("Claude stack:")}`);
    for (const id of opts.stack.components) {
      const def = findComponent(id);
      const scopeTag =
        def.scope === "project" ? pc.green("project") : pc.yellow("user-doc");

      // Tri-state marker: ● full, ◐ partial (orange/yellow).
      let marker = pc.green("●");
      let partialNote = "";
      if (
        id === "wshobson" &&
        opts.stack.wshobsonAgents !== undefined &&
        opts.stack.wshobsonTotal !== undefined
      ) {
        const n = opts.stack.wshobsonAgents.length;
        const total = opts.stack.wshobsonTotal;
        if (n < total) {
          marker = pc.yellow("◐");
          partialNote = pc.yellow(`  (${n}/${total} agents)`);
        }
      } else if (
        id === "superpowers" &&
        opts.stack.superpowersSkills !== undefined &&
        opts.stack.superpowersTotal !== undefined
      ) {
        const n = opts.stack.superpowersSkills.length;
        const total = opts.stack.superpowersTotal;
        if (n < total) {
          marker = pc.yellow("◐");
          partialNote = pc.yellow(`  (${n}/${total} skills)`);
        }
      } else if (
        id === "pocock" &&
        opts.stack.pocockSkills !== undefined &&
        opts.stack.pocockTotal !== undefined
      ) {
        const n = opts.stack.pocockSkills.length;
        const total = opts.stack.pocockTotal;
        if (n < total) {
          marker = pc.yellow("◐");
          partialNote = pc.yellow(`  (${n}/${total} skills)`);
        }
      }

      lines.push(
        `  ${marker} ${def.name} ${pc.dim(`[${scopeTag}]`)}${partialNote}`,
      );
    }
    lines.push(`  ${pc.dim("•")} STACK.md + .claude/stack.json (inventory)`);
  }

  if (opts.mcp && opts.mcp.servers.length > 0) {
    lines.push("");
    lines.push(`${pc.bold("MCP servers:")} ${pc.dim("(.mcp.json)")}`);
    for (const id of opts.mcp.servers) {
      const def = findMcpServer(id);
      const missingCreds = (def.requiresEnvVars ?? []).filter(
        (v) => !opts.mcp?.envVars[v],
      );
      let marker = pc.green("●");
      let tag = "";
      if (missingCreds.length > 0) {
        marker = pc.yellow("◐");
        tag = ` ${pc.yellow(`[missing ${missingCreds.join(", ")}]`)}`;
      } else if (def.requiresEnvVars?.length) {
        tag = ` ${pc.green(`[creds set]`)}`;
      }
      lines.push(`  ${marker} ${def.name}${tag}`);
    }
  }

  p.note(lines.join("\n"), "Plan");

  const ok = await p.confirm({
    message: "Proceed?",
    initialValue: true,
  });

  return !p.isCancel(ok) && ok === true;
}
