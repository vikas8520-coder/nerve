import test from "node:test";
import assert from "node:assert/strict";

test("runNerveCli: missing command returns error", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runNerveCli");
  assert.ok(tool);
  const result = await tool.handler({});
  assert.equal(result, "Please provide a command to execute.");
});

test("runNerveCli: empty command returns error", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runNerveCli");
  assert.ok(tool);
  const result = await tool.handler({ command: "" });
  assert.equal(result, "Please provide a command to execute.");
});

test("runNerveCli: returns CLI-not-found when nerve unavailable", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runNerveCli");
  assert.ok(tool);
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = "";
    const result = await tool.handler({ command: "health" });
    assert.ok(
      result.includes("nerve CLI not found in PATH"),
      `Expected CLI-not-found message, got: ${result}`
    );
  } finally {
    process.env.PATH = originalPath;
  }
});
