import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getApiKeys } from "@/lib/db/apiKeys";
import { getProviderConnections } from "@/lib/db/providers";
import {
  buildUnifiedSource,
  getUsageSummary,
  getDailyUsage,
  getProviderUsageRows,
  getModelUsageRows,
  getApiKeyUsageRows,
} from "@/lib/db/usageAnalytics";

function getRangeStartIso(range: string): string | null {
  const end = new Date();
  const start = new Date(end);

  switch (range) {
    case "1d":
      start.setDate(start.getDate() - 1);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return start.toISOString();
}

function resolveDateWindow(searchParams: URLSearchParams, range: string) {
  const singleDate = searchParams.get("date");
  if (singleDate) {
    return { sinceIso: `${singleDate}T00:00:00.000Z`, untilIso: `${singleDate}T23:59:59.999Z` };
  }
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  return {
    sinceIso: startDate || getRangeStartIso(range),
    untilIso: endDate || null,
  };
}

function getProviderDisplayName(provider: string): string {
  const providerMap: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    groq: "Groq",
    xai: "xAI",
    deepseek: "DeepSeek",
    mistral: "Mistral",
    cohere: "Cohere",
    fireworks: "Fireworks",
    together: "Together AI",
    perplexity: "Perplexity",
    openrouter: "OpenRouter",
    azure: "Azure OpenAI",
    bedrock: "AWS Bedrock",
    vertex: "Vertex AI",
    ollama: "Ollama",
    lmstudio: "LM Studio",
  };
  return providerMap[provider] || provider;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d") || "7d";

  try {
      const { sinceIso, untilIso } = resolveDateWindow(searchParams, range);
    
      // Get raw cutoff date from database settings
      const { getUserDatabaseSettings } = await import("@/lib/db/databaseSettings");
      const dbSettings = getUserDatabaseSettings();
      const rawCutoffDate = dbSettings.aggregation?.rawDataRetentionDays 
        ? new Date(Date.now() - dbSettings.aggregation.rawDataRetentionDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { unifiedSource, unifiedParams } = buildUnifiedSource({
        sinceIso: sinceIso ?? null,
        untilIso: untilIso ?? null,
        rawCutoffDate,
        apiKeyWhere: "",
        apiKeyParams: {},
      });

      // Fetch all data in parallel
      const [
        summary,
        dailyUsage,
        providerUsage,
        modelUsage,
        apiKeyUsage,
        apiKeys,
        providerConnections,
      ] = await Promise.all([
        getUsageSummary(unifiedSource, unifiedParams),
        getDailyUsage(unifiedSource, unifiedParams),
        getProviderUsageRows(unifiedSource, unifiedParams),
        getModelUsageRows(unifiedSource, unifiedParams),
        getApiKeyUsageRows("WHERE api_key_id IS NOT NULL", unifiedParams),
        getApiKeys(),
        getProviderConnections(),
      ]);

    // Build provider health map
    const providerHealth = new Map<string, boolean>();
    for (const conn of providerConnections) {
      const isConnected = conn.isActive !== false && !!conn.credentials;
      const provider = conn.provider?.toLowerCase();
      if (provider) {
        providerHealth.set(provider, isConnected);
      }
    }

    // Transform provider usage
    const providers = providerUsage.map(p => ({
      provider: p.provider,
      providerName: getProviderDisplayName(p.provider),
      requests: Number(p.requests) || 0,
      tokens: Number(p.totalTokens) || 0,
      cost: 0, // Cost calculated separately
      successRate: Number(p.successfulRequests) / (Number(p.requests) || 1),
      avgLatencyMs: Number(p.avgLatencyMs) || 0,
      isHealthy: providerHealth.get(p.provider.toLowerCase()) ?? true,
    }));

    // Transform model usage
    const topModels = modelUsage.map(m => ({
      model: m.model,
      provider: m.provider,
      requests: Number(m.requests) || 0,
      tokens: Number(m.totalTokens) || 0,
      cost: 0,
    }));

    // Transform API key usage
    const apiKeyUsageMap = new Map<string, { requests: number; lastUsedAt: string | null }>();
    for (const ak of apiKeyUsage) {
      if (ak.apiKeyId) {
        apiKeyUsageMap.set(ak.apiKeyId, {
          requests: Number(ak.requests) || 0,
          lastUsedAt: null, // Would need to query separately for last used
        });
      }
    }

    const apiKeysSummary = apiKeys.map(k => ({
      id: k.id,
      name: k.name,
      scopes: k.scopes || [],
      requestCount: apiKeyUsageMap.get(k.id)?.requests || 0,
      lastUsedAt: apiKeyUsageMap.get(k.id)?.lastUsedAt || null,
      isActive: k.isActive !== false,
    }));

    // Transform recent activity from daily usage (simplified)
    const recentActivity = dailyUsage
      .slice(-50)
      .reverse()
      .map(d => ({
        id: `daily-${d.date}`,
        model: "unknown",
        provider: "unknown",
        timestamp: d.date,
        tokens: Number(d.totalTokens) || 0,
        cost: 0,
        success: true,
      }));

    // Daily stats for chart
    const dailyStats = dailyUsage.map(d => ({
      date: d.date,
      requests: Number(d.requests) || 0,
      tokens: Number(d.totalTokens) || 0,
      cost: 0,
    }));

    const periodLabels: Record<string, string> = {
      "1d": "Last 24 hours",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      "90d": "Last 90 days",
    };

    return NextResponse.json({
      summary: {
        totalRequests: summary.totalRequests,
        totalTokens: summary.totalTokens,
        totalCost: summary.totalCost,
        successRate: summary.totalRequests > 0 ? summary.successfulRequests / summary.totalRequests : 0,
        avgLatencyMs: summary.avgLatencyMs,
        period: periodLabels[range] || periodLabels["7d"],
      },
      providers,
      topModels,
      apiKeys: apiKeysSummary,
      recentActivity,
      dailyStats,
    });
  } catch (error) {
    console.error("[API ERROR] /api/usage/personalized:", error);
    return NextResponse.json({ error: "Failed to fetch personalized data" }, { status: 500 });
  }
}