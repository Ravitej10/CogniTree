import { Link } from "react-router-dom";
import TreeMotif from "../components/TreeMotif";

export default function NotFoundPage() {
  return (
    <div
      className="font-body flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "#F7F8F4", color: "#14231C" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>
      <div className="w-full max-w-[180px] opacity-80">
        <TreeMotif className="w-full" animate={true} />
      </div>
      <h1 className="font-display mt-6 text-3xl font-semibold tracking-tight">
        This branch doesn't exist.
      </h1>
      <p className="mt-2 max-w-sm text-sm" style={{ color: "#8B9A8C" }}>
        The page you're looking for isn't part of the tree yet.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: "#2F6B4F" }}
      >
        Back to home
      </Link>
    </div>
  );
}
