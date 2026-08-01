"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type TaskType = "coding" | "reasoning" | "chat" | "vision" | "any";
type InjectionMode = "prepend" | "append" | "replace";

type Template = {
  id: string;
  name: string;
  modelPattern: string;
  taskType: TaskType;
  systemPrompt: string;
  injectionMode: InjectionMode;
  priority: number;
  enabled: boolean;
};

type TemplateForm = Omit<Template, "id">;

const EMPTY_FORM: TemplateForm = {
  name: "",
  modelPattern: "",
  taskType: "any",
  systemPrompt: "",
  injectionMode: "prepend",
  priority: 0,
  enabled: true,
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testModel, setTestModel] = useState("");
  const [matches, setMatches] = useState<Template[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/templates");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Unable to load templates");
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      setMessage(error instanceof Error ? error.message : "Load failed")
    );
  }, [load]);

  const setField = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        editingId ? `/api/v1/templates/${editingId}` : "/api/v1/templates",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Unable to save template");
      setMessage(editingId ? "Template updated." : "Template created.");
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (template: Template) => {
    try {
      const response = await fetch(`/api/v1/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !template.enabled }),
      });
      if (!response.ok) throw new Error("Unable to update template");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    const response = await fetch(`/api/v1/templates/${id}`, { method: "DELETE" });
    if (response.ok) await load();
    else setMessage("Unable to delete template");
  };

  const test = async () => {
    if (!testModel.trim()) return;
    const response = await fetch(`/api/v1/templates?model=${encodeURIComponent(testModel.trim())}`);
    const data = await response.json();
    if (response.ok) setMatches(Array.isArray(data.templates) ? data.templates : []);
    else setMessage(data.error?.message || "Unable to test templates");
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-main">Prompt Templates</h1>
        <p className="mt-1 text-sm text-text-muted">
          Add a system prompt automatically when a request matches a model and task type.
        </p>
      </header>

      {message && <p className="rounded-lg bg-sidebar p-3 text-sm text-text-main">{message}</p>}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium text-text-main">
          {editingId ? "Edit template" : "New template"}
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={save}>
          <label className="text-sm text-text-muted">
            Name
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </label>
          <label className="text-sm text-text-muted">
            Model pattern
            <input
              className={inputClass}
              value={form.modelPattern}
              onChange={(e) => setField("modelPattern", e.target.value)}
              placeholder="*/glm-*"
              required
            />
          </label>
          <label className="text-sm text-text-muted">
            Task type
            <select
              className={inputClass}
              value={form.taskType}
              onChange={(e) => setField("taskType", e.target.value as TaskType)}
            >
              {["any", "coding", "reasoning", "chat", "vision"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-text-muted">
            Injection mode
            <select
              className={inputClass}
              value={form.injectionMode}
              onChange={(e) => setField("injectionMode", e.target.value as InjectionMode)}
            >
              {["prepend", "append", "replace"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-text-muted">
            Priority
            <input
              className={inputClass}
              type="number"
              value={form.priority}
              onChange={(e) => setField("priority", Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 self-end text-sm text-text-main">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setField("enabled", e.target.checked)}
            />{" "}
            Enabled
          </label>
          <label className="text-sm text-text-muted md:col-span-2">
            System prompt
            <textarea
              className={`${inputClass} min-h-28`}
              value={form.systemPrompt}
              onChange={(e) => setField("systemPrompt", e.target.value)}
              required
            />
          </label>
          <div className="flex gap-3 md:col-span-2">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={busy}
            >
              {busy ? "Saving…" : editingId ? "Update template" : "Create template"}
            </button>
            {editingId && (
              <button
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-main"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium text-text-main">Test matching</h2>
        <div className="mt-3 flex gap-3">
          <input
            className={inputClass}
            value={testModel}
            onChange={(e) => setTestModel(e.target.value)}
            placeholder="Provider/model-id"
          />
          <button
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-main"
            onClick={test}
          >
            Test
          </button>
        </div>
        {matches && (
          <p className="mt-3 text-sm text-text-muted">
            {matches.length
              ? matches.map((item) => item.name).join(", ")
              : "No templates match this model."}
          </p>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-220 text-left text-sm">
          <thead className="border-b border-border text-text-muted">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Model pattern</th>
              <th className="p-3">Task</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Enabled</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr className="border-b border-border last:border-0" key={template.id}>
                <td className="p-3 font-medium text-text-main">{template.name}</td>
                <td className="p-3 text-text-muted">{template.modelPattern}</td>
                <td className="p-3 text-text-muted">{template.taskType}</td>
                <td className="p-3 text-text-muted">{template.injectionMode}</td>
                <td className="p-3 text-text-muted">{template.priority}</td>
                <td className="p-3">
                  <button
                    className="rounded border border-border px-2 py-1 text-xs text-text-main"
                    onClick={() => void toggle(template)}
                  >
                    {template.enabled ? "On" : "Off"}
                  </button>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <button
                    className="mr-3 text-primary"
                    onClick={() => {
                      setEditingId(template.id);
                      setForm({ ...template, id: undefined } as TemplateForm);
                    }}
                  >
                    Edit
                  </button>
                  <button className="text-red-500" onClick={() => void remove(template.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
