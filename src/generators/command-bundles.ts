import { execa } from "execa";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { COMMAND_BUNDLES } from "../catalog/loader.js";

export interface BundleResult {
  bundleId: string;
  bundleName: string;
  commandCount: number;
  ok: number;
  failed: number;
  errors: string[];
}

function splitCommand(cmd: string): { command: string; args: string[] } {
  // Very small splitter — handles tokens separated by spaces. Quoted args
  // would need more care but our bundles avoid them.
  const tokens = cmd.split(/\s+/).filter(Boolean);
  return { command: tokens[0], args: tokens.slice(1) };
}

export async function applyCommandBundles(opts: {
  targetPath: string;
  bundleIds: string[];
}): Promise<BundleResult[]> {
  const results: BundleResult[] = [];
  if (opts.bundleIds.length === 0) return results;

  for (const id of opts.bundleIds) {
    const bundle = COMMAND_BUNDLES.find((b) => b.id === id);
    if (!bundle) continue;

    p.log.step(
      `Running bundle ${pc.cyan(bundle.name)} ${pc.dim(`(${bundle.commands.length} commands)`)}`,
    );

    const result: BundleResult = {
      bundleId: bundle.id,
      bundleName: bundle.name,
      commandCount: bundle.commands.length,
      ok: 0,
      failed: 0,
      errors: [],
    };

    for (const cmd of bundle.commands) {
      const { command, args } = splitCommand(cmd.exec);
      p.log.message(pc.dim(`  $ ${cmd.exec}${cmd.desc ? ` ${pc.dim(`# ${cmd.desc}`)}` : ""}`));
      try {
        await execa(command, args, {
          cwd: opts.targetPath,
          stdio: "inherit",
          timeout: 300_000,
        });
        result.ok++;
      } catch (err) {
        result.failed++;
        const msg = (err as Error).message.split("\n")[0].slice(0, 200);
        result.errors.push(`${cmd.exec} → ${msg}`);
        p.log.warn(`Failed: ${cmd.exec}`);
      }
    }

    if (result.failed === 0) {
      p.log.success(`Bundle ${bundle.name}: ${result.ok}/${result.commandCount} ok`);
    } else {
      p.log.warn(
        `Bundle ${bundle.name}: ${pc.yellow(`${result.ok} ok`)} · ${pc.red(`${result.failed} failed`)}`,
      );
    }
    results.push(result);
  }

  return results;
}
