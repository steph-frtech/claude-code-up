import { execa } from "execa";
import * as gh from "../lib/gh.js";
import type { GitHubAnswers } from "../types.js";

export async function cloneFromGitHub(opts: {
  targetPath: string;
  github: GitHubAnswers;
}): Promise<void> {
  await gh.cloneRepoToDir({
    owner: opts.github.owner,
    name: opts.github.repoName,
    dest: opts.targetPath,
  });
}

async function currentBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execa("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd,
    });
    return stdout.trim() || "main";
  } catch {
    return "main";
  }
}

export async function pushToGitHub(opts: {
  targetPath: string;
  github: GitHubAnswers;
}): Promise<{ url: string }> {
  const cwd = opts.targetPath;
  const remoteUrl = `https://github.com/${opts.github.owner}/${opts.github.repoName}.git`;

  if (opts.github.mode === "create-new") {
    try {
      await execa("git", ["remote", "add", "origin", remoteUrl], { cwd });
    } catch {
      await execa("git", ["remote", "set-url", "origin", remoteUrl], { cwd });
    }
  }

  await execa("git", ["add", "."], { cwd });

  const commitMsg =
    opts.github.mode === "clone-existing"
      ? "Add claude-code-up config and Claude stack"
      : "Initial commit";

  try {
    await execa("git", ["commit", "-m", commitMsg, "--quiet"], { cwd });
  } catch {
    // Nothing to commit (e.g., cloned repo unchanged) — proceed without failing.
  }

  const branch = await currentBranch(cwd);

  if (opts.github.mode === "create-new") {
    await execa("git", ["push", "-u", "origin", branch], { cwd });
  } else {
    await execa("git", ["push", "origin", branch], { cwd });
  }

  const { stdout } = await execa("git", ["remote", "get-url", "origin"], { cwd });
  const url = stdout.trim().replace(/\.git$/, "");
  return { url };
}
