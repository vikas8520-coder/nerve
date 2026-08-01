/**
 * API: Prompt Injection Templates
 * GET  — List all templates (optional ?task_type= and ?model= filters)
 * POST — Create a new template
 *
 * Placement: /api/v1/templates (per the Prompt Template Injection spec).
 * Auth: management auth (same as /api/webhooks) — these are operator config
 * endpoints, not part of the OpenAI-compatible inference surface.
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { buildErrorBody } from "@nerve/open-sse/utils/error.ts";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  listTemplates,
  createTemplate,
  findMatchingTemplates,
} from "@/lib/db/promptInjectionTemplates";

const TASK_TYPES = ["coding", "reasoning", "chat", "vision", "any"] as const;
const INJECTION_MODES = ["prepend", "append", "replace"] as const;
const listTemplatesQuerySchema = z
  .object({
    task_type: z.enum(TASK_TYPES).optional(),
    model: z.string().min(1).max(500).optional(),
  })
  .strict();

const createTemplateSchema = z
  .object({
    name: z.string().min(1).max(200),
    modelPattern: z.string().min(1).max(500),
    taskType: z.enum(TASK_TYPES).optional().default("any"),
    systemPrompt: z.string().min(1).max(20000),
    injectionMode: z.enum(INJECTION_MODES).optional().default("prepend"),
    priority: z.number().int().min(-1000).max(1000).optional().default(0),
    enabled: z.boolean().optional().default(true),
  })
  .strict();

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = listTemplatesQuerySchema.safeParse({
      task_type: searchParams.get("task_type") ?? undefined,
      model: searchParams.get("model") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json(buildErrorBody(400, query.error.message), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
    const { task_type: taskType, model } = query.data;

    // ?model= triggers match-mode: return only templates that would match.
    if (model) {
      const matches = findMatchingTemplates(model, taskType);
      return NextResponse.json({ templates: matches }, { headers: CORS_HEADERS });
    }

    const templates = listTemplates(taskType ? { taskType } : undefined);
    return NextResponse.json({ templates }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : "Failed to list templates"),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const validation = validateBody(createTemplateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(buildErrorBody(400, validation.error.message), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const template = createTemplate(validation.data);
    return NextResponse.json({ template }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : "Failed to create template"),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
