/**
 * #9201 — no-auth models known to return HTTP 200 with an EMPTY choices array
 * (no content, no error) must be excluded from EVERY auto/* candidate pool by the
 * hard-coded AUTO_COMBO_EMPTY_BODY_MODELS set in
 * open-sse/services/autoCombo/virtualFactory.ts. These empty-200 responses slip
 * through Nerve's streaming quality gate (which does not buffer streams) and poison
 * downstream consumers (e.g. Hermes context-compression). Excluding them at the
 * candidate-pool level is the safe stopgap; they stay usable via direct
 * opencode/<model> calls.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nerve-9201-empty-body-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const virtualFactory = await import("../../open-sse/services/autoCombo/virtualFactory.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(async () => {
  await resetStorage();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });

  if (ORIGINAL_DATA_DIR === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  }
});

test("#9201: opencode:big-pickle is ABSENT from the auto-combo candidate pool (empty-200 model)", async () => {
  await providersDb.createProviderConnection({
    provider: "opencode",
    authType: "no-auth",
    name: "OpenCode Free Account 1",
  });

  const combo = await virtualFactory.createVirtualAutoCombo(undefined);
  const modelStrings = combo.models.map((m: { model: string }) => m.model);
  assert.ok(
    !modelStrings.some((model: string) => model.endsWith("/big-pickle")),
    `BUG #9201: empty-200 model 'big-pickle' must not appear in the auto-combo ` +
      `candidate pool, but it did. Pool: ${JSON.stringify(modelStrings)}`
  );
});

test("#9201: opencode:mimo-v2.5-free is ABSENT from the auto-combo candidate pool (empty-200 model)", async () => {
  await providersDb.createProviderConnection({
    provider: "opencode",
    authType: "no-auth",
    name: "OpenCode Free Account 1",
  });

  const combo = await virtualFactory.createVirtualAutoCombo(undefined);
  const modelStrings = combo.models.map((m: { model: string }) => m.model);
  assert.ok(
    !modelStrings.some((model: string) => model.endsWith("/mimo-v2.5-free")),
    `BUG #9201: empty-200 model 'mimo-v2.5-free' must not appear in the auto-combo ` +
      `candidate pool, but it did. Pool: ${JSON.stringify(modelStrings)}`
  );
});

test("#9201: other opencode models (e.g. deepseek-v4-flash-free) remain in the pool", async () => {
  await providersDb.createProviderConnection({
    provider: "opencode",
    authType: "no-auth",
    name: "OpenCode Free Account 1",
  });

  const combo = await virtualFactory.createVirtualAutoCombo(undefined);
  const modelStrings = combo.models.map((m: { model: string }) => m.model);
  assert.ok(
    modelStrings.some((model: string) => model.endsWith("/deepseek-v4-flash-free")),
    `a non-empty-200 opencode model must remain in the pool. Pool: ${JSON.stringify(modelStrings)}`
  );
});
