/**
 * MCP Server Registry — Curated list of official and community MCP servers
 * with auto-install capability
 */

import { writeFile, readFile, mkdir, rm, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface McpServerDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Category for filtering */
  category: McpServerCategory;
  /** Installation method */
  install: McpInstallMethod;
  /** Version (semver or "latest") */
  version: string;
  /** Minimum Nerve version required */
  minNerveVersion?: string;
  /** Required environment variables */
  requiredEnv?: string[];
  /** Optional environment variables */
  optionalEnv?: string[];
  /** Documentation URL */
  docsUrl?: string;
  /** Repository URL */
  repoUrl?: string;
  /** Icon/emoji for UI */
  icon?: string;
  /** Tags for search */
  tags?: string[];
  /** Whether this is an official/verified server */
  official: boolean;
  /** Maintainer info */
  maintainer?: string;
  /** License */
  license?: string;
}

export type McpServerCategory =
  | "filesystem"
  | "code"
  | "database"
  | "api"
  | "web"
  | "cloud"
  | "productivity"
  | "ai"
  | "monitoring"
  | "security"
  | "other";

export type McpInstallMethod =
  | { type: "npm"; package: string; command?: string }
  | { type: "npx"; package: string; args?: string[] }
  | { type: "docker"; image: string; env?: Record<string, string> }
  | { type: "binary"; url: string; checksum?: string }
  | { type: "source"; repo: string; buildCommand?: string };

export interface McpServerInstance {
  definition: McpServerDefinition;
  status: "installed" | "not-installed" | "installing" | "error" | "updating";
  installedVersion?: string;
  installedPath?: string;
  lastUpdated?: string;
  error?: string;
  config?: Record<string, unknown>;
}

export interface McpProjectTemplate {
  name: string;
  description: string;
  detectedPatterns: string[]; // package.json deps, file patterns, etc.
  recommendedServers: string[]; // MCP server IDs
  optionalServers?: string[];
}

// ── Curated MCP Server Registry ───────────────────────────────────────────────

export const MCP_SERVER_REGISTRY: McpServerDefinition[] = [
  // Filesystem & Code
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files on the local filesystem",
    category: "filesystem",
    install: { type: "npx", package: "@modelcontextprotocol/server-filesystem", args: [] },
    version: "latest",
    requiredEnv: ["ALLOWED_DIRECTORIES"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📁",
    tags: ["files", "local", "read", "write"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Interact with GitHub API - repos, issues, PRs, actions",
    category: "code",
    install: { type: "npx", package: "@modelcontextprotocol/server-github", args: [] },
    version: "latest",
    requiredEnv: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🐙",
    tags: ["git", "github", "issues", "prs", "actions"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "git",
    name: "Git",
    description: "Local git repository operations",
    category: "code",
    install: { type: "npx", package: "@modelcontextprotocol/server-git", args: [] },
    version: "latest",
    requiredEnv: ["REPO_PATH"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📝",
    tags: ["git", "local", "version-control"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Databases
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    category: "database",
    install: { type: "npx", package: "@modelcontextprotocol/server-postgres", args: [] },
    version: "latest",
    requiredEnv: ["POSTGRES_CONNECTION_STRING"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🐘",
    tags: ["sql", "postgres", "database"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Query local SQLite databases",
    category: "database",
    install: { type: "npx", package: "@modelcontextprotocol/server-sqlite", args: [] },
    version: "latest",
    requiredEnv: ["DB_PATH"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🗃️",
    tags: ["sql", "sqlite", "local", "database"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Query and manage MySQL databases",
    category: "database",
    install: { type: "npx", package: "@modelcontextprotocol/server-mysql", args: [] },
    version: "latest",
    requiredEnv: ["MYSQL_CONNECTION_STRING"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/mysql",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🐬",
    tags: ["sql", "mysql", "database"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Web & API
  {
    id: "fetch",
    name: "Fetch",
    description: "HTTP requests and web scraping",
    category: "web",
    install: { type: "npx", package: "@modelcontextprotocol/server-fetch", args: [] },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🌐",
    tags: ["http", "web", "fetch", "scrape"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web search via Brave Search API",
    category: "web",
    install: { type: "npx", package: "@modelcontextprotocol/server-brave-search", args: [] },
    version: "latest",
    requiredEnv: ["BRAVE_API_KEY"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🔍",
    tags: ["search", "web", "brave"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation and scraping with Puppeteer",
    category: "web",
    install: { type: "npx", package: "@modelcontextprotocol/server-puppeteer", args: [] },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🤖",
    tags: ["browser", "automation", "scrape", "puppeteer"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Cloud & Infrastructure
  {
    id: "aws",
    name: "AWS",
    description: "Manage AWS resources and services",
    category: "cloud",
    install: { type: "npx", package: "@modelcontextprotocol/server-aws", args: [] },
    version: "latest",
    requiredEnv: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/aws",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "☁️",
    tags: ["aws", "cloud", "infrastructure"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "gcp",
    name: "Google Cloud",
    description: "Manage Google Cloud resources",
    category: "cloud",
    install: { type: "npx", package: "@modelcontextprotocol/server-gcp", args: [] },
    version: "latest",
    requiredEnv: ["GCP_PROJECT_ID", "GCP_CREDENTIALS"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gcp",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "☁️",
    tags: ["gcp", "google-cloud", "infrastructure"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    description: "Interact with Kubernetes clusters",
    category: "cloud",
    install: { type: "npx", package: "@modelcontextprotocol/server-kubernetes", args: [] },
    version: "latest",
    requiredEnv: ["KUBECONFIG"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/kubernetes",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "⚙️",
    tags: ["k8s", "kubernetes", "containers"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "docker",
    name: "Docker",
    description: "Manage Docker containers and images",
    category: "cloud",
    install: { type: "npx", package: "@modelcontextprotocol/server-docker", args: [] },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/docker",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🐳",
    tags: ["docker", "containers"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Productivity
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, manage channels in Slack",
    category: "productivity",
    install: { type: "npx", package: "@modelcontextprotocol/server-slack", args: [] },
    version: "latest",
    requiredEnv: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "💬",
    tags: ["slack", "messaging", "team"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and write Notion pages and databases",
    category: "productivity",
    install: { type: "npx", package: "@modelcontextprotocol/server-notion", args: [] },
    version: "latest",
    requiredEnv: ["NOTION_API_KEY"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/notion",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📓",
    tags: ["notion", "docs", "database"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Access Google Drive files and folders",
    category: "productivity",
    install: { type: "npx", package: "@modelcontextprotocol/server-gdrive", args: [] },
    version: "latest",
    requiredEnv: ["GOOGLE_DRIVE_CREDENTIALS"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📁",
    tags: ["google", "drive", "files"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // AI & ML
  {
    id: "huggingface",
    name: "Hugging Face",
    description: "Access Hugging Face models, datasets, and spaces",
    category: "ai",
    install: { type: "npx", package: "@modelcontextprotocol/server-huggingface", args: [] },
    version: "latest",
    requiredEnv: ["HF_TOKEN"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/huggingface",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🤗",
    tags: ["huggingface", "models", "datasets", "ml"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Run local LLMs via Ollama",
    category: "ai",
    install: { type: "npx", package: "@modelcontextprotocol/server-ollama", args: [] },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/ollama",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🦙",
    tags: ["ollama", "local", "llm"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Monitoring & Security
  {
    id: "sentry",
    name: "Sentry",
    description: "Monitor errors and performance with Sentry",
    category: "monitoring",
    install: { type: "npx", package: "@modelcontextprotocol/server-sentry", args: [] },
    version: "latest",
    requiredEnv: ["SENTRY_AUTH_TOKEN", "SENTRY_ORG"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sentry",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📊",
    tags: ["sentry", "errors", "monitoring"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },
  {
    id: "datadog",
    name: "Datadog",
    description: "Query Datadog metrics and logs",
    category: "monitoring",
    install: { type: "npx", package: "@modelcontextprotocol/server-datadog", args: [] },
    version: "latest",
    requiredEnv: ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/datadog",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "📈",
    tags: ["datadog", "metrics", "monitoring"],
    official: true,
    maintainer: "MCP Team",
    license: "MIT",
  },

  // Community / Extended
  {
    id: "memory",
    name: "Memory",
    description: "Persistent memory/knowledge graph for agents",
    category: "ai",
    install: { type: "npm", package: "mcp-memory-server", command: "mcp-memory-server" },
    version: "latest",
    docsUrl: "https://github.com/memory-mcp/memory-mcp-server",
    repoUrl: "https://github.com/memory-mcp/memory-mcp-server",
    icon: "🧠",
    tags: ["memory", "knowledge", "graph", "persistent"],
    official: false,
    maintainer: "Community",
    license: "MIT",
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Structured reasoning with step-by-step thinking",
    category: "ai",
    install: { type: "npm", package: "mcp-sequential-thinking", command: "mcp-sequential-thinking" },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "🤔",
    tags: ["reasoning", "thinking", "structured"],
    official: false,
    maintainer: "Community",
    license: "MIT",
  },
  {
    id: "time",
    name: "Time",
    description: "Time and timezone utilities",
    category: "productivity",
    install: { type: "npm", package: "mcp-time", command: "mcp-time" },
    version: "latest",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    icon: "⏰",
    tags: ["time", "timezone", "date"],
    official: false,
    maintainer: "Community",
    license: "MIT",
  },
];

// ── Project Templates ──────────────────────────────────────────────────────────

export const MCP_PROJECT_TEMPLATES: McpProjectTemplate[] = [
  {
    name: "Full-Stack Web App",
    description: "React/Next.js + Database + API",
    detectedPatterns: [
      "package.json:next",
      "package.json:react",
      "package.json:typescript",
      "prisma/schema.prisma",
      "drizzle.config.ts",
    ],
    recommendedServers: ["filesystem", "github", "postgres", "fetch"],
    optionalServers: ["docker", "slack", "sentry"],
  },
  {
    name: "Python Data Science",
    description: "Jupyter + Pandas + ML",
    detectedPatterns: [
      "requirements.txt:pandas",
      "requirements.txt:numpy",
      "requirements.txt:scikit-learn",
      "pyproject.toml:jupyter",
      "*.ipynb",
    ],
    recommendedServers: ["filesystem", "sqlite", "fetch", "huggingface"],
    optionalServers: ["memory", "sequential-thinking"],
  },
  {
    name: "Go Microservice",
    description: "Go + Docker + Kubernetes",
    detectedPatterns: [
      "go.mod",
      "Dockerfile",
      "k8s/*.yaml",
      "*.go",
    ],
    recommendedServers: ["filesystem", "github", "docker", "kubernetes", "postgres"],
    optionalServers: ["datadog", "sentry"],
  },
  {
    name: "AI/ML Project",
    description: "LLM fine-tuning, RAG, agents",
    detectedPatterns: [
      "requirements.txt:transformers",
      "requirements.txt:langchain",
      "requirements.txt:llama-index",
      "pyproject.toml:openai",
    ],
    recommendedServers: ["filesystem", "github", "huggingface", "ollama", "memory"],
    optionalServers: ["sequential-thinking", "sqlite", "fetch"],
  },
  {
    name: "Node.js Backend",
    description: "Express/Fastify + Database + Auth",
    detectedPatterns: [
      "package.json:express",
      "package.json:fastify",
      "package.json:prisma",
      "package.json:typeorm",
    ],
    recommendedServers: ["filesystem", "github", "postgres", "sqlite", "fetch"],
    optionalServers: ["docker", "redis", "sentry"],
  },
  {
    name: "Rust Project",
    description: "Rust + Cargo + CI/CD",
    detectedPatterns: [
      "Cargo.toml",
      "*.rs",
      ".github/workflows/*.yml",
    ],
    recommendedServers: ["filesystem", "github", "docker"],
    optionalServers: ["sqlite", "postgres"],
  },
];

// ── Registry Helpers ──────────────────────────────────────────────────────────

export function getMcpServerById(id: string): McpServerDefinition | undefined {
  return MCP_SERVER_REGISTRY.find((s) => s.id === id);
}

export function getMcpServersByCategory(category: McpServerCategory): McpServerDefinition[] {
  return MCP_SERVER_REGISTRY.filter((s) => s.category === category);
}

export function getOfficialMcpServers(): McpServerDefinition[] {
  return MCP_SERVER_REGISTRY.filter((s) => s.official);
}

export function getCommunityMcpServers(): McpServerDefinition[] {
  return MCP_SERVER_REGISTRY.filter((s) => !s.official);
}

export function searchMcpServers(query: string): McpServerDefinition[] {
  const q = query.toLowerCase();
  return MCP_SERVER_REGISTRY.filter(
    (s) =>
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some((t) => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
  );
}

export function getAllCategories(): McpServerCategory[] {
  return Array.from(new Set(MCP_SERVER_REGISTRY.map((s) => s.category)));
}

// ── Project Detection ──────────────────────────────────────────────────────────

interface ProjectDetectionResult {
  template: McpProjectTemplate | null;
  confidence: number;
  matchedPatterns: string[];
  recommendedServers: string[];
  optionalServers: string[];
}

async function readPackageJson(projectPath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(join(projectPath, "package.json"), "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readRequirementsTxt(projectPath: string): Promise<string[]> {
  try {
    const content = await readFile(join(projectPath, "requirements.txt"), "utf-8");
    return content.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function checkFileExists(projectPath: string, pattern: string): Promise<boolean> {
  // Simplified - in production would use glob
  return false;
}

export async function detectProjectType(projectPath: string): Promise<ProjectDetectionResult> {
  const pkg = await readPackageJson(projectPath);
  const requirements = await readRequirementsTxt(projectPath);
  const deps = pkg?.dependencies ? Object.keys(pkg.dependencies) : [];
  const devDeps = pkg?.devDependencies ? Object.keys(pkg.devDependencies) : [];
  const allDeps = [...deps, ...devDeps];

  let bestMatch: ProjectDetectionResult | null = null;
  let bestConfidence = 0;

  for (const template of MCP_PROJECT_TEMPLATES) {
    let matched = 0;
    const matchedPatterns: string[] = [];

    for (const pattern of template.detectedPatterns) {
      let match = false;
      if (pattern.startsWith("package.json:")) {
        const dep = pattern.split(":")[1];
        match = allDeps.includes(dep);
      } else if (pattern.startsWith("requirements.txt:")) {
        const dep = pattern.split(":")[1];
        match = requirements.some((r) => r.includes(dep));
      }
      if (match) {
        matched++;
        matchedPatterns.push(pattern);
      }
    }

    const confidence = template.detectedPatterns.length > 0 ? matched / template.detectedPatterns.length : 0;
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = {
        template,
        confidence,
        matchedPatterns,
        recommendedServers: template.recommendedServers,
        optionalServers: template.optionalServers || [],
      };
    }
  }

  return bestMatch || {
    template: null,
    confidence: 0,
    matchedPatterns: [],
    recommendedServers: [],
    optionalServers: [],
  };
}

// ── Installation Manager ───────────────────────────────────────────────────────

const MCP_INSTALL_DIR = join(homedir(), ".nerve", "mcp-servers");
const MCP_CONFIG_FILE = join(MCP_INSTALL_DIR, "installed.json");

interface InstalledServerRecord {
  id: string;
  version: string;
  path: string;
  installedAt: string;
  config?: Record<string, unknown>;
}

async function loadInstalled(): Promise<Record<string, InstalledServerRecord>> {
  try {
    const content = await readFile(MCP_CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveInstalled(installed: Record<string, InstalledServerRecord>): Promise<void> {
  await mkdir(MCP_INSTALL_DIR, { recursive: true });
  await writeFile(MCP_CONFIG_FILE, JSON.stringify(installed, null, 2));
}

async function runNpx(packageName: string, args: string[] = [], cwd: string = MCP_INSTALL_DIR): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("npx", ["-y", packageName, ...args], { cwd, timeout: 120000 });
}

async function runNpmInstall(packageName: string, cwd: string = MCP_INSTALL_DIR): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("npm", ["install", packageName], { cwd, timeout: 120000 });
}

export async function installMcpServer(serverId: string, config?: Record<string, unknown>): Promise<McpServerInstance> {
  const definition = getMcpServerById(serverId);
  if (!definition) {
    throw new Error(`MCP server '${serverId}' not found in registry`);
  }

  const installed = await loadInstalled();
  const serverDir = join(MCP_INSTALL_DIR, serverId);

  // Create instance with installing status
  const instance: McpServerInstance = {
    definition,
    status: "installing",
    config,
  };

  try {
    await mkdir(serverDir, { recursive: true });

    let installedVersion = definition.version;
    let installedPath = serverDir;

    switch (definition.install.type) {
      case "npx": {
        // Test install with npx
        const result = await runNpx(definition.install.package, definition.install.args || []);
        // For npx servers, the "installation" is just verifying it works
        // The actual binary is fetched on-demand by npx
        installedPath = "npx";
        break;
      }
      case "npm": {
        // Install as local npm package
        await runNpmInstall(definition.install.package);
        // Find the installed binary
        const binPath = join(MCP_INSTALL_DIR, "node_modules", ".bin", definition.install.command || definition.install.package);
        installedPath = binPath;
        break;
      }
      case "docker": {
        // Pull docker image
        await execFileAsync("docker", ["pull", definition.install.image], { timeout: 300000 });
        installedPath = `docker:${definition.install.image}`;
        break;
      }
      default:
        throw new Error(`Unsupported install method: ${(definition.install as McpInstallMethod).type}`);
    }

    // Save installation record
    const record: InstalledServerRecord = {
      id: serverId,
      version: installedVersion,
      path: installedPath,
      installedAt: new Date().toISOString(),
      config,
    };

    installed[serverId] = record;
    await saveInstalled(installed);

    return {
      ...instance,
      status: "installed",
      installedVersion,
      installedPath,
      lastUpdated: record.installedAt,
      config,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await saveInstalled(installed);
    return {
      ...instance,
      status: "error",
      error: errorMessage,
    };
  }
}

export async function uninstallMcpServer(serverId: string): Promise<boolean> {
  const installed = await loadInstalled();
  const record = installed[serverId];
  if (!record) return false;

  try {
    const serverDir = join(MCP_INSTALL_DIR, serverId);
    await rm(serverDir, { recursive: true, force: true });
    delete installed[serverId];
    await saveInstalled(installed);
    return true;
  } catch {
    return false;
  }
}

export async function updateMcpServer(serverId: string): Promise<McpServerInstance> {
  // For npx servers, "update" means next run gets latest
  // For npm servers, reinstall
  const definition = getMcpServerById(serverId);
  if (!definition) {
    throw new Error(`MCP server '${serverId}' not found in registry`);
  }

  await uninstallMcpServer(serverId);
  return installMcpServer(serverId);
}

export async function listInstalledMcpServers(): Promise<McpServerInstance[]> {
  const installed = await loadInstalled();
  const instances: McpServerInstance[] = [];

  for (const definition of MCP_SERVER_REGISTRY) {
    const record = installed[definition.id];
    if (record) {
      instances.push({
        definition,
        status: "installed",
        installedVersion: record.version,
        installedPath: record.path,
        lastUpdated: record.installedAt,
        config: record.config,
      });
    } else {
      instances.push({
        definition,
        status: "not-installed",
      });
    }
  }

  return instances;
}

export async function getMcpServerStatus(serverId: string): Promise<McpServerInstance | null> {
  const installed = await loadInstalled();
  const record = installed[serverId];
  const definition = getMcpServerById(serverId);

  if (!definition) return null;

  if (record) {
    return {
      definition,
      status: "installed",
      installedVersion: record.version,
      installedPath: record.path,
      lastUpdated: record.installedAt,
      config: record.config,
    };
  }

  return {
    definition,
    status: "not-installed",
  };
}

// ── Configuration Generator ────────────────────────────────────────────────────

export function generateMcpConfig(servers: McpServerInstance[]): Record<string, Record<string, unknown>> {
  const mcpServers: Record<string, Record<string, unknown>> = {};

  for (const instance of servers) {
    if (instance.status !== "installed") continue;
    const { definition, config } = instance;

    let serverConfig: Record<string, unknown> = {};

    switch (definition.install.type) {
      case "npx": {
        serverConfig = {
          command: "npx",
          args: ["-y", definition.install.package, ...(definition.install.args || [])],
        };
        break;
      }
      case "npm": {
        const binName = definition.install.command || definition.install.package;
        serverConfig = {
          command: binName,
        };
        break;
      }
      case "docker": {
        serverConfig = {
          command: "docker",
          args: [
            "run",
            "-i",
            "--rm",
            ...Object.entries(definition.install.env || {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
            definition.install.image,
          ],
        };
        break;
      }
    }

    // Add environment variables from config
    if (config && Object.keys(config).length > 0) {
      serverConfig.env = config;
    } else if (definition.requiredEnv?.length || definition.optionalEnv?.length) {
      serverConfig.env = {};
      for (const env of definition.requiredEnv || []) {
        serverConfig.env[env] = process.env[env] || "";
      }
      for (const env of definition.optionalEnv || []) {
        if (process.env[env]) serverConfig.env[env] = process.env[env];
      }
    }

    mcpServers[definition.id] = serverConfig;
  }

  return { mcpServers };
}

export function generateClaudeDesktopConfig(servers: McpServerInstance[]): string {
  const { mcpServers } = generateMcpConfig(servers);
  return JSON.stringify({ mcpServers }, null, 2);
}

export function generateCursorConfig(servers: McpServerInstance[]): string {
  const { mcpServers } = generateMcpConfig(servers);
  return JSON.stringify({ mcp: { servers: mcpServers } }, null, 2);
}

export function generateVscodeConfig(servers: McpServerInstance[]): string {
  const { mcpServers } = generateMcpConfig(servers);
  return JSON.stringify({ mcp: { servers: mcpServers } }, null, 2);
}