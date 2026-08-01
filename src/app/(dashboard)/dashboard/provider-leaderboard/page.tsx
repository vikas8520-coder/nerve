"use client";

/**
 * Provider Health Leaderboard dashboard page.
 *
 * Ranked table of providers by observed performance (success rate, latency,
 * tokens/sec, cost) with a sortable table, time-range selector, success-rate
 * bar chart (recharts), and a task-based recommendations section.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/shared/components";
import { useProviderNodeMap, resolveProviderName } from "@/lib/display/useProviderNodeMap";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface LeaderboardEntry {
  providerId: string;
  providerName: string;
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokensPerSecond: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  costPer1kTokens: number;
  rank: number;
  lastUsed: string;
}

interface TaskRecommendation {
  providerId: string;
  modelId: string;
  score: number;
  reason: string;
}

interface Recommendations {
  coding: TaskRecommendation | null;
  reasoning: TaskRecommendation | null;
  chat: TaskRecommendation | null;
  vision: TaskRecommendation | null;
}

type TimeRange = "1h" | "6h" | "24h" | "7d";
type SortKey =
  | "rank"
  | "providerName"
  | "successRate"
  | "avgLatencyMs"
  | "avgTokensPerSecond"
  | "costPer1kTokens"
  | "totalRequests";
type SortDir = "asc" | "desc";

const TIME_RANGES: { value: TimeRange; label: string; hours: number }[] = [
  { value: "1h", label: "1 hour", hours: 1 },
  { value: "6h", label: "6 hours", hours: 6 },
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 168 },
];

const TASK_LABELS: Record<keyof Recommendations, { label: string; icon: string }> = {
  coding: { label: "Coding", icon: "code" },
  reasoning: { label: "Reasoning", icon: "psychology" },
  chat: { label: "Chat", icon: "chat" },
  vision: { label: "Vision", icon: "visibility" },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function formatLatency(ms: number): string {
  if (ms <= 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatCostPer1k(usd: number): string {
  if (usd <= 0) return "—";
  if (usd < 0.001) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(3)}`;
}

function successRateColor(rate: number): string {
  if (rate >= 0.95) return "#22c55e";
  if (rate >= 0.8) return "#84cc16";
  if (rate >= 0.6) return "#facc15";
  if (rate >= 0.4) return "#f97316";
  return "#ef4444";
}

export default function ProviderLeaderboardPage() {
  const nodeMap = useProviderNodeMap();
  const [range, setRange] = useState<TimeRange>("24h");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchLeaderboard = useCallback(async (r: TimeRange) => {
    const hours = TIME_RANGES.find((t) => t.value === r)?.hours ?? 24;
    try {
      const [lbRes, recRes] = await Promise.all([
        fetch(`/api/v1/leaderboard?hours=${hours}`),
        fetch("/api/v1/leaderboard/recommendations"),
      ]);
      if (!lbRes.ok) throw new Error(`Leaderboard request failed (${lbRes.status})`);
      const lbData = await lbRes.json();
      setEntries(lbData.entries ?? []);
      // Recommendations are best-effort — degrade gracefully on failure.
      if (recRes.ok) {
        setRecommendations(await recRes.json());
      } else {
        setRecommendations(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    void fetchLeaderboard(range);
  }, [range, fetchLeaderboard]);

  const sortedEntries = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...entries].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [entries, sortKey, sortDir]);

  const chartData = useMemo(
    () =>
      entries.slice(0, 12).map((e) => ({
        name: resolveProviderName(e.providerId, nodeMap),
        successRate: Math.round(e.successRate * 100),
        providerId: e.providerId,
      })),
    [entries, nodeMap]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" || key === "providerName" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "rank", label: "Rank", align: "left" },
    { key: "providerName", label: "Provider", align: "left" },
    { key: "successRate", label: "Success", align: "right" },
    { key: "avgLatencyMs", label: "Latency", align: "right" },
    { key: "avgTokensPerSecond", label: "Tokens/s", align: "right" },
    { key: "costPer1kTokens", label: "Cost/1K", align: "right" },
    { key: "totalRequests", label: "Requests", align: "right" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Provider Health Leaderboard</h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time ranking of providers by actual performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_RANGES.map((t) => (
            <button
              key={t.value}
              onClick={() => setRange(t.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                range === t.value
                  ? "bg-violet-500 border-violet-500 text-white"
                  : "border-border text-text-muted hover:text-text-main hover:border-violet-500/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {/* Recommendations */}
      {recommendations && (
        <Card title="Task-Based Recommendations" icon="recommend">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(TASK_LABELS) as (keyof Recommendations)[]).map((task) => {
              const rec = recommendations[task];
              const meta = TASK_LABELS[task];
              return (
                <div
                  key={task}
                  className="p-4 rounded-lg border border-border bg-black/[0.02] dark:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-text-muted">
                      {meta.icon}
                    </span>
                    <span className="text-sm font-medium text-text-main">{meta.label}</span>
                  </div>
                  {rec ? (
                    <>
                      <p className="text-sm font-semibold text-text-main truncate">
                        {resolveProviderName(rec.providerId, nodeMap)}
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">{rec.modelId}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-violet-500"
                            style={{ width: `${Math.round(rec.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-text-muted">
                          {Math.round(rec.score * 100)}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-2 line-clamp-2">{rec.reason}</p>
                    </>
                  ) : (
                    <p className="text-sm text-text-muted">No data</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Success-rate bar chart */}
      {chartData.length > 0 && (
        <Card title="Success Rate by Provider" icon="bar_chart" padding="sm">
          <div className="h-64 w-full px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={{ stroke: "var(--color-border)" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={{ stroke: "var(--color-border)" }}
                  width={36}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Success"]}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="successRate" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={successRateColor(entry.successRate / 100)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Ranked table */}
      <Card title="Provider Ranking" icon="leaderboard" padding="none">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-text-muted">Loading leaderboard…</div>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            No call data in the selected time range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-text-muted border-b border-border">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`pb-3 pt-4 px-4 font-medium cursor-pointer select-none whitespace-nowrap hover:text-text-main ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.label}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr
                    key={entry.providerId}
                    className="border-b border-border/50 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-4 text-text-muted font-mono">
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                    </td>
                    <td className="py-3 px-4 font-medium text-text-main">
                      {resolveProviderName(entry.providerId, nodeMap)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.round(entry.successRate * 100)}%`,
                              backgroundColor: successRateColor(entry.successRate),
                            }}
                          />
                        </div>
                        <span className="font-mono text-sm w-10 text-right">
                          {Math.round(entry.successRate * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {formatLatency(entry.avgLatencyMs)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {formatNumber(entry.avgTokensPerSecond)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {formatCostPer1k(entry.costPer1kTokens)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-text-muted">
                      {formatNumber(entry.totalRequests)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary footer */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-text-muted">
          <span>
            <strong className="text-text-main">{entries.length}</strong> providers
          </span>
          <span>
            <strong className="text-text-main">
              {formatNumber(entries.reduce((s, e) => s + e.totalRequests, 0))}
            </strong>{" "}
            total requests
          </span>
          <span>
            <strong className="text-text-main">
              {formatCost(entries.reduce((s, e) => s + e.estimatedCostUsd, 0))}
            </strong>{" "}
            estimated cost
          </span>
        </div>
      )}
    </div>
  );
}
