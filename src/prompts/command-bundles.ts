import * as p from "@clack/prompts";
import pc from "picocolors";
import type { CommandBundlesAnswer } from "../types.js";
import { COMMAND_BUNDLES } from "../catalog/loader.js";
import { matchesApplyWhen, formatTrigger } from "../stack/decision-tree.js";
import type { FunnelAnswers } from "./funnel.js";

export async function askCommandBundles(
  funnel: FunnelAnswers | undefined,
): Promise<CommandBundlesAnswer | null> {
  if (!funnel) return { bundleIds: [] };

  const matching = COMMAND_BUNDLES.filter((b) =>
    matchesApplyWhen(b.applyWhen, funnel),
  );

  if (matching.length === 0) return { bundleIds: [] };

  const options = matching.map((b) => {
    const cmdCount = b.commands.length;
    const trigger = formatTrigger({
      id: b.id,
      kind: "command",
      tier: "conditional",
      applyWhen: b.applyWhen,
    });
    return {
      value: b.id,
      label: `${b.name} ${pc.dim(`(${cmdCount} cmd${cmdCount > 1 ? "s" : ""})`)} ${pc.yellow(`[${trigger}]`)}`,
      hint: b.description,
    };
  });

  const selected = await p.multiselect<string>({
    message:
      "Run init commands for your stack? (space to toggle, enter to confirm)",
    options: options as unknown as Parameters<typeof p.multiselect<string>>[0]["options"],
    initialValues: matching.map((b) => b.id),
    required: false,
  });
  if (p.isCancel(selected)) return null;
  return { bundleIds: selected as string[] };
}
