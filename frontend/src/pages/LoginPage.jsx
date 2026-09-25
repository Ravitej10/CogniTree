import { useState } from "react";
import TreeMotif from "../components/TreeMotif";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const stored = localStorage.getItem("mock_user");
      if (!stored) {
        setError("No account found. Try signing up first.");
        return;
      }

      localStorage.setItem("access_token", "mock-demo-token-cognitree");
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2" style={{ background: "#F7F8F4", color: "#14231C" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .ct-input:focus-visible { outline: 2px solid #2F6B4F; outline-offset: 2px; }
      `}</style>

      <div className="relative hidden flex-col justify-between overflow-hidden px-12 py-10 md:flex select-none" style={{ background: "#14231C", color: "#F7F8F4" }}>
        <a href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(47, 107, 79, 0.4)", border: "1px solid rgba(139, 154, 140, 0.3)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="3" fill="#2F6B4F" />
              <circle cx="6" cy="18" r="2.5" fill="#E2A73E" />
              <circle cx="18" cy="18" r="2.5" fill="#2F6B4F" />
              <path d="M12 9V13M12 13L6 15.5M12 13L18 15.5" stroke="#8B9A8C" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">CogniTree</span>
        </a>

        <div className="my-auto mx-auto w-full max-w-xs opacity-90">
          <TreeMotif className="w-full" animate={true} />
        </div>

        <blockquote className="font-display max-w-sm text-2xl font-medium leading-snug">
          Pick up exactly where
          <br />
          your last gap was.
        </blockquote>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between md:hidden">
            <a href="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold">CogniTree</span>
            </a>
            <a href="/" className="text-xs font-medium text-[#2F6B4F]">← Home</a>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Welcome back</h1>
          <p className="font-body mt-2 text-sm text-[#8B9A8C]">
            Log in to see your current map of strengths and gaps.
          </p>

          <form onSubmit={handleSubmit} className="font-body mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-[#14231C]">
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={updateField}
                placeholder="you@school.edu"
                disabled={loading}
                className="ct-input rounded-xl border bg-white px-4 py-2.5 text-sm"
                style={{ borderColor: "#D8DED4", color: "#14231C" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-[#14231C]">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={updateField}
                placeholder="Your password"
                disabled={loading}
                className="ct-input rounded-xl border bg-white px-4 py-2.5 text-sm"
                style={{ borderColor: "#D8DED4", color: "#14231C" }}
              />
            </div>

            {error && (
              <div role="alert" className="mt-2 flex items-start gap-2.5 rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] p-3 text-xs font-medium text-[#991B1B]">
                <svg className="h-4 w-4 shrink-0 text-[#B3491F] mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-3 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#2F6B4F" }}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="font-body mt-8 text-center text-sm text-[#8B9A8C]">
            Don't have an account?{" "}
            <a href="/signup" className="font-semibold text-[#14231C] underline decoration-[#D8DED4] underline-offset-4 hover:decoration-[#2F6B4F]">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
