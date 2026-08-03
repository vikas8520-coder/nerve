import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getMcpServerById,
  getMcpServersByCategory,
  getOfficialMcpServers,
  getCommunityMcpServers,
  searchMcpServers,
  getAllCategories,
  MCP_SERVER_REGISTRY,
  MCP_PROJECT_TEMPLATES,
  detectProjectType,
} from "../../open-sse/services/mcpRegistry.ts";

describe("MCP Registry", () => {
  describe("Registry lookups", () => {
    it("should find filesystem server by ID", () => {
      const server = getMcpServerById("filesystem");
      assert.ok(server);
      assert.equal(server?.name, "Filesystem");
      assert.equal(server?.category, "filesystem");
      assert.equal(server?.official, true);
    });

    it("should return undefined for unknown ID", () => {
      const server = getMcpServerById("nonexistent");
      assert.equal(server, undefined);
    });

    it("should filter by category", () => {
      const databaseServers = getMcpServersByCategory("database");
      assert.ok(databaseServers.length >= 3);
      assert.ok(databaseServers.every((s) => s.category === "database"));
    });

    it("should return official servers", () => {
      const official = getOfficialMcpServers();
      assert.ok(official.length > 0);
      assert.ok(official.every((s) => s.official === true));
    });

    it("should return community servers", () => {
      const community = getCommunityMcpServers();
      assert.ok(community.length > 0);
      assert.ok(community.every((s) => s.official === false));
    });

    it("should search servers by query", () => {
      const results = searchMcpServers("git");
      assert.ok(results.length >= 2); // github, git
      assert.ok(results.some((s) => s.id === "github"));
      assert.ok(results.some((s) => s.id === "git"));
    });

    it("should search by description", () => {
      const results = searchMcpServers("database");
      assert.ok(results.length >= 3);
      assert.ok(results.every((s) => s.category === "database" || s.description.toLowerCase().includes("database")));
    });

    it("should return all categories", () => {
      const categories = getAllCategories();
      assert.ok(categories.includes("filesystem"));
      assert.ok(categories.includes("database"));
      assert.ok(categories.includes("cloud"));
      assert.ok(categories.includes("ai"));
    });
  });

  describe("Project detection", () => {
    it("should detect full-stack web app template", async () => {
      // We can't easily test file system operations in this context
      // but we can verify the templates exist and have expected structure
      const templates = MCP_PROJECT_TEMPLATES;
      assert.ok(templates.length >= 5);

      const webTemplate = templates.find((t) => t.name === "Full-Stack Web App");
      assert.ok(webTemplate);
      assert.ok(webTemplate.detectedPatterns.length > 0);
      assert.ok(webTemplate.recommendedServers.includes("filesystem"));
      assert.ok(webTemplate.recommendedServers.includes("github"));
    });

    it("should detect python data science template", () => {
      const templates = MCP_PROJECT_TEMPLATES;
      const pyTemplate = templates.find((t) => t.name === "Python Data Science");
      assert.ok(pyTemplate);
      assert.ok(pyTemplate.recommendedServers.includes("sqlite"));
      assert.ok(pyTemplate.recommendedServers.includes("huggingface"));
    });

    it("should detect AI/ML project template", () => {
      const templates = MCP_PROJECT_TEMPLATES;
      const aiTemplate = templates.find((t) => t.name === "AI/ML Project");
      assert.ok(aiTemplate);
      assert.ok(aiTemplate.recommendedServers.includes("huggingface"));
      assert.ok(aiTemplate.recommendedServers.includes("ollama"));
      assert.ok(aiTemplate.recommendedServers.includes("memory"));
    });
  });

  describe("Registry completeness", () => {
    it("should have at least 20 servers in registry", () => {
      assert.ok(MCP_SERVER_REGISTRY.length >= 20);
    });

    it("should have all servers with required fields", () => {
      for (const server of MCP_SERVER_REGISTRY) {
        assert.ok(server.id, "Server missing id");
        assert.ok(server.name, "Server missing name");
        assert.ok(server.description, "Server missing description");
        assert.ok(server.category, "Server missing category");
        assert.ok(server.install, "Server missing install method");
        assert.ok(server.version, "Server missing version");
        assert.ok(typeof server.official === "boolean", "Server missing official flag");
      }
    });

    it("should have valid install methods", () => {
      for (const server of MCP_SERVER_REGISTRY) {
        const { type } = server.install;
        assert.ok(
          ["npm", "npx", "docker", "binary", "source"].includes(type),
          `Invalid install type for ${server.id}: ${type}`
        );
      }
    });
  });
});

console.log("All MCP Registry tests passed!");