"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Button, Input, Select, Badge, Spinner } from "@/shared/components";
import { useTranslations } from "next-intl";
import { matchesSearch } from "@/shared/utils/turkishText";

interface SelectOption {
  value: string;
  label: string;
}

type McpServerCategory = 
  | "filesystem" | "code" | "database" | "api" 
  | "web" | "cloud" | "productivity" | "ai" 
  | "monitoring" | "security" | "other";

type McpServerDefinition = {
  id: string;
  name: string;
  description: string;
  category: McpServerCategory;
  install: { type: string; package?: string; image?: string; command?: string };
  version: string;
  requiredEnv?: string[];
  optionalEnv?: string[];
  docsUrl?: string;
  repoUrl?: string;
  icon?: string;
  tags?: string[];
  official: boolean;
  maintainer?: string;
  license?: string;
};

type McpServerInstance = {
  definition: McpServerDefinition;
  status: "installed" | "not-installed" | "installing" | "error" | "updating";
  installedVersion?: string;
  installedPath?: string;
  lastUpdated?: string;
  error?: string;
  config?: Record<string, unknown>;
};

type McpServerResponse = {
  servers: McpServerInstance[];
  categories: McpServerCategory[];
  total: number;
};

type McpConfigResponse = {
  success: boolean;
  config: Record<string, any>;
  format: string;
  serverCount: number;
};

const CATEGORY_LABELS: Record<McpServerCategory, string> = {
  filesystem: "Filesystem",
  code: "Code",
  database: "Database",
  api: "API",
  web: "Web",
  cloud: "Cloud",
  productivity: "Productivity",
  ai: "AI/ML",
  monitoring: "Monitoring",
  security: "Security",
  other: "Other",
};

const CATEGORY_ICONS: Record<McpServerCategory, string> = {
  filesystem: "📁",
  code: "💻",
  database: "🗃️",
  api: "🔌",
  web: "🌐",
  cloud: "☁️",
  productivity: "📋",
  ai: "🤖",
  monitoring: "📊",
  security: "🔒",
  other: "📦",
};

export default function McpServerRegistry() {
  const t = useTranslations("mcpRegistry");
  const [servers, setServers] = useState<McpServerInstance[]>([]);
  const [categories, setCategories] = useState<McpServerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<McpServerCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "not-installed" | "error">("all");
  const [selectedServer, setSelectedServer] = useState<McpServerInstance | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [configFormat, setConfigFormat] = useState<"json" | "claude" | "cursor" | "vscode">("json");
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [detectPath, setDetectPath] = useState("");
  const [detectResult, setDetectResult] = useState<any>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const fetchServers = useCallback(async (params?: { category?: string; search?: string; official?: string; installed?: string }) => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.official) searchParams.set("official", params.official);
      if (params?.installed) searchParams.set("installed", params.installed);

      const res = await fetch(`/api/mcp/servers?${searchParams.toString()}`);
      if (res.ok) {
        const data: McpServerResponse = await res.json();
        setServers(data.servers);
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleInstall = async (serverId: string, config?: Record<string, unknown>) => {
    setActionLoading(prev => ({ ...prev, [serverId]: true }));
    try {
      const res = await fetch("/api/mcp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, config, action: "install" }),
      });
      if (res.ok) {
        await fetchServers();
        setActionMessage(t("installSuccess", { name: getServerById(serverId)?.name || serverId }));
      } else {
        const data = await res.json();
        setActionMessage(data.error || t("installFailed"));
      }
    } catch (error) {
      setActionMessage(t("installError"));
    } finally {
      setActionLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const handleUninstall = async (serverId: string) => {
    if (!globalThis.confirm(t("confirmUninstall", { name: getServerById(serverId)?.name || serverId }))) return;
    
    setActionLoading(prev => ({ ...prev, [serverId]: true }));
    try {
      const res = await fetch("/api/mcp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, action: "uninstall" }),
      });
      if (res.ok) {
        await fetchServers();
        setActionMessage(t("uninstallSuccess"));
      } else {
        const data = await res.json();
        setActionMessage(data.error || t("uninstallFailed"));
      }
    } catch (error) {
      setActionMessage(t("uninstallError"));
    } finally {
      setActionLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const handleUpdate = async (serverId: string) => {
    setActionLoading(prev => ({ ...prev, [serverId]: true }));
    try {
      const res = await fetch("/api/mcp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, action: "update" }),
      });
      if (res.ok) {
        await fetchServers();
        setActionMessage(t("updateSuccess"));
      } else {
        const data = await res.json();
        setActionMessage(data.error || t("updateFailed"));
      }
    } catch (error) {
      setActionMessage(t("updateError"));
    } finally {
      setActionLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const handleGenerateConfig = async () => {
    try {
      const res = await fetch(`/api/mcp/config?format=${configFormat}`);
      if (res.ok) {
        const data: McpConfigResponse = await res.json();
        setGeneratedConfig(JSON.stringify(data.config, null, 2));
        setCopySuccess(false);
      }
    } catch (error) {
      console.error("Failed to generate config:", error);
    }
  };

  const handleCopyConfig = () => {
    if (generatedConfig) {
      navigator.clipboard.writeText(generatedConfig);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDetectProject = async () => {
    if (!detectPath.trim()) return;
    
    setDetectLoading(true);
    try {
      const res = await fetch("/api/mcp/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: detectPath }),
      });
      if (res.ok) {
        const data = await res.json();
        setDetectResult(data.result);
      }
    } catch (error) {
      console.error("Failed to detect project:", error);
    } finally {
      setDetectLoading(false);
    }
  };

  const getServerById = (id: string) => servers.find(s => s.definition.id === id);

  const filteredServers = useMemo(() => {
    return servers.filter(server => {
      if (searchQuery && 
          !matchesSearch(server.definition.name, searchQuery) &&
          !matchesSearch(server.definition.description, searchQuery) &&
          !matchesSearch(server.definition.id, searchQuery) &&
          !server.definition.tags?.some(t => matchesSearch(t, searchQuery))) {
        return false;
      }
      if (categoryFilter !== "all" && server.definition.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && server.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [servers, searchQuery, categoryFilter, statusFilter]);

  const installedCount = servers.filter(s => s.status === "installed").length;
  const officialCount = servers.filter(s => s.definition.official).length;
  const communityCount = servers.filter(s => !s.definition.official).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label={t("totalServers")} value={servers.length} icon="📦" />
        <StatCard label={t("installed")} value={installedCount} icon="✅" />
        <StatCard label={t("official")} value={officialCount} icon="✨" />
        <StatCard label={t("community")} value={communityCount} icon="🌍" />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="w-full md:w-48"
            options={[
              { value: "all", label: t("allCategories") },
              ...categories.map(cat => ({ value: cat, label: `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}` }))
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full md:w-48"
            options={[
              { value: "all", label: t("allStatuses") },
              { value: "installed", label: t("installed") },
              { value: "not-installed", label: t("notInstalled") },
              { value: "error", label: t("error") },
            ]}
          />
        </div>
      </Card>

      {/* Server List */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-tertiary">
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-muted">{t("server")}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-muted">{t("category")}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-muted">{t("status")}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-muted">{t("version")}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-muted">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredServers.map(server => (
                <tr key={server.definition.id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{server.definition.icon || CATEGORY_ICONS[server.definition.category]}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text">{server.definition.name}</span>
                          {server.definition.official && (
                            <Badge variant="default" className="text-xs">{t("official")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-text-muted truncate max-w-xs">{server.definition.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default" className="text-xs">
                      {CATEGORY_ICONS[server.definition.category]} {CATEGORY_LABELS[server.definition.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={server.status} t={t} />
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {server.installedVersion || server.definition.version}
                  </td>
                  <td className="px-4 py-3">
                    <ServerActions
                      server={server}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                      onUpdate={handleUpdate}
                      onDetail={() => { setSelectedServer(server); setShowDetail(true); }}
                      loading={actionLoading[server.definition.id]}
                    />
                  </td>
                </tr>
              ))}
              {filteredServers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                    {t("noServersFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Config Generator */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t("generateConfig")}</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <Select
            value={configFormat}
            onChange={(e) => setConfigFormat(e.target.value as any)}
            className="w-full md:w-48"
            options={[
              { value: "json", label: t("formatJson") },
              { value: "claude", label: t("formatClaude") },
              { value: "cursor", label: t("formatCursor") },
              { value: "vscode", label: t("formatVscode") },
            ]}
          />
          <Button onClick={handleGenerateConfig} variant="primary">
            {t("generate")}
          </Button>
        </div>
        {generatedConfig && (
          <div className="mt-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t("generatedConfig")}</span>
              <Button size="sm" variant="ghost" onClick={handleCopyConfig}>
                {copySuccess ? t("copied") : t("copy")}
              </Button>
            </div>
            <pre className="bg-bg-tertiary rounded-lg p-4 max-h-64 overflow-auto text-xs text-text">
              {generatedConfig}
            </pre>
          </div>
        )}
      </Card>

      {/* Project Detection */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t("detectProject")}</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <Input
            placeholder="/path/to/project"
            value={detectPath}
            onChange={(e) => setDetectPath(e.target.value)}
            className="flex-1 min-w-[300px]"
          />
          <Button onClick={handleDetectProject} variant="primary" disabled={detectLoading}>
            {detectLoading ? <Spinner size="sm" /> : t("detect")}
          </Button>
        </div>
        {detectResult && (
          <div className="mt-4 p-4 bg-bg-tertiary rounded-lg">
            <h4 className="font-semibold mb-2">{t("detectionResult")}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t("template")}: </span>
                <span className="font-medium">{detectResult.template?.name || t("none")}</span>
              </div>
              <div>
                <span className="text-text-muted">{t("confidence")}: </span>
                <span className="font-medium">{(detectResult.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-text-muted">{t("recommended")}: </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {detectResult.recommendedServers?.map((id: string) => (
                    <Badge key={id} variant="default">{id}</Badge>
                  ))}
                </div>
              </div>
              {detectResult.optionalServers?.length && (
                <div className="md:col-span-2">
                  <span className="text-text-muted">{t("optional")}: </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {detectResult.optionalServers.map((id: string) => (
                      <Badge key={id} variant="info">{id}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {detectResult.template && (
              <Button size="sm" variant="primary" className="mt-4" onClick={() => {
                detectResult.recommendedServers?.forEach((id: string) => handleInstall(id));
              }}>
                {t("installRecommended")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {showDetail && selectedServer && (
        <ServerDetailModal
          server={selectedServer}
          onClose={() => { setShowDetail(false); setSelectedServer(null); }}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onUpdate={handleUpdate}
          loading={actionLoading[selectedServer.definition.id]}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: McpServerInstance["status"]; t: any }) {
  const configs = {
    installed: { label: t("installed"), color: "bg-green-500/20 text-green-400 border-green-500/30", dot: "bg-green-400" },
    "not-installed": { label: t("notInstalled"), color: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-400" },
    installing: { label: t("installing"), color: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-400 animate-pulse" },
    updating: { label: t("updating"), color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400 animate-pulse" },
    error: { label: t("error"), color: "bg-red-500/20 text-red-400 border-red-500/30", dot: "bg-red-400" },
  };
  const config = configs[status] || configs["not-installed"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function ServerActions({ 
  server, 
  onInstall, 
  onUninstall, 
  onUpdate, 
  onDetail,
  loading 
}: { 
  server: McpServerInstance;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onUpdate: (id: string) => void;
  onDetail: () => void;
  loading: boolean;
}) {
  const { status } = server;
  
  if (status === "installing" || status === "updating") {
    return <span className="text-sm text-text-muted animate-pulse">⟳ {status}...</span>;
  }

  if (status === "installed") {
    return (
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onUpdate(server.definition.id)} 
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
        >
          Update
        </button>
        <button 
          onClick={() => onUninstall(server.definition.id)} 
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Uninstall
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onInstall(server.definition.id)} 
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
        >
          Retry
        </button>
        <button 
          onClick={onDetail}
          className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
        >
          Details
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => onInstall(server.definition.id)} 
        disabled={loading}
        className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Install
      </button>
      <button 
        onClick={onDetail}
        className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
      >
        Details
      </button>
    </div>
  );
}

function ServerDetailModal({ 
  server, 
  onClose, 
  onInstall, 
  onUninstall, 
  onUpdate,
  loading 
}: { 
  server: McpServerInstance;
  onClose: () => void;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onUpdate: (id: string) => void;
  loading: boolean;
}) {
  const t = useTranslations("mcpRegistry");
  const { definition, status, error, config, installedPath, lastUpdated } = server;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-bg rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{definition.icon || "📦"}</span>
            <div>
              <h2 className="text-lg font-semibold">{definition.name}</h2>
              <p className="text-sm text-text-muted">{definition.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            <p className="text-text-muted">{definition.description}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t("category")}: </span>
                <span className="font-medium">{CATEGORY_ICONS[definition.category]} {CATEGORY_LABELS[definition.category]}</span>
              </div>
              <div>
                <span className="text-text-muted">{t("version")}: </span>
                <span className="font-medium">{installedPath || definition.version}</span>
              </div>
              <div>
                <span className="text-text-muted">{t("status")}: </span>
                <StatusBadge status={status} t={t} />
              </div>
              <div>
                <span className="text-text-muted">{t("type")}: </span>
                <span className="font-medium capitalize">{definition.official ? t("official") : t("community")}</span>
              </div>
              {lastUpdated && (
                <div>
                  <span className="text-text-muted">{t("lastUpdated")}: </span>
                  <span className="font-medium">{new Date(lastUpdated).toLocaleString()}</span>
                </div>
              )}
              {installedPath && (
                <div>
                  <span className="text-text-muted">{t("installPath")}: </span>
                  <span className="font-mono text-xs truncate block">{installedPath}</span>
                </div>
              )}
              {error && (
                <div className="col-span-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="text-text-muted">{t("error")}: </span>
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}
            </div>

            {definition.requiredEnv?.length && (
              <div>
                <h4 className="font-semibold mb-2">{t("requiredEnv")}</h4>
                <div className="flex flex-wrap gap-2">
                  {definition.requiredEnv.map(env => (
                    <Badge key={env} variant="default">{env}</Badge>
                  ))}
                </div>
              </div>
            )}

            {definition.optionalEnv?.length && (
              <div>
                <h4 className="font-semibold mb-2">{t("optionalEnv")}</h4>
                <div className="flex flex-wrap gap-2">
                  {definition.optionalEnv.map(env => (
                    <Badge key={env} variant="info">{env}</Badge>
                  ))}
                </div>
              </div>
            )}

            {definition.tags?.length && (
              <div>
                <h4 className="font-semibold mb-2">{t("tags")}</h4>
                <div className="flex flex-wrap gap-2">
                  {definition.tags.map(tag => (
                    <Badge key={tag} variant="default">#{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {definition.docsUrl && (
              <a href={definition.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                {t("viewDocs")}
              </a>
            )}
            {definition.repoUrl && (
              <a href={definition.repoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline ml-4">
                {t("viewRepo")}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          {status === "installed" && (
            <>
              <button 
                onClick={() => { onUpdate(definition.id); onClose(); }} 
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
              >
                {t("update")}
              </button>
              <button 
                onClick={() => { onUninstall(definition.id); onClose(); }} 
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                {t("uninstall")}
              </button>
            </>
          )}
          {status === "not-installed" && (
            <button 
              onClick={() => { onInstall(definition.id); onClose(); }} 
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("install")}
            </button>
          )}
          {status === "error" && (
            <button 
              onClick={() => { onInstall(definition.id); onClose(); }} 
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              {t("retry")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text">{value}</p>
        </div>
      </div>
    </Card>
  );
}