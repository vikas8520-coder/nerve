import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for the Nerve setup wizard helpers.
 *
 * The wizard itself is interactive (prints to stdout), so we test the
 * pure functions that are independently testable: password generation
 * and API key formatting.
 */

// We import from the built CLI source — these are .mjs files so we use
// dynamic import with the file:// URL.
async function importWizard() {
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const cwd = process.cwd();
  const url = pathToFileURL(join(cwd, "bin", "setup-wizard.mjs")).href;
  return await import(url);
}

test("generateRandomPassword produces a base64url string of at least 16 chars", async () => {
  const { generateRandomPassword } = await importWizard();
  const pw = generateRandomPassword();
  assert.equal(typeof pw, "string");
  assert.ok(pw.length >= 16, `password should be at least 16 chars, got ${pw.length}`);
  // base64url charset: A-Z a-z 0-9 - _
  assert.match(pw, /^[A-Za-z0-9_-]{16,}$/);
});

test("generateRandomPassword produces unique values", async () => {
  const { generateRandomPassword } = await importWizard();
  const pw1 = generateRandomPassword();
  const pw2 = generateRandomPassword();
  assert.notEqual(pw1, pw2, "two consecutive calls should produce different passwords");
});

test("generateRandomPassword does not contain padding or +/", async () => {
  const { generateRandomPassword } = await importWizard();
  // Generate several to reduce flakiness
  for (let i = 0; i < 20; i++) {
    const pw = generateRandomPassword();
    assert.ok(!pw.includes("="), "should not contain = padding");
    assert.ok(!pw.includes("+"), "should not contain +");
    assert.ok(!pw.includes("/"), "should not contain /");
  }
});
