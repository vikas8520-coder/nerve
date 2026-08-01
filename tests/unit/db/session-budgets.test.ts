/**
 * Unit coverage for the session_budgets DB layer — Smart Cost Guardrails.
 *
 * Tests CRUD operations, usage increment, budget checking (within/over/warning),
 * and edge cases (disabled budgets, no limits configured, delete by id).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nerve-session-budgets-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-api-key-secret";

const core = await import("../../../src/lib/db/core.ts");
const sessionBudgets = await import("../../../src/lib/db/sessionBudgets.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// createOrUpdateBudget — create
// ─────────────────────────────────────────────────────────────────────────────

test("createOrUpdateBudget creates a new budget with limits", () => {
  const budget = sessionBudgets.createOrUpdateBudget("ext:session-1", "key-1", {
    maxTokens: 100_000,
    maxCostUsd: 5.0,
    warningThreshold: 0.8,
  });

  assert.ok(budget.id);
  assert.equal(budget.sessionId, "ext:session-1");
  assert.equal(budget.apiKeyId, "key-1");
  assert.equal(budget.maxTokens, 100_000);
  assert.equal(budget.maxCostUsd, 5.0);
  assert.equal(budget.tokensUsed, 0);
  assert.equal(budget.costUsdUsed, 0);
  assert.equal(budget.warningThreshold, 0.8);
  assert.equal(budget.enabled, true);
  assert.ok(budget.createdAt);
  assert.ok(budget.updatedAt);
});

test("createOrUpdateBudget with null apiKeyId", () => {
  const budget = sessionBudgets.createOrUpdateBudget("ext:session-2", null, {
    maxTokens: 50_000,
  });
  assert.equal(budget.apiKeyId, null);
  assert.equal(budget.maxTokens, 50_000);
  assert.equal(budget.maxCostUsd, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// createOrUpdateBudget — update preserves usage counters
// ─────────────────────────────────────────────────────────────────────────────

test("createOrUpdateBudget updates limits on existing budget without resetting usage", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-3", null, {
    maxTokens: 100_000,
    maxCostUsd: 10.0,
  });

  sessionBudgets.incrementUsage("ext:session-3", 30_000, 2.5);

  const updated = sessionBudgets.createOrUpdateBudget("ext:session-3", null, {
    maxTokens: 200_000,
    maxCostUsd: 20.0,
  });

  assert.equal(updated.maxTokens, 200_000);
  assert.equal(updated.maxCostUsd, 20.0);
  assert.equal(updated.tokensUsed, 30_000, "tokensUsed should be preserved on update");
  assert.equal(updated.costUsdUsed, 2.5, "costUsdUsed should be preserved on update");
});

test("createOrUpdateBudget can disable an existing budget", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-4", null, { maxTokens: 1000 });
  const updated = sessionBudgets.createOrUpdateBudget("ext:session-4", null, {
    enabled: false,
  });
  assert.equal(updated.enabled, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// getBudget / getBudgetById
// ─────────────────────────────────────────────────────────────────────────────

test("getBudget returns null for non-existent session", () => {
  assert.equal(sessionBudgets.getBudget("ext:nonexistent"), null);
});

test("getBudget retrieves an existing budget", () => {
  const created = sessionBudgets.createOrUpdateBudget("ext:session-5", "key-5", {
    maxTokens: 10_000,
  });
  const fetched = sessionBudgets.getBudget("ext:session-5");
  assert.deepEqual(fetched, created);
});

test("getBudgetById retrieves by primary key", () => {
  const created = sessionBudgets.createOrUpdateBudget("ext:session-6", null, {
    maxTokens: 10_000,
  });
  const fetched = sessionBudgets.getBudgetById(created.id);
  assert.deepEqual(fetched, created);
});

// ─────────────────────────────────────────────────────────────────────────────
// listBudgets
// ─────────────────────────────────────────────────────────────────────────────

test("listBudgets returns all budgets with total count", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-a", "key-1", { maxTokens: 1000 });
  sessionBudgets.createOrUpdateBudget("ext:session-b", "key-2", { maxTokens: 2000 });
  sessionBudgets.createOrUpdateBudget("ext:session-c", "key-1", { maxTokens: 3000 });

  const result = sessionBudgets.listBudgets();
  assert.equal(result.budgets.length, 3);
  assert.equal(result.total, 3);
});

test("listBudgets filters by apiKeyId", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-a", "key-1", { maxTokens: 1000 });
  sessionBudgets.createOrUpdateBudget("ext:session-b", "key-2", { maxTokens: 2000 });

  const result = sessionBudgets.listBudgets({ apiKeyId: "key-1" });
  assert.equal(result.budgets.length, 1);
  assert.equal(result.budgets[0].sessionId, "ext:session-a");
});

test("listBudgets filters by enabledOnly", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-a", null, { maxTokens: 1000 });
  sessionBudgets.createOrUpdateBudget("ext:session-b", null, {
    maxTokens: 1000,
    enabled: false,
  });

  const result = sessionBudgets.listBudgets({ enabledOnly: true });
  assert.equal(result.budgets.length, 1);
  assert.equal(result.budgets[0].sessionId, "ext:session-a");
});

// ─────────────────────────────────────────────────────────────────────────────
// incrementUsage
// ─────────────────────────────────────────────────────────────────────────────

test("incrementUsage adds to tokens and cost counters", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-7", null, { maxTokens: 100_000 });

  sessionBudgets.incrementUsage("ext:session-7", 5000, 1.5);
  let budget = sessionBudgets.getBudget("ext:session-7");
  assert.equal(budget?.tokensUsed, 5000);
  assert.equal(budget?.costUsdUsed, 1.5);

  sessionBudgets.incrementUsage("ext:session-7", 3000, 0.5);
  budget = sessionBudgets.getBudget("ext:session-7");
  assert.equal(budget?.tokensUsed, 8000);
  assert.equal(budget?.costUsdUsed, 2.0);
});

test("incrementUsage returns null for non-existent session", () => {
  const result = sessionBudgets.incrementUsage("ext:nonexistent", 100, 0.5);
  assert.equal(result, null);
});

test("incrementUsage floors negative tokens to zero", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-8", null, { maxTokens: 1000 });
  sessionBudgets.incrementUsage("ext:session-8", -100, -5);
  const budget = sessionBudgets.getBudget("ext:session-8");
  assert.equal(budget?.tokensUsed, 0);
  assert.equal(budget?.costUsdUsed, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// resetUsage
// ─────────────────────────────────────────────────────────────────────────────

test("resetUsage zeros the counters", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-9", null, { maxTokens: 100_000 });
  sessionBudgets.incrementUsage("ext:session-9", 50_000, 3.0);

  const reset = sessionBudgets.resetUsage("ext:session-9");
  assert.equal(reset?.tokensUsed, 0);
  assert.equal(reset?.costUsdUsed, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteBudget / deleteBudgetById
// ─────────────────────────────────────────────────────────────────────────────

test("deleteBudget removes a budget by session_id", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-10", null, { maxTokens: 1000 });
  assert.equal(sessionBudgets.deleteBudget("ext:session-10"), true);
  assert.equal(sessionBudgets.getBudget("ext:session-10"), null);
});

test("deleteBudget returns false for non-existent session", () => {
  assert.equal(sessionBudgets.deleteBudget("ext:nonexistent"), false);
});

test("deleteBudgetById removes a budget by primary key", () => {
  const created = sessionBudgets.createOrUpdateBudget("ext:session-11", null, {
    maxTokens: 1000,
  });
  assert.equal(sessionBudgets.deleteBudgetById(created.id), true);
  assert.equal(sessionBudgets.getBudgetById(created.id), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkBudget
// ─────────────────────────────────────────────────────────────────────────────

test("checkBudget returns withinBudget=true when no budget configured", () => {
  const check = sessionBudgets.checkBudget("ext:nonexistent");
  assert.equal(check.withinBudget, true);
  assert.equal(check.warningLevel, 0);
  assert.equal(check.overLimit, null);
  assert.equal(check.remaining.tokens, null);
  assert.equal(check.remaining.costUsd, null);
});

test("checkBudget returns withinBudget=true when under limits", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-12", null, {
    maxTokens: 100_000,
    maxCostUsd: 10.0,
  });
  sessionBudgets.incrementUsage("ext:session-12", 10_000, 1.0);

  const check = sessionBudgets.checkBudget("ext:session-12");
  assert.equal(check.withinBudget, true);
  assert.equal(check.warningLevel, 0.1);
  assert.equal(check.remaining.tokens, 90_000);
  assert.equal(check.remaining.costUsd, 9.0);
  assert.equal(check.overLimit, null);
});

test("checkBudget detects token limit exceeded", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-13", null, {
    maxTokens: 1000,
    maxCostUsd: 100.0,
  });
  sessionBudgets.incrementUsage("ext:session-13", 1000, 1.0);

  const check = sessionBudgets.checkBudget("ext:session-13");
  assert.equal(check.withinBudget, false);
  assert.equal(check.overLimit, "tokens");
  assert.equal(check.remaining.tokens, 0);
});

test("checkBudget detects cost limit exceeded", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-14", null, {
    maxTokens: 1_000_000,
    maxCostUsd: 5.0,
  });
  sessionBudgets.incrementUsage("ext:session-14", 1000, 5.0);

  const check = sessionBudgets.checkBudget("ext:session-14");
  assert.equal(check.withinBudget, false);
  assert.equal(check.overLimit, "cost");
  assert.equal(check.remaining.costUsd, 0);
});

test("checkBudget detects both limits exceeded", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-15", null, {
    maxTokens: 1000,
    maxCostUsd: 5.0,
  });
  sessionBudgets.incrementUsage("ext:session-15", 1000, 5.0);

  const check = sessionBudgets.checkBudget("ext:session-15");
  assert.equal(check.withinBudget, false);
  assert.equal(check.overLimit, "both");
});

test("checkBudget is withinBudget for disabled budget even if over limit", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-16", null, {
    maxTokens: 1000,
    enabled: false,
  });
  sessionBudgets.incrementUsage("ext:session-16", 2000, 0);

  const check = sessionBudgets.checkBudget("ext:session-16");
  assert.equal(check.withinBudget, true, "disabled budget should not block");
});

test("checkBudget warningLevel is the max of token and cost fractions", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-17", null, {
    maxTokens: 100_000,
    maxCostUsd: 10.0,
  });
  sessionBudgets.incrementUsage("ext:session-17", 90_000, 5.0);

  const check = sessionBudgets.checkBudget("ext:session-17");
  // token fraction = 0.9, cost fraction = 0.5 → warningLevel = 0.9
  assert.equal(check.warningLevel, 0.9);
  assert.equal(check.withinBudget, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// isWarningThresholdReached
// ─────────────────────────────────────────────────────────────────────────────

test("isWarningThresholdReached returns true when at 80% threshold", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-18", null, {
    maxTokens: 100_000,
    warningThreshold: 0.8,
  });
  sessionBudgets.incrementUsage("ext:session-18", 80_000, 0);

  assert.equal(sessionBudgets.isWarningThresholdReached("ext:session-18"), true);
});

test("isWarningThresholdReached returns false when below threshold", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-19", null, {
    maxTokens: 100_000,
    warningThreshold: 0.8,
  });
  sessionBudgets.incrementUsage("ext:session-19", 70_000, 0);

  assert.equal(sessionBudgets.isWarningThresholdReached("ext:session-19"), false);
});

test("isWarningThresholdReached returns false when over budget (not just warning)", () => {
  sessionBudgets.createOrUpdateBudget("ext:session-20", null, {
    maxTokens: 1000,
    warningThreshold: 0.8,
  });
  sessionBudgets.incrementUsage("ext:session-20", 1000, 0);

  // Over budget → withinBudget is false → warning should be false
  assert.equal(sessionBudgets.isWarningThresholdReached("ext:session-20"), false);
});

test("isWarningThresholdReached returns false for non-existent budget", () => {
  assert.equal(sessionBudgets.isWarningThresholdReached("ext:nonexistent"), false);
});
