import { STACK_ITEMS } from "../catalog/loader.js";
import type { StackComponent, StackScope } from "../types.js";

export interface ComponentDefinition {
  id: StackComponent;
  name: string;
  description: string;
  source: string;
  scope: StackScope;
  hint: string;
  tags: string[];
  preselectFor: string[];
  available?: Record<string, number>;
  instructions?: string[];
  defaultPlugins?: string[];
  defaultSkills?: string[];
}

export const COMPONENTS: ComponentDefinition[] = STACK_ITEMS.map((raw) => ({
  id: raw.id as StackComponent,
  name: raw.name,
  description: raw.description,
  source: raw.source,
  scope: raw.scope as StackScope,
  hint: raw.hint,
  tags: raw.tags,
  preselectFor: raw.preselectFor,
  available: Object.keys(raw.available).length > 0 ? raw.available : undefined,
  instructions: raw.instructions,
  defaultPlugins: raw.defaultPlugins,
  defaultSkills: raw.defaultSkills,
}));

export function findComponent(id: StackComponent): ComponentDefinition {
  const def = COMPONENTS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown stack component: ${id}`);
  return def;
}
