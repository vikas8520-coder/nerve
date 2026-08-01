/**
 * API: Session Budget by session ID
 * GET    — Get current budget status
 * DELETE — Delete a budget
 */

import { NextResponse } from "next/server";
import { buildErrorBody } from "@nerve/open-sse/utils/error";
import { z } from "zod";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { checkBudget, deleteBudget, getBudget } from "@/lib/db/sessionBudgets";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function OPTIONS() {
  return handleCorsOptions();
}

const sessionIdSchema = z.string().min(1).max(256);

async function getValidatedSessionId(
  params: Promise<{ sessionId: string }>
): Promise<string | null> {
  const { sessionId } = await params;
  const parsed = sessionIdSchema.safeParse(sessionId);
  return parsed.success ? parsed.data : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const sessionId = await getValidatedSessionId(params);
    if (!sessionId) {
      return NextResponse.json(buildErrorBody(400, "Invalid session ID"), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
    const budget = getBudget(sessionId);
    if (!budget) {
      return NextResponse.json(buildErrorBody(404, "Session budget not found"), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const status = checkBudget(sessionId);
    return NextResponse.json({ budget, status }, { headers: CORS_HEADERS });
  } catch (error: unknown) {
    return NextResponse.json(buildErrorBody(500, "Failed to get session budget"), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const sessionId = await getValidatedSessionId(params);
    if (!sessionId) {
      return NextResponse.json(buildErrorBody(400, "Invalid session ID"), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
    const deleted = deleteBudget(sessionId);
    if (!deleted) {
      return NextResponse.json(buildErrorBody(404, "Session budget not found"), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: unknown) {
    return NextResponse.json(buildErrorBody(500, "Failed to delete session budget"), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
