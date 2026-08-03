/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  nerve_get_health: ["read:health"],
  nerve_list_combos: ["read:combos"],
  nerve_get_combo_metrics: ["read:combos"],
  nerve_switch_combo: ["write:combos"],
  nerve_check_quota: ["read:quota"],
  nerve_route_request: ["execute:completions"],
  nerve_web_search: ["execute:search"],
  nerve_web_fetch: ["execute:search"],
  nerve_cost_report: ["read:usage"],
  nerve_list_models_catalog: ["read:models"],

  // Phase 2: Advanced Tools
  nerve_simulate_route: ["read:health", "read:combos"],
  nerve_set_budget_guard: ["write:budget"],
  nerve_set_resilience_profile: ["write:resilience"],
  nerve_test_combo: ["execute:completions", "read:combos"],
  nerve_get_provider_metrics: ["read:health"],
  nerve_best_combo_for_task: ["read:combos", "read:health"],
  nerve_explain_route: ["read:health", "read:usage"],
  nerve_get_session_snapshot: ["read:usage"],
  nerve_db_health_check: ["read:health", "write:resilience"],
  nerve_sync_pricing: ["pricing:write"],
  nerve_cache_stats: ["read:cache"],
  nerve_cache_flush: ["write:cache"],
  nerve_compression_status: ["read:compression"],
  nerve_compression_configure: ["write:compression"],
  nerve_set_compression_engine: ["write:compression"],
  nerve_list_compression_combos: ["read:compression"],
  nerve_compression_combo_stats: ["read:compression"],
  nerve_ccr_store: ["write:compression"],
  nerve_ccr_retrieve: ["read:compression"],
  nerve_ccr_inspect: ["read:compression"],
  nerve_ccr_list: ["read:compression"],
  nerve_ccr_delete: ["write:compression"],
  nerve_ccr_stats: ["read:compression"],
  nerve_oneproxy_fetch: ["read:proxies"],
  nerve_oneproxy_rotate: ["read:proxies"],
  nerve_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  nerve_pool_status: ["read:health"],
  nerve_pool_sessions: ["read:health"],
  nerve_pool_health: ["read:health"],
  nerve_pool_reset: ["write:resilience"],
  nerve_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  nerve_browser_pool_status: ["read:health"],
} as const;
