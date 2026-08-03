import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NERVE_BASE_URL,
  resolveNerveBaseUrl,
} from "../../src/shared/utils/resolveNerveBaseUrl.ts";

test("resolveNerveBaseUrl prefers NERVE_BASE_URL", () => {
  assert.equal(
    resolveNerveBaseUrl({
      NERVE_BASE_URL: "https://internal.example.com/",
      BASE_URL: "https://base.example.com",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://internal.example.com"
  );
});

test("resolveNerveBaseUrl falls back to BASE_URL", () => {
  assert.equal(
    resolveNerveBaseUrl({
      BASE_URL: "https://base.example.com/",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://base.example.com"
  );
});

test("resolveNerveBaseUrl falls back to NEXT_PUBLIC_BASE_URL", () => {
  assert.equal(
    resolveNerveBaseUrl({
      NEXT_PUBLIC_BASE_URL: "https://public.example.com/",
    }),
    "https://public.example.com"
  );
});

test("resolveNerveBaseUrl ignores blank values", () => {
  assert.equal(
    resolveNerveBaseUrl({
      NERVE_BASE_URL: "   ",
      BASE_URL: "",
      NEXT_PUBLIC_BASE_URL: " https://public.example.com/ ",
    }),
    "https://public.example.com"
  );
});

test("resolveNerveBaseUrl uses the default localhost fallback", () => {
  assert.equal(resolveNerveBaseUrl({}), DEFAULT_NERVE_BASE_URL);
});
