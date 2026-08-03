import { NextResponse } from "next/server";
import { detectProjectType } from "@nerve/open-sse/services/mcpRegistry.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: { projectPath?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectPath } = body;

  if (!projectPath) {
    return NextResponse.json({ error: "projectPath is required" }, { status: 400 });
  }

  try {
    const result = await detectProjectType(projectPath);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[MCP DETECT API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect project type" },
      { status: 500 }
    );
  }
}