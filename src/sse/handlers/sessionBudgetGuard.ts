/**
 * sessionBudgetGuard.ts — Smart Cost Guardrails integration for the chat pipeline.
 *
 * Provides two hooks:
 *  1. `enforceSessionBudget()` — pre-request check. Returns a 429 Response if the
 *     session is already over budget, or null if the request may proceed.
 *  2. `applySessionBudgetPostResponse()` — post-response. Increments usage from
 *     the response's `usage` object, and attaches an `X-Budget-Warning` header
 *     when the session crosses its warning threshold.
 *
 * Both hooks are no-ops when no budget is configured for the session.
 */

import { createHash } from "node:crypto";
import { errorResponse } from "@nerve/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@nerve/open-sse/config/constants.ts";
import {
  checkBudget,
  getBudget,
  incrementUsage,
  isWarningThresholdReached,
} from "@/lib/db/sessionBudgets";
import { calculateCost } from "@/lib/usage/costCalculator";

/**
 * Pre-request budget enforcement. Call BEFORE dispatching to upstream.
 * Returns a 429 Response if the session is over budget, or null to proceed.
 */
export function enforceSessionBudget(sessionId: string | null): Response | null {
  if (!sessionId) return null;

  let budget;
  try {
    budget = getBudget(sessionId);
  } catch {
    return null;
  }
  if (!budget || !budget.enabled) return null;

  let check;
  try {
    check = checkBudget(sessionId);
  } catch {
    return null;
  }

  if (check.withinBudget) return null;

  // Build a clear over-budget message
  const parts: string[] = [];
  if (budget.maxTokens !== null && budget.maxTokens > 0) {
    parts.push(`used ${budget.tokensUsed} of ${budget.maxTokens} tokens`);
  }
  if (budget.maxCostUsd !== null && budget.maxCostUsd > 0) {
    parts.push(`used $${budget.costUsdUsed.toFixed(4)} of $${budget.maxCostUsd.toFixed(4)}`);
  }
  const detail = parts.length > 0 ? parts.join(", ") : "budget limit reached";

  return errorResponse(HTTP_STATUS.RATE_LIMITED, `Session budget exceeded: ${detail}`);
}

/**
 * Return the ID used for cost guardrails. A caller-supplied X-Session-Id takes
 * precedence; otherwise, bind the budget to the authenticated key and client
 * identity without retaining either raw header value in the database.
 */
export function resolveBudgetSessionId(
  headers: Headers,
  apiKeyId: string | null | undefined
): string | null {
  const supplied = headers.get("x-session-id")?.trim();
  if (supplied) return supplied.slice(0, 256);
  if (!apiKeyId) return null;

  const userAgent = headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${apiKeyId}:${userAgent}`).digest("hex").slice(0, 32);
}

/**
 * Post-response budget accounting. Call AFTER a successful chat completion.
 *
 * Extracts token usage from a non-streaming JSON response, or accepts usage
 * supplied by a stream finalizer, increments the session budget, and returns
 * the response with an `X-Budget-Warning` header attached if the warning
 * threshold is crossed.
 */
export async function applySessionBudgetPostResponse(
  response: Response,
  sessionId: string | null,
  provider: string | null,
  model: string,
  usage?: Record<string, number | undefined> | null
): Promise<Response> {
  if (!response.ok) return response;
  if (!sessionId) return response;

  let budget;
  try {
    budget = getBudget(sessionId);
  } catch {
    return response;
  }
  if (!budget || !budget.enabled) return response;

  // Extract usage from the explicit param, or try to read from the response body
  let resolvedUsage = usage ?? null;
  if (!resolvedUsage && response.headers.get("content-type")?.includes("application/json")) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      resolvedUsage = body?.usage ?? null;
    } catch {
      // Body already consumed or not JSON — skip
    }
  }

  if (!resolvedUsage || typeof resolvedUsage !== "object") return response;

  const promptTokens = Number(resolvedUsage.prompt_tokens) || 0;
  const completionTokens = Number(resolvedUsage.completion_tokens) || 0;
  const totalTokens = Number(resolvedUsage.total_tokens) || promptTokens + completionTokens;

  if (totalTokens <= 0) return response;

  // Calculate cost (best-effort — returns 0 if no pricing found)
  let costUsd = 0;
  try {
    costUsd = await calculateCost(provider || "", model, resolvedUsage);
  } catch {
    costUsd = 0;
  }

  // Increment usage
  try {
    incrementUsage(sessionId, totalTokens, costUsd);
  } catch {
    return response;
  }

  // Attach warning header if threshold crossed
  let warningReached = false;
  try {
    warningReached = isWarningThresholdReached(sessionId);
  } catch {
    warningReached = false;
  }

  if (warningReached) {
    try {
      response.headers.set("X-Budget-Warning", "true");
      return response;
    } catch {
      const cloned = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      cloned.headers.set("X-Budget-Warning", "true");
      return cloned;
    }
  }

  return response;
}
