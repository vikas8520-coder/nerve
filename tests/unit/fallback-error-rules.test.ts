/**
 * Unit tests for open-sse/config/fallbackErrorRules.ts (Phase 2.6).
 * Verifies the configurable rule loader, override JSON support, and matchers.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import {
  reloadFallbackErrorRules,
  getFallbackErrorRules,
  getContextOverflowPatterns,
  matchesModelUnavailable,
  matchesContextOverflow,
  DEFAULT_FALLBACK_ERROR_RULES,
} from "../../open-sse/config/fallbackErrorRules.ts";

test("loads bundled defaults when no override path is set", () => {
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
  reloadFallbackErrorRules();
  const rules = getFallbackErrorRules();
  assert.ok(rules.modelUnavailable.length > 0);
  assert.ok(rules.contextOverflow.length > 0);
});

test("matches a known model-unavailable fragment (case-insensitive)", () => {
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
  reloadFallbackErrorRules();
  assert.equal(matchesModelUnavailable("Error: model_not_found for this account"), true);
  assert.equal(matchesModelUnavailable("This model does not exist"), true);
  assert.equal(matchesModelUnavailable("all good, here is your completion"), false);
});

test("matches a known context-overflow pattern", () => {
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
  reloadFallbackErrorRules();
  assert.equal(matchesContextOverflow("prompt is too long for the model context window"), true);
  assert.equal(matchesContextOverflow("maximum context length exceeded"), true);
  assert.equal(matchesContextOverflow("everything is fine"), false);
});

test("compiles context-overflow regexes from the active rules", () => {
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
  reloadFallbackErrorRules();
  const patterns = getContextOverflowPatterns();
  assert.ok(Array.isArray(patterns));
  assert.equal(patterns.length, DEFAULT_FALLBACK_ERROR_RULES.contextOverflow.length);
});

test("override JSON extends the model-unavailable list", () => {
  const tmp = `/tmp/fallback-rules-${Date.now()}.json`;
  writeFileSync(
    tmp,
    JSON.stringify({
      modelUnavailable: ["custom_provider_model_missing"],
      contextOverflow: ["custom context overflow signal"],
    })
  );
  process.env.NERVE_FALLBACK_ERROR_RULES_PATH = tmp;
  reloadFallbackErrorRules();
  assert.equal(matchesModelUnavailable("custom_provider_model_missing detected"), true);
  assert.equal(matchesContextOverflow("custom context overflow signal here"), true);
  unlinkSync(tmp);
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
});

test("keeps defaults when override JSON is partial", () => {
  const tmp = `/tmp/fallback-rules-partial-${Date.now()}.json`;
  writeFileSync(tmp, JSON.stringify({ modelUnavailable: ["only-this-one"] }));
  process.env.NERVE_FALLBACK_ERROR_RULES_PATH = tmp;
  reloadFallbackErrorRules();
  // contextOverflow came from the file as empty → falls back to defaults.
  assert.equal(
    getContextOverflowPatterns().length,
    DEFAULT_FALLBACK_ERROR_RULES.contextOverflow.length
  );
  unlinkSync(tmp);
  delete process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
});
