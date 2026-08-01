/**
 * API: Session Budgets (collection)
 * GET  — List all session budgets
 * POST — Create or update a session budget
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { buildErrorBody } from "@nerve/open-sse/utils/error";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { createOrUpdateBudget, listBudgets } from "@/lib/db/sessionBudgets";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

const createBudgetSchema = z
  .object({
    sessionId: z.string().min(1).max(256),
    apiKeyId: z.string().max(256).nullable().optional(),
    maxTokens: z.number().int().positive().nullable().optional(),
    maxCostUsd: z.number().positive().nullable().optional(),
    warningThreshold: z.number().min(0).max(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => data.maxTokens != null || data.maxCostUsd != null, {
    message: "At least one of maxTokens or maxCostUsd must be set",
    path: ["maxTokens"],
  });

const listBudgetsQuerySchema = z.object({
  apiKeyId: z.string().min(1).max(256).optional(),
  enabledOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listBudgetsQuerySchema.safeParse({
      apiKeyId: searchParams.get("apiKeyId") ?? undefined,
      enabledOnly: searchParams.get("enabledOnly") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(buildErrorBody(400, "Invalid budget list query"), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const result = listBudgets({
      apiKeyId: parsed.data.apiKeyId,
      enabledOnly: parsed.data.enabledOnly === "true",
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return NextResponse.json(
      { budgets: result.budgets, total: result.total },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    return NextResponse.json(buildErrorBody(500, "Failed to list session budgets"), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const validation = validateBody(createBudgetSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(buildErrorBody(400, validation.error), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const { data } = validation;

    const budget = createOrUpdateBudget(data.sessionId, data.apiKeyId ?? null, {
      maxTokens: data.maxTokens,
      maxCostUsd: data.maxCostUsd,
      warningThreshold: data.warningThreshold,
      enabled: data.enabled,
      apiKeyId: data.apiKeyId ?? null,
    });

    return NextResponse.json({ budget }, { status: 201, headers: CORS_HEADERS });
  } catch (error: unknown) {
    return NextResponse.json(buildErrorBody(500, "Failed to create session budget"), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
