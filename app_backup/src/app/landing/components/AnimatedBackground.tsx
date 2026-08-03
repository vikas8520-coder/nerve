"use client";
import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulse: number;
  pulseSpeed: number;
};

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let nodes: Node[] = [];
    const maxDist = 140;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Re-seed nodes based on screen size — roughly one node per 18000 px²
      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 18000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.8,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.008,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update node positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += node.pulseSpeed;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      }

      // Draw connecting lines (glow)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const opacity = (1 - dist / maxDist) * 0.15;
            ctx.strokeStyle = `rgba(0, 255, 159, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes (small circles that flicker)
      for (const node of nodes) {
        const flicker = (Math.sin(node.pulse) + 1) / 2; // 0..1
        const opacity = 0.3 + flicker * 0.4;
        ctx.fillStyle = `rgba(0, 255, 159, ${opacity})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow on bright pulses
        if (flicker > 0.7) {
          ctx.fillStyle = `rgba(0, 255, 159, ${(flicker - 0.7) * 0.2})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(to right, #00FF9F 1px, transparent 1px), linear-gradient(to bottom, #00FF9F 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Neural network canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-50" />

        {/* Animated gradient orbs */}
        <div className="absolute -top-20 left-1/4 w-[600px] h-[600px] bg-[#00FF9F]/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px] animate-blob-delayed-1" />
        <div className="absolute -bottom-20 left-1/2 w-[550px] h-[550px] bg-blue-500/12 rounded-full blur-[120px] animate-blob-delayed-2" />

        {/* Vignette effect */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, transparent 0%, rgba(11, 14, 20, 0.4) 100%)",
          }}
        />
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
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
        .animate-blob-delayed-1 {
          animation: blob 22s ease-in-out 2s infinite;
        }
        .animate-blob-delayed-2 {
          animation: blob 25s ease-in-out 4s infinite;
        }
      `}</style>
    </>
  );
}
