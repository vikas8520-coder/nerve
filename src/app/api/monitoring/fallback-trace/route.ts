/**
 * GET /api/monitoring/fallback-trace
 *
 * Returns the most recent fallback-trace events (Phase 2.2 observability).
 * Query params:
 *   - requestId: filter to a single request correlation id
 *   - limit: max number of events to return (default 100)
 *
 * Response shape:
 *   { traces: FallbackTraceEvent[] }
 *
 * See open-sse/services/fallbackTrace.ts for the ring-buffer implementation.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFallbackTraces,
  reloadFallbackTraceConfig,
} from "../../../../../open-sse/services/fallbackTrace.ts";
import { isAuthenticated } from "@/shared/utils/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json(
      { error: { code: "AUTH_001", message: "Authentication required" } },
      { status: 401 }
    );
  }
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId") || undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(Number(limitRaw) || 100, 1000)) : 100;

  // Re-read env-derived config on each call (cheap; honours hot-reload of
  // NERVE_FALLBACK_TRACE_ENABLED / NERVE_FALLBACK_TRACE_CAPACITY).
  reloadFallbackTraceConfig();

  const traces = getFallbackTraces({ requestId, limit });
  return NextResponse.json({ traces });
}
