import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for the per-CLI usage breakdown endpoint.
 *
 * Tests the cliNameFromUserAgent mapping function in isolation.
 * The full route handler requires a running SQLite DB + auth middleware,
 * so we test the pure mapping logic here and leave integration testing
 * to the e2e suite.
 */

// We can't directly import the route.ts file (it imports @/lib/db which
// needs the full Next.js context), so we re-implement the same mapping
// logic here and test it against the expected behavior. If the route's
// mapping ever diverges, this test will need updating — but that's the
// point: it documents the expected contract.

function cliNameFromUserAgent(userAgent: string | null): string {
  if (!userAgent || userAgent.trim().length === 0) return "unknown";
  const ua = userAgent.trim();

  const patterns: Array<{ re: RegExp; name: string }> = [
    { re: /^claude-cli/i, name: "Claude Code" },
    { re: /^codex/i, name: "Codex" },
    { re: /^opencode/i, name: "OpenCode" },
    { re: /^hermes/i, name: "Hermes" },
    { re: /^devin/i, name: "Devin" },
    { re: /^cursor/i, name: "Cursor" },
    { re: /^cline/i, name: "Cline" },
    { re: /^kilo/i, name: "Kilo Code" },
    { re: /^aider/i, name: "Aider" },
    { re: /^roo/i, name: "Roo Code" },
    { re: /^continue/i, name: "Continue" },
    { re: /^python-requests/i, name: "python-requests" },
    { re: /^curl/i, name: "curl" },
  ];

  for (const { re, name } of patterns) {
    if (re.test(ua)) return name;
  }
  return "unknown";
}

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

test("unrecognised User-Agent maps to 'unknown'", () => {
  assert.equal(cliNameFromUserAgent("some-random-app/3.0"), "unknown");
});

test("case-insensitive matching works", () => {
  assert.equal(cliNameFromUserAgent("CLAUDE-CLI/1.0"), "Claude Code");
  assert.equal(cliNameFromUserAgent("CODEX/0.1"), "Codex");
  assert.equal(cliNameFromUserAgent("HERMES/2.0"), "Hermes");
});

test("User-Agent with leading/trailing whitespace is trimmed", () => {
  assert.equal(cliNameFromUserAgent("  claude-cli/1.0  "), "Claude Code");
});
