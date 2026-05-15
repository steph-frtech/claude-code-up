import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import type { ProjectAnswers, WipeMode } from "../types.js";
import { askGitHub } from "./github.js";
import { askStack } from "./stack.js";
import { askMcp } from "./mcp.js";
import { askFunnel } from "./funnel.js";
import { askScaffolder } from "./scaffolder.js";
import { askCommandBundles } from "./command-bundles.js";

export interface AskProjectOptions {
  defaultDir?: string;
  force: boolean;
}

const NAME_RE = /^[a-zA-Z0-9._-]+$/;

export async function askProject(
  opts: AskProjectOptions,
): Promise<ProjectAnswers | null> {
  const defaultName = opts.defaultDir
    ? path.basename(path.resolve(opts.defaultDir))
    : undefined;

  const name = await p.text({
    message: "Project name?",
    placeholder: "my-app",
    initialValue: defaultName,
    validate: (v) => {
      if (!v) return "Required";
      if (!NAME_RE.test(v)) return "Use letters, digits, '.', '_' or '-' only";
      return undefined;
    },
  });

  if (p.isCancel(name)) return null;

  const dir = await p.text({
    message: "Target directory?",
    initialValue: opts.defaultDir ?? `../${name}`,
    validate: (v) => {
      if (!v) return "Required";
      return undefined;
    },
  });

  if (p.isCancel(dir)) return null;

  const abs = path.resolve(dir);
  p.log.info(`Target resolved to: ${pc.cyan(abs)}`);

  let wipeMode: WipeMode | undefined;
  let existingEntries: number | undefined;
  if (existsSync(abs)) {
    let entries: string[] = [];
    try {
      entries = readdirSync(abs);
    } catch {
      p.log.error(`Cannot read directory: ${abs}`);
      return null;
    }
    if (entries.length > 0) {
      existingEntries = entries.length;
      if (opts.force) {
        wipeMode = "wipe";
        p.log.warn(
          `${pc.red("--force")} active — will wipe ${entries.length} existing entries before generating.`,
        );
      } else {
        const choice = await p.select({
          message: `${pc.yellow(abs)} is not empty (${entries.length} entries). What do you want to do?`,
          options: [
            {
              value: "merge" as const,
              label: "Keep existing files, add claude-code-up config on top",
            },
            {
              value: "wipe" as const,
              label: "Wipe and regenerate (destructive)",
            },
            { value: "abort" as const, label: "Cancel" },
          ],
          initialValue: "merge" as const,
        });
        if (p.isCancel(choice) || choice === "abort") return null;
        wipeMode = choice;
      }
    }
  }

  const initGit = await p.confirm({
    message: "Initialize a git repository?",
    initialValue: true,
  });

  if (p.isCancel(initGit)) return null;

  const github = initGit ? await askGitHub({ projectName: name }) : null;

  // Funnel FIRST: category → language → framework → DB → ORM.
  // The choices then drive sensible defaults for stack and MCP prompts.
  const funnel = await askFunnel();
  if (funnel === null) return null;

  // Scaffolder proposal — runs BEFORE claude-code-up config (creates the base project).
  const scaffolderChoice = await askScaffolder(funnel);
  if (scaffolderChoice === null) return null;
  const scaffolder = scaffolderChoice === "skip" ? undefined : scaffolderChoice;

  const stack = await askStack(funnel);
  if (stack === null) return null;

  const mcp = await askMcp(funnel);
  if (mcp === null) return null;

  const commandBundles = await askCommandBundles(funnel, mcp.servers);
  if (commandBundles === null) return null;

  return {
    name,
    dir,
    initGit,
    funnel:
      funnel.categories.length +
        funnel.languages.length +
        funnel.frameworks.length +
        funnel.databases.length +
        funnel.orms.length >
      0
        ? funnel
        : undefined,
    scaffolder,
    commandBundles:
      commandBundles.bundleIds.length > 0 ? commandBundles : undefined,
    github: github ?? undefined,
    stack: stack.components.length > 0 ? stack : undefined,
    mcp: mcp.servers.length > 0 ? mcp : undefined,
    wipeMode,
    existingEntries,
  };
}
