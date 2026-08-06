/**
 * Fallback Trace — per-request routing observability (Phase 2.2, NERVE_ENHANCEMENT_PLAN §2.2)
 *
 * Emits structured fallback events to an in-memory ring buffer. Each entry records
 * one fallback hop a request took: which stage (family_fallback | combo_fallback |
 * global_fallback), the source and destination models, the trigger reason, and the
 * latency of the failed attempt. The last N traces are exposed via
 * `/api/monitoring/fallback-trace` (see src/app/api/monitoring/fallback-trace/route.ts).
 *
 * Design notes:
 *  - In-memory ring buffer (default 100 entries). Single-node deployments are the
 *    common case; multi-instance deployments can set `NERVE_FALLBACK_TRACE_REDIS_URL`
 *    (reserved — not yet wired) and this module will use it transparently.
 *  - Zero allocations on the hot path when tracing is disabled (enabled by default;
 *    disable via `NERVE_FALLBACK_TRACE_ENABLED=false`).
 *  - All writes are append-only and lock-free for single-threaded event loop; the
 *    ring buffer is a plain array with a rotating write index.
 */

export type FallbackStage = "family_fallback" | "combo_fallback" | "global_fallback";

export interface FallbackTraceEvent {
  /** Monotonic sequence number (for ordering when the ring wraps). */
  seq: number;
  /** ISO timestamp. */
  ts: string;
  /** Request correlation id (x-request-id / request.id), or "unknown". */
  requestId: string;
  /** Combo name when applicable (family/global fallbacks may be combo-scoped). */
  combo: string | null;
  /** Which fallback mechanism fired. */
  stage: FallbackStage;
  /** Model we tried and abandoned. */
  fromModel: string;
  /** Model we moved to (null when the fallback itself failed / exhausted). */
  toModel: string | null;
  /** Human-readable trigger: error string, latency threshold, quality verdict, etc. */
  reason: string;
  /** How long the abandoned attempt took, in ms. */
  latencyMs: number;
  /** Whether the hop succeeded (found a working model) or exhausted. */
  exhausted: boolean;
}

const DEFAULT_CAPACITY = 100;

function resolveCapacity(): number {
  const raw = process.env.NERVE_FALLBACK_TRACE_CAPACITY;
  if (!raw) return DEFAULT_CAPACITY;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CAPACITY;
  return Math.min(Math.floor(n), 10_000);
}

function isEnabled(): boolean {
  const raw = process.env.NERVE_FALLBACK_TRACE_ENABLED;
  if (raw === "false" || raw === "0") return false;
  return true;
}

let enabled = isEnabled();
let capacity = resolveCapacity();
let buffer: FallbackTraceEvent[] = [];
let writeIndex = 0;
let seqCounter = 0;

/** Re-read env-derived settings (called on hot-reload / admin toggle). */
export function reloadFallbackTraceConfig(): void {
  enabled = isEnabled();
  capacity = resolveCapacity();
  if (buffer.length > capacity) {
    buffer = buffer.slice(buffer.length - capacity);
    writeIndex = 0;
  }
}

export interface RecordFallbackTraceInput {
  requestId?: string | null;
  combo?: string | null;
  stage: FallbackStage;
  fromModel: string;
  toModel?: string | null;
  reason: string;
  latencyMs?: number;
  exhausted?: boolean;
}

/** Append a fallback event to the ring buffer. No-op when tracing is disabled. */
export function recordFallbackTrace(input: RecordFallbackTraceInput): void {
  if (!enabled) return;
  const event: FallbackTraceEvent = {
    seq: ++seqCounter,
    ts: new Date().toISOString(),
    requestId: input.requestId || "unknown",
    combo: input.combo ?? null,
    stage: input.stage,
    fromModel: input.fromModel,
    toModel: input.toModel ?? null,
    reason: input.reason,
    latencyMs: typeof input.latencyMs === "number" ? Math.max(0, Math.round(input.latencyMs)) : 0,
    exhausted: input.exhausted ?? false,
  };
  if (buffer.length < capacity) {
    buffer.push(event);
  } else {
    buffer[writeIndex] = event;
  }
  writeIndex = (writeIndex + 1) % capacity;
}

/** Return traces newest-first. Optional `requestId` filter. */
export function getFallbackTraces(opts?: {
  requestId?: string;
  limit?: number;
}): FallbackTraceEvent[] {
  const out =
    buffer.length < capacity
      ? buffer
      : (() => {
          // Ring is full — reconstruct in insertion order then reverse for newest-first.
          const ordered: FallbackTraceEvent[] = [];
          for (let i = 0; i < capacity; i++) {
            const idx = (writeIndex + i) % capacity;
            ordered.push(buffer[idx]);
          }
          return ordered;
        })();
  let filtered = out;
  if (opts?.requestId) {
    const rid = opts.requestId;
    filtered = out.filter((e) => e.requestId === rid);
  }
  const reversed = filtered.slice().reverse();
  if (opts?.limit && opts.limit > 0) return reversed.slice(0, opts.limit);
  return reversed;
}

/** Clear the buffer (admin action / test helper). */
export function clearFallbackTraces(): void {
  buffer = [];
  writeIndex = 0;
  seqCounter = 0;
}
