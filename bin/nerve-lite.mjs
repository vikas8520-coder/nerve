#!/usr/bin/env node
/**
 * nerve-lite — minimal HTTP server for Nerve's API routes.
 *
 * Drops the Next.js dashboard entirely. Only serves:
 *   POST   /v1/chat/completions
 *   POST   /v1/responses
 *   POST   /v1/embeddings
 *   GET    /v1/models
 *   HEAD   /v1/models
 *   GET    /v1/models/:id
 *   GET    /healthz
 *
 * Uses the same handler functions as the full nerve server (handleChat,
 * getUnifiedModelsResponse, createEmbeddingResponse) — just without the
 * 1,468-file Next.js dashboard loaded into memory.
 *
 * Expected memory: ~300-400 MB (vs ~1,040 MB for full nerve).
 */

import http from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";

// ── Handler imports (loaded once at startup) ──────────────────────────────
let handleChat, getUnifiedModelsResponse, createEmbeddingResponse, initTranslators;
let CORS_HEADERS;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// ── Route table ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || process.env.NERVE_PORT || "20129", 10);
const HOST = process.env.HOSTNAME || "0.0.0.0";

// ── Utility: convert Node.js IncomingMessage to Web API Request ────────────
function nodeRequestToWebRequest(req) {
  const protocol = "http";
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (Array.isArray(val)) {
      for (const v of val) headers.set(key, v);
    } else if (val != null) {
      headers.set(key, val);
    }
  }

  const method = req.method || "GET";
  const init = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    init.body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
        req.on("end", () => controller.close());
        req.on("error", (err) => controller.error(err));
      },
    });
    // @ts-ignore — duplex is needed by undici but not in the types
    init.duplex = "half";
  }

  return new Request(url, init);
}

// ── Utility: pipe Web API Response to Node.js ServerResponse ──────────────
async function webResponseToNodeResponse(webRes, res) {
  // Copy status and headers
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // Ensure CORS headers are present
  if (!res.getHeader("Access-Control-Allow-Origin")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  if (webRes.status === 204 || webRes.body == null) {
    res.end();
    return;
  }

  // Stream the response body
  const reader = webRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

// ── Utility: read request body as JSON ─────────────────────────────────────
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

// ── Error response helper ──────────────────────────────────────────────────
function sendError(res, status, message, type = "invalid_request_error", code = null) {
  const body = JSON.stringify({
    error: { message, type, ...(code ? { code } : {}) },
  });
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(body);
}

// ── Route handlers ──────────────────────────────────────────────────────────

async function handleModels(req, res) {
  const webReq = nodeRequestToWebRequest(req);
  const webRes = await getUnifiedModelsResponse(webReq, CORS);
  await webResponseToNodeResponse(webRes, res);
}

async function handleChatRoute(req, res) {
  // Read and parse body
  const parsedBody = await readBody(req);

  if (!parsedBody) {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  // Content-Type guard
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().split(";")[0].trim().startsWith("application/json")) {
    sendError(
      res,
      415,
      "Content-Type must be application/json",
      "invalid_request_error",
      "unsupported_media_type"
    );
    return;
  }

  // Build Web API Request with pre-parsed body
  const protocol = "http";
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (Array.isArray(val)) {
      for (const v of val) headers.set(key, v);
    } else if (val != null) {
      headers.set(key, val);
    }
  }

  // Create a Request with the body as a string — handleChat accepts preParsedBody
  const webReq = new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(parsedBody),
  });

  const reqId = randomUUID();
  const webRes = await handleChat(webReq, null, parsedBody, reqId);
  await webResponseToNodeResponse(webRes, res);
}

async function handleResponsesRoute(req, res) {
  // /v1/responses delegates to handleChat (same as the full server)
  await handleChatRoute(req, res);
}

async function handleEmbeddingsRoute(req, res) {
  const parsedBody = await readBody(req);
  if (!parsedBody) {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  const protocol = "http";
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (Array.isArray(val)) {
      for (const v of val) headers.set(key, v);
    } else if (val != null) {
      headers.set(key, val);
    }
  }

  const webReq = new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(parsedBody),
  });

  try {
    const webRes = await createEmbeddingResponse(webReq, { preParsedBody: parsedBody });
    if (webRes) {
      await webResponseToNodeResponse(webRes, res);
      return;
    }
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : "Embedding failed", "server_error");
    return;
  }

  sendError(res, 501, "Embeddings not available", "invalid_request_error");
}

function handleHealthz(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const mem = process.memoryUsage();
  res.end(
    JSON.stringify({
      status: "ok",
      uptime: process.uptime(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
    })
  );
}

// ── Router ──────────────────────────────────────────────────────────────────
function route(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.end();
    return;
  }

  // Normalize: /v1/* and /api/v1/* are equivalent
  const normalizedPath = pathname.replace(/^\/api\/v1\//, "/v1/");

  // Health check
  if (normalizedPath === "/healthz" || normalizedPath === "/api/healthz") {
    handleHealthz(req, res);
    return;
  }

  // Models
  if (
    (normalizedPath === "/v1/models" || normalizedPath === "/v1/models/") &&
    (method === "GET" || method === "HEAD")
  ) {
    handleModels(req, res);
    return;
  }

  // Chat completions
  if (normalizedPath === "/v1/chat/completions" && method === "POST") {
    handleChatRoute(req, res);
    return;
  }

  // Responses (Codex API)
  if (
    (normalizedPath === "/v1/responses" || normalizedPath.startsWith("/v1/responses/")) &&
    method === "POST"
  ) {
    handleResponsesRoute(req, res);
    return;
  }

  // Embeddings
  if (normalizedPath === "/v1/embeddings" && method === "POST") {
    handleEmbeddingsRoute(req, res);
    return;
  }

  // 404
  sendError(res, 404, `Not found: ${method} ${pathname}`, "invalid_request_error", "not_found");
}

// ── Startup ────────────────────────────────────────────────────────────────
async function main() {
  console.log("[nerve-lite] Loading handlers...");

  // Import handlers — these pull in the routing engine, DB, translators, etc.
  const chatMod = await import("./../src/sse/handlers/chat.ts");
  handleChat = chatMod.handleChat;

  const modelsMod = await import("./../src/app/api/v1/models/catalog.ts");
  getUnifiedModelsResponse = modelsMod.getUnifiedModelsResponse;

  const embeddingMod = await import("./../src/lib/embeddings/service.ts");
  createEmbeddingResponse = embeddingMod.createEmbeddingResponse;

  const translatorMod = await import("@nerve/open-sse/translator/index.ts");
  initTranslators = translatorMod.initTranslators;

  // Initialize translators
  await initTranslators();
  console.log("[nerve-lite] Translators initialized");

  // Create HTTP server
  const server = http.createServer((req, res) => {
    // Handle route
    Promise.resolve(route(req, res)).catch((err) => {
      console.error("[nerve-lite] Unhandled error:", err);
      if (!res.headersSent) {
        sendError(res, 500, err instanceof Error ? err.message : "Internal error", "server_error");
      }
    });
  });

  server.listen(PORT, HOST, () => {
    const mem = process.memoryUsage();
    console.log(`[nerve-lite] Listening on http://${HOST}:${PORT}`);
    console.log(
      `[nerve-lite] Memory: RSS=${Math.round(mem.rss / 1024 / 1024)}MB heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`
    );
    console.log(`[nerve-lite] Routes:`);
    console.log(`  POST   /v1/chat/completions`);
    console.log(`  POST   /v1/responses`);
    console.log(`  POST   /v1/embeddings`);
    console.log(`  GET    /v1/models`);
    console.log(`  GET    /healthz`);
  });

  // Graceful shutdown
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      console.log(`[nerve-lite] Received ${sig}, shutting down...`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("[nerve-lite] Fatal error:", err);
  process.exit(1);
});
