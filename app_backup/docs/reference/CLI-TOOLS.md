---
title: "CLI Tools — Nerve"
version: 3.8.40
lastUpdated: 2026-06-28
---

# CLI Tools — Nerve

Last updated: 2026-06-28

Nerve integrates with three categories of CLI tools spread across three dedicated dashboard pages:

| Page           | Route                   | Concept                                                           | Count        |
| -------------- | ----------------------- | ----------------------------------------------------------------- | ------------ |
| **CLI Code's** | `/dashboard/cli-code`   | Coding tools you point at Nerve (Client → CLI → Nerve → Provider) | 21           |
| **CLI Agents** | `/dashboard/cli-agents` | Autonomous agents you point at Nerve (same flow, broader scope)   | 6            |
| **ACP Agents** | `/dashboard/acp-agents` | CLIs that Nerve spawns as backend via stdio/ACP (reverse flow)    | see registry |

Legacy routes redirect via 308: `/dashboard/cli-tools` → `/dashboard/cli-code`, `/dashboard/agents` → `/dashboard/acp-agents`.

---

## How It Works

```
CLI Code's / CLI Agents (consumption flow):
Claude / Codex / OpenCode / Cline / KiloCode / Continue / Hermes Agent / Goose / ...
           │
           ▼  (all point to Nerve)
    http://YOUR_SERVER:20128/v1
           │
           ▼  (Nerve routes to the right provider)
    Anthropic / OpenAI / Gemini / DeepSeek / Groq / Mistral / ...

ACP Agents (reverse spawn flow):
    Client request → Nerve → spawns CLI via stdio/ACP → response
```

**Benefits:**

- One API key to manage all tools
- Cost tracking across all CLIs in the dashboard
- Model switching without reconfiguring every tool
- Works locally and on remote servers (VPS, Docker, Akamai, Cloudflare Tunnel)

---

## Auto-configure with `setup-*`

You do not have to write each tool's config by hand. Nerve ships a `setup-*`
command per supported CLI that reads the **live** model catalog from a running
Nerve (local or remote) and writes the tool's own config on your machine:

```bash
nerve setup-codex        nerve setup-claude       nerve setup-opencode
nerve setup-cline        nerve setup-kilo         nerve setup-continue
nerve setup-cursor       nerve setup-roo          nerve setup-crush
nerve setup-goose        nerve setup-qwen         nerve setup-aider
```

Each accepts `--remote <url> --api-key <key>` (configure a local tool against a
remote Nerve), `--dry-run` (preview without writing), and `--port`. Tools
without model auto-discovery (Cline, Kilo, Roo, Goose, Aider, Gemini) take
`--model <id>` (and `--yes` for non-interactive runs). The launchers
`nerve launch` (Claude Code) and `nerve launch-codex` (Codex) spawn the CLI
with the right env injected and write no config at all.

> **Full reference:** the master table — what each command writes, every flag,
> local vs remote, and which tools want a `/v1` suffix — lives in
> **[CLI Integrations](../guides/CLI-INTEGRATIONS.md)**.

---

## Source of Truth

The unified catalog lives in `src/shared/constants/cliTools.ts` as `CLI_TOOLS: Record<string, CliCatalogEntry>`.

Each entry has these fields (defined in `src/shared/schemas/cliCatalog.ts`):

| Field                                           | Type                                                         | Description                                            |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `category`                                      | `"code" \| "agent"`                                          | Which page the tool appears on                         |
| `vendor`                                        | `string`                                                     | Tool origin ("Anthropic", "OSS (P. Gauthier)")         |
| `acpSpawnable`                                  | `boolean`                                                    | Also usable as an ACP Agent (badge shown)              |
| `baseUrlSupport`                                | `"full" \| "partial" \| "none"`                              | Custom endpoint support level. `"none"` = MITM backlog |
| `configType`                                    | `"env" \| "custom" \| "guide" \| "custom-builder" \| "mitm"` | Configuration mechanism                                |
| `id`, `name`, `color`, `description`, `docsUrl` | standard                                                     | Core display fields                                    |

Entries with `baseUrlSupport: "none"` are **not shown** in the dashboard pages — they are registered in the MITM backlog for plan 11 (see `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md`).

---

## 1. CLI Code's Catalog (25 tools)

All tools that appear in `/dashboard/cli-code`. Those with `baseUrlSupport: none` are wired through MITM or a manual guide instead of a custom base URL:

| id           | name                 | vendor              | baseUrlSupport | configType     | acpSpawnable |
| ------------ | -------------------- | ------------------- | -------------- | -------------- | ------------ |
| claude       | Claude Code          | Anthropic           | full           | env            | true         |
| codex        | OpenAI Codex CLI     | OpenAI              | full           | custom         | true         |
| cline        | Cline                | OSS (ex-Claude Dev) | full           | custom         | true         |
| kilo         | Kilo Code            | Kilo-Org            | full           | custom         | false        |
| roo          | Roo Code             | Roo (OSS)           | full           | guide          | false        |
| continue     | Continue             | continue.dev        | full           | guide          | false        |
| aider        | Aider                | OSS (P. Gauthier)   | full           | guide          | true         |
| forge        | ForgeCode            | Antinomy HQ         | full           | custom         | true         |
| jcode        | jcode                | 1jehuang (OSS)      | full           | custom         | false        |
| deepseek-tui | DeepSeek TUI         | Hunter Bown (OSS)   | full           | custom         | false        |
| codewhale    | CodeWhale            | Hmbown (OSS)        | full           | custom         | false        |
| opencode     | OpenCode             | Anomaly (ex-SST)    | full           | guide          | true         |
| droid        | Factory Droid        | Factory AI          | partial        | guide          | false        |
| copilot      | GitHub Copilot CLI   | GitHub/MS           | full           | custom         | false        |
| cursor-cli   | Cursor CLI           | Anysphere           | partial        | guide          | true         |
| smelt        | Smelt                | leonardcser (OSS)   | full           | custom         | false        |
| pi           | Pi (pi-coding-agent) | M. Zechner (OSS)    | full           | custom         | false        |
| grok-build   | Grok Build           | xAI                 | full           | custom         | false        |
| crush        | Crush                | OSS (Charm)         | full           | custom         | false        |
| qwen         | Qwen Code            | Alibaba             | full           | guide          | true         |
| cursor       | Cursor               | Anysphere           | none           | guide          | false        |
| antigravity  | Antigravity          | Google              | none           | mitm           | false        |
| hermes       | Hermes               | Nous Research       | none           | guide          | false        |
| kiro         | Kiro AI              | Amazon              | none           | mitm           | false        |
| custom       | Custom CLI           | —                   | full           | custom-builder | false        |

Tools with `baseUrlSupport: "partial"` show a badge "⚠ Base URL parcial" in the dashboard card.
---

## 2. CLI Agents Catalog (8 tools)

Autonomous agents that appear in `/dashboard/cli-agents`:

| id           | name             | vendor                   | baseUrlSupport | acpSpawnable |
| ------------ | ---------------- | ------------------------ | -------------- | ------------ |
| hermes-agent | Hermes Agent     | Nous Research            | full           | false        |
| openclaw     | OpenClaw         | OSS (P. Steinberger)     | full           | true         |
| goose        | Goose            | Block / Linux Foundation | full           | true         |
| interpreter  | Open Interpreter | OSS                      | full           | true         |
| warp         | Warp AI          | Warp Inc.                | partial        | true         |
| agent-deck   | Agent Deck       | asheshgoplani (OSS)      | full           | false        |
| omp          | Oh My Pi         | OSS                      | full           | true         |
| letta        | Letta CLI        | Letta                    | full           | false        |

---

## 3. ACP Agents (/dashboard/acp-agents)

This page (renamed from `/dashboard/agents`) shows CLIs that Nerve can **spawn** as backend execution engines via stdio/ACP protocol. The catalog is maintained separately in `src/lib/acp/registry.ts` and is **not** the same as `CLI_TOOLS`.

---

## 4. MITM Backlog (not shown in dashboard)

The following CLIs do not support custom base URL natively and are **not listed** in CLI Code's or CLI Agents pages. They are candidates for MITM interception in plan 11:

| CLI                 | Reason                                                     |
| ------------------- | ---------------------------------------------------------- |
| windsurf            | BYOK limited to select Claude models + corporate URL/token |
| amp                 | Closed ecosystem (Sourcegraph)                             |
| amazon-q / kiro-cli | AWS SSO auth, no custom URL                                |
| cowork              | Anthropic Desktop, no configurable endpoint                |

See `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` for the full cross-reference.

---

## 5. Batch Detection API

All tool detection is aggregated via a single endpoint:

**`GET /api/cli-tools/all-statuses`**

- Auth: `requireCliToolsAuth(request)` (same as other `/api/cli-tools/` routes)
- Returns: `Record<toolId, ToolBatchStatus>` (type: `src/shared/types/cliBatchStatus.ts`)
- Strategy: `Promise.all` over all tools, 5s timeout per tool
- Cache: in-memory LRU indexed by config file `mtime`. Cache invalidated when mtime changes. Reset on server restart.

Response shape per tool:

```ts
interface ToolBatchStatus {
  detection: {
    installed: boolean;
    runnable: boolean;
    version?: string;
    command?: string;
    commandPath?: string;
    reason?: string;
  };
  config: {
    status: "configured" | "not_configured" | "not_installed" | "unknown" | "other";
    endpoint?: string | null;
    lastConfiguredAt?: string | null;
  };
  error?: string; // sanitized, no stack traces
}
```

---

## 6. Settings Handlers for New Tools

New tools with `configType: "custom"` have dedicated settings API routes:

| Route                                       | Tool                                                             |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/cli-tools/forge-settings`        | ForgeCode (.forge.toml)                                          |
| `POST /api/cli-tools/jcode-settings`        | jcode (--base-url flag)                                          |
| `POST /api/cli-tools/deepseek-tui-settings` | DeepSeek TUI (OPENAI_BASE_URL, legacy)                           |
| `POST /api/cli-tools/codewhale-settings`    | CodeWhale (OPENAI_BASE_URL, primary + legacy `~/.deepseek` sync) |
| `POST /api/cli-tools/smelt-settings`        | Smelt                                                            |
| `POST /api/cli-tools/pi-settings`           | Pi coding agent                                                  |
| `POST /api/cli-tools/grok-build-settings`   | Grok Build (~/.grok/config.toml, `[model.nerve]`)                |
| `POST /api/cli-tools/qwen-settings`         | Qwen Code (`~/.qwen/settings.json` + dedicated `.env` key)       |

All routes use `sanitizeErrorMessage()` for error responses (Hard Rule #12).

---

## 7. Dashboard Pages Architecture

### CLI Code's (`/dashboard/cli-code`)

- `src/app/(dashboard)/dashboard/cli-code/page.tsx` — server component
- `src/app/(dashboard)/dashboard/cli-code/CliCodePageClient.tsx` — client grid
- `src/app/(dashboard)/dashboard/cli-code/[id]/page.tsx` — tool detail page
- `src/app/(dashboard)/dashboard/cli-code/components/` — 12 specialized tool cards + `ToolDetailClient.tsx`

### CLI Agents (`/dashboard/cli-agents`)

- `src/app/(dashboard)/dashboard/cli-agents/page.tsx` — server component
- `src/app/(dashboard)/dashboard/cli-agents/CliAgentsPageClient.tsx` — client grid
- `src/app/(dashboard)/dashboard/cli-agents/[id]/page.tsx` — reuses `ToolDetailClient`

### ACP Agents (`/dashboard/acp-agents`)

- `src/app/(dashboard)/dashboard/acp-agents/page.tsx` — server component (moved from `agents/`)

### Shared UI Components (`src/shared/components/cli/`)

| File                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `CliToolCard.tsx`       | Smart status card (detection + config + endpoint) |
| `CliConceptCard.tsx`    | Per-page concept explanation card                 |
| `CliComparisonCard.tsx` | Three-column comparison across CLI types          |
| `BaseUrlSelect.tsx`     | Endpoint dropdown (Local/Cloud/Custom)            |
| `ApiKeySelect.tsx`      | API key selector                                  |
| `ManualConfigModal.tsx` | Copiable config snippet modal                     |

### Shared Hook (`src/shared/hooks/cli/`)

| File                      | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `useToolBatchStatuses.ts` | Fetches `/api/cli-tools/all-statuses`, manages loading/refresh state |

---

## 8. i18n

New namespaces added in plan 14 F9:

| Namespace   | Purpose                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `cliCommon` | Shared strings (card labels, concept/comparison texts, detail page labels) |
| `cliCode`   | CLI Code's page strings                                                    |
| `cliAgents` | CLI Agents page strings                                                    |
| `acpAgents` | ACP Agents page strings                                                    |

Full PT-BR and EN translations are provided. 39 other locales fall back to EN automatically via namespace-level merge in `src/i18n/request.ts`.

---

## 9. Quick Start

### Step 1 — Get an Nerve API Key

1. Open `/dashboard/api-manager` → **Create API Key**
2. Give it a name (e.g. `cli-tools`) and select all permissions
3. Copy the key — you'll need it for every CLI below

> Your key looks like: `sk-xxxxxxxxxxxxxxxx-xxxxxxxxx`

---

### Step 2 — Install CLI Tools

All npm-based tools require Node.js 22.22.2+ or 24.x:

```bash
# Claude Code (Anthropic)
npm install -g @anthropic-ai/claude-code

# OpenAI Codex
npm install -g @openai/codex

# OpenCode
npm install -g opencode-ai

# Cline
npm install -g cline

# KiloCode
npm install -g kilocode

# Qwen Code
npm install -g @qwen-code/qwen-code

# Aider
pip install aider-chat

# Smelt
cargo install smelt  # Rust-based

# Pi coding agent
# see https://github.com/zechnerj/pi-coding-agent for install

# jcode
# see https://github.com/1jehuang/jcode for install
```

---

### Step 3 — Configure via Dashboard

1. Go to `http://localhost:20128/dashboard/cli-code`
2. Find your tool in the grid
3. Click the card to open the tool detail page
4. Select your API key and base URL
5. Click **Apply Config** or copy the manual config snippet

---

### Step 4 — Set Global Environment Variables

```bash
# Nerve Universal Endpoint
export OPENAI_BASE_URL="http://localhost:20128/v1"
export OPENAI_API_KEY="sk-your-nerve-key"
export ANTHROPIC_BASE_URL="http://localhost:20128"
export ANTHROPIC_AUTH_TOKEN="sk-your-nerve-key"
export GEMINI_BASE_URL="http://localhost:20128/v1"
export GEMINI_API_KEY="sk-your-nerve-key"
```

> For a **remote server** replace `localhost:20128` with the server IP or domain,
> e.g. `http://<your-server-ip>:20128`.

---

### Step 4 — Configure Each Tool

#### Claude Code

```bash
# Create ~/.claude/settings.json:
mkdir -p ~/.claude && cat > ~/.claude/settings.json << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-nerve-key"
  }
}
EOF
```

Use the unified Anthropic gateway root for Claude Code. Do not append `/v1` here.

**Test:** `claude "say hello"`

---

#### OpenAI Codex

```bash
mkdir -p ~/.codex && cat > ~/.codex/config.yaml << EOF
model: auto
apiKey: sk-your-nerve-key
apiBaseUrl: http://localhost:20128/v1
EOF
```

**Test:** `codex "what is 2+2?"`

---

#### OpenCode

```bash
mkdir -p ~/.config/opencode && cat > ~/.config/opencode/opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "nerve": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Nerve",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "sk-your-nerve-key"
      },
      "models": {
        "claude-sonnet-4-5": { "name": "claude-sonnet-4-5" },
        "claude-sonnet-4-5-thinking": { "name": "claude-sonnet-4-5-thinking" },
        "gemini-3-flash": { "name": "gemini-3-flash" }
      }
    }
  }
}
EOF
```

**Test:** `opencode`

> Use `opencode run "your prompt" --model nerve/claude-sonnet-4-5-thinking --variant high`
> to send thinking variants.

---

#### Cline (CLI or VS Code)

**CLI mode:**

```bash
mkdir -p ~/.cline/data && cat > ~/.cline/data/globalState.json << EOF
{
  "apiProvider": "openai",
  "openAiBaseUrl": "http://localhost:20128/v1",
  "openAiApiKey": "sk-your-nerve-key"
}
EOF
```

**VS Code mode:**
Cline extension settings → API Provider: `OpenAI Compatible` → Base URL: `http://localhost:20128/v1`

Or use the Nerve dashboard → **CLI Tools → Cline → Apply Config**.

---

#### KiloCode (CLI or VS Code)

**CLI mode:**

```bash
kilocode --api-base http://localhost:20128/v1 --api-key sk-your-nerve-key
```

**VS Code settings:**

```json
{
  "kilo-code.openAiBaseUrl": "http://localhost:20128/v1",
  "kilo-code.apiKey": "sk-your-nerve-key"
}
```

Or use the Nerve dashboard → **CLI Tools → KiloCode → Apply Config**.

---

#### Continue (VS Code Extension)

Edit `~/.continue/config.yaml`:

```yaml
models:
  - name: Nerve
    provider: openai
    model: auto
    apiBase: http://localhost:20128/v1
    apiKey: sk-your-nerve-key
    default: true
```

Restart VS Code after editing.

---

#### VS Code Insiders (`chatLanguageModels.json`)

Use this when VS Code Insiders is configured for custom endpoint models and you want Nerve to work without a custom header field.

**Recommended location:**

- Linux: `~/.config/Code - Insiders/User/chatLanguageModels.json`
- Windows: `%APPDATA%/Code - Insiders/User/chatLanguageModels.json`

**Example using the tokenized Nerve alias:**

```json
[
  {
    "vendor": "customendpoint",
    "id": "auto",
    "name": "Nerve Auto",
    "family": "gpt-4",
    "version": "1.0.0",
    "url": "http://localhost:20128/api/v1/vscode/sk-your-nerve-key/chat/completions",
    "modelsUrl": "http://localhost:20128/api/v1/vscode/sk-your-nerve-key/models",
    "requestFormat": "openai-chat-completions",
    "contextWindow": 256000,
    "maxOutputTokens": 32768,
    "auth": {
      "type": "none"
    }
  }
]
```

**Notes:**

- Replace `sk-your-nerve-key` with an API key created in Nerve.
- The `url` field should point to `/api/v1/vscode/{token}/chat/completions`.
- The `modelsUrl` field should point to `/api/v1/vscode/{token}/models`.
- Prefer the normal `/v1` + Bearer header flow when the client supports custom headers.
- URL-embedded tokens are a compatibility fallback and may appear in editor logs or proxy history.

---

#### Kiro CLI (Amazon)

```bash
# Login to your AWS/Kiro account:
kiro-cli login

# The CLI uses its own auth — Nerve is not needed as backend for Kiro CLI itself.
# Use kiro-cli alongside Nerve for other tools.
kiro-cli status
```

For the **Kiro IDE** desktop app, use the MITM endpoint exposed by Nerve
under `/dashboard/cli-tools → Kiro`.

---

## 10. Internal Nerve CLI

The `nerve` binary provides commands for server lifecycle, setup, diagnostics, and provider management. Entry point: `bin/nerve.mjs`.

```bash
nerve                              # Start server (default port 20128)
nerve setup                        # Interactive setup wizard
nerve doctor                       # Check config, DB, ports, runtime
nerve providers list               # Configured provider connections
nerve providers test-all           # Test every active connection
nerve reset-password               # Reset the admin password
nerve logs                         # Stream request logs
nerve health                       # Detailed health (breakers, cache, memory)
nerve --version                    # Print version
nerve --help                       # Show all commands
```

### Setup & Initialization

```bash
nerve setup                        # Interactive setup wizard
nerve setup --non-interactive      # CI/automation mode (reads env vars + flags)
nerve setup --password '<value>'   # Set admin password directly
nerve setup --add-provider \
  --provider openai \
  --api-key '<value>' \
  --test-provider                      # Add and test a provider in one shot
```

Recognized environment variables for non-interactive setup:

| Var             | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `NERVE_API_KEY` | Provider API key (bound to `--api-key` via Commander `.env()`) |
| `DATA_DIR`      | Override the Nerve data directory                              |

All other non-interactive inputs are passed as flags, not environment variables:
`--password`, `--provider`, `--provider-name`, `--provider-base-url`, `--default-model`
(see the `nerve setup` options above).

### Diagnostics

```bash
nerve doctor                       # Check config, DB, ports, runtime, memory, liveness
nerve doctor --json                # Machine-readable JSON
nerve doctor --no-liveness         # Skip the HTTP health probe
nerve doctor --host 0.0.0.0        # Override liveness host
nerve doctor --liveness-url <url>  # Full health endpoint URL override
```

The doctor runs these checks: `Config`, `Database`, `Storage/encryption`,
`Port availability`, `Node runtime`, `Native binary` (better-sqlite3),
`Memory`, and `Server liveness`. It exits non-zero if any check is `fail`.

### Provider Management

```bash
nerve providers available                       # Nerve provider catalog
nerve providers available --search openai       # Filter catalog by id/name/alias/category
nerve providers available --category api-key    # Filter by category (api-key, oauth, free, ...)
nerve providers available --json                # Machine-readable JSON

nerve providers list                            # Configured provider connections
nerve providers list --json

nerve providers test <id|name>                  # Test one configured connection
nerve providers test-all                        # Test every active connection
nerve providers validate                        # Local-only structural validation
```

> `providers available` reads the Nerve catalog; `providers list/test/test-all/validate`
> read the local SQLite database directly and do not require the server to be running.

### Recovery & Reset

```bash
nerve reset-password                # Reset the admin password (also: nerve-reset-password)
nerve reset-encrypted-columns       # Show warning + dry-run for encrypted credential reset
nerve reset-encrypted-columns --force  # Actually null out encrypted credentials in SQLite
```

### Credential Export (⚠ handle with care)

```bash
nerve auth export                                 # Show warning + confirmation gate — no DB access
nerve auth export --force                          # Export ALL connections' DECRYPTED credentials to stdout as JSON
nerve auth export --force --id <id>                 # Export only the matching connection
nerve auth export --force --format env               # Emit NERVE_<PROVIDER>_<FIELD>=<value> lines
nerve auth export --force --out creds.json           # Write to a file (created with 0600 permissions)
```

`auth export` is **local-only** (direct SQLite read, no HTTP route) and intentionally prints/writes
**plaintext** `apiKey`/`accessToken`/`refreshToken`/`idToken` values — that is the feature, not a
bug. Nothing is read from the database, and nothing is decrypted, without `--force`. A stderr
warning banner always prints before any plaintext is emitted. Requires `STORAGE_ENCRYPTION_KEY` to
be set. A field that fails to decrypt (stale key, corrupt ciphertext) is reported as
`<field>DecryptFailed: true` instead of aborting the whole export or leaking the underlying error.

### Other subcommands

These assume a running Nerve server, unless noted otherwise:

```bash
nerve status                       # Comprehensive runtime status
nerve logs                         # Stream request logs (--json, --search, --follow)
nerve config show                  # Display current configuration

nerve provider list                # List available providers (alias of providers list)
nerve provider add                 # Register Nerve as a provider on a tool
nerve keys add | list | remove     # Manage API keys
nerve models [provider]            # List models (--json, --search)
nerve combo list | switch | create | delete

nerve backup                       # Snapshot config + DB
nerve restore                      # Restore from a previous snapshot

nerve health                       # Detailed health (breakers, cache, memory)
nerve quota                        # Provider quota usage
nerve cache                        # Cache status
nerve cache clear                  # Clear semantic + signature caches

nerve mcp status | restart         # MCP server status / restart
nerve a2a status | card            # A2A server status / agent card

nerve tunnel list | create | stop  # Manage tunnels (cloudflare/tailscale/ngrok)
nerve env show | get <k> | set <k> <v>  # Inspect / set env vars (temporary)

nerve test                         # Provider connectivity smoke test
nerve update                       # Check for updates
nerve completion                   # Generate shell completion
```

### Common flags

| Flag                | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `--no-open`         | Don't auto-open the browser on start                   |
| `--port <n>`        | Override the API port (default 20128)                  |
| `--mcp`             | Run as MCP server over stdio (for IDEs)                |
| `--non-interactive` | CI mode (no prompts; reads from env/flags)             |
| `--json`            | Machine-readable JSON output (doctor, providers, etc.) |
| `--help`, `-h`      | Show command-specific help                             |
| `--version`, `-v`   | Print the installed version                            |

---

## Available API Endpoints

| Endpoint                   | Description                   | Use For                     |
| -------------------------- | ----------------------------- | --------------------------- |
| `/v1/chat/completions`     | Standard chat (all providers) | All modern tools            |
| `/v1/responses`            | Responses API (OpenAI format) | Codex, agentic workflows    |
| `/v1/completions`          | Legacy text completions       | Older tools using `prompt:` |
| `/v1/embeddings`           | Text embeddings               | RAG, search                 |
| `/v1/images/generations`   | Image generation              | GPT-Image, Flux, etc.       |
| `/v1/audio/speech`         | Text-to-speech                | ElevenLabs, OpenAI TTS      |
| `/v1/audio/transcriptions` | Speech-to-text                | Deepgram, AssemblyAI        |

Ready-to-paste examples with a tokenized Nerve URL:

```txt
Token example: sk-a3ab3c080beaee3a-69f4a4-070d71af

Standard OpenAI base: http://localhost:20128/v1
VS Code models: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/models
VS Code chat: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/chat/completions
VS Code responses: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/responses
Ollama tags: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/tags
Ollama chat: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/chat
```

---

## Troubleshooting

| Error                                        | Cause                   | Fix                                              |
| -------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `Connection refused`                         | Nerve not running       | `nerve serve`                                    |
| `401 Unauthorized`                           | Wrong API key           | Check in `/dashboard/api-manager`                |
| `No combo configured`                        | No active routing combo | Set up in `/dashboard/combos`                    |
| CLI shows "not installed"                    | Binary not in PATH      | Check `which <command>`                          |
| Dashboard shows "not detected" after install | Cache stale             | Click "⟳ Refresh detection" in dashboard         |
| Old link `/dashboard/cli-tools`              | Pre-v3.8.6 bookmark     | Auto-redirected to `/dashboard/cli-code` (308)   |
| Old link `/dashboard/agents`                 | Pre-v3.8.6 bookmark     | Auto-redirected to `/dashboard/acp-agents` (308) |
