import { MultiSelectPrompt } from "@clack/core";
import pc from "picocolors";

export type Tristate = "off" | "partial" | "on";

export interface TristateOpt<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface TristateMultiselectArgs<T> {
  message: string;
  options: TristateOpt<T>[];
  initialValues?: T[];
  initialStates?: Map<T, Tristate>;
  onDrill?: (value: T, currentState: Tristate) => Promise<Tristate>;
}

export interface TristateResult<T> {
  values: T[];
  states: Map<T, Tristate>;
}

/**
 * Tri-state multi-select with D-key drill-down.
 *
 *   ●  green   = fully selected (on)
 *   ◐  yellow  = partially selected (drill returned a subset)
 *   ○  dim     = not selected (off)
 *
 *   Space      → toggle on/off
 *   D          → call onDrill on the cursor's item; the returned Tristate
 *                replaces the item's state. The prompt closes and re-opens
 *                with the updated state visible.
 *   Enter      → submit
 *   Esc / C-c  → cancel
 *
 * Implementation detail: @clack/core does not allow suspending a prompt to
 * run nested prompts, so D submits the current frame, the drill sub-prompt
 * runs in isolation, then a fresh prompt instance is created with carried-over
 * selection + states. Visually it's a brief redraw, not a flicker users
 * typically notice.
 */
export async function tristateMultiselect<T>(
  args: TristateMultiselectArgs<T>,
): Promise<TristateResult<T> | symbol> {
  let currentValues: Set<T> = new Set(args.initialValues ?? []);
  const states = new Map<T, Tristate>(args.initialStates ?? []);
  let cursorAt: T | undefined =
    args.options.length > 0 ? args.options[0].value : undefined;

  while (true) {
    let drillFor: T | null = null;

    type Opt = { value: T; label: string; hint?: string };
    const prompt = new MultiSelectPrompt<Opt>({
      options: args.options as Opt[],
      initialValues: Array.from(currentValues),
      required: false,
      cursorAt,
      render() {
        const cursor = (this as unknown as { cursor: number }).cursor;
        const value = ((this as unknown as { value: T[] | undefined }).value ??
          []) as T[];
        const sel = new Set<T>(value);

        const lines: string[] = [];
        lines.push(`${pc.cyan("◆")}  ${args.message}`);
        lines.push(pc.gray("│"));

        for (let i = 0; i < args.options.length; i++) {
          const opt = args.options[i];
          const isCursor = i === cursor;
          const isSel = sel.has(opt.value);
          const st: Tristate =
            states.get(opt.value) ?? (isSel ? "on" : "off");

          let marker: string;
          if (!isSel) {
            marker = pc.dim("○");
          } else if (st === "partial") {
            marker = pc.yellow("◐");
          } else {
            marker = pc.green("●");
          }

          const pointer = isCursor ? pc.cyan("│ ❯") : pc.gray("│  ");
          const label = isCursor ? opt.label : pc.dim(opt.label);
          const hint = opt.hint ? pc.dim(` ${opt.hint}`) : "";
          lines.push(`${pointer} ${marker} ${label}${hint}`);
        }

        lines.push(pc.gray("│"));
        lines.push(
          `${pc.gray("└")}  ${pc.dim("space toggle · d details · enter confirm · esc cancel")}`,
        );

        return lines.join("\n");
      },
    });

    prompt.on("key", (key) => {
      if (key === "d" || key === "D") {
        const cursor = (prompt as unknown as { cursor: number }).cursor;
        const opt = args.options[cursor];
        if (opt && args.onDrill) {
          drillFor = opt.value;
          cursorAt = opt.value;
          // Close prompt cleanly with current value.
          (prompt as unknown as { state: string }).state = "submit";
        }
      }
    });

    const result = await prompt.prompt();
    if (typeof result === "symbol") return result;
    currentValues = new Set(result as unknown as T[]);

    if (drillFor !== null && args.onDrill) {
      const target = drillFor as T;
      const curSt: Tristate = states.get(target) ?? "on";
      const newSt = await args.onDrill(target, curSt);
      states.set(target, newSt);
      if (newSt === "off") currentValues.delete(target);
      else currentValues.add(target);
      continue; // re-open prompt with the updated state
    }

    // Final pass: any selected item without an explicit state defaults to "on"
    for (const v of currentValues) {
      if (!states.has(v)) states.set(v, "on");
    }
    return { values: Array.from(currentValues), states };
  }
}
