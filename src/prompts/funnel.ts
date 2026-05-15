import * as p from "@clack/prompts";
import {
  PROJECT_CATEGORIES,
  LANGUAGES_BY_CATEGORY,
  FRAMEWORKS_BY_LANG_CATEGORY,
  DATABASES,
  ORMS_BY_LANGUAGE,
  type FunnelOption,
} from "../catalog/loader.js";

export interface FunnelAnswers {
  categories: string[];
  languages: string[];
  frameworks: string[];
  databases: string[];
  orms: string[];
}

function union(options: ReadonlyArray<FunnelOption>[]): FunnelOption[] {
  const seen = new Set<string>();
  const out: FunnelOption[] = [];
  for (const list of options) {
    for (const o of list) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        out.push(o);
      }
    }
  }
  return out;
}

async function multi(
  message: string,
  options: FunnelOption[],
): Promise<string[] | null> {
  if (options.length === 0) return [];
  const opts = options.map((o) => ({
    value: o.id,
    label: o.name,
  })) as unknown as Parameters<typeof p.multiselect<string>>[0]["options"];
  const selected = await p.multiselect<string>({
    message,
    options: opts,
    required: false,
  });
  if (p.isCancel(selected)) return null;
  return selected as string[];
}

export async function askFunnel(): Promise<FunnelAnswers | null> {
  // 1. Category (entry point of the funnel)
  const categories = await multi(
    "Project category? (you can pick more than one)",
    PROJECT_CATEGORIES.slice(),
  );
  if (categories === null) return null;

  // 2. Language — union across selected categories
  const langOpts = union(
    categories.map((c) => LANGUAGES_BY_CATEGORY[c] ?? []),
  );
  const languages = await multi("Language(s)?", langOpts);
  if (languages === null) return null;

  // 3. Framework — keyed by category:language; show with the pair as hint
  const fwSeen = new Set<string>();
  const fwOpts: FunnelOption[] = [];
  for (const cat of categories) {
    for (const lang of languages) {
      const key = `${cat}:${lang}`;
      const list = FRAMEWORKS_BY_LANG_CATEGORY[key] ?? [];
      for (const f of list) {
        const tagged = `${key}:${f.id}`;
        if (!fwSeen.has(tagged)) {
          fwSeen.add(tagged);
          fwOpts.push({ id: tagged, name: `${f.name} — ${cat}/${lang}` });
        }
      }
    }
  }
  const frameworks = await multi("Framework(s)?", fwOpts);
  if (frameworks === null) return null;

  // 4. Database (independent of language but contextual to backend/fullstack/data)
  const dbOpts = DATABASES.slice();
  const databases = await multi("Database(s)?", dbOpts);
  if (databases === null) return null;

  // 5. ORM / query layer — filtered by languages, skipped if user chose no DB
  let orms: string[] = [];
  const hasRealDb =
    databases.length > 0 && !(databases.length === 1 && databases[0] === "none");
  if (hasRealDb) {
    const ormOpts = union(languages.map((l) => ORMS_BY_LANGUAGE[l] ?? []));
    if (ormOpts.length > 0) {
      const sel = await multi("ORM / query builder?", ormOpts);
      if (sel === null) return null;
      orms = sel;
    }
  }

  return { categories, languages, frameworks, databases, orms };
}
