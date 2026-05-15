import {
  WSHOBSON_ITEMS,
  SUPERPOWERS_ITEMS,
  POCOCK_ITEMS,
  type CatalogItemRaw,
} from "../catalog/loader.js";
import type { FunnelAnswers } from "../prompts/funnel.js";

export type CatalogSource = "wshobson" | "superpowers" | "pocock";

export interface ResolvedSelection {
  default: CatalogItemRaw[];
  conditional: CatalogItemRaw[];
  skip: CatalogItemRaw[];
  visible: CatalogItemRaw[];
  preChecked: CatalogItemRaw[];
}

function itemsFor(source: CatalogSource): ReadonlyArray<CatalogItemRaw> {
  switch (source) {
    case "wshobson":
      return WSHOBSON_ITEMS;
    case "superpowers":
      return SUPERPOWERS_ITEMS;
    case "pocock":
      return POCOCK_ITEMS;
  }
}

function intersects(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return false;
  return a.some((x) => b.includes(x));
}

/**
 * Matches an item's applyWhen against a funnel.
 *   - applyWhen undefined        → match (legacy / default-like)
 *   - applyWhen = {} (no rules)  → DON'T auto-match (opt-in — user must drill to enable)
 *   - applyWhen with rules       → all present sections must match (AND); within a
 *                                  section, ANY value matching the funnel passes (OR).
 *   - A rule section omitted     → wildcard for that dimension.
 */
export function matchesApplyWhen(
  applyWhen: CatalogItemRaw["applyWhen"] | undefined,
  funnel: FunnelAnswers | undefined,
): boolean {
  if (applyWhen === undefined) return true;
  // Empty object = opt-in, never auto-match.
  const hasAnyRule =
    (applyWhen.categories?.length ?? 0) > 0 ||
    (applyWhen.languages?.length ?? 0) > 0 ||
    (applyWhen.frameworks?.length ?? 0) > 0 ||
    (applyWhen.databases?.length ?? 0) > 0 ||
    (applyWhen.orms?.length ?? 0) > 0;
  if (!hasAnyRule) return false;

  const f = funnel ?? {
    categories: [],
    languages: [],
    frameworks: [],
    databases: [],
    orms: [],
  };
  if (applyWhen.categories && !intersects(applyWhen.categories, f.categories))
    return false;
  if (applyWhen.languages && !intersects(applyWhen.languages, f.languages))
    return false;
  if (applyWhen.frameworks && !intersects(applyWhen.frameworks, f.frameworks))
    return false;
  if (applyWhen.databases && !intersects(applyWhen.databases, f.databases))
    return false;
  if (applyWhen.orms && !intersects(applyWhen.orms, f.orms)) return false;
  return true;
}

function cap(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Human-readable label describing when an item activates.
 *   tier=default              → "General"
 *   tier=conditional + applyWhen={}    → "Opt-in"
 *   tier=conditional + rules           → joined parts e.g. "Backend + Postgres" or "TS"
 *   tier=skip                 → "Skip"
 */
export function formatTrigger(item: CatalogItemRaw): string {
  if (item.tier === "default") return "General";
  if (item.tier === "skip") return "Skip";
  const w = item.applyWhen;
  if (!w || Object.keys(w).length === 0) return "Opt-in";
  const parts: string[] = [];
  if (w.categories?.length) parts.push(...w.categories.map(cap));
  if (w.languages?.length) parts.push(...w.languages.map((l) => l.toUpperCase()));
  if (w.frameworks?.length) parts.push(...w.frameworks);
  if (w.databases?.length) parts.push(...w.databases.map(cap));
  if (w.orms?.length) parts.push(...w.orms.map(cap));
  return parts.join(" + ");
}

export function resolveForSource(
  source: CatalogSource,
  funnel: FunnelAnswers | undefined,
): ResolvedSelection {
  const items = itemsFor(source);
  const def: CatalogItemRaw[] = [];
  const cond: CatalogItemRaw[] = [];
  const skip: CatalogItemRaw[] = [];

  for (const it of items) {
    if (it.tier === "skip") {
      skip.push(it);
      continue;
    }
    if (it.tier === "default") {
      def.push(it);
      continue;
    }
    // conditional
    if (matchesApplyWhen(it.applyWhen, funnel)) {
      cond.push(it);
    }
  }

  // visible = default + conditional matching (skip is hidden)
  // To let the user see ALL conditional items (not just matching ones),
  // we expose two lists: preChecked (what's checked) and visible (what's shown).
  // For the D-drill, we show all non-skip items so the user can opt-in to
  // unmatched conditionals manually.
  const visible: CatalogItemRaw[] = [];
  for (const it of items) {
    if (it.tier === "skip") continue;
    visible.push(it);
  }

  const preChecked = [...def, ...cond];

  return { default: def, conditional: cond, skip, visible, preChecked };
}
