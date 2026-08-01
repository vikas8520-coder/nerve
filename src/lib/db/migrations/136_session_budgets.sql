-- Smart Cost Guardrails: per-CLI-session cost/token budgets.
-- Tracks max_tokens / max_cost_usd limits and cumulative usage per session.
CREATE TABLE IF NOT EXISTS session_budgets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  api_key_id TEXT,
  max_tokens INTEGER,
  max_cost_usd REAL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd_used REAL NOT NULL DEFAULT 0,
  warning_threshold REAL NOT NULL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_session_budgets_session_id ON session_budgets(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_budgets_session_id_unique ON session_budgets(session_id);
CREATE INDEX IF NOT EXISTS idx_session_budgets_api_key_id ON session_budgets(api_key_id);
CREATE INDEX IF NOT EXISTS idx_session_budgets_enabled ON session_budgets(enabled);
