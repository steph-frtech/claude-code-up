import { execa } from "execa";
import {
  mkdir,
  readdir,
  rm,
  cp,
  copyFile,
  stat,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO_URL = "https://github.com/wshobson/agents.git";
const REL_DEST = ".claude/marketplaces/wshobson";

export interface WshobsonResult {
  destDir: string;
  topLevelDirs: { name: string; count: number }[];
  totalFiles: number;
  error?: string;
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === ".git") continue;
      if (e.isFile()) count++;
      else if (e.isDirectory()) count += await countFiles(path.join(dir, e.name));
    }
  } catch {
    // ignore
  }
  return count;
}

async function listTopDirs(dir: string): Promise<{ name: string; count: number }[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const result: { name: string; count: number }[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name === ".git") continue;
      result.push({ name: e.name, count: await countFiles(path.join(dir, e.name)) });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function cloneWshobson(
  targetPath: string,
  allowedPlugins?: string[],
): Promise<WshobsonResult> {
  const dest = path.join(targetPath, REL_DEST);

  if (!existsSync(dest)) {
    await mkdir(path.dirname(dest), { recursive: true });
    try {
      await execa("git", ["clone", "--depth", "1", REPO_URL, dest], {
        timeout: 120_000,
      });
    } catch (err) {
      return {
        destDir: REL_DEST,
        topLevelDirs: [],
        totalFiles: 0,
        error: (err as Error).message,
      };
    }
    await rm(path.join(dest, ".git"), { recursive: true, force: true }).catch(
      () => undefined,
    );
  }

  // If a filter is set, prune plugins/ to only the allowed names.
  if (allowedPlugins) {
    const pluginsDir = path.join(dest, "plugins");
    if (existsSync(pluginsDir)) {
      const entries = await readdir(pluginsDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !allowedPlugins.includes(e.name)) {
          await rm(path.join(pluginsDir, e.name), {
            recursive: true,
            force: true,
          });
        }
      }
    }
  }

  return {
    destDir: REL_DEST,
    topLevelDirs: await listTopDirs(dest),
    totalFiles: await countFiles(dest),
  };
}

/**
 * Enumerates wshobson plugin names without cloning, via the GitHub API.
 * Returns null if `gh` is missing/unauthed or the call fails.
 */
/**
 * After cloneWshobson, copies ONLY the listed agent files (by name, not plugin)
 * into .claude/agents/. The first matching `plugins/<x>/agents/<name>.md` wins.
 * Returns the count of agents actually written.
 */
export async function flattenSpecificAgents(
  targetPath: string,
  agentNames: string[],
): Promise<{ written: number; missing: string[] }> {
  const mirrorRoot = path.join(targetPath, REL_DEST);
  const pluginsDir = path.join(mirrorRoot, "plugins");
  if (!existsSync(pluginsDir) || agentNames.length === 0) {
    return { written: 0, missing: agentNames };
  }

  const agentsTarget = path.join(targetPath, ".claude", "agents");
  await mkdir(agentsTarget, { recursive: true });

  const want = new Set(agentNames);
  const found = new Set<string>();
  // Skip names already written by an earlier component (e.g. the bundled
  // subagents). Otherwise wshobson would overwrite them on disk AND double-
  // count them in stack.json totals (since each component reports its own
  // count). The first writer wins; subsequent writers count zero for that
  // file.
  let writtenNew = 0;

  const plugins = (await readdir(pluginsDir, { withFileTypes: true })).filter(
    (e) => e.isDirectory() && !e.name.startsWith("."),
  );
  for (const plugin of plugins) {
    if (want.size === found.size) break;
    const agentsDir = path.join(pluginsDir, plugin.name, "agents");
    if (!existsSync(agentsDir)) continue;
    const files = await readdir(agentsDir).catch(() => [] as string[]);
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const base = f.replace(/\.md$/, "");
      if (!want.has(base) || found.has(base)) continue;
      const dest = path.join(agentsTarget, f);
      if (existsSync(dest)) {
        // Already on disk from an earlier component — leave it, don't recount.
        found.add(base);
        continue;
      }
      const src = path.join(agentsDir, f);
      await copyFile(src, dest);
      found.add(base);
      writtenNew++;
    }
  }

  const missing = [...want].filter((n) => !found.has(n));
  return { written: writtenNew, missing };
}

export async function listWshobsonPluginsViaApi(): Promise<string[] | null> {
  try {
    const { stdout } = await execa("gh", [
      "api",
      "repos/wshobson/agents/contents/plugins",
      "--jq",
      '[.[] | select(.type=="dir") | .name] | sort | .[]',
    ]);
    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

export interface FlattenResult {
  skills: number;
  agents: number;
  commands: number;
  conflicts: string[];
}

/**
 * After cloneWshobson, walk plugins/<plugin>/{skills,agents,commands}/* and copy
 * each item into .claude/{skills,agents,commands}/ with a `<plugin>__` prefix so
 * Claude Code's project-scope auto-discovery picks them up.
 */
export async function flattenWshobsonPlugins(
  targetPath: string,
): Promise<FlattenResult> {
  const mirrorRoot = path.join(targetPath, REL_DEST);
  const pluginsDir = path.join(mirrorRoot, "plugins");

  const result: FlattenResult = {
    skills: 0,
    agents: 0,
    commands: 0,
    conflicts: [],
  };

  if (!existsSync(pluginsDir)) return result;

  const skillsTarget = path.join(targetPath, ".claude", "skills");
  const agentsTarget = path.join(targetPath, ".claude", "agents");
  const commandsTarget = path.join(targetPath, ".claude", "commands");
  await mkdir(skillsTarget, { recursive: true });
  await mkdir(agentsTarget, { recursive: true });
  await mkdir(commandsTarget, { recursive: true });

  const pluginEntries = await readdir(pluginsDir, { withFileTypes: true });
  const plugins = pluginEntries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  for (const plugin of plugins) {
    const pluginDir = path.join(pluginsDir, plugin);

    // skills: <plugin>/skills/<skill>/ → .claude/skills/<plugin>__<skill>/
    const sk = path.join(pluginDir, "skills");
    if (existsSync(sk)) {
      const skillDirs = (await readdir(sk, { withFileTypes: true }))
        .filter((e) => e.isDirectory());
      for (const skill of skillDirs) {
        const src = path.join(sk, skill.name);
        const dest = path.join(skillsTarget, `${plugin}__${skill.name}`);
        if (existsSync(dest)) result.conflicts.push(dest);
        await cp(src, dest, { recursive: true, force: true });
        result.skills++;
      }
    }

    // agents: <plugin>/agents/<a>.md → .claude/agents/<plugin>__<a>.md
    const ag = path.join(pluginDir, "agents");
    if (existsSync(ag)) {
      const agentFiles = (await readdir(ag)).filter((f) => f.endsWith(".md"));
      for (const agent of agentFiles) {
        const src = path.join(ag, agent);
        const base = agent.replace(/\.md$/, "");
        const dest = path.join(agentsTarget, `${plugin}__${base}.md`);
        if (existsSync(dest)) result.conflicts.push(dest);
        await copyFile(src, dest);
        result.agents++;
      }
    }

    // commands: <plugin>/commands/{file.md | <cmd>/} → .claude/commands/<plugin>__<name>
    const cm = path.join(pluginDir, "commands");
    if (existsSync(cm)) {
      const cmdEntries = await readdir(cm, { withFileTypes: true });
      for (const e of cmdEntries) {
        const src = path.join(cm, e.name);
        if (e.isFile() && e.name.endsWith(".md")) {
          const base = e.name.replace(/\.md$/, "");
          const dest = path.join(commandsTarget, `${plugin}__${base}.md`);
          if (existsSync(dest)) result.conflicts.push(dest);
          await copyFile(src, dest);
          result.commands++;
        } else if (e.isDirectory()) {
          const dest = path.join(commandsTarget, `${plugin}__${e.name}`);
          if (existsSync(dest)) result.conflicts.push(dest);
          await cp(src, dest, { recursive: true, force: true });
          result.commands++;
        }
      }
    }
  }

  return result;
}
