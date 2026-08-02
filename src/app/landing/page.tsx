"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage() {
  const t = useTranslations("landing");
  const router = useRouter();
  return (
    <div className="relative text-white font-sans overflow-x-hidden antialiased selection:bg-[#00FF9F] selection:text-white">
      {/* Animated Background - Video */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0B0E14]">
        {/* Video background - green verve threads converging to center */}
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-60"
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

      <div className="relative z-10">
        <Navigation />

        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
            <HeroSection />
            <div className="flex justify-center pb-20">
              <FlowAnimation />
            </div>
          </div>

          <GetStarted />
          <HowItWorks />
          <Features />

          {/* CTA Section */}
          <section className="py-24 sm:py-32 px-4 sm:px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-t from-[#00FF9F]/5 to-transparent pointer-events-none"></div>
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 break-words">
                {t("ctaTitle")}
              </h2>
              <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto break-words">
                {t("ctaDescription")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full sm:w-auto h-14 px-10 rounded-lg bg-[#00FF9F] hover:bg-[#00CC7F] text-white text-lg font-bold transition-all shadow-[0_0_20px_rgba(0, 255, 159,0.5)]"
                >
                  {t("startFree")}
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full sm:w-auto h-14 px-10 rounded-lg border border-[#2D333B] hover:bg-[#111520] text-white text-lg font-bold transition-all"
                >
                  {t("readDocumentation")}
                </button>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      {/* Global styles for keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes blob {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
