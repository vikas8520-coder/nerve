"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, ConfirmModal } from "@/shared/components";

interface SessionBudget {
  id: string;
  sessionId: string;
  apiKeyId: string | null;
  maxTokens: number | null;
  maxCostUsd: number | null;
  tokensUsed: number;
  costUsdUsed: number;
  warningThreshold: number;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

interface BudgetStatus {
  withinBudget: boolean;
  warningLevel: number;
  remaining: {
    tokens: number | null;
    costUsd: number | null;
  };
  overLimit: "tokens" | "cost" | "both" | null;
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

interface EditForm {
  sessionId: string;
  maxTokens: string;
  maxCostUsd: string;
  warningThreshold: string;
  enabled: boolean;
}

const EMPTY_FORM: EditForm = {
  sessionId: "",
  maxTokens: "",
  maxCostUsd: "",
  warningThreshold: "0.8",
  enabled: true,
};

function tokenPct(b: SessionBudget): number {
  if (!b.maxTokens || b.maxTokens <= 0) return 0;
  return Math.min(100, (b.tokensUsed / b.maxTokens) * 100);
}

function costPct(b: SessionBudget): number {
  if (!b.maxCostUsd || b.maxCostUsd <= 0) return 0;
  return Math.min(100, (b.costUsdUsed / b.maxCostUsd) * 100);
}

function barColor(pct: number, warningThreshold: number): string {
  if (pct >= 100) return "#ef4444";
  if (pct >= warningThreshold * 100) return "#f59e0b";
  return "#22c55e";
}

export function BudgetsPageClient() {
  const [budgets, setBudgets] = useState<SessionBudget[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionBudget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/budgets");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to load budgets");
      const list: SessionBudget[] = Array.isArray(data.budgets) ? data.budgets : [];
      setBudgets(list);

      // Fetch status for each budget
      const statusEntries = await Promise.all(
        list.map(async (b) => {
          try {
            const sres = await fetch(`/api/v1/budgets/${encodeURIComponent(b.sessionId)}`);
            const sdata = await sres.json().catch(() => ({}));
            if (sres.ok && sdata.status) return [b.sessionId, sdata.status] as const;
          } catch {
            // skip
          }
          return [b.sessionId, null] as const;
        })
      );
      const statusMap: Record<string, BudgetStatus> = {};
      for (const [sid, status] of statusEntries) {
        if (status) statusMap[sid] = status;
      }
      setStatuses(statusMap);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load budgets",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () =>
      budgets.map((b) => ({
        name: b.sessionId.slice(0, 12),
        tokens: Math.round(tokenPct(b)),
        cost: Math.round(costPct(b)),
      })),
    [budgets]
  );

  const handleSave = async () => {
    if (!editForm || !editForm.sessionId.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const body: Record<string, unknown> = {
        sessionId: editForm.sessionId.trim(),
        warningThreshold: Number(editForm.warningThreshold) || 0.8,
        enabled: editForm.enabled,
      };
      if (editForm.maxTokens.trim()) {
        body.maxTokens = Number(editForm.maxTokens);
      } else {
        body.maxTokens = null;
      }
      if (editForm.maxCostUsd.trim()) {
        body.maxCostUsd = Number(editForm.maxCostUsd);
      } else {
        body.maxCostUsd = null;
      }

      const res = await fetch("/api/v1/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to save budget");
      setEditForm(null);
      setFeedback({ type: "success", message: "Budget saved" });
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save budget",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/budgets/${encodeURIComponent(deleteTarget.sessionId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to delete budget");
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Budget deleted" });
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete budget",
      });
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (b: SessionBudget) => {
    setEditForm({
      sessionId: b.sessionId,
      maxTokens: b.maxTokens !== null ? String(b.maxTokens) : "",
      maxCostUsd: b.maxCostUsd !== null ? String(b.maxCostUsd) : "",
      warningThreshold: String(b.warningThreshold),
      enabled: b.enabled,
    });
  };

  const startCreate = () => {
    setEditForm({ ...EMPTY_FORM });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Session Budgets</h1>
          <p className="text-sm text-text-muted mt-1">
            Automatic cost and token limits per CLI session.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Budget
        </button>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Burn-down chart */}
      {budgets.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-medium text-text-primary mb-4">Usage Burn-Down</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(value: number) => [`${value}%`, undefined]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tokens %" />
              <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cost %" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Budgets table */}
      <Card className="p-4">
        {loading ? (
          <div className="py-12 text-center text-text-muted text-sm">Loading budgets…</div>
        ) : budgets.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">
            No session budgets configured. Click &ldquo;Add Budget&rdquo; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border/40">
                  <th className="py-2 pr-4 font-medium">Session</th>
                  <th className="py-2 pr-4 font-medium">Token Usage</th>
                  <th className="py-2 pr-4 font-medium">Cost Usage</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const tPct = tokenPct(b);
                  const cPct = costPct(b);
                  const status = statuses[b.sessionId];
                  const overBudget = status && !status.withinBudget;
                  const warning =
                    status && status.warningLevel >= b.warningThreshold && status.withinBudget;

                  return (
                    <tr key={b.id} className="border-b border-border/20">
                      <td className="py-3 pr-4">
                        <div className="font-mono text-xs text-text-primary truncate max-w-[180px]">
                          {b.sessionId}
                        </div>
                        {!b.enabled && (
                          <span className="text-[10px] text-text-muted">disabled</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {b.maxTokens !== null ? (
                          <div className="space-y-1">
                            <div className="text-xs text-text-muted">
                              {b.tokensUsed.toLocaleString()} / {b.maxTokens.toLocaleString()}
                            </div>
                            <div className="w-32 h-2 bg-bg-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${tPct}%`,
                                  backgroundColor: barColor(tPct, b.warningThreshold),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {b.maxCostUsd !== null ? (
                          <div className="space-y-1">
                            <div className="text-xs text-text-muted">
                              ${b.costUsdUsed.toFixed(4)} / ${b.maxCostUsd.toFixed(4)}
                            </div>
                            <div className="w-32 h-2 bg-bg-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${cPct}%`,
                                  backgroundColor: barColor(cPct, b.warningThreshold),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {overBudget ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-600">
                            Exceeded
                          </span>
                        ) : warning ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600">
                            Warning
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(b)}
                            className="text-xs text-accent-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit / Create modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {budgets.some((b) => b.sessionId === editForm.sessionId) ? "Edit" : "Add"} Budget
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Session ID</label>
                <input
                  type="text"
                  value={editForm.sessionId}
                  onChange={(e) => setEditForm({ ...editForm, sessionId: e.target.value })}
                  disabled={budgets.some((b) => b.sessionId === editForm.sessionId)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-text-primary disabled:opacity-50"
                  placeholder="ext:my-session-id"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={editForm.maxTokens}
                  onChange={(e) => setEditForm({ ...editForm, maxTokens: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-text-primary"
                  placeholder="e.g. 1000000 (leave empty for no limit)"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Max Cost (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.maxCostUsd}
                  onChange={(e) => setEditForm({ ...editForm, maxCostUsd: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-text-primary"
                  placeholder="e.g. 10.00 (leave empty for no limit)"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Warning Threshold (0–1)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={editForm.warningThreshold}
                  onChange={(e) => setEditForm({ ...editForm, warningThreshold: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-text-primary"
                  placeholder="0.8"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditForm(null)}
                className="px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editForm.sessionId.trim()}
                className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Budget"
        message={`Delete budget for session "${deleteTarget?.sessionId.slice(0, 24)}…"?`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
