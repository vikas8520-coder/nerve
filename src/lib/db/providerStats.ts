/**
 * db/providerStats.ts — Provider Health Leaderboard & task-based recommendations.
 *
 * Aggregates the existing `call_logs` table (no new tables) to rank providers by
 * actual observed performance: success rate, latency, throughput, and cost.
 * Also produces per-task-type recommendations by combining call-log performance
 * with `model_intelligence` task-fitness scores and synced vision capabilities.
 *
 * Read-only aggregation; no writes. Follows the pattern of `callLogStats.ts`.
 *
 * @module lib/db/providerStats
 */

import { getDbInstance } from "./core";
import { getProviderDisplayName, type ProviderNodeLike } from "@/lib/display/names";
import { getPricingForModel } from "@/shared/constants/pricing";

// ──────────────── Types ────────────────

export interface ProviderLeaderboardEntry {
  providerId: string;
  providerName: string;
  totalRequests: number;
  successRate: number; // 0-1
  avgLatencyMs: number;
  avgTokensPerSecond: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  costPer1kTokens: number;
  rank: number; // 1 = best
  lastUsed: string; // ISO timestamp
}

export interface TaskRecommendation {
  providerId: string;
  modelId: string;
  score: number; // 0-1 weighted blend
  reason: string;
}

export interface TaskBasedRecommendations {
  coding: TaskRecommendation | null;
  reasoning: TaskRecommendation | null;
  chat: TaskRecommendation | null;
  vision: TaskRecommendation | null;
}

// ──────────────── Scoring weights ────────────────
// successRate (40%) + latency (30%) + cost (20%) + tokens/sec (10%)
const WEIGHT_SUCCESS = 0.4;
const WEIGHT_LATENCY = 0.3;
const WEIGHT_COST = 0.2;
const WEIGHT_THROUGHPUT = 0.1;

// Reference ceiling for normalising raw metrics into 0-1 sub-scores.
const LATENCY_CEILING_MS = 30_000; // 30s → 0 sub-score
const COST_PER_1K_CEILING_USD = 0.05; // $0.05 / 1k tokens → 0 sub-score
const THROUGHPUT_CEILING_TPS = 200; // 200 tok/s → 1.0 sub-score

// ──────────────── Helpers ────────────────

interface ProviderAggregateRow {
  provider: string;
  totalRequests: number;
  successCount: number;
  avgLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalDurationMs: number;
  lastUsed: string | null;
}

interface ModelAggregateRow extends ProviderAggregateRow {
  model: string;
}

function buildProviderNodeMap(): Map<string, ProviderNodeLike> {
  const db = getDbInstance();
  let rows: Array<{ id: string; name: string | null; prefix: string | null }> = [];
  try {
    rows = db.prepare("SELECT id, name, prefix FROM provider_nodes").all() as typeof rows;
  } catch {
    // provider_nodes may not exist in stripped-down test fixtures.
    rows = [];
  }
  const map = new Map<string, ProviderNodeLike>();
  for (const row of rows) {
    map.set(row.id, { name: row.name, prefix: row.prefix });
  }
  return map;
}

/**
 * Estimate USD cost for a batch of tokens using the default pricing table.
 * Pricing rates are $/1M tokens; returns 0 when no pricing is known.
 */
function estimateCostUsd(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = getPricingForModel(provider, model);
  if (!pricing) return 0;
  const inputRate = typeof pricing.input === "number" ? pricing.input : 0;
  const outputRate = typeof pricing.output === "number" ? pricing.output : 0;
  return (tokensIn / 1_000_000) * inputRate + (tokensOut / 1_000_000) * outputRate;
}

/**
 * Clamp a value into the [0, 1] range.
 */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Compute the composite 0-1 leaderboard score from normalised sub-metrics.
 * Exported for unit testing.
 */
export function computeLeaderboardScore(params: {
  successRate: number;
  avgLatencyMs: number;
  costPer1kTokens: number;
  avgTokensPerSecond: number;
}): number {
  const successScore = clamp01(params.successRate);

  // Lower latency is better → invert against ceiling.
  const latencyScore = clamp01(1 - params.avgLatencyMs / LATENCY_CEILING_MS);

  // Lower cost is better → invert against ceiling. Zero cost (free/OAuth) → 1.
  const costScore =
    params.costPer1kTokens <= 0 ? 1 : clamp01(1 - params.costPer1kTokens / COST_PER_1K_CEILING_USD);

  // Higher throughput is better.
  const throughputScore = clamp01(params.avgTokensPerSecond / THROUGHPUT_CEILING_TPS);

  return (
    WEIGHT_SUCCESS * successScore +
    WEIGHT_LATENCY * latencyScore +
    WEIGHT_COST * costScore +
    WEIGHT_THROUGHPUT * throughputScore
  );
}

function rowToLeaderboardEntry(
  row: ProviderAggregateRow,
  nodeMap: Map<string, ProviderNodeLike>,
  rank: number
): ProviderLeaderboardEntry {
  const totalTokens = row.totalTokensIn + row.totalTokensOut;
  const costUsd = estimateCostUsd(row.provider, "", row.totalTokensIn, row.totalTokensOut);
  const costPer1k = totalTokens > 0 ? (costUsd / totalTokens) * 1000 : 0;
  // tokens/sec = total tokens / total seconds. Guard against zero duration.
  const totalSeconds = row.totalDurationMs / 1000;
  const avgTps = totalSeconds > 0 ? totalTokens / totalSeconds : 0;

  return {
    providerId: row.provider,
    providerName: getProviderDisplayName(row.provider, nodeMap.get(row.provider) ?? null),
    totalRequests: row.totalRequests,
    successRate: row.totalRequests > 0 ? row.successCount / row.totalRequests : 0,
    avgLatencyMs: Math.round(row.avgLatencyMs),
    avgTokensPerSecond: Math.round(avgTps * 10) / 10,
    totalTokensUsed: totalTokens,
    estimatedCostUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    costPer1kTokens: Math.round(costPer1k * 1_000_000) / 1_000_000,
    rank,
    lastUsed: row.lastUsed ?? new Date(0).toISOString(),
  };
}

// ──────────────── Leaderboard ────────────────

/**
 * Returns providers ranked by observed performance over the given time window.
 *
 * @param timeRangeHours - Look-back window in hours (default 24).
 * @returns Array of leaderboard entries, best provider first (rank 1).
 */
export function getProviderLeaderboard(timeRangeHours = 24): ProviderLeaderboardEntry[] {
  const db = getDbInstance();
  const sinceIso = new Date(Date.now() - timeRangeHours * 3600 * 1000).toISOString();

  const rows = db
    .prepare(
      `SELECT
          provider,
          COUNT(*) as totalRequests,
          SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) as successCount,
          AVG(duration) as avgLatencyMs,
          SUM(tokens_in) as totalTokensIn,
          SUM(tokens_out) as totalTokensOut,
          SUM(duration) as totalDurationMs,
          MAX(timestamp) as lastUsed
        FROM call_logs
        WHERE provider IS NOT NULL AND provider != '-'
          AND timestamp >= ?
        GROUP BY provider`
    )
    .all(sinceIso) as ProviderAggregateRow[];

  const nodeMap = buildProviderNodeMap();

  const scored = rows.map((row) => {
    const entry = rowToLeaderboardEntry(row, nodeMap, 0);
    const score = computeLeaderboardScore({
      successRate: entry.successRate,
      avgLatencyMs: entry.avgLatencyMs,
      costPer1kTokens: entry.costPer1kTokens,
      avgTokensPerSecond: entry.avgTokensPerSecond,
    });
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((item, idx) => ({ ...item.entry, rank: idx + 1 }));
}

// ──────────────── Task-based recommendations ────────────────

interface ModelIntelligenceRow {
  model: string;
  category: string;
  score: number;
}

/**
 * Best provider+model per task type, blended from call-log performance and
 * `model_intelligence` task-fitness scores.
 *
 * Task → intelligence category mapping:
 *   coding    → "coding"
 *   reasoning → "analysis"
 *   chat      → "default"
 *   vision    → models with synced `supportsVision` capability
 */
export function getTaskBasedRecommendations(): TaskBasedRecommendations {
  const db = getDbInstance();
  const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Per provider+model performance aggregates (last 24h).
  const modelRows = db
    .prepare(
      `SELECT
          provider,
          model,
          COUNT(*) as totalRequests,
          SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) as successCount,
          AVG(duration) as avgLatencyMs,
          SUM(tokens_in) as totalTokensIn,
          SUM(tokens_out) as totalTokensOut,
          SUM(duration) as totalDurationMs,
          MAX(timestamp) as lastUsed
        FROM call_logs
        WHERE provider IS NOT NULL AND provider != '-'
          AND model IS NOT NULL AND model != ''
          AND timestamp >= ?
        GROUP BY provider, model`
    )
    .all(sinceIso) as ModelAggregateRow[];

  if (modelRows.length === 0) {
    return { coding: null, reasoning: null, chat: null, vision: null };
  }

  // Task-fitness scores from model_intelligence (user_override > arena_elo > models_dev_tier).
  const intelligenceRows = db
    .prepare(
      `SELECT model, category, score FROM model_intelligence
       WHERE source IN ('user_override', 'arena_elo', 'models_dev_tier')
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       ORDER BY CASE source
         WHEN 'user_override' THEN 1
         WHEN 'arena_elo' THEN 2
         WHEN 'models_dev_tier' THEN 3
       END`
    )
    .all() as ModelIntelligenceRow[];

  // Best fitness score per (model, category).
  const fitness = new Map<string, number>();
  for (const row of intelligenceRows) {
    const key = `${row.model.toLowerCase()}|${row.category.toLowerCase()}`;
    // First row wins per group because of the ORDER BY priority above.
    if (!fitness.has(key)) fitness.set(key, typeof row.score === "number" ? row.score : 0);
  }

  // Vision-capable model ids from synced/custom model catalog (key_value).
  const visionModels = loadVisionCapableModelIds();

  // Pre-compute a performance score for every provider+model row.
  const performance = modelRows.map((row) => {
    const totalTokens = row.totalTokensIn + row.totalTokensOut;
    const costUsd = estimateCostUsd(row.provider, row.model, row.totalTokensIn, row.totalTokensOut);
    const costPer1k = totalTokens > 0 ? (costUsd / totalTokens) * 1000 : 0;
    const totalSeconds = row.totalDurationMs / 1000;
    const avgTps = totalSeconds > 0 ? totalTokens / totalSeconds : 0;
    const successRate = row.totalRequests > 0 ? row.successCount / row.totalRequests : 0;
    const perfScore = computeLeaderboardScore({
      successRate,
      avgLatencyMs: row.avgLatencyMs,
      costPer1kTokens: costPer1k,
      avgTokensPerSecond: avgTps,
    });
    return {
      provider: row.provider,
      model: row.model,
      totalRequests: row.totalRequests,
      successRate,
      avgLatencyMs: row.avgLatencyMs,
      avgTps,
      costPer1k,
      perfScore,
    };
  });

  // Minimum sample size to trust a recommendation.
  const MIN_SAMPLES = 3;

  function recommendForCategory(category: string, reason: string): TaskRecommendation | null {
    let best: { score: number; rec: TaskRecommendation } | null = null;
    for (const p of performance) {
      if (p.totalRequests < MIN_SAMPLES) continue;
      const fitnessScore = fitness.get(`${p.model.toLowerCase()}|${category.toLowerCase()}`) ?? 0.5;
      // Blend: 60% task fitness, 40% observed performance.
      const score = clamp01(0.6 * fitnessScore + 0.4 * p.perfScore);
      if (!best || score > best.score) {
        best = {
          score,
          rec: {
            providerId: p.provider,
            modelId: p.model,
            score: Math.round(score * 1000) / 1000,
            reason,
          },
        };
      }
    }
    return best?.rec ?? null;
  }

  function recommendForVision(): TaskRecommendation | null {
    let best: { score: number; rec: TaskRecommendation } | null = null;
    for (const p of performance) {
      if (p.totalRequests < MIN_SAMPLES) continue;
      if (!visionModels.has(p.model.toLowerCase())) continue;
      const score = clamp01(p.perfScore);
      if (!best || score > best.score) {
        best = {
          score,
          rec: {
            providerId: p.provider,
            modelId: p.model,
            score: Math.round(score * 1000) / 1000,
            reason: "Best observed performance among vision-capable models",
          },
        };
      }
    }
    return best?.rec ?? null;
  }

  return {
    coding: recommendForCategory(
      "coding",
      "Highest blend of coding task-fitness and observed performance"
    ),
    reasoning: recommendForCategory(
      "analysis",
      "Highest blend of reasoning/analysis task-fitness and observed performance"
    ),
    chat: recommendForCategory(
      "default",
      "Highest blend of general chat task-fitness and observed performance"
    ),
    vision: recommendForVision(),
  };
}

/**
 * Collect vision-capable model ids from the synced + custom model catalogs
 * stored in the `key_value` table. Returns a lower-cased Set for fast lookup.
 */
function loadVisionCapableModelIds(): Set<string> {
  const db = getDbInstance();
  const ids = new Set<string>();
  try {
    const rows = db
      .prepare(
        `SELECT value FROM key_value
         WHERE namespace IN ('syncedAvailableModels', 'customModels')`
      )
      .all() as Array<{ value: string }>;
    for (const row of rows) {
      if (typeof row.value !== "string") continue;
      try {
        const parsed = JSON.parse(row.value);
        collectVisionModelIds(parsed, ids);
      } catch {
        // skip corrupted entries
      }
    }
  } catch {
    // key_value table may be absent in minimal test fixtures.
  }
  return ids;
}

function collectVisionModelIds(payload: unknown, ids: Set<string>): void {
  if (Array.isArray(payload)) {
    for (const item of payload) collectVisionModelIds(item, ids);
    return;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    // Synced catalog rows are arrays under a connection key; custom models are
    // stored as a single model object per provider key. Handle both shapes.
    if (typeof record.id === "string" && record.supportsVision === true) {
      ids.add(record.id.toLowerCase());
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value) || (value && typeof value === "object")) {
        collectVisionModelIds(value, ids);
      }
    }
  }
}

/**
 * Provider/model call statistics aggregated from `call_logs`.
 *
 * Hard Rule #5: routes must not embed raw SQL — these queries live here so the
 * /api/provider-stats route can delegate. Read-only aggregation; no writes.
 */

export interface ProviderCallStat {
  provider: string;
  nodeName: string | null;
  totalRequests: number;
  successfulRequests: number;
  avgLatencyMs: number | null;
  totalTokensIn: number | null;
  totalTokensOut: number | null;
}

export interface ModelCallStat {
  provider: string;
  nodeName: string | null;
  model: string;
  requests: number;
  avgLatencyMs: number | null;
  successfulRequests: number;
}

export function getProviderCallStats(): ProviderCallStat[] {
  const db = getDbInstance();
  return db
    .prepare(
      `SELECT
         c.provider,
         pn.name AS nodeName,
         COUNT(*) AS totalRequests,
         SUM(CASE WHEN c.status >= 200 AND c.status < 400 THEN 1 ELSE 0 END) AS successfulRequests,
         ROUND(AVG(c.duration)) AS avgLatencyMs,
         SUM(c.tokens_in) AS totalTokensIn,
         SUM(c.tokens_out) AS totalTokensOut
       FROM call_logs c
       LEFT JOIN provider_nodes pn ON pn.id = c.provider
       WHERE c.provider IS NOT NULL AND c.provider != '-'
       GROUP BY c.provider
       ORDER BY totalRequests DESC`
    )
    .all() as ProviderCallStat[];
}

export function getModelCallStats(): ModelCallStat[] {
  const db = getDbInstance();
  return db
    .prepare(
      `SELECT
         c.provider,
         pn.name AS nodeName,
         c.model,
         COUNT(*) AS requests,
         ROUND(AVG(c.duration)) AS avgLatencyMs,
         SUM(CASE WHEN c.status >= 200 AND c.status < 400 THEN 1 ELSE 0 END) AS successfulRequests
       FROM call_logs c
       LEFT JOIN provider_nodes pn ON pn.id = c.provider
       WHERE c.provider IS NOT NULL AND c.model IS NOT NULL
       GROUP BY c.provider, c.model
       ORDER BY c.provider, requests DESC`
    )
    .all() as ModelCallStat[];
}
