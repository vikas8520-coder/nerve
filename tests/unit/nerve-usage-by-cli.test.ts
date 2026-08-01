import test from "node:test";
import assert from "node:assert/strict";
import { cliNameFromUserAgent } from "../../src/shared/utils/cliNameFromUserAgent.ts";

/**
 * Unit tests for the per-CLI usage breakdown's User-Agent mapper.
 *
 * These tests import the actual production mapper from
 * src/shared/utils/cliNameFromUserAgent.ts — the same module the API route
 * uses — so they validate real behaviour rather than a duplicated copy.
 */

test("null User-Agent maps to 'unknown'", () => {
  assert.equal(cliNameFromUserAgent(null), "unknown");
});

test("empty string User-Agent maps to 'unknown'", () => {
  assert.equal(cliNameFromUserAgent(""), "unknown");
});

test("whitespace-only User-Agent maps to 'unknown'", () => {
  assert.equal(cliNameFromUserAgent("   "), "unknown");
});

test("claude-cli/1.0 maps to 'Claude Code'", () => {
  assert.equal(cliNameFromUserAgent("claude-cli/1.0"), "Claude Code");
});

test("codex/0.1.4 maps to 'Codex'", () => {
  assert.equal(cliNameFromUserAgent("codex/0.1.4"), "Codex");
});

test("opencode/1.18.10 maps to 'OpenCode'", () => {
  assert.equal(cliNameFromUserAgent("opencode/1.18.10"), "OpenCode");
});

test("hermes/2.0 maps to 'Hermes'", () => {
  assert.equal(cliNameFromUserAgent("hermes/2.0"), "Hermes");
});

test("devin-cli/1.0 maps to 'Devin'", () => {
  assert.equal(cliNameFromUserAgent("devin-cli/1.0"), "Devin");
});

test("curl/8.7.2 maps to 'curl'", () => {
  assert.equal(cliNameFromUserAgent("curl/8.7.2"), "curl");
});

test("python-requests/2.31 maps to 'python-requests'", () => {
  assert.equal(cliNameFromUserAgent("python-requests/2.31"), "python-requests");
});

test("unrecognised User-Agent falls back to raw string", () => {
  assert.equal(cliNameFromUserAgent("some-random-app/3.0"), "some-random-app/3.0");
});

test("case-insensitive matching works", () => {
  assert.equal(cliNameFromUserAgent("CLAUDE-CLI/1.0"), "Claude Code");
  assert.equal(cliNameFromUserAgent("CODEX/0.1"), "Codex");
  assert.equal(cliNameFromUserAgent("HERMES/2.0"), "Hermes");
});

test("User-Agent with leading/trailing whitespace is trimmed", () => {
  assert.equal(cliNameFromUserAgent("  claude-cli/1.0  "), "Claude Code");
});

test("very long unrecognised User-Agent is truncated with ellipsis", () => {
  const long = "x".repeat(70);
  const result = cliNameFromUserAgent(long);
  assert.ok(result.length <= 60, `result should be <= 60 chars, got ${result.length}`);
  assert.ok(result.endsWith("…"), "truncated result should end with ellipsis");
});
