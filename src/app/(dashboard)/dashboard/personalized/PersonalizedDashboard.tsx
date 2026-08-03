"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Badge, Progress, Skeleton } from "@/shared/components";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProviderIcon from "@/shared/components/ProviderIcon";

type UsageSummary = {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
  avgLatencyMs: number;
  period: string;
};

type ProviderUsage = {
  provider: string;
  providerName: string;
  requests: number;
  tokens: number;
  cost: number;
  successRate: number;
  avgLatencyMs: number;
  isHealthy: boolean;
};

type ModelUsage = {
  model: string;
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
  isFavorite?: boolean;
};

type ApiKeySummary = {
  id: string;
  name: string;
  scopes: string[];
  requestCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
};

type PersonalizedDashboardData = {
  summary: UsageSummary;
  providers: ProviderUsage[];
  topModels: ModelUsage[];
  apiKeys: ApiKeySummary[];
  recentActivity: Array<{
    id: string;
    model: string;
    provider: string;
    timestamp: string;
    tokens: number;
    cost: number;
    success: boolean;
  }>;
  dailyStats: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ProviderHealthBadge({ isHealthy }: { isHealthy: boolean }) {
  return (
    <Badge variant={isHealthy ? "success" : "error"} size="sm">
      {isHealthy ? "Healthy" : "Issues"}
    </Badge>
  );
}

function StatCard({ label, value, icon, trend, trendUp }: { 
  label: string; 
  value: string | number; 
  icon: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? "text-green-500" : "text-red-500"}`}>
              <span className="material-symbols-rounded text-[14px]">
                {trendUp ? "trending_up" : "trending_down"}
              </span>
              {trend}
            </p>
          )}
        </div>
        <div className="text-3xl opacity-50">{icon}</div>
      </div>
    </Card>
  );
}

function ProviderRow({ provider, onClick }: { provider: ProviderUsage; onClick?: () => void }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors cursor-pointer"
      onClick={onClick}
    >
      <ProviderIcon provider={provider.provider} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text truncate">{provider.providerName}</span>
          <ProviderHealthBadge isHealthy={provider.isHealthy} />
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted mt-1">
          <span>{formatNumber(provider.requests)} requests</span>
          <span>{formatNumber(provider.tokens)} tokens</span>
          <span>{formatCost(provider.cost)}</span>
          <span>{(provider.successRate * 100).toFixed(1)}% success</span>
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="font-medium text-text">{formatCost(provider.cost)}</div>
        <div className="text-text-muted">{provider.avgLatencyMs}ms avg</div>
      </div>
    </div>
  );
}

function ModelRow({ model, onToggleFavorite }: { model: ModelUsage; onToggleFavorite: (model: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text truncate">{model.model}</span>
          <Badge variant="default" size="sm">{model.provider}</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted mt-1">
          <span>{formatNumber(model.requests)} requests</span>
          <span>{formatNumber(model.tokens)} tokens</span>
          <span>{formatCost(model.cost)}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(model.model); }}
        className="p-1 rounded hover:bg-bg-tertiary transition-colors"
        aria-label={model.isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <span className="material-symbols-rounded text-lg">
          {model.isFavorite ? "star" : "star_border"}
        </span>
      </button>
    </div>
  );
}

function ActivityRow({ activity }: { activity: PersonalizedDashboardData["recentActivity"][0] }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.success ? "#22c55e" : "#ef4444" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text truncate">{activity.model}</span>
          <Badge variant="default" size="sm">{activity.provider}</Badge>
        </div>
        <div className="text-xs text-text-muted">{formatDate(activity.timestamp)}</div>
      </div>
      <div className="text-right text-sm">
        <div className="font-mono text-text">{activity.tokens.toLocaleString()} tokens</div>
        <div className="text-text-muted">{formatCost(activity.cost)}</div>
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: PersonalizedDashboardData["dailyStats"] }) {
  if (!data.length) return <div className="text-center py-8 text-text-muted">No data</div>;
  
  const maxRequests = Math.max(...data.map(d => d.requests));
  const maxCost = Math.max(...data.map(d => d.cost));
  
  return (
    <div className="space-y-3">
      {data.slice(-7).reverse().map((day, i) => (
        <div key={day.date} className="flex items-center gap-3">
          <span className="text-sm text-text-muted w-24">{new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          <div className="flex-1 h-6 bg-bg-tertiary rounded overflow-hidden relative">
            <div 
              className="h-full bg-primary/20 rounded-l" 
              style={{ width: `${maxRequests > 0 ? (day.requests / maxRequests) * 100 : 0}%` }}
            />
            <div 
              className="absolute inset-0 flex items-center justify-center text-xs font-medium text-text"
              style={{ opacity: day.requests > maxRequests * 0.15 ? 1 : 0 }}
            >
              {formatNumber(day.requests)}
            </div>
          </div>
          <span className="text-sm font-mono text-text w-20 text-right">{formatCost(day.cost)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PersonalizedDashboard() {
  const t = useTranslations("personalizedDashboard");
  const router = useRouter();
  const [data, setData] = useState<PersonalizedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"1d" | "7d" | "30d" | "90d">("7d");
  const [favoriteModels, setFavoriteModels] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/personalized?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch personalized data:", error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleFavorite = (model: string) => {
    setFavoriteModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Unable to load personalized data</p>
        <Button onClick={fetchData} className="mt-4">Retry</Button>
      </div>
    );
  }

  const { summary, providers, topModels, apiKeys, recentActivity, dailyStats } = data;

  return (
    <div className="space-y-6">
      {/* Header with range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t("title")}</h1>
          <p className="text-text-muted">{t("subtitle", { period: summary.period })}</p>
        </div>
        <div className="flex items-center gap-2">
          {["1d", "7d", "30d", "90d"].map(r => (
            <button
              key={r}
              onClick={() => setRange(r as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-text-muted hover:bg-bg-tertiary"
              }`}
            >
              {r === "1d" ? "24h" : r === "7d" ? "7d" : r === "30d" ? "30d" : "90d"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={t("totalRequests")} 
          value={formatNumber(summary.totalRequests)} 
          icon="📊"
        />
        <StatCard 
          label={t("totalTokens")} 
          value={formatNumber(summary.totalTokens)} 
          icon="🔤"
        />
        <StatCard 
          label={t("totalCost")} 
          value={formatCost(summary.totalCost)} 
          icon="💰"
        />
        <StatCard 
          label={t("successRate")} 
          value={`${(summary.successRate * 100).toFixed(1)}%`} 
          icon="✅"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Providers & Models */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Health */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("providerHealth")}</h2>
              <Link href="/dashboard/providers" className="text-sm text-primary hover:underline">
                {t("viewAll")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {providers.slice(0, 8).map(provider => (
                <ProviderRow 
                  key={provider.provider} 
                  provider={provider} 
                  onClick={() => router.push(`/dashboard/providers/${provider.provider}`)}
                />
              ))}
              {providers.length === 0 && (
                <div className="p-8 text-center text-text-muted">
                  {t("noProviders")}
                </div>
              )}
            </div>
          </Card>

          {/* Top Models */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("topModels")}</h2>
              <Link href="/dashboard/models" className="text-sm text-primary hover:underline">
                {t("viewAll")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {topModels.slice(0, 10).map(model => (
                <ModelRow 
                  key={model.model} 
                  model={{ ...model, isFavorite: favoriteModels.has(model.model) }}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              {topModels.length === 0 && (
                <div className="p-8 text-center text-text-muted">
                  {t("noModels")}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("recentActivity")}</h2>
              <Link href="/dashboard/logs" className="text-sm text-primary hover:underline">
                {t("viewAll")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentActivity.slice(0, 15).map(activity => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
              {recentActivity.length === 0 && (
                <div className="p-8 text-center text-text-muted">
                  {t("noActivity")}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - API Keys & Daily Chart */}
        <div className="space-y-6">
          {/* API Keys */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("apiKeys")}</h2>
              <Link href="/dashboard/settings/keys" className="text-sm text-primary hover:underline">
                {t("manage")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {apiKeys.slice(0, 5).map(key => (
                <div key={key.id} className="p-3 hover:bg-bg-tertiary transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text">{key.name}</p>
                      <p className="text-xs text-text-muted">{key.id.slice(0, 12)}...</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={key.isActive ? "success" : "default"} size="sm">
                        {key.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                    <span>{formatNumber(key.requestCount)} requests</span>
                    <span>{key.lastUsedAt ? formatDate(key.lastUsedAt) : t("neverUsed")}</span>
                    <span className="flex items-center gap-1">
                      {key.scopes.map(s => (
                        <Badge key={s} variant="default" size="sm" className="text-[10px]">{s}</Badge>
                      ))}
                    </span>
                  </div>
                </div>
              ))}
              {apiKeys.length === 0 && (
                <div className="p-8 text-center text-text-muted">
                  {t("noApiKeys")}
                </div>
              )}
            </div>
          </Card>

          {/* Daily Usage Chart */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">{t("dailyUsage")}</h2>
            <DailyChart data={dailyStats} />
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">{t("quickActions")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/providers" className="p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-center">
                <div className="text-2xl mb-1">🔌</div>
                <div className="text-sm font-medium">{t("addProvider")}</div>
              </Link>
              <Link href="/dashboard/combos" className="p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-center">
                <div className="text-2xl mb-1">⚙️</div>
                <div className="text-sm font-medium">{t("manageCombos")}</div>
              </Link>
              <Link href="/dashboard/mcp" className="p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-center">
                <div className="text-2xl mb-1">📦</div>
                <div className="text-sm font-medium">{t("mcpServers")}</div>
              </Link>
              <Link href="/dashboard/settings" className="p-3 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-center">
                <div className="text-2xl mb-1">⚙️</div>
                <div className="text-sm font-medium">{t("settings")}</div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}