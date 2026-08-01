import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Unit tests for the .env.example better defaults.
 *
 * Verifies that the recommended defaults section exists and the
 * INITIAL_PASSWORD warning is present.
 */

const envExamplePath = join(process.cwd(), ".env.example");
const envExample = readFileSync(envExamplePath, "utf-8");

test(".env.example contains a recommended defaults section", () => {
  assert.ok(
    envExample.includes("RECOMMENDED DEFAULTS") || envExample.includes("recommended defaults"),
    ".env.example should mention 'RECOMMENDED DEFAULTS' for local-only setup"
  );
});

test(".env.example lists REQUIRE_API_KEY=false as recommended", () => {
  assert.ok(
    envExample.includes("REQUIRE_API_KEY=false"),
    ".env.example should recommend REQUIRE_API_KEY=false for local-only setup"
  );
});

test(".env.example has a warning about INITIAL_PASSWORD=CHANGEME being insecure", () => {
  assert.ok(
    envExample.includes("CHANGEME") &&
      (envExample.includes("insecure") ||
        envExample.includes("⚠") ||
        envExample.includes("WARNING")),
    ".env.example should warn that INITIAL_PASSWORD=CHANGEME is insecure"
  );
});

test(".env.example mentions nerve setup as the interactive alternative", () => {
  assert.ok(
    envExample.includes("nerve setup") || envExample.includes("nerve setup"),
    ".env.example should point users to 'nerve setup' as the interactive alternative"
  );
});

test(".env.example still has the INITIAL_PASSWORD line", () => {
  assert.ok(
    envExample.includes("INITIAL_PASSWORD="),
    ".env.example should still define INITIAL_PASSWORD"
  );
});
