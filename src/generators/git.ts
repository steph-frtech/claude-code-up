import { execa } from "execa";

export async function initGit(opts: { targetPath: string }): Promise<void> {
  await execa("git", ["init", "--quiet"], { cwd: opts.targetPath });
}
