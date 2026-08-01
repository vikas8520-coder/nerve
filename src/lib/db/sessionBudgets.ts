/**
 * db/sessionBudgets.ts — Smart Cost Guardrails.
 *
 * Per-CLI-session cost/token budgets. Tracks max_tokens / max_cost_usd limits
 * and cumulative usage so the chat pipeline can reject (429) or warn (header)
 * when a session approaches or exceeds its configured guardrails.
 *
 * All SQL is confined to this module — routes and handlers call these functions.
 */

import { v4 as uuidv4 } from "uuid";
import { getDbInstance, rowToCamel } from "./core";

// ──────────────── Types ────────────────

export interface SessionBudget {
  id: string;
  sessionId: string;
  apiKeyId: string | null;
  maxTokens: number | null;
  maxCostUsd: number | null;
  tokensUsed: number;
  costUsdUsed: number;
  warningThreshold: number;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

interface SessionBudgetRow {
  id: string;
  session_id: string;
  api_key_id: string | null;
  max_tokens: number | null;
  max_cost_usd: number | null;
  tokens_used: number;
  cost_usd_used: number;
  warning_threshold: number;
  created_at: string;
  updated_at: string;
  enabled: number;
}

export interface BudgetLimits {
  maxTokens?: number | null;
  maxCostUsd?: number | null;
  warningThreshold?: number | null;
  enabled?: boolean;
  apiKeyId?: string | null;
}

export interface BudgetCheckResult {
  withinBudget: boolean;
  warningLevel: number; // 0..1 fraction of the most-consumed limit
  remaining: {
    tokens: number | null; // null when no token limit set
    costUsd: number | null; // null when no cost limit set
  };
  overLimit: "tokens" | "cost" | "both" | null;
}

// ──────────────── Helpers ────────────────

function rowToBudget(row: SessionBudgetRow): SessionBudget {
  const camel = rowToCamel(row) as Record<string, unknown>;
  return {
    id: String(camel.id),
    sessionId: String(camel.sessionId),
    apiKeyId: (camel.apiKeyId as string | null) ?? null,
    maxTokens: (camel.maxTokens as number | null) ?? null,
    maxCostUsd: (camel.maxCostUsd as number | null) ?? null,
    tokensUsed: Number(camel.tokensUsed) || 0,
    costUsdUsed: Number(camel.costUsdUsed) || 0,
    warningThreshold: Number(camel.warningThreshold) || 0.8,
    createdAt: String(camel.createdAt),
    updatedAt: String(camel.updatedAt),
    enabled: Number(camel.enabled) === 1,
  };
}

interface StatementLike<TRow = unknown> {
  all: (...params: unknown[]) => TRow[];
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => { changes?: number };
}

interface DbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
  exec: (sql: string) => void;
  transaction: <TResult>(fn: () => TResult) => TResult;
}

function getDb(): DbLike {
  return getDbInstance() as unknown as DbLike;
}

// ──────────────── CRUD ────────────────

/**
 * Create a new session budget or update the limits of an existing one.
 * Usage counters (tokensUsed / costUsdUsed) are preserved on update unless
 * the caller explicitly resets them via `BudgetLimits`.
 */
export function createOrUpdateBudget(
  sessionId: string,
  apiKeyId: string | null,
  limits: BudgetLimits
): SessionBudget {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare<SessionBudgetRow>("SELECT * FROM session_budgets WHERE session_id = ?")
    .get(sessionId);

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (limits.maxTokens !== undefined) {
      fields.push("max_tokens = ?");
      values.push(limits.maxTokens ?? null);
    }
    if (limits.maxCostUsd !== undefined) {
      fields.push("max_cost_usd = ?");
      values.push(limits.maxCostUsd ?? null);
    }
    if (limits.warningThreshold !== undefined) {
      fields.push("warning_threshold = ?");
      values.push(limits.warningThreshold ?? 0.8);
    }
    if (limits.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(limits.enabled ? 1 : 0);
    }
    if (limits.apiKeyId !== undefined) {
      fields.push("api_key_id = ?");
      values.push(limits.apiKeyId ?? null);
    }

    fields.push("updated_at = ?");
    values.push(now);
    values.push(sessionId);

    if (fields.length > 1) {
      db.prepare(`UPDATE session_budgets SET ${fields.join(", ")} WHERE session_id = ?`).run(
        ...values
      );
    }

    return getBudget(sessionId)!;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO session_budgets
       (id, session_id, api_key_id, max_tokens, max_cost_usd, tokens_used, cost_usd_used,
        warning_threshold, created_at, updated_at, enabled)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
  ).run(
    id,
    sessionId,
    apiKeyId ?? null,
    limits.maxTokens ?? null,
    limits.maxCostUsd ?? null,
    limits.warningThreshold ?? 0.8,
    now,
    now,
    limits.enabled === false ? 0 : 1
  );

  return getBudget(sessionId)!;
}

/**
 * Get the budget for a session (by session_id, not primary key).
 */
export function getBudget(sessionId: string): SessionBudget | null {
  const db = getDb();
  const row = db
    .prepare<SessionBudgetRow>("SELECT * FROM session_budgets WHERE session_id = ?")
    .get(sessionId);
  return row ? rowToBudget(row) : null;
}

/**
 * Get a budget by its primary key id.
 */
export function getBudgetById(id: string): SessionBudget | null {
  const db = getDb();
  const row = db.prepare<SessionBudgetRow>("SELECT * FROM session_budgets WHERE id = ?").get(id);
  return row ? rowToBudget(row) : null;
}

/**
 * List all session budgets, optionally filtered by api_key_id or enabled state.
 */
export function listBudgets(options?: {
  apiKeyId?: string;
  enabledOnly?: boolean;
  limit?: number;
  offset?: number;
}): { budgets: SessionBudget[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.apiKeyId) {
    conditions.push("api_key_id = ?");
    params.push(options.apiKeyId);
  }
  if (options?.enabledOnly) {
    conditions.push("enabled = 1");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  let sql = `SELECT * FROM session_budgets ${where} ORDER BY created_at DESC`;
  if (limit !== undefined) {
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
  }

  const rows = db.prepare<SessionBudgetRow>(sql).all(...params) as SessionBudgetRow[];
  const countRow = db
    .prepare<{ cnt: number }>(`SELECT count(*) as cnt FROM session_budgets ${where}`)
    .get(...params.slice(0, conditions.length)) as { cnt: number };

  return { budgets: rows.map(rowToBudget), total: countRow.cnt };
}

/**
 * Increment a session's usage counters. Idempotent within a transaction.
 */
export function incrementUsage(
  sessionId: string,
  tokensUsed: number,
  costUsd: number
): SessionBudget | null {
  const db = getDb();
  const now = new Date().toISOString();
  const tokens = Math.max(0, Math.floor(tokensUsed));
  const cost = Math.max(0, costUsd);

  const result = db
    .prepare(
      `UPDATE session_budgets
         SET tokens_used = tokens_used + ?,
             cost_usd_used = cost_usd_used + ?,
             updated_at = ?
       WHERE session_id = ?`
    )
    .run(tokens, cost, now, sessionId);

  if ((result as { changes?: number }).changes === 0) return null;
  return getBudget(sessionId);
}

/**
 * Reset usage counters to zero (e.g. for a new billing period).
 */
export function resetUsage(sessionId: string): SessionBudget | null {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE session_budgets SET tokens_used = 0, cost_usd_used = 0, updated_at = ? WHERE session_id = ?`
    )
    .run(now, sessionId);
  if ((result as { changes?: number }).changes === 0) return null;
  return getBudget(sessionId);
}

/**
 * Delete a session budget by session_id.
 */
export function deleteBudget(sessionId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM session_budgets WHERE session_id = ?").run(sessionId);
  return ((result as { changes?: number }).changes ?? 0) > 0;
}

/**
 * Delete a session budget by primary key id.
 */
export function deleteBudgetById(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM session_budgets WHERE id = ?").run(id);
  return ((result as { changes?: number }).changes ?? 0) > 0;
}

// ──────────────── Budget Check ────────────────

/**
 * Check whether a session is within its configured budget.
 *
 * Returns:
 *  - `withinBudget`: false if any enabled limit is exceeded
 *  - `warningLevel`: 0..1 — the highest fraction consumed across all active limits
 *  - `remaining`: tokens/cost remaining (null when that limit is not configured)
 *  - `overLimit`: which limit was exceeded
 *
 * A disabled budget or one with no limits configured is always "within budget".
 */
export function checkBudget(sessionId: string): BudgetCheckResult {
  const budget = getBudget(sessionId);

  if (!budget || !budget.enabled) {
    return {
      withinBudget: true,
      warningLevel: 0,
      remaining: { tokens: null, costUsd: null },
      overLimit: null,
    };
  }

  let tokenFraction = 0;
  let costFraction = 0;
  let tokensRemaining: number | null = null;
  let costRemaining: number | null = null;
  let overTokens = false;
  let overCost = false;

  if (budget.maxTokens !== null && budget.maxTokens > 0) {
    tokenFraction = budget.tokensUsed / budget.maxTokens;
    tokensRemaining = Math.max(0, budget.maxTokens - budget.tokensUsed);
    overTokens = budget.tokensUsed >= budget.maxTokens;
  }

  if (budget.maxCostUsd !== null && budget.maxCostUsd > 0) {
    costFraction = budget.costUsdUsed / budget.maxCostUsd;
    costRemaining = Math.max(0, budget.maxCostUsd - budget.costUsdUsed);
    overCost = budget.costUsdUsed >= budget.maxCostUsd;
  }

  const warningLevel = Math.max(tokenFraction, costFraction);
  const withinBudget = !overTokens && !overCost;

  let overLimit: BudgetCheckResult["overLimit"] = null;
  if (overTokens && overCost) overLimit = "both";
  else if (overTokens) overLimit = "tokens";
  else if (overCost) overLimit = "cost";

  return {
    withinBudget,
    warningLevel,
    remaining: { tokens: tokensRemaining, costUsd: costRemaining },
    overLimit,
  };
}

/**
 * Returns true if the session has exceeded its warning threshold (default 80%).
 */
export function isWarningThresholdReached(sessionId: string): boolean {
  const budget = getBudget(sessionId);
  if (!budget || !budget.enabled) return false;
  const check = checkBudget(sessionId);
  return check.warningLevel >= budget.warningThreshold && check.withinBudget;
}
