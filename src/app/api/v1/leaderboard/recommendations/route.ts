/**
 * GET /api/v1/leaderboard/recommendations
 *
 * Returns the best provider+model per task type (coding, reasoning, chat,
 * vision), blended from call-log performance and model_intelligence scores.
 */

import { NextResponse } from "next/server";
import { errorResponse } from "@nerve/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@nerve/open-sse/config/constants.ts";
import { getTaskBasedRecommendations } from "@/lib/db/providerStats";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const recommendations = getTaskBasedRecommendations();
    return NextResponse.json(recommendations, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/leaderboard/recommendations]", msg);
    return errorResponse(HTTP_STATUS.SERVER_ERROR, "Failed to build task-based recommendations");
  }
}
