/**
 * Prompt Template Injection — request mutation helper.
 *
 * Used by the chat pipeline (`src/sse/handlers/chat.ts`) to inject system-prompt
 * optimizations based on the resolved model id and inferred task type. The
 * matching templates are looked up via
 * `findMatchingTemplates` / `inferTaskType` from the
 * `prompt_injection_templates` DB module.
 *
 * Injection modes:
 *   prepend — add a new system message at the beginning of `messages`.
 *   append  — add a new system message just before the last user message.
 *   replace — replace any existing system message(s) content with the template.
 *
 * A template is skipped when an existing system message already carries the
 * exact same content (de-dup guard).
 *
 * @module sse/handlers/templateInjection
 */

import {
  findMatchingTemplates,
  inferTaskType,
  type PromptInjectionTemplate,
} from "@/lib/db/promptInjectionTemplates";

interface ChatMessage {
  role?: string;
  content?: unknown;
}

interface ChatBody {
  messages?: ChatMessage[];
}

/**
 * Apply prompt injection templates to a chat request body. Returns the mutated
 * body (a shallow clone when templates applied, otherwise the original body)
 * and the list of template names that were applied (for the
 * `X-Template-Applied` response header).
 */
export function applyPromptTemplates(
  body: ChatBody,
  modelId: string,
  taskType?: string
): { body: ChatBody; appliedNames: string[] } {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) return { body, appliedNames: [] };

  const inferred = taskType
    ? (taskType as PromptInjectionTemplate["taskType"])
    : inferTaskType(modelId);
  const matches = findMatchingTemplates(modelId, inferred);
  return applyTemplatesToMessages(body, matches);
}

/**
 * Apply already-selected templates to a chat body. Exported separately so the
 * message ordering rules can be unit tested without a database.
 */
export function applyTemplatesToMessages(
  body: ChatBody,
  matches: PromptInjectionTemplate[]
): { body: ChatBody; appliedNames: string[] } {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0 || matches.length === 0) return { body, appliedNames: [] };

  let nextMessages = messages.slice();
  const appliedNames: string[] = [];

  for (const tpl of matches) {
    const existingSystem = nextMessages.filter((m) => m?.role === "system");
    const alreadyPresent = existingSystem.some(
      (m) => typeof m?.content === "string" && m.content === tpl.systemPrompt
    );
    if (alreadyPresent) continue;

    if (tpl.injectionMode === "replace") {
      // Replace the first existing system message; drop the rest.
      let replaced = false;
      nextMessages = nextMessages
        .map((m) => {
          if (m?.role === "system") {
            if (!replaced) {
              replaced = true;
              return { role: "system", content: tpl.systemPrompt };
            }
            // remove subsequent system messages
            return null;
          }
          return m;
        })
        .filter((m): m is ChatMessage => m !== null);
      if (!replaced) {
        nextMessages = [{ role: "system", content: tpl.systemPrompt }, ...nextMessages];
      }
    } else if (tpl.injectionMode === "append") {
      // Insert just before the last user message (or at the end if none).
      const lastUserIdx = findLastIndex(nextMessages, (m) => m?.role === "user");
      const insertAt = lastUserIdx >= 0 ? lastUserIdx : nextMessages.length;
      nextMessages = [
        ...nextMessages.slice(0, insertAt),
        { role: "system", content: tpl.systemPrompt },
        ...nextMessages.slice(insertAt),
      ];
    } else {
      // prepend (default)
      nextMessages = [{ role: "system", content: tpl.systemPrompt }, ...nextMessages];
    }
    appliedNames.push(tpl.name);
  }

  return { body: { ...body, messages: nextMessages }, appliedNames };
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
