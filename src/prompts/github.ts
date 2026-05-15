import * as p from "@clack/prompts";
import pc from "picocolors";
import * as gh from "../lib/gh.js";
import type { GitHubAnswers } from "../types.js";

export interface AskGitHubOptions {
  projectName: string;
}

const NAME_RE = /^[a-zA-Z0-9._-]+$/;

export async function askGitHub(
  opts: AskGitHubOptions,
): Promise<GitHubAnswers | null> {
  const wantsGithub = await p.confirm({
    message: "Use GitHub for this project?",
    initialValue: true,
  });

  if (p.isCancel(wantsGithub) || wantsGithub !== true) return null;

  if (!(await gh.isInstalled())) {
    p.log.error(gh.INSTALL_HINT);
    p.log.warn("Skipping GitHub setup. Local git repo will still be initialized.");
    return null;
  }

  if (!(await gh.isAuthed())) {
    p.log.step(`Running ${pc.cyan("gh auth login")}…`);
    try {
      await gh.login();
    } catch {
      p.log.error("gh auth login failed or was cancelled.");
      return null;
    }
    if (!(await gh.isAuthed())) {
      p.log.error("Still not authenticated. Skipping GitHub setup.");
      return null;
    }
  }

  const owner = await gh.getCurrentUser();
  if (!owner) {
    p.log.error("Could not determine current GitHub user via gh CLI.");
    return null;
  }

  let repoName = opts.projectName;
  while (true) {
    const nameInput = await p.text({
      message: "Repository name?",
      initialValue: repoName,
      validate: (v) => {
        if (!v) return "Required";
        if (!NAME_RE.test(v)) return "Use letters, digits, '.', '_' or '-' only";
        return undefined;
      },
    });
    if (p.isCancel(nameInput)) return null;
    repoName = nameInput;

    p.log.step(`Checking ${pc.cyan(`${owner}/${repoName}`)} on GitHub…`);
    const exists = await gh.repoExists(owner, repoName);

    if (exists) {
      const useExisting = await p.confirm({
        message: `${pc.cyan(`${owner}/${repoName}`)} already exists. Clone it and add claude-code-up config on top?`,
        initialValue: true,
      });
      if (p.isCancel(useExisting)) return null;
      if (useExisting === true) {
        return {
          mode: "clone-existing",
          owner,
          repoName,
          url: `https://github.com/${owner}/${repoName}`,
        };
      }
      const tryAgain = await p.confirm({
        message: "Try a different repository name?",
        initialValue: true,
      });
      if (p.isCancel(tryAgain) || tryAgain !== true) return null;
      continue;
    }

    const createNow = await p.confirm({
      message: `${pc.cyan(`${owner}/${repoName}`)} doesn't exist. Create it now (will push at the end)?`,
      initialValue: true,
    });
    if (p.isCancel(createNow) || createNow !== true) return null;

    const visibility = await p.select({
      message: "Visibility?",
      initialValue: "private" as const,
      options: [
        { value: "private" as const, label: "Private" },
        { value: "public" as const, label: "Public" },
      ],
    });
    if (p.isCancel(visibility)) return null;

    const description = await p.text({
      message: "Description (optional)?",
      placeholder: "Press enter to skip",
    });
    if (p.isCancel(description)) return null;

    p.log.step(`Creating ${pc.cyan(`${owner}/${repoName}`)} (${visibility})…`);
    try {
      const { url } = await gh.createEmptyRepo({
        name: repoName,
        visibility,
        description: description ? description : undefined,
      });
      p.log.success(`Repo created: ${pc.cyan(url)}`);
      return {
        mode: "create-new",
        owner,
        repoName,
        visibility,
        description: description ? description : undefined,
        url,
      };
    } catch (err) {
      p.log.error(`Failed to create repo: ${(err as Error).message}`);
      return null;
    }
  }
}
