/**
 * T-08 options-schema tests.
 *
 * Covers `parseNervePluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseNervePluginOptions } from "../src/index.js";

test("parseNervePluginOptions: undefined → {}", () => {
  assert.deepEqual(parseNervePluginOptions(undefined), {});
});

test("parseNervePluginOptions: null → {}", () => {
  assert.deepEqual(parseNervePluginOptions(null), {});
});

test("parseNervePluginOptions: empty object → {}", () => {
  assert.deepEqual(parseNervePluginOptions({}), {});
});

test("parseNervePluginOptions: valid providerId → returns it", () => {
  const r = parseNervePluginOptions({ providerId: "nerve-preprod" });
  assert.equal(r.providerId, "nerve-preprod");
});

test("parseNervePluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(() => parseNervePluginOptions({ providerId: "nerve prod!" }), /providerId.*slug/i);
});

test("parseNervePluginOptions: empty providerId → throws", () => {
  assert.throws(() => parseNervePluginOptions({ providerId: "" }), /providerId/i);
});

test("parseNervePluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parseNervePluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parseNervePluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parseNervePluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parseNervePluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parseNervePluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parseNervePluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parseNervePluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parseNervePluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parseNervePluginOptions({
        providerId: "nerve",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parseNervePluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "nerve-prod",
    displayName: "Nerve Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parseNervePluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parseNervePluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parseNervePluginOptions({
      providerId: "",
      baseURL: "garbage",
    });
    assert.fail("expected throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /providerId/);
    assert.match(msg, /baseURL/);
  }
});

test("parseNervePluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parseNervePluginOptions / NervePlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parseNervePluginOptions, "function");
});
