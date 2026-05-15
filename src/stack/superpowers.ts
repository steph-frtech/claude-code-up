import { execa } from "execa";
import { mkdir, readdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO_URL = "https://github.com/obra/superpowers.git";
const REL_DEST = ".claude/marketplaces/superpowers";

export interface SuperpowersResult {
  destDir: string;
  totalFiles: number;
  flatSkills: number;
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

export async function listSuperpowersSkillsViaApi(): Promise<string[] | null> {
  try {
    const { stdout } = await execa("gh", [
      "api",
      "repos/obra/superpowers/contents/skills",
      "--jq",
      '[.[] | select(.type=="dir") | .name] | sort | .[]',
    ]);
    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

export async function installSuperpowers(
  targetPath: string,
  allowedSkills?: string[],
): Promise<SuperpowersResult> {
  const dest = path.join(targetPath, REL_DEST);

  if (!existsSync(dest)) {
    await mkdir(path.dirname(dest), { recursive: true });
    try {
      await execa("git", ["clone", "--depth", "1", REPO_URL, dest], {
        timeout: 60_000,
      });
    } catch (err) {
      return {
        destDir: REL_DEST,
        totalFiles: 0,
        flatSkills: 0,
        error: (err as Error).message,
      };
    }
    await rm(path.join(dest, ".git"), { recursive: true, force: true }).catch(
      () => undefined,
    );
  }

  // Flatten skills/<name>/ → .claude/skills/superpowers__<name>/
  let flatSkills = 0;
  const skillsRoot = path.join(dest, "skills");
  if (existsSync(skillsRoot)) {
    const skillsTarget = path.join(targetPath, ".claude", "skills");
    await mkdir(skillsTarget, { recursive: true });
    const skillDirs = (await readdir(skillsRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .filter((e) => !allowedSkills || allowedSkills.includes(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const s of skillDirs) {
      await cp(
        path.join(skillsRoot, s.name),
        path.join(skillsTarget, `superpowers__${s.name}`),
        { recursive: true, force: true },
      );
      flatSkills++;
    }
  }

  return {
    destDir: REL_DEST,
    totalFiles: await countFiles(dest),
    flatSkills,
  };
}
