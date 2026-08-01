import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the DB into a throwaway DATA_DIR so migrations run against a fresh file.
let tmpDataDir: string;
let mod: typeof import("@/lib/db/promptInjectionTemplates");
let core: typeof import("@/lib/db/core");
let injection: typeof import("@/sse/handlers/templateInjection");

before(async () => {
  tmpDataDir = mkdtempSync(join(tmpdir(), "nerve-pit-"));
  process.env.DATA_DIR = tmpDataDir;
  core = await import("@/lib/db/core");
  core.resetDbInstance();
  // Touch the instance so migrations (incl. 134_prompt_injection_templates) apply.
  core.getDbInstance();
  mod = await import("@/lib/db/promptInjectionTemplates");
  injection = await import("@/sse/handlers/templateInjection");
});

after(() => {
  core.resetDbInstance();
  if (tmpDataDir) rmSync(tmpDataDir, { recursive: true, force: true });
});

describe("promptInjectionTemplates — glob matching", () => {
  test("globToRegExp: * matches any sequence including /", () => {
    const re = mod.globToRegExp("*/glm-*");
    assert.ok(re.test("openai/glm-4"));
    assert.ok(re.test("a/b/c/glm-mini"));
    assert.ok(!re.test("openai/gpt-4"));
  });

  test("globToRegExp: ? matches a single char", () => {
    const re = mod.globToRegExp("model-?");
    assert.ok(re.test("model-a"));
    assert.ok(!re.test("model-ab"));
  });

  test("globToRegExp: literal special chars are escaped", () => {
    const re = mod.globToRegExp("auto/best-coding");
    assert.ok(re.test("auto/best-coding"));
    assert.ok(!re.test("autoxbestxcoding"));
  });

  test("matchesPattern is case-insensitive", () => {
    assert.ok(mod.matchesPattern("OpenAI/GLM-4", "*/glm-*"));
    assert.ok(mod.matchesPattern("auto/Best-Coding", "auto/best-coding"));
  });

  test("matchesPattern exact short-circuit", () => {
    assert.ok(mod.matchesPattern("auto/best-fast", "auto/best-fast"));
  });

  test("empty pattern never matches", () => {
    assert.ok(!mod.matchesPattern("anything", ""));
  });
});

describe("promptInjectionTemplates — inferTaskType", () => {
  test("auto/best-coding → coding", () => {
    assert.equal(mod.inferTaskType("auto/best-coding"), "coding");
  });

  test("auto/best-fast → chat", () => {
    assert.equal(mod.inferTaskType("auto/best-fast"), "chat");
  });

  test("reasoning family → reasoning", () => {
    assert.equal(mod.inferTaskType("glm/glm-4.6-reasoning"), "reasoning");
    assert.equal(mod.inferTaskType("openai/o1-mini"), "reasoning");
    assert.equal(mod.inferTaskType("openai/o3-mini"), "reasoning");
  });

  test("vision family → vision", () => {
    assert.equal(mod.inferTaskType("openai/gpt-4o"), "vision");
    assert.equal(mod.inferTaskType("meta/llama-3.2-vision"), "vision");
  });

  test("unknown → any", () => {
    assert.equal(mod.inferTaskType("openai/gpt-3.5-turbo"), "any");
  });
});

describe("promptInjectionTemplates — findMatchingTemplates (seeded)", () => {
  test("reasoning model matches reasoning boost templates", () => {
    // Pattern `*-reasoning-*` requires a suffix after `reasoning-`.
    const matches = mod.findMatchingTemplates("glm/glm-4.6-reasoning-flash", "reasoning");
    const names = matches.map((m) => m.name);
    assert.ok(names.some((n) => n.includes("Reasoning boost")));
  });

  test("o1 model matches o1 reasoning boost", () => {
    const matches = mod.findMatchingTemplates("openai/o1-mini", "reasoning");
    const names = matches.map((m) => m.name);
    assert.ok(names.some((n) => n.includes("o1")));
  });

  test("auto/best-coding matches coding conciseness", () => {
    const matches = mod.findMatchingTemplates("auto/best-coding", "coding");
    const names = matches.map((m) => m.name);
    assert.ok(names.some((n) => n.includes("Coding conciseness")));
  });

  test("deepseek model matches coding conciseness (deepseek)", () => {
    const matches = mod.findMatchingTemplates("deepseek/deepseek-chat", "coding");
    const names = matches.map((m) => m.name);
    assert.ok(names.some((n) => n.includes("deepseek")));
  });

  test("gpt-4o matches vision detail", () => {
    const matches = mod.findMatchingTemplates("openai/gpt-4o", "vision");
    const names = matches.map((m) => m.name);
    assert.ok(names.some((n) => n.includes("Vision detail")));
  });

  test("non-matching model returns empty", () => {
    const matches = mod.findMatchingTemplates("unknown/nothing-here", "any");
    assert.equal(matches.length, 0);
  });

  test("results are sorted by priority desc", () => {
    const matches = mod.findMatchingTemplates("openai/o1-mini", "reasoning");
    for (let i = 1; i < matches.length; i += 1) {
      assert.ok(
        matches[i - 1].priority >= matches[i].priority,
        `priority ${matches[i - 1].priority} >= ${matches[i].priority}`
      );
    }
  });

  test("disabled templates are excluded", () => {
    const created = mod.createTemplate({
      name: "temp-disabled",
      modelPattern: "*-disabled-*",
      taskType: "any",
      systemPrompt: "x",
      injectionMode: "prepend",
      priority: 100,
      enabled: false,
    });
    assert.equal(created.enabled, false);
    const matches = mod.findMatchingTemplates("foo-disabled-bar", "any");
    assert.ok(!matches.some((m) => m.id === created.id));
    mod.deleteTemplate(created.id);
  });

  test("task_type 'any' on the template matches any requested task", () => {
    const created = mod.createTemplate({
      name: "any-task-tpl",
      modelPattern: "*-anytask-*",
      taskType: "any",
      systemPrompt: "x",
      injectionMode: "prepend",
      priority: 1,
      enabled: true,
    });
    const matchesCoding = mod.findMatchingTemplates("foo-anytask-bar", "coding");
    assert.ok(matchesCoding.some((m) => m.id === created.id));
    const matchesVision = mod.findMatchingTemplates("foo-anytask-bar", "vision");
    assert.ok(matchesVision.some((m) => m.id === created.id));
    mod.deleteTemplate(created.id);
  });
});

describe("promptInjectionTemplates — CRUD", () => {
  test("create → get → update → delete", () => {
    const created = mod.createTemplate({
      name: "crud-tpl",
      modelPattern: "*/crud-*",
      taskType: "chat",
      systemPrompt: "be nice",
      injectionMode: "append",
      priority: 7,
      enabled: true,
    });
    assert.ok(created.id);
    assert.equal(created.name, "crud-tpl");
    assert.equal(created.taskType, "chat");
    assert.equal(created.injectionMode, "append");
    assert.equal(created.priority, 7);
    assert.equal(created.enabled, true);

    const fetched = mod.getTemplate(created.id);
    assert.equal(fetched?.id, created.id);

    const updated = mod.updateTemplate(created.id, { priority: 99, enabled: false });
    assert.equal(updated?.priority, 99);
    assert.equal(updated?.enabled, false);

    const deleted = mod.deleteTemplate(created.id);
    assert.equal(deleted, true);
    assert.equal(mod.getTemplate(created.id), null);
  });

  test("updateTemplate returns null for missing id", () => {
    assert.equal(mod.updateTemplate("does-not-exist", { priority: 1 }), null);
  });

  test("listTemplates filters by task_type", () => {
    const list = mod.listTemplates({ taskType: "coding" });
    assert.ok(list.length > 0);
    for (const t of list) {
      assert.ok(t.taskType === "coding" || t.taskType === "any");
    }
  });
});

describe("templateInjection — applyPromptTemplates", () => {
  test("prepend inserts a system message at the start", () => {
    const tpl = mod.createTemplate({
      name: "prepend-test",
      modelPattern: "*-prepend-*",
      taskType: "any",
      systemPrompt: "PREPEND-MARKER",
      injectionMode: "prepend",
      priority: 1,
      enabled: true,
    });
    const body = { messages: [{ role: "user", content: "hi" }] };
    const result = injection.applyPromptTemplates(body, "foo-prepend-bar");
    assert.equal(result.appliedNames.length, 1);
    assert.equal(result.body.messages?.[0]?.role, "system");
    assert.equal(result.body.messages?.[0]?.content, "PREPEND-MARKER");
    mod.deleteTemplate(tpl.id);
  });

  test("append inserts a system message before the last user message", () => {
    const tpl = mod.createTemplate({
      name: "append-test",
      modelPattern: "*-append-*",
      taskType: "any",
      systemPrompt: "APPEND-MARKER",
      injectionMode: "append",
      priority: 1,
      enabled: true,
    });
    const body = {
      messages: [
        { role: "system", content: "existing" },
        { role: "user", content: "first" },
        { role: "user", content: "last" },
      ],
    };
    const result = injection.applyPromptTemplates(body, "foo-append-bar");
    const msgs = result.body.messages!;
    const lastIdx = msgs.length - 1;
    assert.equal(msgs[lastIdx]?.role, "user");
    assert.equal(msgs[lastIdx]?.content, "last");
    assert.equal(msgs[lastIdx - 1]?.role, "system");
    assert.equal(msgs[lastIdx - 1]?.content, "APPEND-MARKER");
    mod.deleteTemplate(tpl.id);
  });

  test("replace overwrites existing system messages", () => {
    const tpl = mod.createTemplate({
      name: "replace-test",
      modelPattern: "*-replace-*",
      taskType: "any",
      systemPrompt: "REPLACED",
      injectionMode: "replace",
      priority: 1,
      enabled: true,
    });
    const body = {
      messages: [
        { role: "system", content: "old1" },
        { role: "system", content: "old2" },
        { role: "user", content: "hi" },
      ],
    };
    const result = injection.applyPromptTemplates(body, "foo-replace-bar");
    const systemMsgs = result.body.messages!.filter((m) => m?.role === "system");
    assert.equal(systemMsgs.length, 1);
    assert.equal(systemMsgs[0]?.content, "REPLACED");
    mod.deleteTemplate(tpl.id);
  });

  test("de-dup guard: existing identical system content is not re-injected", () => {
    const tpl = mod.createTemplate({
      name: "dedup-test",
      modelPattern: "*-dedup-*",
      taskType: "any",
      systemPrompt: "ALREADY-THERE",
      injectionMode: "prepend",
      priority: 1,
      enabled: true,
    });
    const body = {
      messages: [
        { role: "system", content: "ALREADY-THERE" },
        { role: "user", content: "hi" },
      ],
    };
    const result = injection.applyPromptTemplates(body, "foo-dedup-bar");
    assert.equal(result.appliedNames.length, 0);
    mod.deleteTemplate(tpl.id);
  });

  test("no messages → no-op", () => {
    const result = injection.applyPromptTemplates({ messages: [] }, "anything");
    assert.equal(result.appliedNames.length, 0);
    assert.deepEqual(result.body, { messages: [] });
  });

  test("no matching templates → body unchanged", () => {
    const body = { messages: [{ role: "user", content: "hi" }] };
    const result = injection.applyPromptTemplates(body, "no-such-model-zzz");
    assert.equal(result.appliedNames.length, 0);
    assert.equal(result.body, body);
  });
});
