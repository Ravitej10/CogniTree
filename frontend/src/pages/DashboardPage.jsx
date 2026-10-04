import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import TreeMotif from "../components/TreeMotif";
import QuizModal from "../components/QuizModal";
import {
  apiGetMe,
  apiGetMyDocuments,
  apiUploadDocument,
  apiGetQuizHistory,
  apiGetStudentMastery,
  clearSession,
  getStoredUser,
} from "../api/client";

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(getStoredUser());
  const [documents, setDocuments] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [masteryData, setMasteryData] = useState({
    topics: [],
    total_assessed: 0,
    gaps_count: 0,
    strong_count: 0,
    average_mastery: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMastery, setLoadingMastery] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: "", text: "" });

  // Quiz modal state
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const profile = await apiGetMe();
        if (isMounted) setUser(profile);
      } catch (err) {
        // If not authenticated, redirect to login
        clearSession();
        navigate("/login");
        return;
      }

      try {
        const [docs, history, mastery] = await Promise.all([
          apiGetMyDocuments().catch(() => []),
          apiGetQuizHistory().catch(() => []),
          apiGetStudentMastery().catch(() => ({
            topics: [],
            total_assessed: 0,
            gaps_count: 0,
            strong_count: 0,
            average_mastery: 0,
          })),
        ]);
        if (isMounted) {
          setDocuments(docs || []);
          setQuizHistory(history || []);
          setMasteryData(
            mastery || {
              topics: [],
              total_assessed: 0,
              gaps_count: 0,
              strong_count: 0,
              average_mastery: 0,
            }
          );
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingMastery(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  async function handleFileUpload(event) {
    event.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadMsg({ type: "", text: "" });

    try {
      const res = await apiUploadDocument(selectedFile);
      setUploadMsg({
        type: "success",
        text: `"${res.filename}" processed successfully (${res.chunk_count} chunks indexed in ChromaDB)!`,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh documents list
      const refreshedDocs = await apiGetMyDocuments();
      setDocuments(refreshedDocs);
    } catch (err) {
      setUploadMsg({
        type: "error",
        text: err.message || "Failed to upload document. Please ensure it is a valid PDF.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleQuizCompleted() {
    try {
      const [updatedHistory, updatedMastery] = await Promise.all([
        apiGetQuizHistory().catch(() => []),
        apiGetStudentMastery().catch(() => null),
      ]);
      setQuizHistory(updatedHistory || []);
      if (updatedMastery) {
        setMasteryData(updatedMastery);
      }
    } catch (e) {
      console.error("Error refreshing dashboard after quiz:", e);
    }
  }

  const topics = masteryData.topics || [];
  const gaps = topics.filter((t) => t.status === "gap");
  const strong = topics.filter((t) => t.status === "strong");
  const totalAssessed = masteryData.total_assessed ?? topics.length;
  const avgMastery = masteryData.average_mastery ?? 0;

  return (
    <div className="min-h-screen font-body" style={{ background: "#F7F8F4", color: "#14231C" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Top Navigation */}
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
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-[#8B9A8C] hidden sm:inline">
              {user?.username ? `@${user.username}` : user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:opacity-70"
              style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Welcome & Actions */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
              Your Diagnostic Map
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back{user?.username ? `, ${user.username}` : ""}.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed" style={{ color: "#3D4A40" }}>
              {loadingMastery
                ? "Analyzing your diagnostic map..."
                : totalAssessed === 0
                ? "No diagnostic assessments completed yet. Take a quiz to pinpoint knowledge gaps."
                : gaps.length === 0
                ? `All ${totalAssessed} assessed sub-topics are currently at or above the 70% mastery threshold.`
                : `${gaps.length} sub-topic${gaps.length === 1 ? "" : "s"} currently identified below the 70% mastery threshold.`}
            </p>
          </div>

          <button
            onClick={() => setIsQuizOpen(true)}
            className="shrink-0 flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95"
            style={{ background: "#2F6B4F" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start a diagnostic quiz
          </button>
        </div>

        {/* Section 1: Ingestion Pipeline & Course Documents */}
        <div className="mt-10 rounded-2xl border p-6" style={{ borderColor: "#D8DED4", background: "#FFFFFF" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "#E8ECE5" }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2F6B4F" }} />
                <h2 className="font-display text-lg font-semibold">Course Material Grounding (Module 1)</h2>
              </div>
              <p className="text-xs text-[#8B9A8C] mt-1">
                Upload course PDFs, textbooks, or syllabus documents to ground question generation and RAG vector search.
              </p>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleFileUpload} className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                disabled={uploading}
                className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border file:border-[#D8DED4] file:text-xs file:font-semibold file:bg-[#F7F8F4] file:text-[#14231C] hover:file:bg-[#ECEEE9]"
              />
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#2F6B4F" }}
              >
                {uploading ? "Ingesting PDF..." : "Upload & Index"}
              </button>
            </form>
          </div>

          {/* Upload Status Alert */}
          {uploadMsg.text && (
            <div
              className={`mt-4 rounded-xl border p-3 text-xs flex items-center gap-2 ${
                uploadMsg.type === "success"
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
                  : "border-[#FCA5A5] bg-[#FDF2F2] text-[#991B1B]"
              }`}
            >
              <span>{uploadMsg.type === "success" ? "✓" : "⚠"}</span>
              <span>{uploadMsg.text}</span>
            </div>
          )}

          {/* Uploaded Documents List */}
          <div className="mt-4">
            <h3 className="font-mono text-xs uppercase tracking-wider text-[#8B9A8C] mb-2">
              Indexed Knowledge Sources ({documents.length})
            </h3>
            {documents.length === 0 ? (
              <p className="text-xs italic text-[#8B9A8C] py-2">
                No course documents uploaded yet. Choose a PDF above to extract and index into ChromaDB.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-xl border p-3.5"
                    style={{ borderColor: "#E8ECE5", background: "#F7F8F4" }}
                  >
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-[#2F6B4F] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-[#14231C] truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-[11px] font-mono text-[#8B9A8C] mt-0.5">
                          {doc.chunk_count} vector chunks
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#8B9A8C]">Status:</span>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${doc.status === "ready" ? "bg-[#10B981]/20 text-[#065F46]" : "bg-[#F59E0B]/20 text-[#92400E]"}`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Diagnosed Gaps & Live Tree */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E2A73E" }} />
                <h2 className="font-display text-xl font-semibold">Diagnosed Gaps (&lt; 70% Mastery)</h2>
              </div>
              {!loadingMastery && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#E2A73E]/15 text-[#92400E] font-medium">
                  {gaps.length}
                </span>
              )}
            </div>

            {loadingMastery ? (
              <div className="rounded-2xl border p-8 text-center bg-white" style={{ borderColor: "#D8DED4" }}>
                <p className="text-xs text-[#8B9A8C]">Loading diagnostic gaps...</p>
              </div>
            ) : gaps.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center bg-white" style={{ borderColor: "#D8DED4" }}>
                {totalAssessed === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-[#14231C]">No diagnostic assessments taken yet</p>
                    <p className="text-xs text-[#8B9A8C] mt-1 max-w-md mx-auto">
                      Complete a diagnostic quiz to identify which concepts fall below the 70% mastery threshold.
                    </p>
                    <button
                      onClick={() => setIsQuizOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-95"
                      style={{ background: "#2F6B4F" }}
                    >
                      Start Diagnostic Quiz
                    </button>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-sm font-semibold text-[#065F46]">✓ Zero Knowledge Gaps</p>
                    <p className="text-xs text-[#047857] mt-1">
                      Great work! All your assessed concepts have achieved &ge; 70% mastery.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ background: "#D8DED4" }}>
                {gaps.map((t) => (
                  <div key={t.name} className="flex items-center justify-between gap-4 p-5" style={{ background: "#FFFFFF" }}>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs" style={{ color: "#8B9A8C" }}>{t.subject}</span>
                        {t.total_questions !== undefined && (
                          <span className="text-[11px] font-mono text-[#8B9A8C]">
                            ({t.correct_questions}/{t.total_questions} correct)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "#F0E7D6" }}>
                        <div className="h-full rounded-full" style={{ width: `${t.mastery}%`, background: "#E2A73E" }} />
                      </div>
                      <span className="font-mono text-xs font-medium" style={{ color: "#E2A73E" }}>{t.mastery}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4 mt-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2F6B4F" }} />
                <h2 className="font-display text-xl font-semibold">Mastered Topics (Holding Strong)</h2>
              </div>
              {!loadingMastery && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#2F6B4F]/15 text-[#2F6B4F] font-medium">
                  {strong.length}
                </span>
              )}
            </div>

            {loadingMastery ? (
              <div className="rounded-2xl border p-8 text-center bg-white" style={{ borderColor: "#D8DED4" }}>
                <p className="text-xs text-[#8B9A8C]">Loading mastered concepts...</p>
              </div>
            ) : strong.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center bg-white" style={{ borderColor: "#D8DED4" }}>
                {totalAssessed === 0 ? (
                  <p className="text-xs text-[#8B9A8C]">
                    Topics with &ge; 70% mastery will appear here as you complete assessments.
                  </p>
                ) : (
                  <p className="text-xs text-[#92400E]">
                    No topics have crossed the 70% threshold yet. Focus on gap remediation!
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ background: "#D8DED4" }}>
                {strong.map((t) => (
                  <div key={t.name} className="flex items-center justify-between gap-4 p-5" style={{ background: "#FFFFFF" }}>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs" style={{ color: "#8B9A8C" }}>{t.subject}</span>
                        {t.total_questions !== undefined && (
                          <span className="text-[11px] font-mono text-[#8B9A8C]">
                            ({t.correct_questions}/{t.total_questions} correct)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "#E3ECE6" }}>
                        <div className="h-full rounded-full" style={{ width: `${t.mastery}%`, background: "#2F6B4F" }} />
                      </div>
                      <span className="font-mono text-xs font-medium" style={{ color: "#2F6B4F" }}>{t.mastery}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quiz Sessions History */}
            {quizHistory.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2F6B4F" }} />
                  <h2 className="font-display text-xl font-semibold">Your Diagnostic History</h2>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border p-4 bg-white" style={{ borderColor: "#D8DED4" }}>
                  {quizHistory.slice(0, 5).map((session) => (
                    <div key={session.session_id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "#E8ECE5" }}>
                      <div>
                        <p className="text-xs font-semibold">Diagnostic Test #{session.session_id}</p>
                        <p className="text-[11px] font-mono text-[#8B9A8C]">
                          {session.created_at ? new Date(session.created_at).toLocaleDateString() : "Recent"}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#E8EFEA", color: "#2F6B4F" }}>
                        {session.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Tree Widget */}
          <div className="flex flex-col justify-between rounded-2xl border p-8" style={{ borderColor: "#D8DED4", background: "#FFFFFF" }}>
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
                  Live Knowledge Tree
                </p>
                {totalAssessed > 0 && (
                  <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: "#E8EFEA", color: "#2F6B4F" }}>
                    {avgMastery}% Avg
                  </span>
                )}
              </div>
              <div className="mx-auto mt-6 max-w-[260px]">
                <TreeMotif className="w-full" animate={true} />
              </div>

              {/* Dynamic Metrics */}
              <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border p-3" style={{ borderColor: "#E8ECE5", background: "#F7F8F4" }}>
                  <p className="font-mono text-[10px] uppercase text-[#8B9A8C]">Gaps Found</p>
                  <p className="font-display text-2xl font-bold text-[#E2A73E] mt-0.5">{gaps.length}</p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: "#E8ECE5", background: "#F7F8F4" }}>
                  <p className="font-mono text-[10px] uppercase text-[#8B9A8C]">Mastered</p>
                  <p className="font-display text-2xl font-bold text-[#2F6B4F] mt-0.5">{strong.length}</p>
                </div>
              </div>

              <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: "#8B9A8C" }}>
                Amber leaf nodes represent diagnosed gaps (<span className="font-semibold text-[#E2A73E]">&lt; 70%</span>). Green nodes represent mastered concepts.
              </p>
            </div>

            <Link
              to="/tree"
              className="mt-8 flex items-center justify-center rounded-full border py-3 text-sm font-semibold transition hover:bg-[#F7F8F4]"
              style={{ borderColor: "#D8DED4", color: "#14231C" }}
            >
              View Full Knowledge Tree →
            </Link>
          </div>
        </div>
      </main>

      {/* Interactive Diagnostic Quiz Modal */}
      <QuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        onCompleted={handleQuizCompleted}
      />
    </div>
  );
}
