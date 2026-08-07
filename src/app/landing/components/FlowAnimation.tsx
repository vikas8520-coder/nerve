"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import ProviderIcon from "@/shared/components/ProviderIcon";

export default function FlowAnimation() {
  const t = useTranslations("landing");
  const [activeFlow, setActiveFlow] = useState(0);

  const cliTools = [
    { id: "codex", name: t("flowToolOpenAICodex") },
    { id: "cline", name: t("flowToolCline") },
    { id: "hermes-agent", name: t("flowToolHermesAgent") },
    { id: "opencode", name: t("flowToolOpenCode") },
  ];

  const providers = [
    {
      id: "openai",
      name: t("flowProviderOpenAI"),
      color: "bg-emerald-500",
      textColor: "text-white",
    },
    {
      id: "anthropic",
      name: t("flowProviderAnthropic"),
      color: "bg-orange-400",
      textColor: "text-white",
    },
    {
      id: "gemini",
      name: t("flowProviderGemini"),
      color: "bg-blue-500",
      textColor: "text-white",
    },
    {
      id: "copilot",
      name: t("flowProviderGithubCopilot"),
      color: "bg-gray-700",
      textColor: "text-white",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFlow((prev) => (prev + 1) % providers.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [providers.length]);

  return (
    <div className="mt-16 w-full max-w-4xl overflow-x-hidden px-2">
      <div className="relative h-[360px] hidden md:flex items-center justify-center animate-[float_6s_ease-in-out_infinite]">
        {/* Nerve Hub - Center */}
        <div className="relative z-20 w-32 h-32 rounded-full bg-[#111520] border-2 border-[#00FF9F] shadow-[0_0_40px_rgba(0, 255, 159,0.3)] flex flex-col items-center justify-center gap-1 group cursor-pointer hover:scale-105 transition-transform duration-500">
          <span className="material-symbols-outlined text-4xl text-[#00FF9F]" aria-hidden="true">
            hub
          </span>
          <span className="text-xs font-bold text-white tracking-widest uppercase">
            {t("brandName")}
          </span>
          <div className="absolute inset-0 rounded-full border border-[#00FF9F]/30 animate-ping opacity-20"></div>
        </div>

        {/* CLI Tools - Left side */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-8">
          {cliTools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity group"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#111520] border border-[#2D333B] flex items-center justify-center p-3 hover:border-[#00FF9F]/50 transition-all hover:scale-105">
                <ProviderIcon providerId={tool.id} size={42} type="color" />
              </div>
            </div>
          ))}
        </div>

        {/* SVG Lines from CLI to Nerve */}
        <svg
          className="absolute inset-0 w-full h-full z-10 pointer-events-none stroke-yellow-700"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="animate-[dash_2s_linear_infinite]"
            d="M 60 60 C 250 60, 250 180, 360 180"
            fill="none"
            strokeDasharray="5,5"
            strokeWidth="2"
          ></path>
          <path
            className="animate-[dash_2s_linear_infinite]"
            d="M 60 140 C 250 140, 250 180, 360 180"
            fill="none"
            strokeDasharray="5,5"
            strokeWidth="2"
          ></path>
          <path
            className="animate-[dash_2s_linear_infinite]"
            d="M 60 220 C 250 220, 250 180, 360 180"
            fill="none"
            strokeDasharray="5,5"
            strokeWidth="2"
          ></path>
          <path
            className="animate-[dash_2s_linear_infinite]"
            d="M 60 300 C 250 300, 250 180, 360 180"
            fill="none"
            strokeDasharray="5,5"
            strokeWidth="2"
          ></path>
        </svg>

        {/* SVG Lines from Nerve to Providers */}
        <svg
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 440 180 C 550 180, 550 50, 740 50"
            fill="none"
            stroke={activeFlow === 0 ? "#00FF9F" : "rgb(75, 85, 99)"}
            strokeWidth={activeFlow === 0 ? "3" : "2"}
            className={activeFlow === 0 ? "animate-pulse" : ""}
          ></path>
          <path
            d="M 440 180 C 550 180, 550 130, 740 130"
            fill="none"
            stroke={activeFlow === 1 ? "#00FF9F" : "rgb(75, 85, 99)"}
            strokeWidth={activeFlow === 1 ? "3" : "2"}
            className={activeFlow === 1 ? "animate-pulse" : ""}
          ></path>
          <path
            d="M 440 180 C 550 180, 550 230, 740 230"
            fill="none"
            stroke={activeFlow === 2 ? "#00FF9F" : "rgb(75, 85, 99)"}
            strokeWidth={activeFlow === 2 ? "3" : "2"}
            className={activeFlow === 2 ? "animate-pulse" : ""}
          ></path>
          <path
            d="M 440 180 C 550 180, 550 310, 740 310"
            fill="none"
            stroke={activeFlow === 3 ? "#00FF9F" : "rgb(75, 85, 99)"}
            strokeWidth={activeFlow === 3 ? "3" : "2"}
            className={activeFlow === 3 ? "animate-pulse" : ""}
          ></path>
        </svg>

        {/* AI Providers - Right side */}
        <div className="absolute right-4 top-0 bottom-0 flex flex-col justify-between py-6">
          {providers.map((provider, idx) => (
            <div
              key={provider.id}
              className={`flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity group ${activeFlow === idx ? "ring-4 ring-[#00FF9F]/50 scale-110" : ""}`}
              title={provider.name}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#111520] border border-[#2D333B] flex items-center justify-center p-3 hover:border-[#00FF9F]/50 transition-all hover:scale-105">
                <ProviderIcon providerId={provider.id} size={42} type="color" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden mt-8 w-full p-4 rounded-lg bg-[#111520] border border-[#2D333B]">
        <p className="text-sm text-center text-gray-400">{t("interactiveDiagram")}</p>
      </div>
    </div>
  );
}
