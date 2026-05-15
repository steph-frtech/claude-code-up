import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { CLAUDE_MD } from "../templates.js";

export async function generateClaudeMd(opts: {
  targetPath: string;
  projectName: string;
  content?: string;
  preserveExisting?: boolean;
}): Promise<{ written: boolean; reason?: string }> {
  const dest = path.join(opts.targetPath, "CLAUDE.md");
  if (opts.preserveExisting && existsSync(dest) && opts.content === undefined) {
    return { written: false, reason: "existing CLAUDE.md preserved" };
  }
  const content = opts.content
    ? opts.content
    : CLAUDE_MD.replaceAll("{{projectName}}", opts.projectName);
  await writeFile(dest, content, "utf8");
  return { written: true };
}
