import { NextResponse } from "next/server";
import {
  getMcpServerById,
  getMcpServersByCategory,
  getOfficialMcpServers,
  getCommunityMcpServers,
  searchMcpServers,
  getAllCategories,
  listInstalledMcpServers,
  getMcpServerStatus,
  MCP_SERVER_REGISTRY,
} from "@nerve/open-sse/services/mcpRegistry.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const official = searchParams.get("official");
  const installed = searchParams.get("installed");

  try {
    let servers;

    if (installed === "true") {
      servers = await listInstalledMcpServers();
    } else if (category) {
      servers = getMcpServersByCategory(category as any).map((s) => ({
        ...s,
        status: "not-installed",
      }));
    } else if (search) {
      servers = searchMcpServers(search).map((s) => ({
        ...s,
        status: "not-installed",
      }));
    } else if (official === "true") {
      servers = getOfficialMcpServers().map((s) => ({
        ...s,
        status: "not-installed",
      }));
    } else if (official === "false") {
      servers = getCommunityMcpServers().map((s) => ({
        ...s,
        status: "not-installed",
      }));
    } else {
      // Return all with installed status
      servers = await listInstalledMcpServers();
    }

    return NextResponse.json({
      servers,
      categories: getAllCategories(),
      total: servers.length,
    });
  } catch (error) {
    console.error("[MCP SERVERS API] Error:", error);
    return NextResponse.json({ error: "Failed to list MCP servers" }, { status: 500 });
  }
}