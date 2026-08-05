"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Toggle } from "@/shared/components";

type TaskRoutingConfig = {
  enabled: boolean;
  detectionEnabled: boolean;
  taskModelMap: Record<string, string>;
};

type SmartFeature = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  whenEnabled: string;
  notAffected: string;
  endpoint: string;
  bodyKey: string;
};

export default function SmartNotificationsCard() {
  const [features, setFeatures] = useState<SmartFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/task-routing", { cache: "no-store" });
      if (!res.ok) throw new Error("failed to load task-routing");
      const taskRouting: TaskRoutingConfig = await res.json();
      setFeatures([
        {
          id: "task-routing",
          name: "Task-Aware Smart Routing",
          description:
            "Automatically detect images, coding, analysis, and summarization requests and route them to the best model intent.",
          enabled: taskRouting.enabled,
          whenEnabled:
            "Image uploads route to auto/vision, coding to auto/coding, analysis to auto/reasoning, and background traffic to a cheap chat model.",
          notAffected:
            "Plain chat and creative writing keep their requested model; only coding, reasoning, vision, and utility traffic are overridden.",
          endpoint: "/api/settings/task-routing",
          bodyKey: "enabled",
        },
      ]);
    } catch (e) {
      console.error("[SmartNotifications] load failed:", e);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (feature: SmartFeature) => {
      setBusy(feature.id);
      try {
        const res = await fetch(feature.endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [feature.bodyKey]: !feature.enabled }),
        });
        if (!res.ok) throw new Error("toggle failed");
        await load();
      } catch (e) {
        console.error("[SmartNotifications] toggle failed:", e);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  if (loading || !features || features.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            notifications
          </span>
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Smart Notifications</h3>
          <p className="text-xs text-text-muted">
            Features that affect routing and request handling
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={`rounded-lg border p-3 ${
              feature.enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50"
            }`}
          >
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base">{feature.name}</p>
                <p className="text-xs sm:text-sm text-text-muted">{feature.description}</p>
              </div>
              <Toggle
                checked={feature.enabled}
                disabled={busy === feature.id}
                onChange={() => toggle(feature)}
              />
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-emerald-500 font-medium">
                When enabled:{" "}
                <span className="text-text-muted font-normal">{feature.whenEnabled}</span>
              </p>
              <p className="text-amber-500 font-medium">
                Not affected:{" "}
                <span className="text-text-muted font-normal">{feature.notAffected}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
