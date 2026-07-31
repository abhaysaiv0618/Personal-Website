import type { Metadata } from "next";
import SectionContent from "@/components/content/SectionContent";
import SceneRoot from "@/components/system/SceneRoot";

export const metadata: Metadata = {
  title: "Abhaysai Vemula — Explore",
  description:
    "Explore Abhaysai Vemula's portfolio as a solar system: six worlds covering experience, education, projects and more.",
};

export default function SystemPage() {
  // This route stays a server component so SectionContent renders on the
  // server. SceneRoot exists purely to hold the `ssr: false` boundary the
  // WebGL canvas needs — putting that boundary here instead would take the
  // content down with it, which is the bug being fixed.
  return (
    <>
      <SceneRoot />
      <SectionContent />
    </>
  );
}
