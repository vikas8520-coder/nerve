/**
 * Database module: Prompt Injection Templates
 *
 * CRUD + matching for the Prompt Template Injection feature. Rows live in the
 * prompt_injection_templates table (migration 134). The chat pipeline calls
 * {@link findMatchingTemplates} before forwarding to the upstream provider and
 * injects a system message (prepend / append / replace) accordingly.
 *
 * @module lib/db/promptInjectionTemplates
 */

import crypto from "crypto";
import { getDbInstance } from "./core";

export type InjectionMode = "prepend" | "append" | "replace";
export type TaskType = "coding" | "reasoning" | "chat" | "vision" | "any";

export interface PromptInjectionTemplate {
  id: string;
  name: string;
  modelPattern: string;
  taskType: TaskType;
  systemPrompt: string;
  injectionMode: InjectionMode;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptInjectionRow {
  id: string;
  name: string;
  model_pattern: string;
  task_type: string;
  system_prompt: string;
  injection_mode: string;
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface CountResult {
  cnt: number;
}

function toTaskType(value: unknown): TaskType {
  const v = typeof value === "string" ? value : "any";
  if (v === "coding" || v === "reasoning" || v === "chat" || v === "vision" || v === "any") {
    return v;
  }
  return "any";
}

function toInjectionMode(value: unknown): InjectionMode {
  const v = typeof value === "string" ? value : "prepend";
  if (v === "prepend" || v === "append" || v === "replace") return v;
  return "prepend";
}

function rowToTemplate(row: PromptInjectionRow): PromptInjectionTemplate {
  return {
    id: row.id,
    name: row.name,
    modelPattern: row.model_pattern,
    taskType: toTaskType(row.task_type),
    systemPrompt: row.system_prompt,
    injectionMode: toInjectionMode(row.injection_mode),
    priority: typeof row.priority === "number" ? row.priority : Number(row.priority) || 0,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTemplateInput {
  name: string;
  modelPattern: string;
  taskType?: TaskType;
  systemPrompt: string;
  injectionMode?: InjectionMode;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  modelPattern?: string;
  taskType?: TaskType;
  systemPrompt?: string;
  injectionMode?: InjectionMode;
  priority?: number;
  enabled?: boolean;
}

export interface ListFilters {
  taskType?: TaskType;
  modelPattern?: string;
  enabled?: boolean;
}

/**
 * Create a new prompt injection template.
 */
export function createTemplate(data: CreateTemplateInput): PromptInjectionTemplate {
  const db = getDbInstance();
  const id = crypto.randomUUID();
  const taskType = data.taskType ?? "any";
  const injectionMode = data.injectionMode ?? "prepend";
  const priority = data.priority ?? 0;
  const enabled = data.enabled === false ? 0 : 1;

  db.prepare(
    `INSERT INTO prompt_injection_templates
       (id, name, model_pattern, task_type, system_prompt, injection_mode, priority, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name,
    data.modelPattern,
    taskType,
    data.systemPrompt,
    injectionMode,
    priority,
    enabled
  );

  return getTemplate(id)!;
}

/**
 * Get a single template by id.
 */
export function getTemplate(id: string): PromptInjectionTemplate | null {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM prompt_injection_templates WHERE id = ?").get(id) as
    PromptInjectionRow | undefined;
  return row ? rowToTemplate(row) : null;
}

/**
 * List templates, optionally filtered by task_type / model_pattern / enabled.
 * Ordered by priority desc then name asc.
 */
export function listTemplates(filters?: ListFilters): PromptInjectionTemplate[] {
  const db = getDbInstance();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.taskType && filters.taskType !== "any") {
    conditions.push("(task_type = ? OR task_type = 'any')");
    params.push(filters.taskType);
  }
  if (filters?.modelPattern) {
    conditions.push("model_pattern = ?");
    params.push(filters.modelPattern);
  }
  if (filters?.enabled !== undefined) {
    conditions.push("enabled = ?");
    params.push(filters.enabled ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM prompt_injection_templates ${where} ORDER BY priority DESC, name ASC`)
    .all(...params) as PromptInjectionRow[];

  return rows.map(rowToTemplate);
}

/**
 * Update a template. Returns the updated row or null if not found.
 */
export function updateTemplate(
  id: string,
  data: UpdateTemplateInput
): PromptInjectionTemplate | null {
  const existing = getTemplate(id);
  if (!existing) return null;

  const db = getDbInstance();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.modelPattern !== undefined) {
    fields.push("model_pattern = ?");
    values.push(data.modelPattern);
  }
  if (data.taskType !== undefined) {
    fields.push("task_type = ?");
    values.push(data.taskType);
  }
  if (data.systemPrompt !== undefined) {
    fields.push("system_prompt = ?");
    values.push(data.systemPrompt);
  }
  if (data.injectionMode !== undefined) {
    fields.push("injection_mode = ?");
    values.push(data.injectionMode);
  }
  if (data.priority !== undefined) {
    fields.push("priority = ?");
    values.push(data.priority);
  }
  if (data.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(data.enabled ? 1 : 0);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE prompt_injection_templates SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );

  return getTemplate(id);
}

/**
 * Delete a template. Returns true if a row was removed.
 */
export function deleteTemplate(id: string): boolean {
  const db = getDbInstance();
  const result = db.prepare("DELETE FROM prompt_injection_templates WHERE id = ?").run(id);
  return (result as { changes?: number }).changes !== undefined
    ? (result as { changes: number }).changes > 0
    : false;
}

/**
 * Count enabled templates (used by dashboards / health checks).
 */
export function countEnabledTemplates(): number {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT count(*) as cnt FROM prompt_injection_templates WHERE enabled = 1")
    .get() as CountResult | undefined;
  return row?.cnt ?? 0;
}

// ── Matching ───────────────────────────────────────────────────────────────

/**
 * Convert a glob pattern (with `*` and `?` wildcards) into a RegExp.
 * `*` matches any sequence of characters (including `/`), `?` matches a single
 * character. All other characters are escaped literally.
 */
export function globToRegExp(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      re += ".*";
    } else if (ch === "?") {
      re += ".";
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re, "i");
}

/**
 * Test whether a model id matches a glob pattern.
 */
export function matchesPattern(modelId: string, pattern: string): boolean {
  if (!pattern) return false;
  // Exact match short-circuit (case-insensitive).
  if (pattern.toLowerCase() === modelId.toLowerCase()) return true;
  return globToRegExp(pattern).test(modelId);
}

/**
 * Best-effort inference of a task type from a model id. Used by the chat
 * pipeline when the request carries no explicit task hint. Recognises common
 * auto-combo channels ('auto/best-coding', 'auto/best-fast') and model-family
 * suffixes (e.g. -reasoning-, /o1-, /o3-, -vision-, /gpt-4o).
 * Returns '"any"' when nothing recognisable is found.
 */
export function inferTaskType(modelId: string): TaskType {
  const id = modelId.toLowerCase();
  if (id.includes("best-coding") || id.includes("coding")) return "coding";
  if (id.includes("best-fast") || id.includes("fast")) return "chat";
  if (id.includes("reasoning") || id.includes("/o1-") || id.includes("/o3-")) return "reasoning";
  if (id.includes("vision") || id.includes("gpt-4o")) return "vision";
  return "any";
}

/**
 * Find enabled templates that match the model id and task type, sorted by
 * priority desc then name asc. A template matches when:
 *   - it is enabled,
 *   - its task_type is "any" OR equals the requested taskType,
 *   - its model_pattern matches the modelId (glob).
 *
 * Pass taskType = "any" (or undefined) to match task-agnostic templates only
 * plus any template whose task_type is "any".
 */
export function findMatchingTemplates(
  modelId: string,
  taskType?: TaskType
): PromptInjectionTemplate[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      `SELECT * FROM prompt_injection_templates
       WHERE enabled = 1
       ORDER BY priority DESC, name ASC`
    )
    .all() as PromptInjectionRow[];

  const wantTask = taskType && taskType !== "any" ? taskType : null;

  return rows
    .filter((row) => {
      const rowTask = toTaskType(row.task_type);
      const taskOk = rowTask === "any" || (wantTask !== null && rowTask === wantTask);
      if (!taskOk) return false;
      return matchesPattern(modelId, row.model_pattern);
    })
    .map(rowToTemplate);
}
