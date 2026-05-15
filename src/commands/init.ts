import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execa } from "execa";
import type { InitOptions } from "../types.js";
import { askProject } from "../prompts/project.js";
import { confirmPlan } from "../prompts/confirm.js";
import { generateClaudeDir } from "../generators/claude-dir.js";
import { generateClaudeMd } from "../generators/claude-md.js";
import { generateGitignore } from "../generators/gitignore.js";
import { initGit } from "../generators/git.js";
import { pushToGitHub, cloneFromGitHub } from "../generators/github.js";
import { applyStack } from "../generators/stack.js";
import { applyMcp } from "../generators/mcp.js";
import { getKarpathyClaudeMd } from "../stack/karpathy.js";
import { summarizeTotals } from "../stack/render.js";

const MIN_CLAUDE_VERSION = "2.1.32";

async function getClaudeVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa("claude", ["--version"]);
    const match = stdout.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

async function isClaudeInstalled(): Promise<boolean> {
  return (await getClaudeVersion()) !== null;
}

async function runNpmInstallClaude(
  channel: "stable" | "latest",
): Promise<boolean> {
  const spec = `@anthropic-ai/claude-code@${channel}`;
  try {
    await execa("npm", ["install", "-g", spec], { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

async function pickChannel(): Promise<"stable" | "latest" | null> {
  const choice = await p.select({
    message: "Which Claude Code channel?",
    initialValue: "stable" as const,
    options: [
      {
        value: "stable" as const,
        label: "Stable (recommended — tested, fewer bugs)",
      },
      {
        value: "latest" as const,
        label: "Latest (cutting-edge — newest features, may regress)",
      },
    ],
  });
  if (p.isCancel(choice)) return null;
  return choice;
}

async function preflightClaudeCode(): Promise<void> {
  const version = await getClaudeVersion();

  if (version === null) {
    p.log.warn("Claude Code CLI not detected on this system.");
    const install = await p.confirm({
      message: "Install Claude Code now?",
      initialValue: true,
    });
    if (p.isCancel(install) || install !== true) return;
    const channel = await pickChannel();
    if (channel === null) return;
    const s = p.spinner();
    s.start(`Installing Claude Code (${channel} channel)`);
    const ok = await runNpmInstallClaude(channel);
    s.stop(ok ? `Claude Code installed (${channel})` : "Install failed");
    if (!ok) {
      p.log.warn(
        `Try manually: npm install -g @anthropic-ai/claude-code@${channel} (may need sudo)`,
      );
    }
    return;
  }

  if (compareVersions(version, MIN_CLAUDE_VERSION) < 0) {
    p.log.warn(
      `Claude Code ${version} is below ${MIN_CLAUDE_VERSION} (required for Agent Teams and some features).`,
    );
    const upgrade = await p.confirm({
      message: "Upgrade Claude Code?",
      initialValue: true,
    });
    if (p.isCancel(upgrade) || upgrade !== true) return;
    const channel = await pickChannel();
    if (channel === null) return;
    const s = p.spinner();
    s.start(`Upgrading Claude Code to ${channel}`);
    const ok = await runNpmInstallClaude(channel);
    s.stop(ok ? `Claude Code upgraded (${channel})` : "Upgrade failed");
  } else {
    p.log.info(`Claude Code ${pc.cyan(version)} detected.`);
  }
}

async function runClaudeDoctorInteractive(
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  try {
    await execa("claude", ["doctor"], {
      cwd,
      env,
      stdio: "inherit",
    });
  } catch {
    // claude doctor exits non-zero on dismiss in some versions — ignore.
  }
}

export async function init(opts: InitOptions): Promise<void> {
  p.intro(`${pc.bgCyan(pc.black(" ccup "))} ${pc.cyan("Claude Code Up")}`);

  await preflightClaudeCode();

  const answers = await askProject({
    defaultDir: opts.targetDir,
    force: opts.force ?? false,
  });

  if (answers === null) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  const targetPath = path.resolve(answers.dir);

  const proceed = await confirmPlan({
    projectName: answers.name,
    targetPath,
    initGit: answers.initGit,
    funnel: answers.funnel,
    scaffolder: answers.scaffolder,
    github: answers.github,
    stack: answers.stack,
    mcp: answers.mcp,
    wipeMode: answers.wipeMode,
    existingEntries: answers.existingEntries,
  });

  if (!proceed) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  const s = p.spinner();

  if (answers.wipeMode === "wipe" && answers.existingEntries) {
    s.start(`Wiping ${answers.existingEntries} entries in ${targetPath}`);
    const entries = await readdir(targetPath);
    for (const e of entries) {
      await rm(path.join(targetPath, e), { recursive: true, force: true });
    }
    s.stop(`Wiped ${answers.existingEntries} entries`);
  }

  const mergeMode = answers.wipeMode === "merge";

  if (answers.github?.mode === "clone-existing") {
    s.start(`Cloning ${answers.github.owner}/${answers.github.repoName}`);
    await cloneFromGitHub({ targetPath, github: answers.github });
    s.stop(`Cloned into ${path.relative(process.cwd(), targetPath) || "."}`);
  } else {
    await mkdir(targetPath, { recursive: true });
  }

  // Run the framework scaffolder BEFORE .claude/ so the scaffolder sees an
  // empty dir (most refuse to run otherwise). Output is streamed via inherit.
  let scaffolderRan = false;
  if (answers.scaffolder) {
    p.log.step(
      `Running ${pc.cyan(`${answers.scaffolder.command} ${answers.scaffolder.args.join(" ")}`)} in ${path.relative(process.cwd(), targetPath) || "."}`,
    );
    try {
      await execa(answers.scaffolder.command, answers.scaffolder.args, {
        cwd: targetPath,
        stdio: "inherit",
      });
      p.log.success("Scaffolder completed");
      scaffolderRan = true;
    } catch (err) {
      p.log.warn(
        `Scaffolder exited with error — continuing with ccup config anyway. (${(err as Error).message.slice(0, 120)})`,
      );
    }
  }

  s.start("Creating .claude/ skeleton");
  await generateClaudeDir({ targetPath });
  s.stop(".claude/ created");

  const wantsKarpathy = answers.stack?.components.includes("karpathy") ?? false;
  let claudeMdContent: string | undefined;
  if (wantsKarpathy) {
    s.start("Fetching Karpathy CLAUDE.md");
    const k = await getKarpathyClaudeMd();
    claudeMdContent = k.content;
    s.stop(
      k.source === "remote"
        ? "Karpathy CLAUDE.md fetched"
        : "Karpathy CLAUDE.md (bundled snapshot — fetch failed)",
    );
  }

  const cloneMode = answers.github?.mode === "clone-existing";
  const preserve = cloneMode || mergeMode || scaffolderRan;

  s.start("Writing CLAUDE.md");
  const cmdResult = await generateClaudeMd({
    targetPath,
    projectName: answers.name,
    content: claudeMdContent,
    preserveExisting: preserve,
  });
  s.stop(
    cmdResult.written
      ? "CLAUDE.md written"
      : `CLAUDE.md preserved (${cmdResult.reason ?? "existing"})`,
  );

  s.start("Writing .gitignore");
  const giResult = await generateGitignore({
    targetPath,
    preserveExisting: preserve,
  });
  s.stop(giResult.written ? ".gitignore written" : ".gitignore preserved (existing)");

  let stackReport = null;
  if (answers.stack && answers.stack.components.length > 0) {
    s.start("Applying Claude stack");
    stackReport = await applyStack({
      targetPath,
      components: answers.stack.components,
      wshobsonAgents: answers.stack.wshobsonAgents,
      pocockSkills: answers.stack.pocockSkills,
      superpowersSkills: answers.stack.superpowersSkills,
    });
    s.stop(
      stackReport
        ? `Stack applied — ${summarizeTotals(stackReport)}`
        : "Stack applied",
    );
  }

  let mcpResult = null;
  if (answers.mcp && answers.mcp.servers.length > 0) {
    s.start(`Writing .mcp.json (${answers.mcp.servers.length} servers)`);
    mcpResult = await applyMcp({
      targetPath,
      servers: answers.mcp.servers,
      envVars: answers.mcp.envVars,
    });
    s.stop(`.mcp.json written (${answers.mcp.servers.length} servers)`);
    if (mcpResult && mcpResult.verifications.length > 0) {
      const ok = mcpResult.verifications.filter((v) => v.status === "ok").length;
      const failed = mcpResult.verifications.filter((v) => v.status === "failed").length;
      const skipped = mcpResult.verifications.filter((v) => v.status === "skipped").length;
      p.log.step(
        `MCP initialize handshake: ${pc.green(`${ok} ok`)} · ${pc.red(`${failed} failed`)} · ${pc.yellow(`${skipped} skipped`)}`,
      );
    }
  }

  if (answers.initGit && answers.github?.mode !== "clone-existing") {
    s.start("Initializing git repository");
    await initGit({ targetPath });
    s.stop("git repository initialized");
  }

  let repoUrl: string | undefined;
  if (answers.github) {
    const action =
      answers.github.mode === "clone-existing"
        ? `Pushing updates to ${answers.github.owner}/${answers.github.repoName}`
        : `Pushing initial commit to ${answers.github.owner}/${answers.github.repoName}`;
    s.start(action);
    const result = await pushToGitHub({ targetPath, github: answers.github });
    repoUrl = result.url;
    s.stop(`Repo: ${result.url}`);
  }

  const rel = path.relative(process.cwd(), targetPath) || ".";
  const summary: string[] = [
    `${pc.bold("Location:")} ${targetPath}`,
  ];
  if (repoUrl) summary.push(`${pc.bold("Repo:")} ${repoUrl}`);
  if (stackReport) {
    summary.push(`${pc.bold("Stack:")} ${summarizeTotals(stackReport)}`);
    const failed = stackReport.components.filter(
      (c) => c.scope === "project" && !c.installed,
    );
    if (failed.length > 0) {
      summary.push(
        `${pc.yellow("⚠ Failed installs:")} ${failed.map((c) => c.id).join(", ")}`,
      );
    } else {
      summary.push(
        `${pc.green("✓ All project-scope components verified.")}`,
      );
    }
    summary.push(`${pc.dim("Details: STACK.md and .claude/stack.json")}`);
  }
  if (mcpResult) {
    summary.push(
      `${pc.bold("MCP:")} ${mcpResult.serverCount} servers in .mcp.json` +
        (mcpResult.envFileWritten ? pc.dim(" · creds in .env") : ""),
    );
    for (const v of mcpResult.verifications) {
      const mark =
        v.status === "ok" ? pc.green("✓")
        : v.status === "failed" ? pc.red("✗")
        : pc.yellow("○");
      const detail = v.error ? pc.dim(` — ${v.error}`) : "";
      summary.push(`    ${mark} ${v.server}${detail}`);
    }
    if (mcpResult.missingEnvVars.length > 0) {
      summary.push(
        `${pc.yellow("⚠ Still missing env vars:")} ${mcpResult.missingEnvVars.join(", ")}`,
      );
    }
    if (mcpResult.envFileWritten) {
      summary.push(
        pc.dim("ccup loaded .env automatically for the verification and the claude launch below."),
      );
      summary.push(
        pc.dim("For future shell sessions, source .env yourself (or use direnv / a launcher)."),
      );
    }
  }
  p.note(summary.join("\n"), pc.green("Done"));

  const initChoice = await p.select({
    message: "Run /init now in the new project?",
    initialValue: "headless" as const,
    options: [
      {
        value: "headless" as const,
        label: "Headless (auto-run /init, no UI, capture output)",
      },
      {
        value: "interactive" as const,
        label: "Interactive (open Claude Code, type /init yourself)",
      },
      { value: "skip" as const, label: "Skip" },
    ],
  });

  if (!p.isCancel(initChoice) && initChoice !== "skip") {
    const claudeAvailable = await isClaudeInstalled();
    if (!claudeAvailable) {
      p.log.warn(
        "Claude Code CLI not found. Install from https://claude.com/claude-code",
      );
    } else {
      // Use the merged env from applyMcp (.env on disk + freshly prompted vars).
      const claudeEnv = mcpResult
        ? { ...process.env, ...mcpResult.resolvedEnv }
        : answers.mcp
          ? { ...process.env, ...answers.mcp.envVars }
          : process.env;
      if (initChoice === "headless") {
        s.start(`Running ${pc.cyan("claude -p /init")} in ${rel}`);
        try {
          const result = await execa("claude", ["-p", "/init"], {
            cwd: targetPath,
            env: claudeEnv,
            timeout: 180_000,
          });
          s.stop("/init completed");
          const out = result.stdout.trim();
          const lines = out.split("\n");
          const tail = lines.slice(-15).join("\n");
          p.note(tail || "(no output)", "/init output (last 15 lines)");
        } catch (err) {
          s.stop("/init failed");
          const msg = (err as Error).message;
          p.log.error(msg.length > 500 ? msg.slice(0, 500) + "…" : msg);
        }
      } else {
        p.log.step(`Launching ${pc.cyan("claude")} in ${rel} — type ${pc.cyan("/init")} to verify`);
        try {
          await execa("claude", [], {
            cwd: targetPath,
            env: claudeEnv,
            stdio: "inherit",
          });
        } catch {
          // claude exit (Ctrl+D / /quit) raises non-zero on some flows — ignore.
        }
      }
    }
  }

  // ccup-side diagnostic summary (we already verified everything during generation).
  const ccupDiag: string[] = [];
  if (stackReport) {
    const projectComps = stackReport.components.filter((c) => c.scope === "project");
    const okComps = projectComps.filter((c) => c.installed);
    ccupDiag.push(
      `${pc.green("✓")} stack components: ${okComps.length}/${projectComps.length} verified`,
    );
    for (const c of projectComps) {
      if (!c.installed) {
        ccupDiag.push(`${pc.red("✗")} ${c.id}: not fully installed${c.error ? ` (${c.error})` : ""}`);
      }
    }
  }
  if (mcpResult) {
    const ok = mcpResult.verifications.filter((v) => v.status === "ok").length;
    const total = mcpResult.verifications.length;
    ccupDiag.push(
      `${ok === total ? pc.green("✓") : pc.yellow("⚠")} MCP handshake: ${ok}/${total} servers ok`,
    );
    for (const v of mcpResult.verifications) {
      if (v.status === "failed") {
        ccupDiag.push(`${pc.red("✗")} mcp/${v.server}: ${v.error ?? "failed"}`);
      } else if (v.status === "skipped") {
        ccupDiag.push(`${pc.yellow("○")} mcp/${v.server}: skipped (${v.error ?? "missing creds"})`);
      }
    }
  }
  if (ccupDiag.length > 0) {
    p.note(ccupDiag.join("\n"), "ccup diagnostic");
  }

  // Offer the official Claude Code doctor (interactive panel, needs TTY).
  if (await isClaudeInstalled()) {
    const runDoctor = await p.confirm({
      message: `Also run ${pc.cyan("claude doctor")} (interactive — Claude Code's own diagnostic panel)?`,
      initialValue: true,
    });
    if (!p.isCancel(runDoctor) && runDoctor === true) {
      const doctorEnv = mcpResult
        ? { ...process.env, ...mcpResult.resolvedEnv }
        : process.env;
      p.log.step("Launching claude doctor — press Esc / Enter inside to return");
      await runClaudeDoctorInteractive(targetPath, doctorEnv);
    }
  }

  p.outro(
    `${pc.bold("cd")} ${pc.cyan(rel)} — happy hacking.`,
  );
}
