/**
 * Configurable fallback error-detection rules (Phase 2.6 — NERVE_ENHANCEMENT_PLAN §2.6)
 *
 * Historically `MODEL_UNAVAILABLE_FRAGMENTS` (modelFamilyFallback.ts) and
 * `CONTEXT_OVERFLOW_PATTERNS` (accountFallback.ts) were hard-coded in source.
 * Adding a new provider's error signature required a code change + rebuild.
 *
 * This module externalizes those rules so operators can extend detection WITHOUT
 * touching source. Resolution order:
 *   1. If `NERVE_FALLBACK_ERROR_RULES_PATH` points to a readable JSON file, load it.
 *   2. Otherwise fall back to the bundled defaults exported below.
 *
 * The defaults mirror the previously hard-coded arrays verbatim so behavior is
 * unchanged for existing deployments. Rules are hot-reloadable via
 * `reloadFallbackErrorRules()` (e.g. called from an admin endpoint or SIGHUP).
 *
 * Matching model:
 *   - `modelUnavailable`: substring fragments (case-insensitive `includes`).
 *   - `contextOverflow`:  regex source strings (case-insensitive). Resolved to
 *     RegExp at load time so the matching code path stays identical to the old
 *     `CONTEXT_OVERFLOW_PATTERNS` array of RegExp objects.
 *   - `rateLimit` / `providerSpecific`: reserved extensibility for future phases;
 *     the loader validates their shape but Nerve's existing classifiers own the
 *     actual rate-limit logic, so they are not consulted by the core path yet.
 */

import { readFileSync } from "node:fs";

export interface FallbackErrorRules {
  /** Substrings (lowercased compare) that indicate the requested model is unavailable. */
  modelUnavailable: string[];
  /** Regex source strings (case-insensitive) that indicate a context-length overflow. */
  contextOverflow: string[];
  /** Reserved: substrings indicating rate-limit exhaustion. */
  rateLimit: string[];
  /** Reserved: provider-keyed fragment lists for provider-specific signatures. */
  providerSpecific: Record<string, string[]>;
}

export const DEFAULT_FALLBACK_ERROR_RULES: FallbackErrorRules = {
  modelUnavailable: [
    "model not found",
    "model_not_found",
    "model not available",
    "model is not available",
    "no such model",
    "unsupported model",
    "unknown model",
    "this model does not exist",
    "invalid model",
    "model not supported",
    "does not support",
    "not enabled for",
    "access to model",
    "improperly formed request", // Kiro 400 (model unavailable)
  ],
  contextOverflow: [
    "\\binput is too long\\b",
    "\\binput too long\\b",
    "\\bcontext.*(too long|exceeded|overflow|limit)",
    "\\btoo many tokens\\b",
    "\\bprompt is too long\\b",
    "\\bcontext window",
    "\\bmaximum context",
    "\\bmax.*token",
    "\\btoken limit",
    "\\brequest too large\\b",
  ],
  rateLimit: ["rate limit", "quota exceeded", "too many requests"],
  providerSpecific: {
    nvidia: [],
    anthropic: [],
  },
};

let activeRules: FallbackErrorRules = structuredCloneSafe(DEFAULT_FALLBACK_ERROR_RULES);

/** Compiled regex cache, rebuilt whenever rules are (re)loaded. */
let compiledContextOverflow: RegExp[] = compileRegexes(activeRules.contextOverflow);

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compileRegexes(sources: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const src of sources) {
    try {
      out.push(new RegExp(src, "i"));
    } catch {
      // Skip malformed rule silently — never let a bad rule break fallback.
    }
  }
  return out;
}

function resolveRulesPathOverride(): string | null {
  const raw = process.env.NERVE_FALLBACK_ERROR_RULES_PATH;
  if (!raw || typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}

/**
 * Load rules from the optional override file, else use bundled defaults.
 * Safe to call repeatedly (e.g. on hot-reload). Returns the rules now active.
 */
export function reloadFallbackErrorRules(): FallbackErrorRules {
  const path = resolveRulesPathOverride();
  if (!path) {
    activeRules = structuredCloneSafe(DEFAULT_FALLBACK_ERROR_RULES);
    compiledContextOverflow = compileRegexes(activeRules.contextOverflow);
    return activeRules;
  }
  try {
    // ESM-safe: import node:fs at top of module (no require in ESM scope).
    const rawText = readFileSync(path, "utf-8");
    const parsed = JSON.parse(rawText) as Partial<FallbackErrorRules>;
    const merged: FallbackErrorRules = {
      modelUnavailable:
        Array.isArray(parsed.modelUnavailable) && parsed.modelUnavailable.length > 0
          ? parsed.modelUnavailable
          : DEFAULT_FALLBACK_ERROR_RULES.modelUnavailable,
      contextOverflow:
        Array.isArray(parsed.contextOverflow) && parsed.contextOverflow.length > 0
          ? parsed.contextOverflow
          : DEFAULT_FALLBACK_ERROR_RULES.contextOverflow,
      rateLimit:
        Array.isArray(parsed.rateLimit) && parsed.rateLimit.length > 0
          ? parsed.rateLimit
          : DEFAULT_FALLBACK_ERROR_RULES.rateLimit,
      providerSpecific:
        parsed.providerSpecific && typeof parsed.providerSpecific === "object"
          ? parsed.providerSpecific
          : DEFAULT_FALLBACK_ERROR_RULES.providerSpecific,
    };
    activeRules = merged;
    compiledContextOverflow = compileRegexes(merged.contextOverflow);
    return activeRules;
  } catch (err) {
    // On any load failure, keep the previous (or default) rules and report.
     
    console.warn(
      "[fallbackErrorRules] Failed to load override at",
      path,
      "- using defaults:",
      err instanceof Error ? err.message : err
    );
    return activeRules;
  }
}

/** Get the currently active rules (no reload). */
export function getFallbackErrorRules(): FallbackErrorRules {
  return activeRules;
}

/** Compiled context-overflow regexes (mirrors old `CONTEXT_OVERFLOW_PATTERNS`). */
export function getContextOverflowPatterns(): RegExp[] {
  return compiledContextOverflow;
}

/** True if `errorMessage` contains any configured model-unavailable fragment. */
export function matchesModelUnavailable(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return activeRules.modelUnavailable.some((frag) => frag && msg.includes(frag.toLowerCase()));
}

/** True if `errorMessage` matches any configured context-overflow pattern. */
export function matchesContextOverflow(errorMessage: string): boolean {
  return compiledContextOverflow.some((re) => re.test(errorMessage));
}

// Initialize at module load (honors override path if present at boot).
reloadFallbackErrorRules();
