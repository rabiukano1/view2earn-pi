"use client";

import { PiRewardedAdButton } from "@/pi/components/PiRewardedAdButton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

type QuizQuestion = {
  _id: string;
  question: string;
  options: string[];
};

export default function DailyQuizPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const questions = useQuery(
    api.quiz.getDailyQuiz,
    userId ? { userId, ecosystem: "PI", day: new Date().getDay() } : "skip"
  );
  const submitQuiz = useMutation(api.quiz.submitQuiz);

  const [gameState, setGameState] = useState<"welcome" | "playing" | "result">(
    "welcome"
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [busy, setBusy] = useState<boolean>(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    pointsEarned: number;
    review: {
      correctIndex: number;
      selected: number;
      explanation: string;
      courseKey: string | null;
      courseTitle: string | null;
      lessonNumber: number | null;
      lessonTitle: string | null;
    }[];
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!me || !userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const list: QuizQuestion[] = questions ?? [];
  const currentQ = list[currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (currentIndex < list.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length < list.length) {
      if (!confirm("You haven't answered all questions. Submit anyway?")) {
        return;
      }
    }

    setBusy(true);
    try {
      const answersPayload = list.map((q, idx) => ({
        questionId: q._id,
        selectedIndex: selectedAnswers[idx] ?? -1,
      }));

      const res = await submitQuiz({
        userId,
        answers: answersPayload,
      });

      setResult(res);
      setGameState("result");
    } catch (e) {
      alert(String((e as Error)?.message ?? e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-page pi-quiz-page">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Daily Quiz Challenge 🧠</p>
        <p className="pi-balance-label">Earn Bonus Points for Knowledge</p>
        <p className="pi-balance-value">+20 PTS / Answer</p>

        <div className="pi-hero-actions" style={{ marginTop: 14 }}>
          <Link className="pi-chip" href="/home">
            ← Home
          </Link>

          {gameState === "playing" && (
            <span className="pi-hero-date">
              QUESTION {currentIndex + 1} OF {list.length}
            </span>
          )}
        </div>
      </div>

      <div className="pi-home-body">
        {/* State 1: Welcome Screen */}
        {gameState === "welcome" && (
          <section className="pi-card pi-card-glass" style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🎓</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Test Your Pi &amp; Web3 Knowledge
            </h2>
            <p className="pi-muted" style={{ fontSize: 14, maxWidth: 440, margin: "0 auto 20px" }}>
              Answer {list.length} daily multiple-choice questions from the Pi Pioneer
              Knowledge Center to test your Pi knowledge and claim bonus points directly to your wallet!
            </p>

            <div className="pi-quiz-perks">
              <div className="pi-quiz-perk">
                <span>⚡</span> <span>{list.length} Questions</span>
              </div>
              <div className="pi-quiz-perk">
                <span>🪙</span> <span>Score Points</span>
              </div>
              <div className="pi-quiz-perk">
                <span>🔥</span> <span>Daily Bonus</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setGameState("playing")}
              style={{ width: "100%", maxWidth: 320, margin: "20px auto 0", justifyContent: "center" }}
              disabled={list.length === 0}
            >
              {list.length === 0 ? "Loading Quiz…" : "Start Daily Quiz 🚀"}
            </button>
          </section>
        )}

        {/* State 2: Active Playing Screen */}
        {gameState === "playing" && currentQ && (
          <section className="pi-card pi-card-glass">
            {/* Progress Track */}
            <div className="pi-progress-track" style={{ height: 6, marginBottom: 16 }}>
              <div
                className="pi-progress-fill"
                style={{
                  width: `${Math.round(((currentIndex + 1) / list.length) * 100)}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>

            <div className="pi-card-head" style={{ marginBottom: 10 }}>
              <span className="pi-badge pi-badge-accent">
                Question {currentIndex + 1} of {list.length}
              </span>
              <span className="pi-muted" style={{ fontSize: 12 }}>
                {Object.keys(selectedAnswers).length} / {list.length} Answered
              </span>
            </div>

            <h3 className="pi-card-title" style={{ fontSize: 18, marginBottom: 18, lineHeight: 1.4 }}>
              {currentQ.question}
            </h3>

            {/* Options List */}
            <div className="pi-quiz-options">
              {currentQ.options.map((optionText, optIdx) => {
                const isSelected = selectedAnswers[currentIndex] === optIdx;
                const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                return (
                  <button
                    key={optIdx}
                    type="button"
                    className={`pi-quiz-option ${isSelected ? "pi-quiz-option-selected" : ""}`}
                    onClick={() => handleSelectOption(optIdx)}
                  >
                    <span className="pi-quiz-letter">{letter}</span>
                    <span className="pi-quiz-option-text">{optionText}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation Buttons */}
            <div className="pi-quiz-nav-row" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>

              {currentIndex < list.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNext}
                  disabled={selectedAnswers[currentIndex] === undefined}
                >
                  Next Question →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={busy}
                >
                  {busy ? "Submitting…" : "Submit Quiz 🎉"}
                </button>
              )}
            </div>
          </section>
        )}

        {/* State 3: Result Screen */}
        {gameState === "result" && result && (
          <section className="pi-card pi-card-glass" style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {result.score >= 3 ? "🎉" : "💪"}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
              {result.score >= 4
                ? "Excellent Knowledge!"
                : result.score >= 3
                ? "Good Job!"
                : "Keep Learning!"}
            </h2>
            <p className="pi-muted" style={{ fontSize: 14, marginBottom: 16 }}>
              You scored <strong>{result.score} out of {result.total}</strong> correct
            </p>

            <div className="pi-result-score-box">
              <span className="pi-result-score-val">+{result.pointsEarned} PTS</span>
              <span className="pi-muted" style={{ fontSize: 12 }}>
                Credited directly to your wallet balance
              </span>
            </div>

            {/* Review: explanation + learn-more links (learn-pi.md §10/§11) */}
            {result.review && result.review.length > 0 ? (
              <div className="pi-quiz-review" style={{ marginTop: 22, textAlign: "left" }}>
                <p className="pi-section-title" style={{ textAlign: "center" }}>Review your answers</p>
                {result.review.map((r, i) => {
                  const q = list[i];
                  if (!q) return null;
                  const isCorrect = r.selected === r.correctIndex;
                  return (
                    <div key={i} className="pi-quiz-review-item">
                      <p className="pi-question" style={{ fontSize: 14 }}>
                        <span className={`pi-review-badge ${isCorrect ? "pi-review-ok" : "pi-review-bad"}`}>
                          {isCorrect ? "✓" : "✕"}
                        </span>{" "}
                        {q.question}
                      </p>
                      {q.options.map((opt, oi) => {
                        const isRight = oi === r.correctIndex;
                        const isPicked = oi === r.selected;
                        return (
                          <div
                            key={oi}
                            className={[
                              "pi-review-option",
                              isRight ? "pi-review-right" : "",
                              isPicked && !isRight ? "pi-review-picked" : "",
                            ].join(" ")}>
                            <span className="pi-review-letter">{String.fromCharCode(65 + oi)}</span>
                            <span>{opt}</span>
                            {isRight ? <span>✓</span> : isPicked ? <span>✕</span> : null}
                          </div>
                        );
                      })}
                      {r.explanation ? (
                        <p className="pi-explanation" style={{ marginBottom: 6 }}>
                          <span className="pi-explanation-label">Why? </span>
                          {r.explanation}
                        </p>
                      ) : null}
                      {r.courseKey && r.lessonNumber ? (
                        <Link
                          href={`/knowledge?course=${r.courseKey}&lesson=${r.lessonNumber}`}
                          className="pi-link-text">
                          📚 Learn more: {r.courseTitle} → {r.lessonTitle ?? `Lesson ${r.lessonNumber}`}
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Pi Rewarded Ad Bonus */}
            {userId && (
              <PiRewardedAdButton
                userId={userId}
                label="Watch Pi Ad for 2x Score Bonus"
                sublabel="Earn an extra +50 PTS bonus on top of your quiz score!"
                bonusPoints={50}
                style={{ marginTop: 18, textAlign: "left" }}
              />
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center" }}>
              <Link href="/home" className="btn btn-secondary" style={{ flex: 1 }}>
                Back to Home
              </Link>
              <Link href="/learn" className="btn btn-primary" style={{ flex: 1 }}>
                Read Lessons 🎓
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
