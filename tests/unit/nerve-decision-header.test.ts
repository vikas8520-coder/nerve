import test from "node:test";
import assert from "node:assert/strict";
import { NERVE_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import {
  buildNerveDecisionHeaderValue,
  buildNerveResponseMetaHeaders,
} from "../../src/domain/nerveResponseMeta.ts";
import { assembleStreamingResponseHeaders } from "../../open-sse/handlers/chatCore/streamingResponseHeaders.ts";
import { buildNonStreamingResponseHeaders } from "../../open-sse/handlers/chatCore/nonStreamingResponseHeaders.ts";

test("headers constant exposes the decision key", () => {
  assert.equal(NERVE_RESPONSE_HEADERS.decision, "X-Nerve-Decision");
});

test("buildNerveResponseMetaHeaders emits X-Nerve-Decision for a combo strategy", () => {
  const headers = buildNerveResponseMetaHeaders({
    strategy: "priority",
    provider: "openai",
    model: "gpt-4o",
    latencyMs: 42,
  });
  assert.equal(headers["X-Nerve-Decision"], "strategy=priority; provider=openai; latency_ms=42");
});

test("strategy: single (non-combo request) still emits the header", () => {
  const headers = buildNerveResponseMetaHeaders({
    strategy: "single",
    provider: "anthropic",
    latencyMs: 10,
  });
  assert.equal(headers["X-Nerve-Decision"], "strategy=single; provider=anthropic; latency_ms=10");
});

test("omitted strategy AND provider -> header absent entirely", () => {
  const headers = buildNerveResponseMetaHeaders({ model: "gpt-4o" });
  assert.equal("X-Nerve-Decision" in headers, false);
});

test("control characters in strategy are stripped, no header-injection / leak surface", () => {
  const value = buildNerveDecisionHeaderValue({
    strategy: "prio\r\nrity",
    provider: "openai",
    latencyMs: 5,
  });
  assert.ok(value !== null);
  assert.equal(/[\r\n]/.test(value as string), false);
  assert.equal((value as string).includes("Error:"), false);
  assert.equal((value as string).includes(" at /"), false);
});

test("assembleStreamingResponseHeaders includes X-Nerve-Decision with strategy=fusion", () => {
  const providerHeaders = new Headers();
  const headers = assembleStreamingResponseHeaders({
    providerHeaders,
    provider: "openai",
    model: "gpt-4o",
    pendingRequestId: "req-1",
    comboStrategy: "fusion",
  });
  assert.equal(headers["X-Nerve-Decision"], "strategy=fusion; provider=openai; latency_ms=0");
});

test("buildNonStreamingResponseHeaders falls back to strategy=single when comboStrategy is null", () => {
  const headers = buildNonStreamingResponseHeaders({
    provider: "openai",
    model: "gpt-4o",
    startTime: Date.now(),
    responseUsage: null,
    estimatedCost: 0,
    requestId: "req-2",
    comboStrategy: null,
  });
  assert.match(headers["X-Nerve-Decision"], /^strategy=single; provider=openai; latency_ms=\d+$/);
});
