import { Metadata } from "next";
import { redirect } from "next/navigation";
import PersonalizedDashboard from "./PersonalizedDashboard";

export const metadata: Metadata = {
  title: "Personalized Dashboard | Nerve",
  description: "Your personalized AI usage dashboard",
};

export default async function PersonalizedPage() {
  return <PersonalizedDashboard />;
}