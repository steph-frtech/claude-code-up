import * as p from "@clack/prompts";
import pc from "picocolors";
import type { CommandBundlesAnswer } from "../types.js";
import { COMMAND_BUNDLES } from "../catalog/loader.js";
import { matchesApplyWhen, formatTrigger } from "../stack/decision-tree.js";
import type { FunnelAnswers } from "./funnel.js";

/**
 * A bundle matches when:
 *  1. Its applyWhen funnel rules pass (categories/languages/frameworks/databases/orms), AND
 *  2. If applyWhen.mcps is set, the user picked at least one of those MCPs.
 *
 * The `mcps` gate is what stops e.g. `expo-revenuecat` from auto-running
 * when the user didn't pick the RevenueCat MCP in the previous step.
 */
function bundleMatchesContext(
  bundle: (typeof COMMAND_BUNDLES)[number],
  funnel: FunnelAnswers,
  mcpIds: string[],
): boolean {
  if (!matchesApplyWhen(bundle.applyWhen, funnel)) return false;
  const wantedMcps = (bundle.applyWhen as { mcps?: string[] } | undefined)?.mcps;
  if (wantedMcps && wantedMcps.length > 0) {
    if (!wantedMcps.some((id) => mcpIds.includes(id))) return false;
  }
  return true;
}

export async function askCommandBundles(
  funnel: FunnelAnswers | undefined,
  mcpIds: string[] = [],
): Promise<CommandBundlesAnswer | null> {
  if (!funnel) return { bundleIds: [] };

  // Visible = funnel+mcp-matched bundles + opt-in ones (empty applyWhen).
  // Preselected = only the matched ones. Opt-in bundles must be toggled by
  // the user (e.g. Prettier+ESLint when Biome is the default).
  const isOptIn = (b: (typeof COMMAND_BUNDLES)[number]) =>
    b.applyWhen !== undefined && Object.keys(b.applyWhen).length === 0;
  const matching = COMMAND_BUNDLES.filter((b) =>
    bundleMatchesContext(b, funnel, mcpIds),
  );
  const visible = COMMAND_BUNDLES.filter(
    (b) => bundleMatchesContext(b, funnel, mcpIds) || isOptIn(b),
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
