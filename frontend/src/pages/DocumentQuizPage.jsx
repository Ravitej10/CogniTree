import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  apiGenerateDocumentQuestions,
  apiGetDocument,
  apiGetDocumentQuestions,
  apiGetMe,
  apiSubmitDocumentQuiz,
  clearSession,
} from "../api/client";


export default function DocumentQuizPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const [generationCount, setGenerationCount] = useState(5);
  const [quizStarted, setQuizStarted] = useState(false);

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      await apiGetMe();
      const [documentData, questionData] = await Promise.all([
        apiGetDocument(documentId),
        apiGetDocumentQuestions(documentId),
      ]);
      setDocument(documentData);
      let loadedQuestions = questionData.questions || [];
      setQuestions(loadedQuestions);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        clearSession();
        navigate("/login");
        return;
      }
      setError(requestError.message || "Could not load this document.");
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [documentId]);

  async function generateQuestions() {
    setGenerating(true);
    setError("");
    try {
      await apiGenerateDocumentQuestions(documentId, { count: generationCount, model: selectedModel });
      const [documentData, questionData] = await Promise.all([
        apiGetDocument(documentId),
        apiGetDocumentQuestions(documentId),
      ]);
      setDocument(documentData);
      setQuestions(questionData.questions || []);
      setAnswers({});
      setCurrentIndex(0);
    } catch (requestError) {
      setError(requestError.message || "Question generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionId, optionIndex) {
    setAnswers((previous) => ({ ...previous, [questionId]: optionIndex }));
  }

  async function submitQuiz() {
    if (Object.keys(answers).length !== questions.length) {
      setError("Answer every question before submitting the diagnostic test.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = questions.map((question) => ({
        question_id: question.id,
        selected_index: answers[question.id],
      }));
      setResult(await apiSubmitDocumentQuiz(documentId, payload));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message || "Could not submit the diagnostic test.");
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIndex];
  const resultByQuestion = useMemo(
    () => new Map((result?.results || []).map((item) => [item.question_id, item])),
    [result],
  );

  function startStoredQuiz() {
    setResult(null);
    setAnswers({});
    setCurrentIndex(0);
    setError("");
    setQuizStarted(true);
  }

  if (loading) {
    return <PageShell><p className="text-sm text-[#8B9A8C]">Loading document assessment…</p></PageShell>;
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/dashboard" className="font-mono text-xs text-[#2F6B4F] hover:underline">
            ← Back to diagnostic map
          </Link>
          <p className="mt-6 font-mono text-xs uppercase tracking-wider text-[#8B9A8C]">
            Document diagnostic
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold text-[#14231C] sm:text-4xl">
            {document?.filename || "Course material"}
          </h1>
          <p className="mt-3 text-sm text-[#3D4A40]">
            This test uses questions generated and stored specifically for this PDF.
          </p>
        </div>
        <div className="rounded-2xl border border-[#D8DED4] bg-white px-5 py-4 text-xs font-mono text-[#3D4A40]">
          <p>{document?.chunk_count || 0} indexed chunks</p>
          <p className="mt-1">{document?.question_count || 0} questions in private bank</p>
          <p className="mt-1">{questions.length} questions in this quiz</p>
          <p className="mt-1">{document?.attempt_count || 0} previous attempts</p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] p-4 text-sm text-[#991B1B]">
          {error}
        </div>
      )}

      {generating && (
        <div className="mt-6 rounded-xl border border-[#93C5FD] bg-[#EFF6FF] p-4 text-sm text-[#1E3A8A]">
          <p className="font-semibold">Gemini is generating your private question bank.</p>
          <p className="mt-1 text-xs">Using {selectedModel} to add {generationCount} grounded questions—keep this page open.</p>
        </div>
      )}

      {!quizStarted ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#D8DED4] bg-white p-6 sm:p-8">
            <p className="font-mono text-xs uppercase text-[#8B9A8C]">Question bank</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-[#14231C]">Generate more questions</h2>
            <p className="mt-2 text-sm text-[#3D4A40]">Add new AI-generated questions to this PDF. Existing questions are kept.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#3D4A40]">
                Gemini model
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={generating} className="mt-2 w-full rounded-xl border border-[#D8DED4] bg-white px-4 py-3 text-sm font-normal text-[#14231C]">
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                  <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#3D4A40]">
                Questions to add
                <select value={generationCount} onChange={(event) => setGenerationCount(Number(event.target.value))} disabled={generating} className="mt-2 w-full rounded-xl border border-[#D8DED4] bg-white px-4 py-3 text-sm font-normal text-[#14231C]">
                  {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} questions</option>)}
                </select>
              </label>
            </div>
            <button onClick={generateQuestions} disabled={generating || document?.status !== "ready"} className="mt-6 rounded-full bg-[#2F6B4F] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {generating ? "Gemini is busy generating…" : "Generate and store questions"}
            </button>
          </div>

          <div className="rounded-2xl border border-[#D8DED4] bg-white p-6 sm:p-8">
            <p className="font-mono text-xs uppercase text-[#8B9A8C]">PDF quiz</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-[#14231C]">Take a stored quiz</h2>
            <p className="mt-2 text-sm text-[#3D4A40]">Start a quiz from this PDF’s existing question bank. Gemini will not be called.</p>
            <p className="mt-6 font-mono text-sm text-[#2F6B4F]">{document?.question_count || 0} questions available</p>
            <button onClick={startStoredQuiz} disabled={questions.length === 0} className="mt-6 rounded-full border border-[#2F6B4F] px-6 py-3 text-sm font-semibold text-[#2F6B4F] disabled:border-[#D8DED4] disabled:text-[#8B9A8C] disabled:opacity-60">
              {questions.length ? `Start ${questions.length}-question quiz` : "Generate questions first"}
            </button>
          </div>
        </section>
      ) : result ? (
        <section className="mt-8 rounded-2xl border border-[#D8DED4] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 border-b border-[#E8ECE5] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase text-[#8B9A8C]">Diagnostic result</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[#14231C]">
                {result.score_percentage}%
              </h2>
              <p className="mt-1 text-sm text-[#3D4A40]">
                {result.correct_count} of {result.total_questions} correct
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { setResult(null); setAnswers({}); setCurrentIndex(0); }} className="rounded-full bg-[#2F6B4F] px-5 py-2.5 text-sm font-semibold text-white">
                Retake this quiz
              </button>
              <button onClick={() => { setQuizStarted(false); setResult(null); }} className="rounded-full border border-[#D8DED4] px-5 py-2.5 text-sm font-semibold text-[#3D4A40]">
                PDF workspace
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {questions.map((question, index) => {
              const review = resultByQuestion.get(question.id);
              return (
                <article key={question.id} className="rounded-xl border border-[#E8ECE5] bg-[#F7F8F4] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#14231C]">{index + 1}. {question.question}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-mono ${review?.is_correct ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                      {review?.is_correct ? "Correct" : "Review"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[#3D4A40]">{review?.explanation}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase text-[#8B9A8C]">
                    {question.difficulty || "medium"}{question.source_page ? ` · Source page ${question.source_page}` : ""}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="rounded-2xl border border-[#D8DED4] bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs uppercase text-[#8B9A8C]">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-[#E8F5E9] px-3 py-1 text-[10px] font-mono text-[#2F6B4F]">
                  {currentQuestion?.skill_type}
                </span>
                <span className="rounded-full bg-[#FFF4D6] px-3 py-1 text-[10px] font-mono uppercase text-[#8A5A00]">
                  {currentQuestion?.difficulty || "medium"}
                </span>
                {currentQuestion?.source_page && (
                  <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[10px] font-mono text-[#4338CA]">
                    Page {currentQuestion.source_page}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E8ECE5]">
              <div className="h-full rounded-full bg-[#2F6B4F]" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <p className="mt-6 font-mono text-xs text-[#8B9A8C]">
              {currentQuestion?.topic} · {currentQuestion?.subtopic}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-[#14231C]">
              {currentQuestion?.question}
            </h2>
            <div className="mt-6 space-y-3">
              {currentQuestion?.options.map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  onClick={() => selectAnswer(currentQuestion.id, optionIndex)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition ${answers[currentQuestion.id] === optionIndex ? "border-[#2F6B4F] bg-[#E8F5E9]" : "border-[#D8DED4] bg-white hover:border-[#8B9A8C]"}`}
                >
                  <span className="font-mono font-semibold text-[#2F6B4F]">{String.fromCharCode(65 + optionIndex)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                disabled={currentIndex === 0}
                className="rounded-full border border-[#D8DED4] px-5 py-2.5 text-sm font-semibold disabled:opacity-30"
              >
                Previous
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((index) => index + 1)}
                  className="rounded-full bg-[#2F6B4F] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Next question
                </button>
              ) : (
                <button
                  onClick={submitQuiz}
                  disabled={submitting || answeredCount !== questions.length}
                  className="rounded-full bg-[#2F6B4F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {submitting ? "Evaluating…" : "Submit diagnostic"}
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-[#D8DED4] bg-white p-5">
            <p className="font-mono text-xs uppercase text-[#8B9A8C]">Question map</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`aspect-square rounded-lg text-xs font-mono ${currentIndex === index ? "bg-[#14231C] text-white" : answers[question.id] !== undefined ? "bg-[#E8F5E9] text-[#2F6B4F]" : "bg-[#F7F8F4] text-[#8B9A8C]"}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs text-[#8B9A8C]">{answeredCount} of {questions.length} answered</p>
            <button onClick={() => setQuizStarted(false)} className="mt-5 w-full rounded-full border border-[#D8DED4] px-4 py-2 text-xs font-semibold text-[#3D4A40]">
              Exit to PDF workspace
            </button>
          </aside>
        </section>
      )}
    </PageShell>
  );
}


function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[#F7F8F4] font-body text-[#14231C]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>
      <header className="border-b border-[#D8DED4] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="font-display text-lg font-semibold">CogniTree</Link>
          <Link to="/dashboard" className="text-xs font-semibold text-[#2F6B4F]">Diagnostic map</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
