export type ServerLifecyclePhase = "starting" | "ready" | "stopping";

declare global {
  var __nerveServerLifecycle: ServerLifecyclePhase | undefined;
}

export function getServerLifecyclePhase(): ServerLifecyclePhase {
  return globalThis.__nerveServerLifecycle ?? "starting";
}

export function markServerStarting(): void {
  globalThis.__nerveServerLifecycle = "starting";
}

export function markServerReady(): void {
  if (getServerLifecyclePhase() !== "stopping") {
    globalThis.__nerveServerLifecycle = "ready";
  }
}

export function markServerStopping(): void {
  globalThis.__nerveServerLifecycle = "stopping";
}
