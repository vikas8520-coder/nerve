"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Button, Input } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [setupComplete, setSetupComplete] = useState(null);
  const [oidcEnabled, setOidcEnabled] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [nodeVersion, setNodeVersion] = useState(null);
  const [nodeCompatible, setNodeCompatible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/settings/require-login`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.nodeVersion) setNodeVersion(data.nodeVersion);
          if (data.nodeCompatible === false) setNodeCompatible(false);
          if (data.requireLogin === false) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setHasPassword(!!data.hasPassword);
          setSetupComplete(!!data.setupComplete);
          setOidcEnabled(!!data.oidcEnabled);
        } else {
          setHasPassword(true);
          setSetupComplete(true);
          setOidcEnabled(false);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setHasPassword(true);
        setSetupComplete(true);
        setOidcEnabled(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("nerve_login_time", String(Date.now()));
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        // (#521) If no password is set, redirect to onboarding instead of showing an error
        if (data.needsSetup) {
          router.push("/dashboard/onboarding");
          return;
        }
        setError(data.error || t("invalidPassword"));
      }
    } catch (err) {
      setError(t("errorOccurredRetry"));
    } finally {
      setLoading(false);
    }
  };

  const nodeWarningBanner =
    !nodeCompatible && nodeVersion ? (
      <div className="w-full max-w-lg mx-auto mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="bg-red-950/60 border-2 border-red-500/40 rounded-2xl p-6 shadow-lg shadow-red-900/20 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-red-400 text-[28px]">error</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-red-300 mb-1">
                {t("nodeIncompatibleTitle")}
              </h3>
              <p className="text-sm text-red-200/80 leading-relaxed mb-3">
                {t("nodeIncompatibleDesc", { version: nodeVersion })}
              </p>
              <div className="bg-black/40 rounded-lg px-4 py-3 font-mono text-sm border border-red-500/20">
                <div className="flex items-center gap-2 text-red-300/60 mb-1">
                  <span className="material-symbols-outlined text-[14px]">terminal</span>
                  <span className="text-xs">{t("nodeIncompatibleFixLabel")}</span>
                </div>
                <code className="text-amber-300">nvm install 22 && nvm use 22</code>
              </div>
              <p className="text-xs text-red-300/50 mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">info</span>
                {t("nodeIncompatibleHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  if (hasPassword === null || setupComplete === null || oidcEnabled === null) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
        {/* Animated Background - Video */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0B0E14]">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            autoPlay
            loop
            muted
            playsInline
            src="/landing/nerve-background.mp4"
            aria-hidden="true"
          />
          {/* Subtle center glow enhancement */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FF9F]/5 rounded-full blur-[200px] pointer-events-none"></div>
        </div>
        {nodeWarningBanner}
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span className="text-sm text-text-muted">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (!hasPassword && !setupComplete) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
        {/* Animated Background - Video + Grid overlay */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0B0E14]">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            autoPlay
            loop
            muted
            playsInline
            src="/landing/nerve-background.mp4"
            aria-hidden="true"
          />
          {/* Subtle center glow enhancement */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FF9F]/5 rounded-full blur-[200px] pointer-events-none"></div>
        </div>
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} z-10`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 mb-6">
              <span className="material-symbols-outlined text-primary text-[40px]">
                rocket_launch
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">{t("welcome")}</h1>
            <p className="text-text-muted mt-2">{t("configureInstance")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("runOnboardingWizard")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("startOnboarding")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">Nerve — {t("unifiedProxy")}</p>
        </div>
      </div>
    );
  }

  if (!hasPassword && setupComplete) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
        {/* Animated Background - Video + Grid overlay */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0B0E14]">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            autoPlay
            loop
            muted
            playsInline
            src="/landing/nerve-background.mp4"
            aria-hidden="true"
          />
          {/* Subtle center glow enhancement */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FF9F]/5 rounded-full blur-[200px] pointer-events-none"></div>
        </div>
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} z-10`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/10 mb-6">
              <span className="material-symbols-outlined text-amber-500 text-[40px]">
                shield_person
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">
              {t("secureYourInstance")}
            </h1>
            <p className="text-text-muted mt-2">{t("passwordNotEnabled")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("setPasswordDescription")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("configurePassword")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">
            Nerve — {t("unifiedAiApiProxy")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Animated Background - Video */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0B0E14]">
        {/* Video background - green verve threads converging to center */}
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-50"
          autoPlay
          loop
          muted
          playsInline
          src="/landing/nerve-background.mp4"
          aria-hidden="true"
        />
        {/* Subtle center glow enhancement */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FF9F]/5 rounded-full blur-[200px] pointer-events-none"></div>
        {/* Subtle grid pattern overlay for depth */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00FF9F/5_1px,transparent_1px),linear-gradient(to_bottom,#00FF9F/5_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"></div>
      </div>

      {nodeWarningBanner && (
        <div className="flex justify-center pt-6 px-6 z-10">{nodeWarningBanner}</div>
      )}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} z-10`}
        >
          {/* Logo & Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-hover mb-6 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-[28px]">hub</span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight mb-2">{t("signIn")}</h1>
            <p className="text-text-muted">{t("enterPassword")}</p>
          </div>

          {/* Login Card */}
          <div className="bg-surface/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/30">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-main flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-text-muted text-base">lock</span>
                  {t("password")}
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder={t("enterPassword")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="h-12 pl-10 pr-4 text-base"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/60">
                    <span className="material-symbols-outlined text-base">key</span>
                  </span>
                </div>
                {error && (
                  <p className="text-sm text-red-500 flex items-center gap-1.5 pt-1 animate-in shake-in">
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                  </p>
                )}
                <p className="text-xs text-text-muted/60 pt-0.5 flex items-center gap-1.5 justify-center">
                  <span className="material-symbols-outlined text-[12px]">info</span>
                  {t("defaultPasswordHint")}
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-12 text-base font-medium rounded-xl"
                loading={loading}
              >
                {t("continue")}
              </Button>
            </form>

            {oidcEnabled && (
              <div className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-12 text-base font-medium rounded-xl"
                  onClick={() => (window.location.href = "/api/auth/oidc/login")}
                >
                  <span className="material-symbols-outlined mr-2">account_circle</span>
                  {t("continueWithOidc") || "Continue with OIDC"}
                </Button>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border/50">
              <a
                href="/forgot-password"
                className="block text-center text-sm text-text-muted hover:text-primary transition-colors"
              >
                {t("forgotPassword")}
              </a>
            </div>
          </div>

          {/* Feature highlights below the card - compact */}
          <div className="mt-8 hidden sm:block">
            <p className="text-center text-xs text-text-muted/60 mb-4 uppercase tracking-wider">
              {t("unifiedAiApiProxy")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: "swap_horiz",
                  title: t("featureMultiProviderTitle"),
                  short: "290+ Providers",
                },
                { icon: "speed", title: t("featureLoadBalancingTitle"), short: "Smart Routing" },
                {
                  icon: "analytics",
                  title: t("featureUsageTrackingTitle"),
                  short: "Usage Tracking",
                },
              ].map((item) => (
                <div
                  key={item.icon}
                  className="p-3 rounded-xl bg-surface/60 backdrop-blur-sm border border-border/30 text-center hover:border-primary/30 transition-colors group"
                  title={item.title}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      {item.icon}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-text-main truncate">{item.short}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/50 mt-8">
            Nerve — Unified AI API Proxy
          </p>
        </div>
      </div>
    </div>
  );
}
