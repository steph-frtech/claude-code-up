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

  // Visible = funnel-matched bundles + opt-in legacy ones (empty applyWhen).
  // Preselected = only funnel-matched bundles. Opt-in bundles must be toggled
  // by the user (e.g. Prettier+ESLint when Biome is the default).
  const isOptIn = (b: (typeof COMMAND_BUNDLES)[number]) =>
    b.applyWhen !== undefined && Object.keys(b.applyWhen).length === 0;
  const matching = COMMAND_BUNDLES.filter((b) =>
    matchesApplyWhen(b.applyWhen, funnel),
  );
  const visible = COMMAND_BUNDLES.filter(
    (b) => matchesApplyWhen(b.applyWhen, funnel) || isOptIn(b),
  );

  if (visible.length === 0) return { bundleIds: [] };

  const options = visible.map((b) => {
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
