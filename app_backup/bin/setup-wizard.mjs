/**
 * Nerve Setup Wizard — post-password/provider summary.
 *
 * After the existing `nerve setup` command configures the dashboard password
 * and (optionally) a provider, this module:
 *   1. Prints (or creates) the first API key so the user can authenticate.
 *   2. Prints the OpenAI and Anthropic surface URLs.
 *   3. Prints next-step connection instructions for Claude Code, Codex,
 *      OpenCode, and Hermes.
 *
 * Kept as a separate module so `setup.mjs` stays under its complexity ratchet
 * and the wizard logic is independently testable.
 *
 * @module bin/setup-wizard
 */

import { randomBytes } from "node:crypto";
import { printHeading, printInfo, printSuccess } from "./cli/io.mjs";

const DEFAULT_PORT = 20128;

/** Resolve the base URL the user should point CLIs at. */
function resolveBaseUrl() {
  const port = process.env.NERVE_PORT || process.env.PORT || DEFAULT_PORT;
  const host = process.env.NERVE_SERVER_HOST || "localhost";
  return `http://${host}:${port}`;
}

/**
 * Generate a random 16-char hex password (used when the user opts out of
 * choosing one interactively but still wants login enabled).
 */
export function generateRandomPassword() {
  return randomBytes(12).toString("base64url").slice(0, 20);
}

/**
 * Query the api_keys table for the first active key. Returns the raw key
 * string (only available at creation time) or null if none exists.
 *
 * Works directly on the better-sqlite3 / bun:sqlite handle from openNerveDb
 * — same pattern as the rest of the CLI DB helpers. Guards against a fresh
 * DB where the api_keys table has not been created yet (the CLI's openNerveDb
 * only ensures settings/provider schemas, not the full server schema).
 */
function getFirstApiKey(db) {
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("api_keys");
  if (!hasTable) return null;

  const row = db
    .prepare(
      "SELECT key FROM api_keys WHERE is_active = 1 OR is_active IS NULL ORDER BY created_at LIMIT 1"
    )
    .get();
  return row?.key ?? null;
}

/**
 * Ensure the api_keys table exists on the CLI-opened DB handle, then create
 * a new key via the server-side createApiKey (which uses getDbInstance() —
 * a separate connection to the same file). We create the table on both
 * handles so the INSERT succeeds regardless of which connection runs it.
 */
async function createFirstApiKey(db) {
  // Ensure the table exists on the CLI handle (matches core.ts SCHEMA_SQL).
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      machine_id TEXT,
      allowed_models TEXT DEFAULT '[]',
      no_log INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  const { getConsistentMachineId } = await import("../src/shared/utils/machineId.ts");
  const { createApiKey } = await import("../src/lib/db/apiKeys.ts");

  // createApiKey uses getDbInstance() internally — a separate connection to
  // the same SQLite file. With WAL journaling both connections see each
  // other's committed writes, so the key lands in the same database.
  const machineId = await getConsistentMachineId();
  const apiKey = await createApiKey("nerve-setup", machineId, ["manage"]);
  return apiKey.key;
}

/**
 * Run the post-setup wizard: ensure an API key exists, print it, print the
 * CLI surface URLs, and print next-step instructions.
 *
 * @param {object} db  — open DB handle from openNerveDb()
 * @param {object} opts — { nonInteractive?: boolean }
 */
export async function runSetupWizard(db, opts = {}) {
  const baseUrl = resolveBaseUrl();
  const openaiSurface = `${baseUrl}/v1`;
  const anthropicSurface = baseUrl;

  // ── API key ──────────────────────────────────────────────────────────────
  let apiKey = getFirstApiKey(db);
  if (!apiKey) {
    printInfo("No API key found — creating one now…");
    apiKey = await createFirstApiKey(db);
    printSuccess('API key created (name: "nerve-setup", scope: manage)');
  } else {
    printInfo("Using existing API key from the database.");
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  printHeading("Nerve is ready — connection details");

  console.log("  API key:");
  console.log(`    \x1b[1m${apiKey}\x1b[0m`);
  console.log("");
  console.log("  Endpoint URLs:");
  console.log(`    OpenAI surface:      \x1b[36m${openaiSurface}\x1b[0m`);
  console.log(`    Anthropic surface:   \x1b[36m${anthropicSurface}\x1b[0m`);
  console.log("");

  // ── Next steps ───────────────────────────────────────────────────────────
  printHeading("Next steps — connect your CLI tools");

  console.log("  Claude Code:");
  console.log("    export ANTHROPIC_BASE_URL=" + anthropicSurface);
  console.log("    export ANTHROPIC_API_KEY=" + apiKey);
  console.log("    claude  # or: nerve setup-claude --remote " + baseUrl);
  console.log("");

  console.log("  Codex:");
  console.log("    export OPENAI_BASE_URL=" + openaiSurface);
  console.log("    export OPENAI_API_KEY=" + apiKey);
  console.log("    codex  # or: nerve setup-codex --remote " + baseUrl);
  console.log("");

  console.log("  OpenCode:");
  console.log("    nerve setup opencode  # wires the bundled @nerve/opencode-plugin");
  console.log("");

  console.log("  Hermes:");
  console.log("    export HERMES_OPENAI_BASE_URL=" + openaiSurface);
  console.log("    export HERMES_OPENAI_API_KEY=" + apiKey);
  console.log("");

  console.log("  Dashboard:");
  console.log(`    \x1b[36m${baseUrl}\x1b[0m`);
  console.log("");

  if (!opts.nonInteractive) {
    printInfo("All set. Run `nerve serve` to start the server.");
  }
}
