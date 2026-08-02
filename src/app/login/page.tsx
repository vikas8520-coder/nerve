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
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#05080D]">
        {/* Video background - emerald neural threads */}
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          autoPlay
          loop
          muted
          playsInline
          src="/landing/nerve-background.mp4"
          aria-hidden="true"
        />
        {/* Radial gradient center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[radial-gradient(ellipse_at_center,#00FF9F/15_0%,#00FF9F/5_40%,transparent_70%)] rounded-full blur-[300px] pointer-events-none"></div>
        {/* Diagonal mesh gradient overlay */}
        <div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,#00FF9F/3_0deg,transparent_120deg,#00FF9F/2_240deg,transparent_360deg)] pointer-events-none"></div>
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#00FF9F]/10 blur-sm"
              style={{
                width: `${8 + ((i * 3) % 20)}px`,
                height: `${8 + ((i * 3) % 20)}px`,
                top: `${10 + ((i * 7) % 80)}%`,
                left: `${5 + ((i * 11) % 90)}%`,
                animation: `float ${15 + ((i * 2) % 10)}s ease-in-out infinite`,
                animationDelay: `${(i * 1.3) % 5}s`,
              }}
            />
          ))}
        </div>
        <style jsx>{`
          @keyframes float {
            0%,
            100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.3;
            }
            25% {
              transform: translate(30px, -20px) scale(1.2);
              opacity: 0.6;
            }
            50% {
              transform: translate(-20px, 30px) scale(0.8);
              opacity: 0.4;
            }
            75% {
              transform: translate(25px, 25px) scale(1.1);
              opacity: 0.5;
            }
          }
        `}</style>
      </div>

      {nodeWarningBanner && (
        <div className="flex justify-center pt-6 px-6 z-10">{nodeWarningBanner}</div>
      )}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className={`w-full max-w-md transition-all duration-800 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} z-10`}
        >
          {/* Nerve Brand Mark - distinctive neural node */}
          <div className="text-center mb-10 relative">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#00FF9F]/30 to-[#00FF9F]/5 blur-xl animate-pulse"></div>
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A0F1A] to-[#0D1420] border border-[#00FF9F]/30 flex items-center justify-center shadow-[0_0_40px_#00FF9F/10]">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    stroke="#00FF9F"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeDashoffset="0"
                  >
                    <animate
                      attributeName="strokeDashoffset"
                      from="75"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <path
                    d="M16 8V24M8 16H24"
                    stroke="#00FF9F"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.8;1;0.8"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </path>
                  <circle cx="16" cy="16" r="4" fill="#00FF9F" opacity="0.9">
                    <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="0.9;1;0.9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-text-main tracking-tight mb-2 bg-gradient-to-r from-white via-[#00FF9F] to-white bg-clip-text text-transparent animate-in fade-in duration-700">
              {t("signIn")}
            </h1>
            <p className="text-text-muted/80 text-lg animate-in fade-in duration-700 delay-100">
              {t("enterPassword")}
            </p>
          </div>

          {/* Login Card - Distinctive glassmorphism with animated border */}
          <div className="relative">
            {/* Animated border ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#00FF9F]/40 via-transparent to-[#00FF9F]/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 animate-border-glow"></div>
            <style jsx>{`
              @keyframes border-glow {
                0%,
                100% {
                  background-position: 0% 50%;
                }
                50% {
                  background-position: 100% 50%;
                }
              }
              .animate-border-glow {
                background-size: 200% 200%;
                animation: border-glow 3s ease-in-out infinite;
              }
            `}</style>

            <div className="relative bg-[#0A0F1A]/90 backdrop-blur-2xl border border-[#00FF9F]/20 rounded-3xl p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,255,159,0.05),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-main flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-lg bg-[#00FF9F]/10 text-[#00FF9F]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    {t("password")}
                  </label>
                  <div className="relative group">
                    <Input
                      type="password"
                      placeholder={t("enterPassword")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="h-13 pl-12 pr-4 text-base bg-[#05080D]/80 border border-[#00FF9F]/10 rounded-xl focus:border-[#00FF9F]/50 focus:ring-1 focus:ring-[#00FF9F]/20 transition-all duration-300 placeholder:text-text-muted/40"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40 group-focus-within:text-[#00FF9F]/60 transition-colors">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    {/* Focus indicator line */}
                    <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-[#00FF9F] rounded-full transition-all duration-300 group-focus-within:w-full group-focus-within:left-0"></div>
                  </div>
                  {error && (
                    <p className="text-sm text-red-400/90 flex items-center gap-2 pt-1 animate-in slide-in-from-left duration-300">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </span>
                      {error}
                    </p>
                  )}
                  <p className="text-xs text-text-muted/50 pt-0.5 flex items-center gap-1.5 justify-center">
                    <span className="w-4 h-4 flex items-center justify-center rounded-lg bg-[#00FF9F]/10 text-[#00FF9F]/70">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                    </span>
                    {t("defaultPasswordHint")}
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-[#00FF9F] to-[#00CC7F] hover:from-[#00CC7F] hover:to-[#00FF9F] text-[#05080D] shadow-[0_4px_20px_rgba(0,255,159,0.3)] hover:shadow-[0_8px_30px_rgba(0,255,159,0.4)] transition-all duration-300 relative overflow-hidden"
                  loading={loading}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {t("continue")}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00FF9F]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Button>
              </form>

              {oidcEnabled && (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full h-13 text-base font-semibold rounded-xl bg-[#0A0F1A]/80 border border-[#00FF9F]/20 hover:border-[#00FF9F]/40 hover:bg-[#00FF9F]/5 text-text-main transition-all duration-300"
                    onClick={() => (window.location.href = "/api/auth/oidc/login")}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      {t("continueWithOidc") || "Continue with OIDC"}
                    </span>
                  </Button>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-[#00FF9F]/10">
                <a
                  href="/forgot-password"
                  className="block text-center text-sm text-text-muted/70 hover:text-[#00FF9F] transition-colors duration-300 relative"
                >
                  {t("forgotPassword")}
                  <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-[#00FF9F] transition-all duration-300 hover:w-full hover:left-0"></span>
                </a>
              </div>
            </div>
          </div>

          {/* Capability badges - Neural network style */}
          <div className="mt-10 hidden sm:block animate-in fade-in duration-800 delay-300">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#00FF9F]/40 to-transparent"></div>
              <span className="text-xs text-text-muted/50 uppercase tracking-widest font-mono">
                Nerve Network
              </span>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#00FF9F]/40 to-transparent"></div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: "nodes", label: "290+ Models", desc: t("featureMultiProviderTitle") },
                { icon: "route", label: "Smart Route", desc: t("featureLoadBalancingTitle") },
                { icon: "monitor", label: "Live Metrics", desc: t("featureUsageTrackingTitle") },
              ].map((item) => (
                <button
                  key={item.icon}
                  className="group relative p-3.5 rounded-2xl bg-[#0A0F1A]/80 backdrop-blur-xl border border-[#00FF9F]/10 hover:border-[#00FF9F]/30 hover:bg-[#00FF9F]/5 text-center transition-all duration-400 overflow-hidden"
                  title={item.desc}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#00FF9F]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400"></div>
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#00FF9F]/20 to-[#00FF9F]/5 mx-auto mb-2.5 flex items-center justify-center group-hover:scale-110 transition-transform duration-400">
                    {item.icon === "nodes" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00FF9F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="12" cy="18" r="3" />
                        <path d="M6 9v3M18 9v3M12 15v-3" />
                        <path d="M9 6h6M6 12h12" />
                      </svg>
                    )}
                    {item.icon === "route" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00FF9F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 17 11 9 13 13 21 5" />
                        <path d="M21 5h-5v5" />
                        <circle cx="6" cy="18" r="3" opacity="0.5" />
                        <animate
                          attributeName="strokeDashoffset"
                          from="60"
                          to="0"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </svg>
                    )}
                    {item.icon === "monitor" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00FF9F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8" />
                        <path d="M12 17v4" />
                        <polyline points="4 9 8 5 16 13 20 9" strokeDasharray="4 2" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-text-main truncate relative">
                    {item.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/40 mt-10 font-mono tracking-wider">
            Nerve — Neural Routing Engine
          </p>
        </div>
      </div>
    </div>
  );
}
