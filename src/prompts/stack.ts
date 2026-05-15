import * as p from "@clack/prompts";
import pc from "picocolors";
import type { StackAnswers, StackComponent, FunnelAnswers } from "../types.js";
import { COMPONENTS } from "../stack/manifest.js";
import { resolveForSource, formatTrigger } from "../stack/decision-tree.js";
import {
  tristateMultiselect,
  type Tristate,
} from "./tristate-multiselect.js";

function logPicked(name: string, picked: string[], total: number): void {
  const ratio = `${picked.length}/${total}`;
  const tag =
    picked.length === total
      ? pc.green(ratio)
      : picked.length === 0
        ? pc.red(ratio)
        : pc.yellow(ratio);
  p.log.info(`${name}: ${tag} picked`);
  if (picked.length === 0) return;
  const preview = picked.slice(0, 8).join(", ");
  const rest = picked.length > 8 ? `, +${picked.length - 8} more` : "";
  p.log.message(pc.dim(`  ${preview}${rest}`));
}

function tierTag(tier: string): string {
  if (tier === "default") return pc.green("[default]");
  if (tier === "conditional") return pc.yellow("[conditional]");
  return pc.red("[skip]");
}

function triggerLabel(triggerText: string, tier: string): string {
  if (tier === "default") return pc.green(`[${triggerText}]`);
  if (tier === "skip") return pc.red(`[${triggerText}]`);
  return pc.yellow(`[${triggerText}]`);
}

async function drillSource(
  source: "wshobson" | "superpowers" | "pocock",
  funnel: FunnelAnswers | undefined,
  current: string[] | undefined,
): Promise<{ picked: string[]; total: number } | null> {
  const resolved = resolveForSource(source, funnel);
  const initial =
    current !== undefined
      ? current
      : resolved.preChecked.map((it) => it.id);

  const options = resolved.visible.map((it) => {
    const trigger = formatTrigger(it);
    const triggerStr = triggerLabel(trigger, it.tier);
    const desc = it.description ? ` ${pc.dim("— " + it.description)}` : "";
    return {
      value: it.id,
      label: `${it.id} ${triggerStr}${desc}`,
      hint: tierTag(it.tier),
    };
  });

  const picked = await p.multiselect({
    message: `Pick ${source} items (default + matching conditional pre-checked):`,
    options,
    initialValues: initial,
    required: false,
  });
  if (p.isCancel(picked)) return null;
  return {
    picked: picked as string[],
    total: resolved.visible.length,
  };
}

export async function askStack(
  funnel?: FunnelAnswers,
): Promise<StackAnswers | null> {
  // Pre-compute defaults per source from the decision tree.
  const wshobsonResolved = resolveForSource("wshobson", funnel);
  const superpowersResolved = resolveForSource("superpowers", funnel);
  const pocockResolved = resolveForSource("pocock", funnel);

  let wshobsonAgents: string[] | undefined = wshobsonResolved.preChecked.map(
    (i) => i.id,
  );
  let wshobsonTotal: number | undefined = wshobsonResolved.visible.length;
  let superpowersSkills: string[] | undefined =
    superpowersResolved.preChecked.map((i) => i.id);
  let superpowersTotal: number | undefined = superpowersResolved.visible.length;
  let pocockSkills: string[] | undefined = pocockResolved.preChecked.map(
    (i) => i.id,
  );
  let pocockTotal: number | undefined = pocockResolved.visible.length;

  const partialFor = (picked?: string[], total?: number): boolean =>
    picked !== undefined &&
    total !== undefined &&
    picked.length > 0 &&
    picked.length < total;

  const initialStates = new Map<StackComponent, Tristate>();
  if (partialFor(wshobsonAgents, wshobsonTotal)) initialStates.set("wshobson", "partial");
  if (partialFor(superpowersSkills, superpowersTotal))
    initialStates.set("superpowers", "partial");
  if (partialFor(pocockSkills, pocockTotal))
    initialStates.set("pocock", "partial");

  const result = await tristateMultiselect<StackComponent>({
    message:
      "Claude stack — D on wshobson / superpowers / pocock to customize:",
    options: COMPONENTS.map((c) => ({
      value: c.id,
      label: c.name,
      hint: `→ ${c.hint}`,
    })),
    initialValues: COMPONENTS.map((c) => c.id),
    initialStates,
    onDrill: async (id, currentState) => {
      if (id === "wshobson") {
        const res = await drillSource("wshobson", funnel, wshobsonAgents);
        if (res === null) return currentState;
        wshobsonAgents = res.picked;
        wshobsonTotal = res.total;
        logPicked("wshobson", res.picked, res.total);
        if (res.picked.length === 0) return "off";
        if (res.picked.length === res.total) return "on";
        return "partial";
      }
      if (id === "superpowers") {
        const res = await drillSource("superpowers", funnel, superpowersSkills);
        if (res === null) return currentState;
        superpowersSkills = res.picked;
        superpowersTotal = res.total;
        logPicked("superpowers", res.picked, res.total);
        if (res.picked.length === 0) return "off";
        if (res.picked.length === res.total) return "on";
        return "partial";
      }
      if (id === "pocock") {
        const res = await drillSource("pocock", funnel, pocockSkills);
        if (res === null) return currentState;
        pocockSkills = res.picked;
        pocockTotal = res.total;
        logPicked("pocock", res.picked, res.total);
        if (res.picked.length === 0) return "off";
        if (res.picked.length === res.total) return "on";
        return "partial";
      }
      return currentState;
    },
  });

  if (typeof result === "symbol") return null;
  const components = result.values;

  if (components.includes("agent-teams")) {
    p.log.warn(
      "Agent Teams is a research preview. Requires Claude Code ≥2.1.32, Opus 4.6+, and Pro/Max plan.",
    );
  }

  return {
    components,
    wshobsonAgents,
    wshobsonTotal,
    superpowersSkills,
    superpowersTotal,
    pocockSkills,
    pocockTotal,
  };
}
