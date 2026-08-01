/**
 * GET /api/v1/leaderboard?hours=24
 *
 * Returns the Provider Health Leaderboard — providers ranked by observed
 * performance (success rate, latency, throughput, cost) over the given
 * look-back window. Aggregates the existing `call_logs` table; no new tables.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@nerve/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@nerve/open-sse/config/constants.ts";
import { getProviderLeaderboard } from "@/lib/db/providerStats";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

const QuerySchema = z.object({
  hours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .default(24),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    hours: url.searchParams.get("hours") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      parsed.error.issues[0]?.message ?? "Invalid hours parameter"
    );
  }

  try {
    const entries = getProviderLeaderboard(parsed.data.hours);
    return NextResponse.json(
      { hours: parsed.data.hours, count: entries.length, entries },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/leaderboard]", msg);
    return errorResponse(HTTP_STATUS.SERVER_ERROR, "Failed to build provider leaderboard");
  }
}
