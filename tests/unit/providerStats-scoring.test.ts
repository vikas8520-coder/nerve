/**
 * tests/unit/providerStats-scoring.test.ts
 *
 * Unit tests for the Provider Health Leaderboard scoring logic in
 * `src/lib/db/providerStats.ts`. Focuses on the pure `computeLeaderboardScore`
 * function — weight distribution, clamping, and ranking invariants — without
 * touching the database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeLeaderboardScore } from "../../src/lib/db/providerStats.ts";

const TOLERANCE = 1e-9;

test("computeLeaderboardScore: perfect metrics → 1.0", () => {
  const score = computeLeaderboardScore({
    successRate: 1,
    avgLatencyMs: 0,
    costPer1kTokens: 0,
    avgTokensPerSecond: 200,
  });
  assert.ok(Math.abs(score - 1) < TOLERANCE, `expected ~1, got ${score}`);
});

test("computeLeaderboardScore: worst metrics → 0", () => {
  const score = computeLeaderboardScore({
    successRate: 0,
    avgLatencyMs: 30_000,
    costPer1kTokens: 0.05,
    avgTokensPerSecond: 0,
  });
  assert.ok(score <= TOLERANCE, `expected ~0, got ${score}`);
});

test("computeLeaderboardScore: respects 40/30/20/10 weights", () => {
  // Only success rate contributes (0.5), other sub-scores are 0.
  const onlySuccess = computeLeaderboardScore({
    successRate: 0.5,
    avgLatencyMs: 30_000,
    costPer1kTokens: 0.05,
    avgTokensPerSecond: 0,
  });
  assert.ok(Math.abs(onlySuccess - 0.4 * 0.5) < TOLERANCE);

  // Only latency contributes (0.5 → latencyScore = 0.5).
  const onlyLatency = computeLeaderboardScore({
    successRate: 0,
    avgLatencyMs: 15_000,
    costPer1kTokens: 0.05,
    avgTokensPerSecond: 0,
  });
  assert.ok(Math.abs(onlyLatency - 0.3 * 0.5) < TOLERANCE);

  // Only cost contributes (0.5 → costScore = 0.5).
  const onlyCost = computeLeaderboardScore({
    successRate: 0,
    avgLatencyMs: 30_000,
    costPer1kTokens: 0.025,
    avgTokensPerSecond: 0,
  });
  assert.ok(Math.abs(onlyCost - 0.2 * 0.5) < TOLERANCE);

  // Only throughput contributes (0.5 → throughputScore = 0.5).
  const onlyThroughput = computeLeaderboardScore({
    successRate: 0,
    avgLatencyMs: 30_000,
    costPer1kTokens: 0.05,
    avgTokensPerSecond: 100,
  });
  assert.ok(Math.abs(onlyThroughput - 0.1 * 0.5) < TOLERANCE);
});

test("computeLeaderboardScore: clamps out-of-range inputs to [0,1]", () => {
  const negativeSuccess = computeLeaderboardScore({
    successRate: -5,
    avgLatencyMs: 0,
    costPer1kTokens: 0,
    avgTokensPerSecond: 1000,
  });
  // success 0, latency 1, cost 1, throughput 1 → 0.3+0.2+0.1
  assert.ok(Math.abs(negativeSuccess - 0.6) < TOLERANCE, `expected ~0.6, got ${negativeSuccess}`);

  const hugeLatency = computeLeaderboardScore({
    successRate: 1,
    avgLatencyMs: 1_000_000,
    costPer1kTokens: 0,
    avgTokensPerSecond: 200,
  });
  // success 1, latency 0, cost 1, throughput 1 → 0.4 + 0.2 + 0.1
  assert.ok(Math.abs(hugeLatency - 0.7) < TOLERANCE);
});

test("computeLeaderboardScore: NaN inputs map to 0 (no NaN propagation)", () => {
  const score = computeLeaderboardScore({
    successRate: Number.NaN,
    avgLatencyMs: Number.NaN,
    costPer1kTokens: Number.NaN,
    avgTokensPerSecond: Number.NaN,
  });
  assert.ok(Number.isFinite(score));
  assert.ok(score >= 0 && score <= 1);
});

test("computeLeaderboardScore: free provider (zero cost) gets full cost sub-score", () => {
  const freeProvider = computeLeaderboardScore({
    successRate: 1,
    avgLatencyMs: 0,
    costPer1kTokens: 0,
    avgTokensPerSecond: 200,
  });
  const paidProvider = computeLeaderboardScore({
    successRate: 1,
    avgLatencyMs: 0,
    costPer1kTokens: 0.001,
    avgTokensPerSecond: 200,
  });
  assert.ok(freeProvider > paidProvider, "free provider should score higher than paid");
  assert.ok(Math.abs(freeProvider - 1) < TOLERANCE);
});

test("computeLeaderboardScore: higher success rate ranks above lower when other metrics equal", () => {
  const highSuccess = computeLeaderboardScore({
    successRate: 0.99,
    avgLatencyMs: 1000,
    costPer1kTokens: 0.01,
    avgTokensPerSecond: 50,
  });
  const lowSuccess = computeLeaderboardScore({
    successRate: 0.5,
    avgLatencyMs: 1000,
    costPer1kTokens: 0.01,
    avgTokensPerSecond: 50,
  });
  assert.ok(highSuccess > lowSuccess);
});

test("computeLeaderboardScore: lower latency ranks above higher when other metrics equal", () => {
  const fast = computeLeaderboardScore({
    successRate: 0.9,
    avgLatencyMs: 500,
    costPer1kTokens: 0.01,
    avgTokensPerSecond: 50,
  });
  const slow = computeLeaderboardScore({
    successRate: 0.9,
    avgLatencyMs: 10_000,
    costPer1kTokens: 0.01,
    avgTokensPerSecond: 50,
  });
  assert.ok(fast > slow);
});
