import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { GITIGNORE } from "../templates.js";

export async function generateGitignore(opts: {
  targetPath: string;
  preserveExisting?: boolean;
}): Promise<{ written: boolean }> {
  const dest = path.join(opts.targetPath, ".gitignore");
  if (opts.preserveExisting && existsSync(dest)) {
    return { written: false };
  }
  await writeFile(dest, GITIGNORE, "utf8");
  return { written: true };
}
