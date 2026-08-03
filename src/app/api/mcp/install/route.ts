import { NextResponse } from "next/server";
import { installMcpServer, uninstallMcpServer, updateMcpServer, listInstalledMcpServers, getMcpServerStatus } from "@nerve/open-sse/services/mcpRegistry.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: { serverId: string; config?: Record<string, unknown>; action?: "install" | "uninstall" | "update" | "list" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { serverId, config, action = "install" } = body;

  if (!serverId) {
    return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  }

  try {
    let result;

    switch (action) {
      case "install": {
        result = await installMcpServer(serverId, config);
        break;
      }
      case "uninstall": {
        const success = await uninstallMcpServer(serverId);
        result = { success, serverId };
        break;
      }
      case "update": {
        result = await updateMcpServer(serverId);
        break;
      }
      case "list": {
        result = await listInstalledMcpServers();
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[MCP INSTALL API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute MCP server action" },
      { status: 500 }
    );
  }
}