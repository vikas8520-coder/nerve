/**
 * API: Prompt Injection Template by ID
 * GET    — Get template details
 * PUT    — Update template
 * DELETE — Delete template
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { buildErrorBody } from "@nerve/open-sse/utils/error.ts";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/db/promptInjectionTemplates";

const TASK_TYPES = ["coding", "reasoning", "chat", "vision", "any"] as const;
const INJECTION_MODES = ["prepend", "append", "replace"] as const;

const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    modelPattern: z.string().min(1).max(500).optional(),
    taskType: z.enum(TASK_TYPES).optional(),
    systemPrompt: z.string().min(1).max(20000).optional(),
    injectionMode: z.enum(INJECTION_MODES).optional(),
    priority: z.number().int().min(-1000).max(1000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const template = getTemplate(id);
    if (!template) {
      return NextResponse.json(buildErrorBody(404, "Template not found"), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return NextResponse.json({ template }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : "Failed to get template"),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const rawBody = await request.json();
    const validation = validateBody(updateTemplateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(buildErrorBody(400, validation.error.message), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const template = updateTemplate(id, validation.data);
    if (!template) {
      return NextResponse.json(buildErrorBody(404, "Template not found"), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return NextResponse.json({ template }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : "Failed to update template"),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const deleted = deleteTemplate(id);
    if (!deleted) {
      return NextResponse.json(buildErrorBody(404, "Template not found"), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : "Failed to delete template"),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
