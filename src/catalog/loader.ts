// Single entry point for JSON-driven catalog data.
// Re-exports the generated constants so existing imports keep working.
export {
  PROJECT_CATEGORIES,
  LANGUAGES_BY_CATEGORY,
  FRAMEWORKS_BY_LANG_CATEGORY,
  DATABASES,
  ORMS_BY_LANGUAGE,
  STACK_ITEMS,
  MCP_SERVERS,
  CURATED_AGENTS_DATA,
  CURATED_SKILLS_DATA,
  WSHOBSON_ITEMS,
  SUPERPOWERS_ITEMS,
  POCOCK_ITEMS,
  SCAFFOLDERS,
  COMMAND_BUNDLES,
} from "../catalog.gen.js";
export type {
  FunnelOption,
  StackItemRaw,
  McpServerRaw,
  CuratedAgentRaw,
  CuratedSkillRaw,
  CatalogItemRaw,
  ScaffolderRaw,
  CommandBundleRaw,
  CommandBundleCommand,
} from "../catalog.gen.js";
