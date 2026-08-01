-- 137_prompt_injection_templates.sql
-- Prompt Template Injection — automatically inject system-prompt optimizations
-- based on the model family and task type. The chat pipeline calls
-- findMatchingTemplates(modelId, taskType) before forwarding to the upstream
-- provider and prepends/appends/replaces a system message accordingly.
--
-- NOTE: the name `prompt_templates` was already taken by the prompt-versioning
-- module (src/lib/db/prompts.ts, migration auto-created in-code). This feature
-- uses a distinct table `prompt_injection_templates` to avoid a schema clash.
--
-- Columns:
--   id              — TEXT primary key (uuid)
--   name            — human-readable label
--   model_pattern   — glob pattern matched against the resolved model id
--                     (e.g. "*/glm-*", "*-reasoning-*", "auto/best-coding")
--   task_type       — coding | reasoning | chat | vision | any
--   system_prompt   — the prompt text to inject
--   injection_mode  — prepend | append | replace
--   priority        — higher = applied first (default 0)
--   enabled         — 0/1 master on/off switch (default 1)
--   created_at      — row creation timestamp
--   updated_at      — row last-modified timestamp

CREATE TABLE IF NOT EXISTS prompt_injection_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model_pattern TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'any',
  system_prompt TEXT NOT NULL,
  injection_mode TEXT NOT NULL DEFAULT 'prepend',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pit_enabled
  ON prompt_injection_templates(enabled);
CREATE INDEX IF NOT EXISTS idx_pit_task_type
  ON prompt_injection_templates(task_type);

-- Seed default templates (idempotent: INSERT OR IGNORE keeps re-runs safe).
INSERT OR IGNORE INTO prompt_injection_templates
  (id, name, model_pattern, task_type, system_prompt, injection_mode, priority, enabled)
VALUES
  (
    'seed-reasoning-boost',
    'Reasoning boost',
    '*-reasoning-*',
    'reasoning',
    'Think through this problem step by step before answering.',
    'prepend',
    10,
    1
  ),
  (
    'seed-reasoning-boost-o1',
    'Reasoning boost (o1)',
    '*/o1-*',
    'reasoning',
    'Think through this problem step by step before answering.',
    'prepend',
    10,
    1
  ),
  (
    'seed-reasoning-boost-o3',
    'Reasoning boost (o3)',
    '*/o3-*',
    'reasoning',
    'Think through this problem step by step before answering.',
    'prepend',
    10,
    1
  ),
  (
    'seed-coding-conciseness-auto',
    'Coding conciseness (auto)',
    'auto/best-coding',
    'coding',
    'Be concise and direct. Write clean, production-ready code.',
    'prepend',
    10,
    1
  ),
  (
    'seed-coding-conciseness-deepseek',
    'Coding conciseness (deepseek)',
    '*/deepseek-*',
    'coding',
    'Be concise and direct. Write clean, production-ready code.',
    'prepend',
    5,
    1
  ),
  (
    'seed-coding-conciseness-codestral',
    'Coding conciseness (codestral)',
    '*/codestral-*',
    'coding',
    'Be concise and direct. Write clean, production-ready code.',
    'prepend',
    5,
    1
  ),
  (
    'seed-fast-chat-auto',
    'Fast chat (auto)',
    'auto/best-fast',
    'chat',
    'Be brief and helpful.',
    'prepend',
    5,
    1
  ),
  (
    'seed-fast-chat-llama',
    'Fast chat (llama)',
    '*/llama-*',
    'chat',
    'Be brief and helpful.',
    'prepend',
    5,
    1
  ),
  (
    'seed-fast-chat-mistral-small',
    'Fast chat (mistral-small)',
    '*/mistral-small-*',
    'chat',
    'Be brief and helpful.',
    'prepend',
    5,
    1
  ),
  (
    'seed-vision-detail',
    'Vision detail',
    '*-vision-*',
    'vision',
    'When analyzing images, describe what you see in detail.',
    'prepend',
    10,
    1
  ),
  (
    'seed-vision-detail-gpt4o',
    'Vision detail (gpt-4o)',
    '*/gpt-4o*',
    'vision',
    'When analyzing images, describe what you see in detail.',
    'prepend',
    10,
    1
  );
