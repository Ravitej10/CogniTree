import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TreeMotif from "../components/TreeMotif";

const TOPICS = [
  { name: "AVL Rotations", subject: "Data Structures", mastery: 82, status: "strong" },
  { name: "Banker's Algorithm", subject: "Operating Systems", mastery: 34, status: "gap" },
  { name: "Normalization (3NF)", subject: "Databases", mastery: 91, status: "strong" },
  { name: "TCP Congestion Control", subject: "Networks", mastery: 47, status: "gap" },
  { name: "Recursion & Backtracking", subject: "Data Structures", mastery: 76, status: "strong" },
  { name: "Deadlock Avoidance", subject: "Operating Systems", mastery: 28, status: "gap" },
];

export default function DashboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("mock_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("mock_user");
    window.location.href = "/login";
  }

  const gaps = TOPICS.filter((t) => t.status === "gap");
  const strong = TOPICS.filter((t) => t.status === "strong");

  return (
    <div className="min-h-screen font-body" style={{ background: "#F7F8F4", color: "#14231C" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
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
          <button
            onClick={handleLogout}
            className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:opacity-70"
            style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
              Your map
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back{user?.full_name ? `, ${user.full_name}` : ""}.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed" style={{ color: "#3D4A40" }}>
              {gaps.length} sub-topics need attention right now. Everything else is holding steady.
            </p>
          </div>
          <Link
            to="#"
            className="shrink-0 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "#2F6B4F" }}
          >
            Start a diagnostic quiz
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E2A73E" }} />
              <h2 className="font-display text-xl font-semibold">Diagnosed gaps</h2>
            </div>
            <div className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ background: "#D8DED4" }}>
              {gaps.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-4 p-5" style={{ background: "#FFFFFF" }}>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="font-mono mt-1 text-xs" style={{ color: "#8B9A8C" }}>{t.subject}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "#F0E7D6" }}>
                      <div className="h-full rounded-full" style={{ width: `${t.mastery}%`, background: "#E2A73E" }} />
                    </div>
                    <span className="font-mono text-xs" style={{ color: "#8B9A8C" }}>{t.mastery}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 mt-10 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2F6B4F" }} />
              <h2 className="font-display text-xl font-semibold">Mastered topics</h2>
            </div>
            <div className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ background: "#D8DED4" }}>
              {strong.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-4 p-5" style={{ background: "#FFFFFF" }}>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="font-mono mt-1 text-xs" style={{ color: "#8B9A8C" }}>{t.subject}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "#E3ECE6" }}>
                      <div className="h-full rounded-full" style={{ width: `${t.mastery}%`, background: "#2F6B4F" }} />
                    </div>
                    <span className="font-mono text-xs" style={{ color: "#8B9A8C" }}>{t.mastery}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-8" style={{ borderColor: "#D8DED4", background: "#FFFFFF" }}>
            <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
              Live tree
            </p>
            <div className="mx-auto mt-4 max-w-[260px]">
              <TreeMotif className="w-full" animate={true} />
            </div>
            <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: "#8B9A8C" }}>
              Gold nodes are your current gaps. Green nodes are holding.
            </p>
            <Link
              to="/tree"
              className="mt-6 flex items-center justify-center rounded-full border py-2.5 text-sm font-semibold transition hover:opacity-70"
              style={{ borderColor: "#D8DED4", color: "#14231C" }}
            >
              View full tree →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
