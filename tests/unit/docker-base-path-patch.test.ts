import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  patchBasePathLiterals,
  patchJsonManifestFile,
  patchStandaloneBasePath,
} from "../../scripts/docker/patch-standalone-base-path.mjs";

test("patchBasePathLiterals rewrites empty basePath literals", () => {
  const input = 'const cfg={basePath:"",assetPrefix:void 0};"basePath":""';
  const output = patchBasePathLiterals(input, "/nerve");
  assert.match(output, /basePath:"\/nerve"/);
  assert.match(output, /"basePath":"\/nerve"/);
});

test("patchJsonManifestFile updates nested basePath fields", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nerve-basepath-"));
  const filePath = path.join(dir, "routes-manifest.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ basePath: "", nested: { basePath: "" } }, null, 2)
  );
  assert.equal(patchJsonManifestFile(filePath, "/nerve"), true);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(parsed.basePath, "/nerve");
  assert.equal(parsed.nested.basePath, "/nerve");
});

test("patchStandaloneBasePath rewrites a root-path standalone tree", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nerve-standalone-"));
  const distRoot = path.join(appRoot, ".build", "next");
  fs.mkdirSync(path.join(distRoot, "server"), { recursive: true });
  fs.writeFileSync(
    path.join(distRoot, "routes-manifest.json"),
    JSON.stringify({ basePath: "" })
  );
  fs.writeFileSync(
    path.join(distRoot, "server", "chunk.js"),
    'export const config={basePath:""};'
  );
  fs.writeFileSync(path.join(appRoot, "BUILD_NERVE_BASE_PATH"), "\n");

  const result = patchStandaloneBasePath({
    appRoot,
    fromBasePath: "",
    toBasePath: "/nerve",
  });

  assert.equal(result.changed, true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(distRoot, "routes-manifest.json"), "utf8")).basePath,
    "/nerve"
  );
  assert.match(fs.readFileSync(path.join(distRoot, "server", "chunk.js"), "utf8"), /\/nerve/);
});

test("patchStandaloneBasePath rejects mismatched non-root builds", () => {
  assert.throws(
    () =>
      patchStandaloneBasePath({
        appRoot: process.cwd(),
        fromBasePath: "/custom",
        toBasePath: "/nerve",
      }),
    /does not match the image build/
  );
});
