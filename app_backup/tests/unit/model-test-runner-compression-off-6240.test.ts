// #6240 — the "Test model" internal request builders must always send
// `X-Nerve-Compression: off` so a globally-enabled Output Style (e.g. "Ultra terse") never
// leaks a system-prompt injection into a plain connection test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInternalChatRequest, buildInternalRerankRequest } from "@/lib/api/modelTestRunner.ts";

test("buildInternalChatRequest sends X-Nerve-Compression: off", () => {
  const controller = new AbortController();
  const request = buildInternalChatRequest({ model: "openai/gpt-4" }, controller.signal);
  assert.equal(request.headers.get("X-Nerve-Compression"), "off");
  assert.equal(request.headers.get("X-Nerve-No-Cache"), "true");
});

test("buildInternalRerankRequest sends X-Nerve-Compression: off", () => {
  const controller = new AbortController();
  const request = buildInternalRerankRequest({ model: "openai/rerank-1" }, controller.signal);
  assert.equal(request.headers.get("X-Nerve-Compression"), "off");
  assert.equal(request.headers.get("X-Nerve-No-Cache"), "true");
});
