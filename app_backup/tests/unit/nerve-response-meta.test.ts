import test from "node:test";
import assert from "node:assert/strict";

import {
  attachNerveMetaHeaders,
  buildNerveResponseMetaHeaders,
  buildNerveSseMetadataComment,
  formatNerveCost,
  getNerveTokenCounts,
} from "../../src/domain/nerveResponseMeta.ts";
import { APP_CONFIG } from "../../src/shared/constants/appConfig.ts";
import { NERVE_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";

test("getNerveTokenCounts normalizes common usage shapes", () => {
  assert.deepEqual(
    getNerveTokenCounts({
      prompt_tokens: 12,
      completion_tokens: 5,
    }),
    { input: 12, output: 5 }
  );
  assert.deepEqual(
    getNerveTokenCounts({
      input_tokens: "9",
      output_tokens: "4",
    }),
    { input: 9, output: 4 }
  );
});

test("buildNerveResponseMetaHeaders formats provider alias, tokens, latency, and cost", () => {
  const headers = buildNerveResponseMetaHeaders({
    provider: "claude",
    model: "claude-sonnet-4-6",
    cacheHit: true,
    latencyMs: 1234.6,
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
    },
    costUsd: 0.00123456789,
  });

  assert.equal(headers["X-Nerve-Provider"], "cc");
  assert.equal(headers["X-Nerve-Model"], "claude-sonnet-4-6");
  assert.equal(headers["X-Nerve-Cache-Hit"], "true");
  assert.equal(headers["X-Nerve-Latency-Ms"], "1235");
  assert.equal(headers["X-Nerve-Tokens-In"], "11");
  assert.equal(headers["X-Nerve-Tokens-Out"], "7");
  assert.equal(headers["X-Nerve-Response-Cost"], "0.0012345679");
});

test("buildNerveResponseMetaHeaders keeps ASCII model header values unchanged", () => {
  const headers = buildNerveResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o-mini",
  });

  assert.equal(headers[NERVE_RESPONSE_HEADERS.model], "gpt-4o-mini");
});

test("buildNerveResponseMetaHeaders percent-encodes non-ASCII model header values", () => {
  const model = "free-mix/[假流式]gemini-3.5-flash";
  const headers = buildNerveResponseMetaHeaders({
    provider: "openai",
    model,
  });

  assert.equal(headers[NERVE_RESPONSE_HEADERS.model], encodeURIComponent(model));
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildNerveResponseMetaHeaders strips control characters from string header values", () => {
  const headers = buildNerveResponseMetaHeaders({
    provider: "openai",
    model: "free\r\nX-Injected: yes\u0000-model",
    requestId: "req-1\nreq-2\rreq-3\u0007",
  });

  assert.doesNotMatch(headers[NERVE_RESPONSE_HEADERS.model], /[\r\n\u0000-\u001f\u007f]/);
  assert.doesNotMatch(headers[NERVE_RESPONSE_HEADERS.requestId], /[\r\n\u0000-\u001f\u007f]/);
  assert.equal(headers[NERVE_RESPONSE_HEADERS.model], "freeX-Injected: yes-model");
  assert.equal(headers[NERVE_RESPONSE_HEADERS.requestId], "req-1req-2req-3");
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildNerveResponseMetaHeaders always emits X-Nerve-Version", () => {
  const headers = buildNerveResponseMetaHeaders({ provider: "openai", model: "gpt" });
  assert.equal(headers[NERVE_RESPONSE_HEADERS.version], APP_CONFIG.version);

  // Even with no provider/model at all, the version is still attached.
  const bare = buildNerveResponseMetaHeaders({});
  assert.equal(bare[NERVE_RESPONSE_HEADERS.version], APP_CONFIG.version);
});

test("buildNerveResponseMetaHeaders emits X-Nerve-Request-Id only when provided", () => {
  const withId = buildNerveResponseMetaHeaders({ model: "gpt", requestId: "req-123" });
  assert.equal(withId[NERVE_RESPONSE_HEADERS.requestId], "req-123");

  const noId = buildNerveResponseMetaHeaders({ model: "gpt" });
  assert.equal(noId[NERVE_RESPONSE_HEADERS.requestId], undefined);

  const nullId = buildNerveResponseMetaHeaders({ model: "gpt", requestId: null });
  assert.equal(nullId[NERVE_RESPONSE_HEADERS.requestId], undefined);

  const blankId = buildNerveResponseMetaHeaders({ model: "gpt", requestId: "   " });
  assert.equal(blankId[NERVE_RESPONSE_HEADERS.requestId], undefined);
});

test("attachNerveMetaHeaders mutates a Headers instance in place, preserving existing entries", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachNerveMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
    requestId: "req-abc",
  });

  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get(NERVE_RESPONSE_HEADERS.version), APP_CONFIG.version);
  assert.equal(headers.get(NERVE_RESPONSE_HEADERS.requestId), "req-abc");
  assert.equal(headers.get(NERVE_RESPONSE_HEADERS.model), "gpt");
});

test("attachNerveMetaHeaders mutates a plain record in place, preserving existing entries", () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  attachNerveMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
  });

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers[NERVE_RESPONSE_HEADERS.version], APP_CONFIG.version);
  assert.equal(headers[NERVE_RESPONSE_HEADERS.model], "gpt");
  // No requestId provided → header omitted.
  assert.equal(headers[NERVE_RESPONSE_HEADERS.requestId], undefined);
});

test("buildNerveSseMetadataComment emits comment lines compatible with SSE", () => {
  const comment = buildNerveSseMetadataComment({
    provider: "openai",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 4,
      completion_tokens: 2,
    },
    latencyMs: 50,
    costUsd: formatNerveCost(0),
  });

  assert.match(comment, /^: x-nerve-cache-hit=false/m);
  assert.match(comment, /^: x-nerve-provider=openai/m);
  assert.match(comment, /^: x-nerve-model=gpt-4o-mini/m);
  assert.match(comment, /^: x-nerve-tokens-in=4/m);
  assert.match(comment, /^: x-nerve-tokens-out=2/m);
  assert.match(comment, /^: x-nerve-response-cost=0\.0000000000/m);
});

test("buildNerveResponseMetaHeaders emits X-Nerve-Cost-Saved only when costSavedUsd is provided", () => {
  // Cache HIT: the incremental cost of serving the hit is 0, but the cache saved the
  // original (would-have-been) cost — surfaced via the Cost-Saved header for analytics.
  const hit = buildNerveResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(hit[NERVE_RESPONSE_HEADERS.responseCost], "0.0000000000");
  assert.equal(hit[NERVE_RESPONSE_HEADERS.costSaved], "0.0125000000");

  // A normal response (no costSavedUsd) omits the Cost-Saved header entirely.
  const miss = buildNerveResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.0125,
  });
  assert.equal(miss[NERVE_RESPONSE_HEADERS.costSaved], undefined);

  // A free-model HIT still emits Cost-Saved (= 0) — it explicitly passed costSavedUsd.
  const freeHit = buildNerveResponseMetaHeaders({
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0,
  });
  assert.equal(freeHit[NERVE_RESPONSE_HEADERS.costSaved], "0.0000000000");
});

test("attachNerveMetaHeaders forwards costSavedUsd onto a Headers bag", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachNerveMetaHeaders(headers, {
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(headers.get(NERVE_RESPONSE_HEADERS.responseCost), "0.0000000000");
  assert.equal(headers.get(NERVE_RESPONSE_HEADERS.costSaved), "0.0125000000");
});
