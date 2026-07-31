/**
 * /dashboard/chaos/page.tsx — Chaos Mode Configuration
 */
import ChaosConfigPageClient from "./ChaosConfigPageClient";

export const metadata = {
  title: "Chaos Mode — Nerve",
};

export default function Page() {
  return <ChaosConfigPageClient />;
}
