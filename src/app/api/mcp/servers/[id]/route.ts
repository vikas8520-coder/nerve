import { NextResponse } from "next/server";
import { getMcpServerById, getMcpServerStatus } from "@nerve/open-sse/services/mcpRegistry.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const definition = getMcpServerById(id);
    if (!definition) {
      return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }

    const status = await getMcpServerStatus(id);

    return NextResponse.json({
      ...definition,
      ...status,
    });
  } catch (error) {
    console.error("[MCP SERVER API] Error:", error);
    return NextResponse.json({ error: "Failed to get MCP server" }, { status: 500 });
  }
}