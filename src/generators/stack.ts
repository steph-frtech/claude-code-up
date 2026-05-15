import { mkdir, writeFile, chmod, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  ComponentReport,
  InstalledItem,
  ItemKind,
  StackComponent,
  StackReport,
} from "../types.js";
import { findComponent } from "../stack/manifest.js";
import { CURATED_AGENTS } from "../stack/agents.js";
import {
  cloneWshobson,
  flattenSpecificAgents,
  flattenWshobsonPlugins,
} from "../stack/wshobson.js";
import { installSuperpowers } from "../stack/superpowers.js";
import { installPocock } from "../stack/pocock.js";
import { CURATED_SKILLS_DATA } from "../catalog/loader.js";
import { AUDIT_SH, STATUSLINE_SH } from "../templates.js";
import { renderStackMd } from "../stack/render.js";

const CCUP_VERSION = "0.1.3";

async function inspectItem(
  targetPath: string,
  relPath: string,
  kind: InstalledItem["kind"],
  name: string,
): Promise<InstalledItem> {
  const abs = path.join(targetPath, relPath);
  if (!existsSync(abs)) {
    return { kind, name, path: relPath, exists: false };
  }
  const st = await stat(abs);
  const item: InstalledItem = {
    kind,
    name,
    path: relPath,
    exists: true,
    bytes: st.size,
  };
  if (kind === "script") {
    item.executable = (st.mode & 0o111) !== 0;
  }
  return item;
}

function mapDirToKind(dir: string): ItemKind {
  switch (dir) {
    case "agents":
      return "agent";
    case "skills":
      return "skill";
    case "commands":
      return "command";
    case "plugins":
      return "plugin";
    case "hooks":
      return "hook";
    default:
      return "bulk";
  }
}

function pluralKind(kind: ItemKind): string {
  switch (kind) {
    case "agent":
      return "agents";
    case "script":
      return "scripts";
    case "file":
      return "files";
    case "skill":
      return "skills";
    case "command":
      return "commands";
    case "plugin":
      return "plugins";
    case "hook":
      return "hooks";
    case "bulk":
      return "items";
  }
}

function computeTotals(reports: ComponentReport[]): StackReport["totals"] {
  const project: Record<string, number> = {};
  const available: Record<string, number> = {};

  for (const r of reports) {
    if (r.scope === "project") {
      for (const item of r.items) {
        if (!item.exists) continue;
        const key = pluralKind(item.kind);
        const add = item.count ?? 1;
        project[key] = (project[key] ?? 0) + add;
      }
    } else if (r.available) {
      for (const [k, v] of Object.entries(r.available)) {
        available[k] = (available[k] ?? 0) + v;
      }
    }
  }

  return { project, available };
}

async function enableAgentTeams(targetPath: string): Promise<void> {
  const settingsAbs = path.join(targetPath, ".claude", "settings.json");
  const raw = existsSync(settingsAbs)
    ? await readFile(settingsAbs, "utf8")
    : "{}";
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(raw);
  } catch {
    settings = {};
  }
  const env = (settings.env as Record<string, string> | undefined) ?? {};
  env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
  settings.env = env;
  await writeFile(
    settingsAbs,
    JSON.stringify(settings, null, 2) + "\n",
    "utf8",
  );
}

async function bumpSkillBudget(targetPath: string): Promise<void> {
  const settingsAbs = path.join(targetPath, ".claude", "settings.json");
  if (!existsSync(settingsAbs)) return;
  const raw = await readFile(settingsAbs, "utf8");
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(raw);
  } catch {
    settings = {};
  }
  // Only set if not already configured higher.
  const current = typeof settings.skillListingBudgetFraction === "number"
    ? (settings.skillListingBudgetFraction as number)
    : 0.01;
  if (current < 0.05) {
    settings.skillListingBudgetFraction = 0.05;
    await writeFile(
      settingsAbs,
      JSON.stringify(settings, null, 2) + "\n",
      "utf8",
    );
  }
}

async function injectStopHook(
  targetPath: string,
  reports: ComponentReport[],
): Promise<void> {
  const settingsRel = path.posix.join(".claude", "settings.json");
  const settingsAbs = path.join(targetPath, settingsRel);

  const raw = existsSync(settingsAbs)
    ? await readFile(settingsAbs, "utf8")
    : "{}";
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(raw);
  } catch {
    settings = {};
  }

  const hooks =
    (settings.hooks as Record<string, unknown> | undefined) ?? {};
  const stopHooks = Array.isArray(hooks.Stop) ? (hooks.Stop as unknown[]) : [];
  stopHooks.push({
    matcher: "",
    hooks: [
      {
        type: "command",
        command: ".claude/scripts/audit.sh",
      },
    ],
  });
  hooks.Stop = stopHooks;
  settings.hooks = hooks;

  await writeFile(
    settingsAbs,
    JSON.stringify(settings, null, 2) + "\n",
    "utf8",
  );

  const agentshieldReport = reports.find((r) => r.id === "agentshield");
  if (agentshieldReport) {
    agentshieldReport.items.push({
      kind: "hook",
      name: "Stop hook → audit.sh",
      path: `${settingsRel}#hooks.Stop`,
      exists: true,
    });
  }
}

export interface ApplyStackOptions {
  targetPath: string;
  components: StackComponent[];
  wshobsonAgents?: string[];
  superpowersSkills?: string[];
  pocockSkills?: string[];
}

export async function applyStack(
  opts: ApplyStackOptions,
): Promise<StackReport | null> {
  if (opts.components.length === 0) return null;

  const reports: ComponentReport[] = [];

  for (const id of opts.components) {
    const def = findComponent(id);
    const report: ComponentReport = {
      id: def.id,
      name: def.name,
      source: def.source,
      scope: def.scope,
      installed: false,
      items: [],
    };

    if (def.available) report.available = def.available;
    if (def.instructions) report.instructions = def.instructions;

    if (id === "karpathy") {
      report.items.push(
        await inspectItem(opts.targetPath, "CLAUDE.md", "file", "CLAUDE.md"),
      );
    } else if (id === "subagents") {
      const agentsDir = path.join(opts.targetPath, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });
      for (const agent of CURATED_AGENTS) {
        const rel = path.posix.join(".claude", "agents", agent.filename);
        await writeFile(
          path.join(opts.targetPath, rel),
          agent.content,
          "utf8",
        );
        report.items.push(
          await inspectItem(opts.targetPath, rel, "agent", agent.name),
        );
      }
    } else if (id === "agentshield") {
      const scriptsDir = path.join(opts.targetPath, ".claude", "scripts");
      await mkdir(scriptsDir, { recursive: true });
      const rel = path.posix.join(".claude", "scripts", "audit.sh");
      const abs = path.join(opts.targetPath, rel);
      await writeFile(abs, AUDIT_SH, "utf8");
      await chmod(abs, 0o755);
      report.items.push(await inspectItem(opts.targetPath, rel, "script", "audit.sh"));
    } else if (id === "superpowers") {
      const result = await installSuperpowers(
        opts.targetPath,
        opts.superpowersSkills,
      );
      if (result.error) {
        report.error = `clone failed: ${result.error}`;
      } else {
        report.items.push({
          kind: "bulk",
          name: "superpowers marketplace mirror",
          path: result.destDir,
          exists: true,
          count: result.totalFiles,
        });
        if (result.flatSkills > 0) {
          report.items.push({
            kind: "skill",
            name: "superpowers skills (flattened)",
            path: ".claude/skills/",
            exists: true,
            count: result.flatSkills,
          });
        }
      }
    } else if (id === "wshobson") {
      const result = await cloneWshobson(opts.targetPath); // mirror kept full
      if (result.error) {
        report.error = `git clone failed: ${result.error}`;
      } else {
        report.items.push({
          kind: "bulk",
          name: "wshobson marketplace mirror",
          path: result.destDir,
          exists: existsSync(path.join(opts.targetPath, result.destDir)),
          count: result.totalFiles,
        });

        const wanted = opts.wshobsonAgents ?? [];
        if (wanted.length > 0) {
          const flat = await flattenSpecificAgents(opts.targetPath, wanted);
          report.items.push({
            kind: "agent",
            name: "wshobson agents (file-level extraction)",
            path: ".claude/agents/",
            exists: true,
            count: flat.written,
          });
          if (flat.missing.length > 0) {
            report.error = `${flat.missing.length} agents not found: ${flat.missing.slice(0, 5).join(", ")}…`;
          }
        }
        void flattenWshobsonPlugins; // legacy plugin-level flatten kept exported for future opt-in
      }
    } else if (id === "pocock") {
      const result = await installPocock(opts.targetPath, opts.pocockSkills);
      if (result.error) {
        report.error = `pocock clone failed: ${result.error}`;
      } else {
        report.items.push({
          kind: "bulk",
          name: "pocock mirror",
          path: result.destDir,
          exists: true,
          count: result.totalFiles,
        });
        if (result.flatSkills > 0) {
          report.items.push({
            kind: "skill",
            name: "pocock skills (flattened)",
            path: ".claude/skills/",
            exists: true,
            count: result.flatSkills,
          });
        }
      }
    } else if (id === "octo-issue-tracker" || id === "octo-scenario-tester") {
      const skill = CURATED_SKILLS_DATA.find((s) => s.id === id);
      if (!skill) {
        report.error = `bundled skill not found in catalog: ${id}`;
      } else {
        const skillDir = path.join(opts.targetPath, ".claude", "skills", skill.name);
        await mkdir(skillDir, { recursive: true });
        const rel = path.posix.join(".claude", "skills", skill.name, "SKILL.md");
        await writeFile(
          path.join(opts.targetPath, rel),
          skill.content,
          "utf8",
        );
        report.items.push(
          await inspectItem(opts.targetPath, rel, "skill", skill.name),
        );
      }
    } else if (id === "agent-teams") {
      await enableAgentTeams(opts.targetPath);
      report.items.push({
        kind: "file",
        name: "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
        path: ".claude/settings.json#env",
        exists: true,
      });
    } else if (id === "statusline") {
      const rel = path.posix.join(".claude", "statusline.sh");
      const abs = path.join(opts.targetPath, rel);
      await writeFile(abs, STATUSLINE_SH, "utf8");
      await chmod(abs, 0o755);
      report.items.push(await inspectItem(opts.targetPath, rel, "script", "statusline.sh"));

      const settingsRel = path.posix.join(".claude", "settings.json");
      const settingsAbs = path.join(opts.targetPath, settingsRel);
      const raw = existsSync(settingsAbs)
        ? await readFile(settingsAbs, "utf8")
        : "{}";
      let settings: Record<string, unknown>;
      try {
        settings = JSON.parse(raw);
      } catch {
        settings = {};
      }
      settings.statusLine = {
        type: "command",
        command: "$CLAUDE_PROJECT_DIR/.claude/statusline.sh",
      };
      await writeFile(
        settingsAbs,
        JSON.stringify(settings, null, 2) + "\n",
        "utf8",
      );
      report.items.push(
        await inspectItem(opts.targetPath, settingsRel, "file", "settings.json (statusLine)"),
      );
    }

    if (def.scope === "project") {
      report.installed = report.items.length > 0 && report.items.every((i) => i.exists);
    } else {
      report.installed = false;
    }

    reports.push(report);
  }

  // Cross-component hook injection: when agentshield is selected, install a Stop
  // hook that runs the audit script after each Claude response.
  if (opts.components.includes("agentshield")) {
    await injectStopHook(opts.targetPath, reports);
  }

  // When wshobson is selected, bump skillListingBudgetFraction so the ~150
  // flattened skill descriptions actually fit Claude Code's listing budget
  // (default 1% drops most of them — see `/doctor`).
  if (opts.components.includes("wshobson")) {
    await bumpSkillBudget(opts.targetPath);
  }

  const totals = computeTotals(reports);

  const stackReport: StackReport = {
    version: "1",
    createdBy: `claude-code-up@${CCUP_VERSION}`,
    createdAt: new Date().toISOString(),
    components: reports,
    totals,
  };

  await mkdir(path.join(opts.targetPath, ".claude"), { recursive: true });
  await writeFile(
    path.join(opts.targetPath, ".claude", "stack.json"),
    JSON.stringify(stackReport, null, 2) + "\n",
    "utf8",
  );

  await writeFile(
    path.join(opts.targetPath, "STACK.md"),
    renderStackMd(stackReport),
    "utf8",
  );

  return stackReport;
}
