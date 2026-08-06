# Nerve Enhancement Plan

**Goal**: Evolve Nerve from a provider-family fallback system to a flexible, observable, quality-aware routing layer that matches or exceeds OmniRoute's capabilities, while preserving Nerve's zero-config automatic fallback for provider families.

**Status**: Phase 1 + Phase 2 implemented and deployed. (Plan originally written 2026-08-06 with stale file paths — reality: routing engine is `open-sse/services/combo.ts`, quality validation already existed in `open-sse/services/combo/validateQuality.ts`.)

---

## IMPLEMENTATION STATUS (as of 2026-08-06)

### ✅ Already in Nerve (discovered, not built)

- **Quality-based fallback** — `open-sse/services/combo/validateQuality.ts` (`validateResponseQuality`). Detects empty/truncated 200-OK responses and treats them as failover. Invoked at `combo.ts` lines 1205, 2127, 2651. **No duplication needed.**
- **Combo infrastructure** — `open-sse/services/combo.ts` handles heterogeneous ordered `{provider,model}` lists with 17 strategies. Cross-provider fallback already supported via combos.
- **Emergency budget fallback** — `open-sse/services/emergencyFallback.ts` (402 → free-tier reroute).

### ✅ Phase 1 — Global Fallback Provider (DONE, deployed)

- `NERVE_GLOBAL_FALLBACK_PROVIDER=provider/model` env var
- Wired into `combo.ts` handleComboChat after combo exhaustion
- Validates quality before accepting (reuses existing `validateResponseQuality`)
- Docs in `.env.example`

### ✅ Phase 2.6 — Configurable Error Detection (DONE, deployed)

- NEW `open-sse/config/fallbackErrorRules.ts`
- Extracted `MODEL_UNAVAILABLE_FRAGMENTS` + context-overflow patterns out of `modelFamilyFallback.ts`
- Override via `NERVE_FALLBACK_ERROR_RULES_PATH` (JSON), hot-reloadable
- 6 unit tests

### ✅ Phase 2.2 — Observability / Fallback Trace (DONE, deployed)

- NEW `open-sse/services/fallbackTrace.ts` (in-memory ring buffer, default 100)
- Emits `family_fallback` / `combo_fallback` / `global_fallback` events
- Wired into `chatCore.ts` (×2 family sites) + `combo.ts` (combo + global)
- NEW `GET /api/monitoring/fallback-trace` (auth-gated, `?requestId=` + `?limit=` filters)
- Docs in `.env.example` (`NERVE_FALLBACK_TRACE_ENABLED`, `NERVE_FALLBACK_TRACE_CAPACITY`)
- 5 unit tests

### ⏳ Remaining (Phase 3+ — not started)

- §2.4 Latency/Weight/Cost strategies (combo schema extension)
- §2.5 Auto-combo generation from catalog
- §2.7 Cross-provider family fallback
- Dashboard UI panel for fallback traces (endpoint exists; UI panel is additive)

---

## Verification

- Unit tests: 20/20 pass (6 fallback-rules + 5 trace + 9 model-family incl. Nemotron)
- TypeScript core typecheck: clean
- Docker image `nerve:prod` rebuilt & deployed (OrbStack VM at 16 GB)
- In-container module check: both new modules present, 3 `recordFallbackTrace` call sites in `combo.ts`, default rules load (14 entries)

## 1. Current Architecture Recap

| Component                             | Location                                                                   | Purpose                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Model-family fallback table           | `open-sse/services/modelFamilyFallback.ts`                                 | Static `MODEL_FAMILIES` map; automatic intra-provider fallback on context-overflow 400. |
| Provider registries (context lengths) | `open-sse/config/providers/registry/<provider>/index.ts`                   | Supplies `contextLength` for family ordering.                                           |
| Combo infrastructure                  | `open-sse/src/lib/combo.ts`, `comboFetcher.ts`, `comboResolver.ts`         | Heterogeneous ordered lists of `{provider, model}`; fallback on any error.              |
| Admission control                     | `open-sse/src/shared/middleware/chatBodyAdmission.ts`                      | Throttles "heavy" requests; returns 503 when limit exceeded.                            |
| MCP tools for routing                 | `open-sse/mcp-server/tools/pickFastestModel.ts`, `advancedTools.ts`        | Latency/weight-based selection primitives (not yet wired into request path).            |
| Error detection fragments             | `open-sse/services/modelFamilyFallback.ts` (`MODEL_UNAVAILABLE_FRAGMENTS`) | Hard-coded strings that trigger fallback.                                               |

---

## 2. Enhancement Categories

### 2.1 Global Fallback Provider (High Priority)

**Problem**: When a combo is exhausted (or no combo exists and family fallback fails), Nerve returns the error. OmniRoute offers an optional global fallback provider as a final safety net.

**Proposed Solution**:

- Add config: `NERVE_GLOBAL_FALLBACK_PROVIDER=anthropic,claude-3-haiku-20240307` (or similar format) in `.env`.
- Extend `comboResolver.ts`: after combo exhaustion, if global fallback is configured and not already tried, attempt one request to that provider/model.
- Log the global-fallback attempt with a distinct tag (`GLOBAL_FALLBACK:`).

**Files to touch**:

- `open-sse/src/lib/comboResolver.ts`
- `open-sse/services/modelFamilyFallback.ts` (for family-exhaustion path)
- `.env.example` (documentation)

---

### 2.2 Per-Request Observability in Dashboard (High Priority)

**Problem**: Fallback decisions are only visible in raw logs. The Nerve dashboard shows aggregate metrics but not per-request routing steps.

**Proposed Solution**:

- Add a lightweight request-id correlation (already present in `request.id` / `x-request-id`).
- Emit structured fallback events to a new in-memory ring buffer (or Redis stream) with fields:
  - `requestId`
  - `timestamp`
  - `stage`: `family_fallback` | `combo_fallback` | `global_fallback`
  - `fromModel`, `toModel`, `reason` (error string, latency threshold, quality score)
  - `latencyMs` (time spent on the failed attempt)
- Expose `/api/monitoring/fallback-trace?requestId=` endpoint (or include in existing health/monitoring endpoint).
- Dashboard UI: add a "Fallback Trace" panel that renders a timeline for the selected request.

**Files to touch**:

- `open-sse/src/lib/comboResolver.ts`, `modelFamilyFallback.ts` (emit events)
- New: `open-sse/src/lib/fallbackTrace.ts` (ring buffer + Redis optional)
- `open-sse/handlers/monitoring.ts` (new endpoint)
- Dashboard Electron/React UI (new panel)

---

### 2.3 Quality-Based Fallback (Medium Priority)

**Problem**: Nerve only falls back on error status codes / error strings. It cannot detect "successful but bad" responses (truncated output, repetition, hallucination, low token efficiency).

**Proposed Solution**:

- Implement a pluggable `ResponseQualityValidator` interface:
  ```ts
  interface ResponseQualityValidator {
    validate(
      stream: AsyncIterable<ChatCompletionChunk>,
      meta: RequestMeta
    ): Promise<QualityVerdict>;
  }
  type QualityVerdict = { ok: true } | { ok: false; reason: string; retryable: boolean };
  ```
- Built-in validators (opt-in via env):
  - `TruncationDetector`: checks for `finish_reason: "length"` or abrupt stop.
  - `RepetitionDetector`: n-gram repetition ratio > threshold.
  - `TokenEfficiencyChecker`: output tokens / input tokens ratio below threshold.
- Wire into combo resolver: if a validator returns `ok: false` and `retryable: true`, treat as a failure and advance to next combo entry (or family sibling).

**Files to touch**:

- New: `open-sse/src/lib/responseQualityValidator.ts`
- `open-sse/src/lib/comboResolver.ts` (integrate validation step)
- `.env.example` (enable/disable validators, thresholds)

---

### 2.4 Latency- & Weight-Based Routing Strategies (Medium Priority)

**Problem**: Nerve's combo strategy is purely "fallback" (sequential). OmniRoute supports weighted random, latency-aware, cost-aware, etc.

**Proposed Solution**:

- Define a `RoutingStrategy` type (already hinted in `pickFastestModel.ts`):
  ```ts
  type RoutingStrategy = "fallback" | "weighted" | "latency" | "cost" | "quality";
  ```
- Extend combo schema to include `strategy` and optional weights:
  ```json
  { "entries": [...], "strategy": "weighted", "weights": [0.5, 0.3, 0.2] }
  ```
- Implement strategy selectors in `comboResolver.ts`:
  - `fallback`: current sequential behavior.
  - `weighted`: pick entry by weight on each request (no retry unless error).
  - `latency`: maintain EWMA latency per entry; pick lowest; on error, fall back to next-lowest.
  - `cost`: similar, using per-model cost metadata from registry.
- Expose via combo CRUD API and dashboard.

**Files to touch**:

- `open-sse/src/lib/comboResolver.ts`
- `open-sse/src/lib/pickFastestModel.ts` (refactor into shared strategy module)
- Combo API handlers (`open-sse/handlers/combos.ts`)
- Dashboard UI for strategy selection

---

### 2.5 Auto-Combo Generation from Catalog (Medium Priority)

**Problem**: Users must manually author combos. OmniRoute can auto-generate combos from the model catalog based on criteria.

**Proposed Solution**:

- Add a background job (or on-demand endpoint) that:
  1. Fetches `/v1/models` catalog (already implemented).
  2. Filters by criteria: `minContext`, `maxPrice`, `providers`, `capabilities` (vision, tools, reasoning).
  3. Sorts by a scoring function (latency, cost, quality signals).
  4. Creates/updates a combo with id `auto/<criteria-hash>`.
- Expose via `POST /api/combos/auto-generate` with criteria payload.
- Schedule periodic refresh (e.g., hourly) to keep combos current.

**Files to touch**:

- New: `open-sse/src/services/autoComboGenerator.ts`
- `open-sse/handlers/combos.ts` (new endpoint)
- Scheduler (could reuse existing cron-like infra or add a simple `setInterval` in main process)

---

### 2.6 Configurable Fallback Error Detection (Low Priority)

**Problem**: `MODEL_UNAVAILABLE_FRAGMENTS` and context-overflow detection are hard-coded in `modelFamilyFallback.ts`. Adding a new provider's error signature requires a code change.

**Proposed Solution**:

- Move error fragments to a JSON config file: `config/fallbackErrorRules.json`.
- Schema:
  ```json
  {
    "contextOverflow": ["max_context_length", "context length exceeded", "too many tokens"],
    "modelUnavailable": ["model not found", "model_not_found", "does not exist"],
    "rateLimit": ["rate limit", "quota exceeded", "too many requests"],
    "providerSpecific": {
      "nvidia": ["specific nvidia error"],
      "anthropic": ["anthropic specific"]
    }
  }
  ```
- Load at startup; allow hot-reload via SIGHUP or admin endpoint.
- `modelFamilyFallback.ts` imports the config instead of using inline arrays.

**Files to touch**:

- New: `open-sse/config/fallbackErrorRules.json`
- `open-sse/services/modelFamilyFallback.ts` (load config)
- `.env.example` (optional override path)

---

### 2.7 Cross-Provider Family Fallback (Optional / Nice-to-Have)

**Problem**: Family fallback is strictly intra-provider. Users sometimes want "if this provider's family is exhausted, try another provider's equivalent family".

**Proposed Solution**:

- Extend `MODEL_FAMILIES` to allow a special `__fallbackProvider__` key:
  ```ts
  "anthropic/claude-3-opus": [
    "anthropic/claude-3-sonnet",
    { provider: "openai", model: "gpt-4-turbo" },  // cross-provider sibling
    { provider: "google", model: "gemini-1.5-pro" }
  ]
  ```
- `getNextFamilyFallback` already returns a string; teach it to parse `{provider, model}` objects and resolve via catalog.
- Keep backward compatibility (string-only entries work as before).

**Files to touch**:

- `open-sse/services/modelFamilyFallback.ts`
- Type definitions for `FamilyEntry`

---

## 3. Implementation Priority & Sequencing

| Phase                  | Items                                                | Rationale                                                                                   |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Phase 1 (Week 1-2)** | Global Fallback Provider, Per-Request Observability  | Immediate safety net + visibility; unblocks debugging of production issues.                 |
| **Phase 2 (Week 3-4)** | Quality-Based Fallback, Configurable Error Detection | Reduces silent bad responses; removes code-change friction for new providers.               |
| **Phase 3 (Week 5-6)** | Latency/Weight Strategies, Auto-Combo Generation     | Brings parity with OmniRoute's routing flexibility; enables "set and forget" for new users. |
| **Phase 4 (Later)**    | Cross-Provider Family Fallback                       | Nice-to-have; lower ROI unless explicitly requested.                                        |

---

## 4. Testing Strategy

- **Unit tests** for each new validator, strategy selector, auto-combo generator.
- **Integration tests** (Playwright / vitest) that spin up a test Nerve instance, send requests that trigger each fallback path, and assert:
  - Correct fallback model is used.
  - Fallback trace appears in `/api/monitoring/fallback-trace`.
  - Global fallback is invoked only after combo exhaustion.
- **Chaos tests**: inject artificial latency/errors via a mock provider to verify strategy behavior.

---

## 5. Backward Compatibility Guarantees

- All new features are **opt-in** via env vars or combo configuration.
- Existing `MODEL_FAMILIES` and combo `fallback` strategy continue to work unchanged.
- No breaking changes to `/v1/chat/completions` request/response format.
- Dashboard additions are additive (new panels, new endpoints).

---

## 6. Documentation Updates

- `README.md`: new section "Advanced Routing & Fallback".
- `.env.example`: document all new vars.
- `docs/routing-strategies.md`: detailed guide for each strategy.
- `docs/fallback-observability.md`: how to read fallback traces.

---

## 7. Open Questions / Decisions Needed

1. **Redis vs in-memory for fallback traces**: Redis allows multi-instance deployments; in-memory is simpler for single-node. Default to in-memory, optional Redis via `NERVE_FALLBACK_TRACE_REDIS_URL`.
2. **Quality validator latency budget**: Validators must not add >50ms to the critical path. Stream-based validators (truncation) are cheap; n-gram repetition may need sampling.
3. **Auto-combo scoring function**: Should we expose a pluggable scoring function (JS eval / WASM) or keep it declarative (JSON weights)?
4. **Dashboard tech stack**: Current dashboard is Electron + React. New panels should follow existing patterns (Redux/Context + Tailwind).

---

## 8. Quick Wins (Can be done in < 1 day each)

- [ ] Add `NERVE_GLOBAL_FALLBACK_PROVIDER` env + combo resolver integration.
- [ ] Emit structured fallback logs (JSON lines) to stdout + optional file.
- [ ] Move `MODEL_UNAVAILABLE_FRAGMENTS` to `config/fallbackErrorRules.json`.
- [ ] Add `/api/monitoring/fallback-trace` endpoint returning last 100 traces.

---

## 9. Related Files Index (for implementers)

```
/open-sse/
├── services/
│   ├── modelFamilyFallback.ts          # Family fallback logic (UPDATED with Nemotron)
│   └── autoComboGenerator.ts           # NEW
├── src/
│   ├── lib/
│   │   ├── combo.ts                    # Combo types & helpers
│   │   ├── comboResolver.ts            # Core fallback/routing logic (MAIN TARGET)
│   │   ├── comboFetcher.ts             # Catalog → combo hydration
│   │   ├── pickFastestModel.ts         # Latency/weight primitives (REFactor)
│   │   ├── responseQualityValidator.ts # NEW
│   │   └── fallbackTrace.ts            # NEW
│   └── shared/middleware/
│       └── chatBodyAdmission.ts        # Admission control (separate)
├── handlers/
│   ├── combos.ts                       # Combo CRUD + auto-generate endpoint
│   └── monitoring.ts                   # Health + fallback trace endpoint
├── config/
│   ├── providers/registry/nvidia/index.ts   # Context lengths (UPDATED)
│   └── fallbackErrorRules.json              # NEW
├── mcp-server/tools/
│   ├── pickFastestModel.ts
│   └── advancedTools.ts
└── tests/
    └── unit/
        ├── model-family-fallback-notation.test.ts  # EXTENDED
        ├── combo-resolver.test.ts                  # NEW
        ├── response-quality-validator.test.ts      # NEW
        └── auto-combo-generator.test.ts            # NEW
```

---

## 10. Sign-Off

**Author**: Vikas Reddy  
**Date**: 2026-08-06  
**Reviewers**: (pending)

> This plan is a living document. Update as implementation progresses and new requirements emerge.
