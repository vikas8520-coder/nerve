"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Toggle,
  Loading,
  EmptyState,
} from "@/shared/components";

interface Template {
  id: string;
  name: string;
  modelPattern: string;
  taskType: string;
  systemPrompt: string;
  injectionMode: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

const TASK_TYPE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "coding", label: "Coding" },
  { value: "reasoning", label: "Reasoning" },
  { value: "chat", label: "Chat" },
  { value: "vision", label: "Vision" },
];

const INJECTION_MODE_OPTIONS = [
  { value: "prepend", label: "Prepend" },
  { value: "append", label: "Append" },
  { value: "replace", label: "Replace" },
];

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  modelPattern: "",
  taskType: "any",
  systemPrompt: "",
  injectionMode: "prepend",
  priority: 0,
  enabled: true,
};

export function TemplatesPageClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test feature state
  const [testModel, setTestModel] = useState("");
  const [testMatches, setTestMatches] = useState<Template[]>([]);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/templates");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load templates");
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load templates",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => setForm({ ...EMPTY_FORM });

  const startEdit = (tpl: Template) => {
    setForm({
      id: tpl.id,
      name: tpl.name,
      modelPattern: tpl.modelPattern,
      taskType: tpl.taskType,
      systemPrompt: tpl.systemPrompt,
      injectionMode: tpl.injectionMode,
      priority: tpl.priority,
      enabled: tpl.enabled,
    });
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.modelPattern.trim() || !form.systemPrompt.trim()) {
      setFeedback({
        type: "error",
        message: "Name, model pattern, and system prompt are required",
      });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name.trim(),
        modelPattern: form.modelPattern.trim(),
        taskType: form.taskType,
        systemPrompt: form.systemPrompt,
        injectionMode: form.injectionMode,
        priority: Number(form.priority) || 0,
        enabled: form.enabled,
      };
      const res = form.id
        ? await fetch(`/api/v1/templates/${form.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to save template");
      setFeedback({
        type: "success",
        message: form.id ? "Template updated" : "Template created",
      });
      resetForm();
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save template",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (tpl: Template) => {
    try {
      const res = await fetch(`/api/v1/templates/${tpl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !tpl.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to toggle template");
      }
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle template",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/templates/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to delete template");
      }
      setFeedback({ type: "success", message: "Template deleted" });
      setDeleteTarget(null);
      if (form.id === deleteTarget.id) resetForm();
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete template",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    if (!testModel.trim()) return;
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/templates?model=${encodeURIComponent(testModel.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Match query failed");
      setTestMatches(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Match query failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Prompt Templates</h1>
          <p className="text-sm text-text-muted">
            Automatically inject system-prompt optimizations based on model family and task type.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-control px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Test feature */}
      <Card title="Test matching" icon="science" padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Model id"
              placeholder="e.g. glm/glm-4.6-reasoning, auto/best-coding"
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
            />
          </div>
          <Button onClick={handleTest} loading={testing} icon="search">
            Test
          </Button>
        </div>
        {testMatches.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-text-muted">
              {testMatches.length} matching template{testMatches.length === 1 ? "" : "s"}:
            </p>
            {testMatches.map((m) => (
              <div
                key={m.id}
                className="rounded-control border border-black/10 bg-black/5 p-2 text-xs dark:border-white/10 dark:bg-white/5"
              >
                <span className="font-medium text-text-main">{m.name}</span>
                <span className="text-text-muted">
                  {" "}
                  — {m.modelPattern} · {m.taskType} · {m.injectionMode} · priority {m.priority}
                </span>
              </div>
            ))}
          </div>
        )}
        {testModel && testMatches.length === 0 && !testing && (
          <p className="mt-3 text-xs text-text-muted">No templates match that model id.</p>
        )}
      </Card>

      {/* Create / edit form */}
      <Card title={form.id ? "Edit template" : "New template"} icon="edit" padding="md">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Name"
            placeholder="Coding optimization for reasoning models"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Model pattern (glob)"
            placeholder="*/glm-*  or  *-reasoning-*  or  auto/best-coding"
            value={form.modelPattern}
            onChange={(e) => setForm({ ...form, modelPattern: e.target.value })}
            hint="* matches any chars, ? matches one char"
          />
          <Select
            label="Task type"
            options={TASK_TYPE_OPTIONS}
            value={form.taskType}
            onChange={(e) => setForm({ ...form, taskType: e.target.value })}
          />
          <Select
            label="Injection mode"
            options={INJECTION_MODE_OPTIONS}
            value={form.injectionMode}
            onChange={(e) => setForm({ ...form, injectionMode: e.target.value })}
          />
          <Input
            label="Priority"
            type="number"
            value={String(form.priority)}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
            hint="Higher = applied first"
          />
          <div className="flex items-end">
            <Toggle
              checked={form.enabled}
              onChange={(checked) => setForm({ ...form, enabled: checked })}
              label="Enabled"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-text-muted">System prompt</label>
          <Textarea
            rows={4}
            placeholder="System prompt text to inject…"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={handleSave} loading={saving} icon="save">
            {form.id ? "Update" : "Create"}
          </Button>
          <Button variant="ghost" onClick={resetForm} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>

      {/* Templates table */}
      <Card title="Templates" icon="list" padding="none">
        {loading ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : templates.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="inbox"
              title="No templates yet"
              description="Create a template above to start injecting system prompts."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs uppercase text-text-muted dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Model pattern</th>
                  <th className="px-3 py-2">Task</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-3 py-2 font-medium text-text-main">{tpl.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-muted">
                      {tpl.modelPattern}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{tpl.taskType}</td>
                    <td className="px-3 py-2 text-text-muted">{tpl.injectionMode}</td>
                    <td className="px-3 py-2 text-text-muted">{tpl.priority}</td>
                    <td className="px-3 py-2">
                      <Toggle
                        size="sm"
                        checked={tpl.enabled}
                        onChange={() => handleToggleEnabled(tpl)}
                        ariaLabel={`Toggle ${tpl.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(tpl)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(tpl)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete confirm */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-main">Delete template?</h3>
            <p className="mt-1 text-sm text-text-muted">
              &quot;{deleteTarget.name}&quot; will be permanently removed.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
