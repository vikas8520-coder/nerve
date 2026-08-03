import { NextResponse } from "next/server";
import {
  generateMcpConfig,
  generateClaudeDesktopConfig,
  generateCursorConfig,
  generateVscodeConfig,
  listInstalledMcpServers,
} from "@nerve/open-sse/services/mcpRegistry.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json"; // json, claude, cursor, vscode

  try {
    const servers = await listInstalledMcpServers();
    const installedServers = servers.filter((s) => s.status === "installed");

    let config;
    switch (format) {
      case "claude":
        config = generateClaudeDesktopConfig(installedServers);
        break;
      case "cursor":
        config = generateCursorConfig(installedServers);
        break;
      case "vscode":
        config = generateVscodeConfig(installedServers);
        break;
      case "json":
      default:
        config = generateMcpConfig(installedServers);
        break;
    }

    return NextResponse.json({ success: true, config, format, serverCount: installedServers.length });
  } catch (error) {
    console.error("[MCP CONFIG API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate MCP config" },
      { status: 500 }
    );
  }
}