import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getDbInstance } from "@/lib/db/core";
import { sanitizeErrorMessage } from "@nerve/open-sse/utils/error";
import { cliNameFromUserAgent } from "@/shared/utils/cliNameFromUserAgent";

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
    let sinceSeconds: number | null = null;
    if (since) {
      const parsed = Math.floor(new Date(since).getTime() / 1000);
      if (Number.isFinite(parsed)) {
        sinceSeconds = parsed;
      } else {
        return NextResponse.json(
          { error: "Invalid 'since' date. Expected an ISO 8601 timestamp." },
          { status: 400 }
        );
      }
    }
    const sinceClause = sinceSeconds !== null ? "WHERE created_at >= @since" : "";
    const params: Record<string, unknown> = {};
    if (sinceSeconds !== null) {
      params.since = sinceSeconds;
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
