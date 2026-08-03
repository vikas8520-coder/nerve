import test from "node:test";
import assert from "node:assert/strict";
import { NERVE_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import { buildNerveResponseMetaHeaders } from "../../src/domain/nerveResponseMeta.ts";

test("headers constant exposes the fallback-attempts key", () => {
  assert.equal(NERVE_RESPONSE_HEADERS.fallbackAttempts, "X-Nerve-Fallback-Attempts");
});

test("buildNerveResponseMetaHeaders emits the fallback-attempts count when > 0", () => {
  const h = buildNerveResponseMetaHeaders({
    model: "gpt",
    provider: "openai",
    fallbackAttempts: 2,
  });
  assert.equal(h["X-Nerve-Fallback-Attempts"], "2");
});

test("buildNerveResponseMetaHeaders omits the header when 0 / absent", () => {
  const none = buildNerveResponseMetaHeaders({ model: "gpt" });
  assert.equal(none["X-Nerve-Fallback-Attempts"], undefined);
  const zero = buildNerveResponseMetaHeaders({ model: "gpt", fallbackAttempts: 0 });
  assert.equal(zero["X-Nerve-Fallback-Attempts"], undefined);
});
