import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { detectTaskType, applyTaskAwareRouting, getTaskRoutingConfig, setTaskRoutingConfig, resetTaskRoutingStats, getDefaultTaskModelMap, TaskType } from "../../open-sse/services/taskAwareRouter.ts";

const DEFAULT_TASK_MODEL_MAP = getDefaultTaskModelMap();

describe("Task-Aware Router", () => {
  beforeEach(() => {
    // Reset to default config before each test
    setTaskRoutingConfig({
      enabled: true,
      detectionEnabled: true,
      taskModelMap: { ...DEFAULT_TASK_MODEL_MAP },
    });
    resetTaskRoutingStats();
  });

  describe("detectTaskType", () => {
    it("should detect coding tasks from keywords", () => {
      const body = { messages: [{ role: "user", content: "Write a function to sort an array" }] };
      assert.equal(detectTaskType(body), "coding");
    });

    it("should detect coding tasks from code patterns in user message", () => {
      const body = { messages: [{ role: "user", content: "```javascript\nconst x = 1;\n```" }] };
      assert.equal(detectTaskType(body), "coding");
    });

    it("should detect analysis tasks", () => {
      const body = { messages: [{ role: "user", content: "Analyze the pros and cons of this approach" }] };
      assert.equal(detectTaskType(body), "analysis");
    });

    it("should detect creative tasks", () => {
      const body = { messages: [{ role: "user", content: "Write a story about a robot" }] };
      assert.equal(detectTaskType(body), "creative");
    });

    it("should detect vision tasks from image content", () => {
      const body = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,abc" } }] }] };
      assert.equal(detectTaskType(body), "vision");
    });

    it("should detect summarization tasks", () => {
      const body = { messages: [{ role: "user", content: "Summarize this article for me" }] };
      assert.equal(detectTaskType(body), "summarization");
    });

    it("should detect background tasks", () => {
      const body = { messages: [{ role: "system", content: "Generate a title for this conversation" }] };
      assert.equal(detectTaskType(body), "background");
    });

    it("should default to chat for unrecognized tasks", () => {
      const body = { messages: [{ role: "user", content: "Hello, how are you?" }] };
      assert.equal(detectTaskType(body), "chat");
    });

    it("should handle empty messages", () => {
      const body = { messages: [] };
      assert.equal(detectTaskType(body), "chat");
    });

    it("should handle missing body", () => {
      assert.equal(detectTaskType(null), "chat");
      assert.equal(detectTaskType(undefined), "chat");
      assert.equal(detectTaskType({}), "chat");
    });

    it("should prioritize vision over other types", () => {
      const body = { 
        messages: [
          { role: "user", content: "Analyze this image and write code for it" },
          { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }] }
        ] 
      };
      assert.equal(detectTaskType(body), "vision");
    });

    it("should detect coding from system prompt", () => {
      const body = { 
        messages: [
          { role: "system", content: "You are a code reviewer. Review the following code." },
          { role: "user", content: "Here is my PR" }
        ] 
      };
      assert.equal(detectTaskType(body), "coding");
    });
  });

  describe("applyTaskAwareRouting", () => {
    it("should return original model when disabled", () => {
      setTaskRoutingConfig({ enabled: false });
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      assert.equal(result.model, "openai/gpt-4o");
      assert.equal(result.wasRouted, false);
    });

    it("should return original model when detection disabled", () => {
      setTaskRoutingConfig({ enabled: true, detectionEnabled: false });
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      assert.equal(result.model, "openai/gpt-4o");
      assert.equal(result.wasRouted, false);
    });

    it("should route coding tasks to auto/coding", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write a function" }] });
      assert.equal(result.model, "auto/coding");
      assert.equal(result.taskType, "coding");
      assert.equal(result.wasRouted, true);
    });

    it("should route analysis tasks to auto/reasoning", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Analyze this data" }] });
      assert.equal(result.model, "auto/reasoning");
      assert.equal(result.taskType, "analysis");
      assert.equal(result.wasRouted, true);
    });

    it("should not override creative tasks (empty default)", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write a poem" }] });
      assert.equal(result.model, "openai/gpt-4o");
      assert.equal(result.taskType, "creative");
      assert.equal(result.wasRouted, false);
    });

    it("should not override chat tasks (empty default)", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Hello" }] });
      assert.equal(result.model, "openai/gpt-4o");
      assert.equal(result.taskType, "chat");
      assert.equal(result.wasRouted, false);
    });

    it("should route vision tasks to auto/vision", () => {
      const body = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,abc" } }] }] };
      const result = applyTaskAwareRouting("openai/gpt-4o", body);
      assert.equal(result.model, "auto/vision");
      assert.equal(result.taskType, "vision");
      assert.equal(result.wasRouted, true);
    });

    it("should route summarization tasks to auto/chat:fast", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Summarize this" }] });
      assert.equal(result.model, "auto/chat:fast");
      assert.equal(result.taskType, "summarization");
      assert.equal(result.wasRouted, true);
    });

    it("should route background tasks to auto/chat:cheap", () => {
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "system", content: "Generate a title" }] });
      assert.equal(result.model, "auto/chat:cheap");
      assert.equal(result.taskType, "background");
      assert.equal(result.wasRouted, true);
    });

    it("should increment stats on detection", () => {
      const configBefore = getTaskRoutingConfig();
      applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      const configAfter = getTaskRoutingConfig();
      assert.equal(configAfter.stats.detected, configBefore.stats.detected + 1);
    });

    it("should increment routed stats when model changed", () => {
      const configBefore = getTaskRoutingConfig();
      applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      const configAfter = getTaskRoutingConfig();
      assert.equal(configAfter.stats.routed, configBefore.stats.routed + 1);
    });

    it("should not increment routed stats when model not changed", () => {
      const configBefore = getTaskRoutingConfig();
      applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Hello" }] });
      const configAfter = getTaskRoutingConfig();
      assert.equal(configAfter.stats.routed, configBefore.stats.routed);
    });
  });

  describe("config management", () => {
    it("should allow custom task model map", () => {
      setTaskRoutingConfig({
        taskModelMap: {
          coding: "custom/coding-model",
          creative: "",
          analysis: "custom/reasoning-model",
          vision: "custom/vision-model",
          summarization: "custom/fast-model",
          background: "custom/cheap-model",
          chat: "",
        },
      });
      const result = applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      assert.equal(result.model, "custom/coding-model");
    });

    it("should persist stats across config changes", () => {
      applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      const statsBefore = getTaskRoutingConfig().stats;
      
      setTaskRoutingConfig({ enabled: false });
      const statsAfter = getTaskRoutingConfig().stats;
      
      assert.equal(statsAfter.detected, statsBefore.detected);
      assert.equal(statsAfter.routed, statsBefore.routed);
    });

    it("should reset stats", () => {
      applyTaskAwareRouting("openai/gpt-4o", { messages: [{ role: "user", content: "Write code" }] });
      assert.ok(getTaskRoutingConfig().stats.detected > 0);
      
      resetTaskRoutingStats();
      assert.equal(getTaskRoutingConfig().stats.detected, 0);
      assert.equal(getTaskRoutingConfig().stats.routed, 0);
    });

    it("should return copy of config (not reference)", () => {
      const config1 = getTaskRoutingConfig();
      const config2 = getTaskRoutingConfig();
      assert.notStrictEqual(config1, config2);
      assert.notStrictEqual(config1.taskModelMap, config2.taskModelMap);
      assert.notStrictEqual(config1.stats, config2.stats);
    });
  });

  describe("DEFAULT_TASK_MODEL_MAP", () => {
    it("should have all task types defined", () => {
      const taskTypes: TaskType[] = ["coding", "creative", "analysis", "vision", "summarization", "background", "chat"];
      for (const type of taskTypes) {
        assert.ok(type in DEFAULT_TASK_MODEL_MAP);
      }
    });

    it("should use auto/* intents for routing tasks", () => {
      assert.equal(DEFAULT_TASK_MODEL_MAP.coding, "auto/coding");
      assert.equal(DEFAULT_TASK_MODEL_MAP.analysis, "auto/reasoning");
      assert.equal(DEFAULT_TASK_MODEL_MAP.vision, "auto/vision");
      assert.equal(DEFAULT_TASK_MODEL_MAP.summarization, "auto/chat:fast");
      assert.equal(DEFAULT_TASK_MODEL_MAP.background, "auto/chat:cheap");
    });

    it("should have empty strings for pass-through tasks", () => {
      assert.equal(DEFAULT_TASK_MODEL_MAP.creative, "");
      assert.equal(DEFAULT_TASK_MODEL_MAP.chat, "");
    });
  });
});

console.log("All Task-Aware Router tests passed!");