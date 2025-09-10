import GraphNav from "@/components/graph/GraphNav";

export default function Home() {
  return (
    <section className="purple-space min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Welcome to My Portfolio
        </h1>
        <p className="text-lg md:text-xl text-purple-200 max-w-2xl mx-auto">
          Explore my journey through an interactive navigation experience
        </p>
      </div>

      <GraphNav />
    </section>
  );
}
