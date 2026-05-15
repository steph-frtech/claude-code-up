import { execa } from "execa";
import type { GitHubVisibility } from "../types.js";

export const INSTALL_HINT =
  "gh CLI is required for the GitHub flow. Install from https://cli.github.com/\n" +
  "  macOS:   brew install gh\n" +
  "  Linux:   sudo apt install gh   (or your distro's package manager)\n" +
  "  Windows: winget install GitHub.cli";

export async function isInstalled(): Promise<boolean> {
  try {
    await execa("gh", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function isAuthed(): Promise<boolean> {
  try {
    await execa("gh", ["auth", "status", "--hostname", "github.com"]);
    return true;
  } catch {
    return false;
  }
}

export async function login(): Promise<void> {
  await execa("gh", ["auth", "login"], { stdio: "inherit" });
}

export async function getCurrentUser(): Promise<string | null> {
  try {
    const { stdout } = await execa("gh", ["api", "user", "--jq", ".login"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function repoExists(owner: string, name: string): Promise<boolean> {
  try {
    await execa("gh", ["repo", "view", `${owner}/${name}`]);
    return true;
  } catch {
    return false;
  }
}

export interface CreateEmptyRepoOptions {
  name: string;
  visibility: GitHubVisibility;
  description?: string;
}

export async function createEmptyRepo(
  opts: CreateEmptyRepoOptions,
): Promise<{ url: string }> {
  const args = ["repo", "create", opts.name, `--${opts.visibility}`];
  if (opts.description) {
    args.push("--description", opts.description);
  }
  await execa("gh", args);
  const { stdout } = await execa("gh", [
    "repo",
    "view",
    opts.name,
    "--json",
    "url",
    "--jq",
    ".url",
  ]);
  return { url: stdout.trim() };
}

export async function cloneRepoToDir(opts: {
  owner: string;
  name: string;
  dest: string;
}): Promise<void> {
  await execa("gh", ["repo", "clone", `${opts.owner}/${opts.name}`, opts.dest]);
}
