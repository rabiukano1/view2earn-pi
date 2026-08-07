"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const ECOSYSTEM = "PI" as const;

type SubmitResult = {
  score: number;
  total: number;
  passed: boolean;
  pointsEarned: number;
  review: { correctIndex: number; explanation: string; selected: number }[];
};

// Learn Pi academy (plan §7.11b) — Pi-only. Reads the same lesson feed as the
// mobile apps; level N unlocks once N-1 is passed, +10 pts per level first time.
export default function PiLearn() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const lessons = useQuery(
    api.academy.getAcademy,
    userId ? { userId, ecosystem: ECOSYSTEM } : "skip",
  );
  const submitLevel = useMutation(api.academy.submitLevel);

  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const firstName = useMemo(() => (me?.name || me?.username || "there").split(" ")[0], [me]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const open = lessons?.find((l) => l.level === openLevel) ?? null;
  const passed = (lessons ?? []).filter((l) => l.passed).length;
  const total = (lessons ?? []).length;
  const progressPct = total > 0 ? passed / total : 0;

  const closeLesson = () => {
    setOpenLevel(null);
    setAnswers({});
    setResult(null);
  };

  const startLesson = (level: number) => {
    setOpenLevel(level);
    setAnswers({});
    setResult(null);
  };

  const submit = async () => {
    if (!open) return;
    const ordered = open.quiz.map((_, i) => answers[i] ?? -1);
    if (ordered.some((a) => a < 0)) {
      alert("Answer every question first");
      return;
    }
    setBusy(true);
    try {
      const res = await submitLevel({
        userId,
        ecosystem: ECOSYSTEM,
        level: open.level,
        answers: ordered,
      });
      setResult(res as SubmitResult);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-page pi-learn">
      {/* Hero */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Keep learning, {firstName} 🎓</p>
        <p className="pi-balance-label">Learn Pi</p>
        <p className="pi-balance-value">
          {lessons === undefined ? "—" : `${passed}/${total}`}
        </p>
        <div className="pi-hero-actions">
          <span className="pi-chip">Lessons passed</span>
          <span className="pi-hero-date">
            {progressPct === 0 ? "Start level 1" : `${Math.round(progressPct * 100)}% complete`}
          </span>
        </div>
        <div className="pi-progress-track pi-hero-progress">
          <div className="pi-progress-fill" style={{ width: `${progressPct * 100}%` }} />
        </div>
      </div>

      {lessons === undefined ? (
        <div className="pi-centered"><div className="pi-spinner" /></div>
      ) : open ? (
        <div className="pi-lesson">
          <div className="pi-lesson-head">
            <button className="pi-link-text pi-learn-back" onClick={closeLesson}>← All lessons</button>
            <span className="pi-level-badge">Level {open.level}</span>
          </div>
          <h2 className="pi-lesson-title">{open.title}</h2>
          <div className="pi-lesson-body">{open.body}</div>

          <p className="pi-section-title">Quiz</p>
          {open.quiz.map((q, qi) => {
            const rev = result?.review[qi];
            return (
              <div key={qi} className="pi-qblock">
                <p className="pi-question">{qi + 1}. {q.question}</p>
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = rev && rev.correctIndex === oi;
                  const isWrongPick = rev && rev.selected === oi && rev.selected !== rev.correctIndex;
                  return (
                    <button
                      key={oi}
                      disabled={!!result}
                      className={[
                        "pi-option",
                        selected && !result ? "pi-option-selected" : "",
                        isCorrect ? "pi-option-correct" : "",
                        isWrongPick ? "pi-option-wrong" : "",
                      ].join(" ")}
                      onClick={() => setAnswers((p) => ({ ...p, [qi]: oi }))}>
                      <span className="pi-option-letter">{String.fromCharCode(65 + oi)}</span>
                      <span className="pi-option-text">{opt}</span>
                      {selected && !result ? <span className="pi-option-check">✓</span> : null}
                      {isCorrect ? <span className="pi-option-check">✓</span> : null}
                      {isWrongPick ? <span className="pi-option-check pi-option-x">✕</span> : null}
                    </button>
                  );
                })}
                {rev ? (
                  <div className="pi-explanation">
                    <span className="pi-explanation-label">{rev.selected === rev.correctIndex ? "Correct — " : "Explanation — "}</span>
                    {rev.explanation}
                  </div>
                ) : null}
              </div>
            );
          })}

          {result ? (
            <div className={`pi-result-box ${result.passed ? "pi-result-pass" : "pi-result-fail"}`}>
              <span className="pi-result-icon">{result.passed ? "🎉" : "📖"}</span>
              <p className="pi-result-title">
                {result.passed ? "Level passed!" : "Not quite — review and retry"}
              </p>
              <p className="pi-result-score">{result.score} of {result.total} correct</p>
              {result.pointsEarned > 0 ? (
                <p className="pi-result-points">+{result.pointsEarned} pts</p>
              ) : null}
              <button
                className="btn btn-primary pi-result-btn"
                onClick={result.passed ? closeLesson : () => setResult(null)}>
                {result.passed ? "Back to lessons" : "Try again"}
              </button>
            </div>
          ) : (
            <button className="btn btn-primary pi-full pi-submit-btn" onClick={submit} disabled={busy}>
              {busy ? "Checking…" : "Submit quiz"}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="pi-section-title">Lessons</p>
          <div className="pi-levels">
            {lessons.map((l, i) => (
              <button
                key={l.level}
                disabled={l.locked}
                className={`pi-level-card ${l.locked ? "pi-level-locked" : ""}`}
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => startLesson(l.level)}>
                <span className={`pi-level-num ${l.passed ? "pi-level-num-pass" : l.locked ? "pi-level-num-locked" : ""}`}>
                  {l.locked ? "🔒" : l.passed ? "✓" : l.level}
                </span>
                <span className="pi-level-info">
                  <span className="pi-level-title">{l.title}</span>
                  <span className="pi-level-meta">
                    {l.locked ? "Complete the previous lesson to unlock" : l.passed ? "Completed · review anytime" : "Lesson ready · tap to start"}
                  </span>
                </span>
                <span className={`pi-level-chev ${l.passed ? "pi-level-chev-pass" : ""}`}>
                  {l.passed ? "+10 pts" : l.locked ? "" : "→"}
                </span>
              </button>
            ))}
          </div>

          <section className="pi-card pi-card-glass pi-learn-tip">
            <span className="pi-tip-icon">💡</span>
            <div className="pi-grow">
              <p className="pi-card-title-sm">Passing tip</p>
              <p className="pi-muted">Each lesson unlocks the next. Read the guide carefully — the quiz questions follow it closely.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
