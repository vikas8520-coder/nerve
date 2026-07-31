import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getDbInstance } from "@/lib/db/core";
import { sanitizeErrorMessage } from "@nerve/open-sse/utils/error";

/**
 * Map a raw User-Agent string to a human-friendly CLI name.
 *
 * CLIs send distinctive User-Agent values (e.g. "claude-cli/1.0", "codex/0.1",
 * "opencode/1.2"). When the UA is null/empty or unrecognised we label it
 * "unknown" so the breakdown always has a stable bucket for unattributed
 * traffic.
 */
function cliNameFromUserAgent(userAgent: string | null): string {
  if (!userAgent || userAgent.trim().length === 0) return "unknown";
  const ua = userAgent.trim();

  // Common CLI identifiers — checked in order of specificity.
  const patterns: Array<{ re: RegExp; name: string }> = [
    { re: /^claude-cli/i, name: "Claude Code" },
    { re: /^codex/i, name: "Codex" },
    { re: /^opencode/i, name: "OpenCode" },
    { re: /^hermes/i, name: "Hermes" },
    { re: /^cursor/i, name: "Cursor" },
    { re: /^cline/i, name: "Cline" },
    { re: /^kilo/i, name: "Kilo Code" },
    { re: /^roo/i, name: "Roo Code" },
    { re: /^aider/i, name: "Aider" },
    { re: /^goose/i, name: "Goose" },
    { re: /^continue/i, name: "Continue" },
    { re: /^qwen/i, name: "Qwen" },
    { re: /^crush/i, name: "Crush" },
  ];

  for (const { re, name } of patterns) {
    if (re.test(ua)) return name;
  }

  // Fall back to the raw UA string (truncated for display).
  return ua.length > 60 ? ua.slice(0, 57) + "…" : ua;
}

interface ByCliRow {
  cli_name: string;
  total_tokens: number;
  total_requests: number;
  last_used: string | null;
}

/**
 * GET /api/usage/by-cli — per-CLI usage breakdown.
 *
 * Groups relay_logs by User-Agent header value, summing tokens and requests,
 * and returning the most recent activity timestamp per CLI.
 *
 * Query params:
 *   ?since=<iso>  — only include logs at or after this timestamp.
 *
 * Requires management auth.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since") || null;

    const db = getDbInstance();

    // relay_logs stores user_agent, prompt_tokens, completion_tokens, and
    // created_at (unix seconds). Group by user_agent, summing tokens/requests.
    const sinceClause = since ? "WHERE created_at >= @since" : "";
    const params: Record<string, unknown> = {};
    if (since) {
      const sinceSeconds = Math.floor(new Date(since).getTime() / 1000);
      if (Number.isFinite(sinceSeconds)) {
        params.since = sinceSeconds;
      }
    }

    const rows = db
      .prepare(
        `
        SELECT
          user_agent,
          COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens,
          COUNT(*) AS total_requests,
          MAX(created_at) AS last_used_epoch
        FROM relay_logs
        ${sinceClause}
        GROUP BY user_agent
        ORDER BY total_tokens DESC
      `
      )
      .all(params) as Array<{
      user_agent: string | null;
      total_tokens: number;
      total_requests: number;
      last_used_epoch: number | null;
    }>;

    const result: ByCliRow[] = rows.map((row) => ({
      cli_name: cliNameFromUserAgent(row.user_agent),
      total_tokens: Number(row.total_tokens) || 0,
      total_requests: Number(row.total_requests) || 0,
      last_used: row.last_used_epoch ? new Date(row.last_used_epoch * 1000).toISOString() : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API ERROR] /api/usage/by-cli failed:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
