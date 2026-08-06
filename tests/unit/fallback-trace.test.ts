/**
 * Unit tests for open-sse/services/fallbackTrace.ts (Phase 2.2 observability).
 * Verifies the in-memory ring buffer: append, newest-first ordering, capacity
 * wrap, requestId filter, and clear.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  recordFallbackTrace,
  getFallbackTraces,
  clearFallbackTraces,
  reloadFallbackTraceConfig,
} from "../../open-sse/services/fallbackTrace.ts";

test("records and retrieves traces newest-first", () => {
  clearFallbackTraces();
  recordFallbackTrace({
    requestId: "r1",
    stage: "family_fallback",
    fromModel: "a",
    toModel: "b",
    reason: "ctx overflow",
  });
  recordFallbackTrace({
    requestId: "r1",
    stage: "combo_fallback",
    fromModel: "b",
    toModel: "c",
    reason: "500",
  });
  const traces = getFallbackTraces();
  assert.equal(traces.length, 2);
  // Newest first.
  assert.equal(traces[0].fromModel, "b");
  assert.equal(traces[1].fromModel, "a");
});

test("filters by requestId", () => {
  clearFallbackTraces();
  recordFallbackTrace({
    requestId: "alpha",
    stage: "family_fallback",
    fromModel: "x",
    toModel: "y",
    reason: "r",
  });
  recordFallbackTrace({
    requestId: "beta",
    stage: "combo_fallback",
    fromModel: "y",
    toModel: "z",
    reason: "r",
  });
  const alpha = getFallbackTraces({ requestId: "alpha" });
  assert.equal(alpha.length, 1);
  assert.equal(alpha[0].requestId, "alpha");
});

test("respects capacity and wraps (ring buffer)", () => {
  clearFallbackTraces();
  // Default capacity 100; force a smaller one via env.
  process.env.NERVE_FALLBACK_TRACE_CAPACITY = "3";
  reloadFallbackTraceConfig();
  for (let i = 0; i < 5; i++) {
    recordFallbackTrace({
      requestId: "wrap",
      stage: "combo_fallback",
      fromModel: `m${i}`,
      toModel: `m${i + 1}`,
      reason: "test",
    });
  }
  const traces = getFallbackTraces();
  assert.equal(traces.length, 3);
  // Newest is m4→m5.
  assert.equal(traces[0].fromModel, "m4");
  // Oldest retained is m2→m3 (m0, m1 evicted).
  assert.equal(traces[2].fromModel, "m2");
  delete process.env.NERVE_FALLBACK_TRACE_CAPACITY;
  reloadFallbackTraceConfig();
});

test("limit option bounds the result", () => {
  clearFallbackTraces();
  for (let i = 0; i < 10; i++) {
    recordFallbackTrace({
      requestId: "lim",
      stage: "global_fallback",
      fromModel: `g${i}`,
      toModel: null,
      reason: "exhausted",
    });
  }
  const traces = getFallbackTraces({ limit: 4 });
  assert.equal(traces.length, 4);
});

test("clear empties the buffer", () => {
  clearFallbackTraces();
  recordFallbackTrace({
    requestId: "c",
    stage: "family_fallback",
    fromModel: "a",
    toModel: "b",
    reason: "r",
  });
  assert.equal(getFallbackTraces().length, 1);
  clearFallbackTraces();
  assert.equal(getFallbackTraces().length, 0);
});
