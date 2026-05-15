import { CURATED_AGENTS_DATA } from "../catalog/loader.js";

export interface CuratedAgent {
  filename: string;
  name: string;
  content: string;
}

export const CURATED_AGENTS: CuratedAgent[] = CURATED_AGENTS_DATA.map((a) => ({
  filename: a.filename,
  name: a.name,
  content: a.content,
}));
