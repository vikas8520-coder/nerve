/**
 * Map a raw User-Agent string to a human-friendly CLI name.
 *
 * CLIs send distinctive User-Agent values (e.g. "claude-cli/1.0", "codex/0.1",
 * "opencode/1.2"). When the UA is null/empty or unrecognised we fall back to
 * the raw string (truncated) so the breakdown always shows something useful.
 *
 * Extracted to a shared utility so both the API route and unit tests import
 * the same implementation.
 */
export function cliNameFromUserAgent(userAgent: string | null): string {
  if (!userAgent || userAgent.trim().length === 0) return "unknown";
  const ua = userAgent.trim();

  // Common CLI identifiers — checked in order of specificity.
  const patterns: Array<{ re: RegExp; name: string }> = [
    { re: /^claude-cli/i, name: "Claude Code" },
    { re: /^codex/i, name: "Codex" },
    { re: /^opencode/i, name: "OpenCode" },
    { re: /^hermes/i, name: "Hermes" },
    { re: /^devin/i, name: "Devin" },
    { re: /^cursor/i, name: "Cursor" },
    { re: /^cline/i, name: "Cline" },
    { re: /^kilo/i, name: "Kilo Code" },
    { re: /^roo/i, name: "Roo Code" },
    { re: /^aider/i, name: "Aider" },
    { re: /^goose/i, name: "Goose" },
    { re: /^continue/i, name: "Continue" },
    { re: /^qwen/i, name: "Qwen" },
    { re: /^crush/i, name: "Crush" },
    { re: /^python-requests/i, name: "python-requests" },
    { re: /^curl/i, name: "curl" },
  ];

  for (const { re, name } of patterns) {
    if (re.test(ua)) return name;
  }

  // Fall back to the raw UA string (truncated for display).
  return ua.length > 60 ? ua.slice(0, 57) + "…" : ua;
}
