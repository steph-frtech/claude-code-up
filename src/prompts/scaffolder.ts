import * as p from "@clack/prompts";
import pc from "picocolors";
import { SCAFFOLDERS, type ScaffolderRaw } from "../catalog/loader.js";
import type { FunnelAnswers } from "./funnel.js";

export interface ScaffolderChoice {
  id: string;
  command: string;
  args: string[];
  templateId?: string;
}

function findScaffolders(funnel: FunnelAnswers | undefined): ScaffolderRaw[] {
  if (!funnel || funnel.frameworks.length === 0) return [];
  return SCAFFOLDERS.filter((sc) =>
    sc.matchFrameworks.some((fw) => funnel.frameworks.includes(fw)),
  );
}

async function askTemplate(
  scaffolder: ScaffolderRaw,
): Promise<{ id: string; extraArgs: string[] } | null> {
  const templates = scaffolder.templates ?? [];
  if (templates.length === 0) return { id: "", extraArgs: [] };

  const defaultTemplate = templates.find((t) => t.default) ?? templates[0];
  const options = templates.map((t) => ({
    value: t.id,
    label: t.default ? `${t.name} ${pc.dim("(default)")}` : t.name,
    hint: t.description,
  }));

  const choice = await p.select<string>({
    message: `Which ${scaffolder.name} template?`,
    initialValue: defaultTemplate.id,
    options: options as Parameters<typeof p.select<string>>[0]["options"],
  });
  if (p.isCancel(choice)) return null;
  const picked = templates.find((t) => t.id === choice);
  if (!picked) return { id: "", extraArgs: [] };
  return { id: picked.id, extraArgs: picked.extraArgs };
}

export async function askScaffolder(
  funnel: FunnelAnswers | undefined,
): Promise<ScaffolderChoice | "skip" | null> {
  const matches = findScaffolders(funnel);
  if (matches.length === 0) return "skip";

  // Build the choice list with one option per matching scaffolder + "skip".
  const opts = matches.map((s) => ({
    value: s.id,
    label: `${s.name}  ${pc.dim(`(${s.command} ${s.args.slice(0, 3).join(" ")}${s.args.length > 3 ? "…" : ""})`)}`,
    hint: s.description,
  }));
  opts.push({ value: "__skip__", label: "Skip — don't scaffold (just claude-code-up config)", hint: "" });

  const choice = await p.select<string>({
    message: `Scaffold a starter app for ${funnel?.frameworks.join(" / ")} in this directory?`,
    options: opts as Parameters<typeof p.select<string>>[0]["options"],
  });
  if (p.isCancel(choice)) return null;
  if (choice === "__skip__") return "skip";

  const found = matches.find((s) => s.id === choice);
  if (!found) return "skip";

  const tpl = await askTemplate(found);
  if (tpl === null) return null;

  return {
    id: found.id,
    command: found.command,
    args: [...found.args, ...tpl.extraArgs],
    templateId: tpl.id || undefined,
  };
}
