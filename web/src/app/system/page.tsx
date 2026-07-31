import type { Metadata } from "next";
import SceneRoot from "@/components/system/SceneRoot";

export const metadata: Metadata = {
  title: "Abhaysai Vemula — Explore",
  description:
    "Explore Abhaysai Vemula's portfolio as a solar system: six worlds covering experience, education, projects and more.",
};

export default function SystemPage() {
  return <SceneRoot />;
}
