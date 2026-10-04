import { useState, useEffect } from "react";
import { apiGetQuiz, apiSubmitQuiz } from "../api/client";

export default function QuizModal({ isOpen, onClose, onCompleted }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [question_id]: selected_index }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch questions on open
  useEffect(() => {
    if (!isOpen) {
      setQuestions([]);
      setCurrentIndex(0);
      setAnswers({});
      setResults(null);
      setError("");
      setElapsedTime(0);
      return;
    }

    let isMounted = true;
    setLoading(true);
    apiGetQuiz()
      .then((data) => {
        if (!isMounted) return;
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          setError("No quiz questions available yet. Please upload course material first!");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Failed to load quiz.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Stopwatch timer
  useEffect(() => {
    if (!isOpen || results || loading) return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, results, loading]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function handleSelectOption(optionIndex) {
    if (results) return;
    const currentQ = questions[currentIndex];
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIndex,
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const payload = Object.entries(answers).map(([qid, selIdx]) => ({
        question_id: parseInt(qid, 10),
        selected_index: selIdx,
      }));

      if (payload.length === 0) {
        setError("Please answer at least one question before submitting.");
        setSubmitting(false);
        return;
      }

      const res = await apiSubmitQuiz(payload);
      setResults(res);
      if (onCompleted) onCompleted(res);
    } catch (err) {
      setError(err.message || "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-body">
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden border"
        style={{ borderColor: "#D8DED4" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "#D8DED4", background: "#F7F8F4" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "#2F6B4F" }} />
              <p className="font-mono text-xs uppercase tracking-wider text-[#8B9A8C]">
                Diagnostic Test Session
              </p>
            </div>
            <h2 className="font-display text-lg font-semibold text-[#14231C] mt-0.5">
              Knowledge Diagnostic
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs border" style={{ borderColor: "#D8DED4", background: "#FFFFFF", color: "#3D4A40" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTime(elapsedTime)}</span>
            </div>
            <button
              onClick={onClose}
              className="text-[#8B9A8C] hover:text-[#14231C] text-xl font-bold transition p-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#2F6B4F", borderTopColor: "transparent" }} />
              <p className="text-sm font-medium text-[#8B9A8C]">Loading diagnostic questions...</p>
            </div>
          )}

          {error && !results && (
            <div className="rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] p-4 text-sm text-[#991B1B] mb-4">
              {error}
            </div>
          )}

          {/* Results Screen */}
          {results && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="rounded-2xl border p-6 text-center" style={{ background: "#F7F8F4", borderColor: "#D8DED4" }}>
                <p className="font-mono text-xs uppercase tracking-wider text-[#8B9A8C]">Assessment Completed</p>
                <div className="font-display text-5xl font-bold text-[#14231C] mt-2">
                  {results.score_percentage}%
                </div>
                <p className="text-sm text-[#3D4A40] mt-1">
                  You answered <span className="font-semibold text-[#2F6B4F]">{results.correct_count}</span> of <span className="font-semibold">{results.total_questions}</span> correctly.
                </p>
              </div>

              <div>
                <h3 className="font-display text-base font-semibold mb-3">Diagnostic Breakdown</h3>
                <div className="flex flex-col gap-3">
                  {results.results?.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border p-4 text-xs"
                      style={{
                        borderColor: item.is_correct ? "#A7F3D0" : "#FDE68A",
                        background: item.is_correct ? "#ECFDF5" : "#FFFBEB",
                      }}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="font-mono">{item.topic} &gt; {item.subtopic}</span>
                        <span className={`px-2 py-0.5 rounded-full ${item.is_correct ? "bg-[#10B981]/20 text-[#065F46]" : "bg-[#F59E0B]/20 text-[#92400E]"}`}>
                          {item.is_correct ? "Correct" : "Needs Review (< 70%)"}
                        </span>
                      </div>
                      <p className="mt-2 text-[#3D4A40] leading-relaxed">
                        <span className="font-semibold">Explanation:</span> {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quiz Question Card */}
          {!loading && !results && currentQ && (
            <div className="flex flex-col gap-5">
              {/* Question metadata */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#8B9A8C]">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium" style={{ background: "#E8EFEA", color: "#2F6B4F" }}>
                  {currentQ.topic || "Core Concept"}
                </span>
              </div>

              {/* Question text */}
              <h3 className="font-display text-lg font-semibold text-[#14231C] leading-snug">
                {currentQ.question}
              </h3>

              {/* Options */}
              <div className="flex flex-col gap-2.5 mt-2">
                {currentQ.options?.map((opt, optIdx) => {
                  const isSelected = answers[currentQ.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`flex items-center gap-3 w-full rounded-xl border p-3.5 text-left text-sm transition ${
                        isSelected
                          ? "border-[#2F6B4F] bg-[#2F6B4F]/10 font-semibold text-[#14231C]"
                          : "border-[#D8DED4] bg-white hover:border-[#8B9A8C] text-[#3D4A40]"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-medium ${
                          isSelected ? "bg-[#2F6B4F] text-white" : "border border-[#D8DED4] text-[#8B9A8C]"
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: "#D8DED4", background: "#F7F8F4" }}>
          {results ? (
            <button
              onClick={onClose}
              className="ml-auto rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#2F6B4F" }}
            >
              Back to Dashboard
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={currentIndex === 0 || loading}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="rounded-full border px-4 py-2 text-xs font-semibold transition disabled:opacity-40"
                style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
              >
                ← Previous
              </button>

              <div className="flex items-center gap-2">
                {currentIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="rounded-full px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "#2F6B4F" }}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting || answeredCount === 0}
                    onClick={handleSubmit}
                    className="rounded-full px-6 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#2F6B4F" }}
                  >
                    {submitting ? "Evaluating..." : "Submit Diagnostic"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
