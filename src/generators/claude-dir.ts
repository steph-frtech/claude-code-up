import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SETTINGS_JSON } from "../templates.js";

export async function generateClaudeDir(opts: { targetPath: string }): Promise<void> {
  const claudeDir = path.join(opts.targetPath, ".claude");
  await mkdir(claudeDir, { recursive: true });
  await mkdir(path.join(claudeDir, "skills"), { recursive: true });
  await mkdir(path.join(claudeDir, "agents"), { recursive: true });
  await writeFile(path.join(claudeDir, "settings.json"), SETTINGS_JSON, "utf8");
}
