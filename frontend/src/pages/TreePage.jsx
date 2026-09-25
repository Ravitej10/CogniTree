import { Link } from "react-router-dom";
import TopicTree from "../components/TopicTree";

export default function TreePage() {
  return (
    <div className="min-h-screen font-body" style={{ background: "#F7F8F4", color: "#14231C" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      <header className="sticky top-0 z-20 border-b" style={{ borderColor: "#D8DED4", background: "#F7F8F4CC", backdropFilter: "blur(6px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="3" fill="#2F6B4F" />
              <circle cx="6" cy="18" r="2.5" fill="#E2A73E" />
              <circle cx="18" cy="18" r="2.5" fill="#2F6B4F" />
              <path d="M12 9V13M12 13L6 15.5M12 13L18 15.5" stroke="#8B9A8C" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight">CogniTree</span>
          </Link>
          <Link
            to="/dashboard"
            className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:opacity-70"
            style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
          Full map
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your knowledge tree</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "#3D4A40" }}>
          Every subject branches into topics, and every topic into the individual sub-topics you've
          been tested on. Click a node to expand it and see where you stand.
        </p>

        <div className="mt-10">
          <TopicTree />
        </div>
      </main>
    </div>
  );
}
