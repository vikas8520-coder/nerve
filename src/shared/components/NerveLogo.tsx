/**
 * NerveLogo — renders the official Nerve neuron logo.
 * Uses the approved master asset; never recreates the logo with SVG/CSS.
 *
 * Props:
 *   size    — width & height in px (default 32)
 *   className — extra classes on the <img>
 *   fill    — fill the container (default true)
 */
import Image from "next/image";

type NerveLogoProps = {
  size?: number;
  className?: string;
  fill?: boolean;
};

export default function NerveLogo({ size = 32, className = "", fill = true }: NerveLogoProps) {
  // Use the clean version with transparent background
  const srcSize = size <= 32 ? "logo-128.png" : size <= 64 ? "logo-256.png" : "logo-512.png";
  const imgClass = fill ? "w-full h-full object-contain" : "";

  return (
    <Image
      src={`/brand/${srcSize}`}
      alt="Nerve"
      width={size}
      height={size}
      className={`${imgClass} ${className}`.trim()}
      draggable={false}
    />
  );
}
