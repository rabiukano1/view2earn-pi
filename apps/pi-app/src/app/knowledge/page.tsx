"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const ECOSYSTEM = "PI" as const;

type View =
  | { name: "hub" }
  | { name: "course"; key: string }
  | { name: "lesson"; key: string; lessonNumber: number };

type LessonQuizResult = {
  score: number;
  total: number;
  passed: boolean;
  completed: boolean;
  review: { correctIndex: number; selected: number; explanation: string }[];
};

function KnowledgeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const [view, setView] = useState<View>({ name: "hub" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<LessonQuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  // Deep link support: /knowledge?course=<key>&lesson=<n> opens straight into a
  // lesson (used by the Daily Quiz "Learn more" links).
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const course = searchParams.get("course");
    const lessonParam = searchParams.get("lesson");
    if (course) {
      const n = lessonParam ? Number(lessonParam) : NaN;
      if (Number.isInteger(n) && n > 0) {
        setView({ name: "lesson", key: course, lessonNumber: n });
      } else {
        setView({ name: "course", key: course });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  const hub = useQuery(api.knowledge.getKnowledgeCenter, userId ? { userId } : "skip");
  const course = useQuery(
    api.knowledge.getCourse,
    userId && view.name === "course" ? { userId, courseKey: view.key } : "skip",
  );
  const lesson = useQuery(
    api.knowledge.getLesson,
    userId && view.name === "lesson"
      ? { userId, courseKey: view.key, lessonNumber: view.lessonNumber }
      : "skip",
  );
  const submitLessonQuiz = useMutation(api.knowledge.submitLessonQuiz);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const openLesson = (key: string, lessonNumber: number) => {
    setView({ name: "lesson", key, lessonNumber });
    setAnswers({});
    setResult(null);
  };

  const openCourse = (key: string) => {
    setView({ name: "course", key });
    setAnswers({});
    setResult(null);
  };

  const goHub = () => {
    setView({ name: "hub" });
    setAnswers({});
    setResult(null);
  };

  const submit = async () => {
    if (!lesson || view.name !== "lesson") return;
    const ordered = lesson.quiz.map((_, i) => answers[i] ?? -1);
    if (ordered.some((a) => a < 0)) {
      alert("Answer every question first");
      return;
    }
    setBusy(true);
    try {
      const res = await submitLessonQuiz({
        userId,
        courseKey: view.key,
        lessonNumber: view.lessonNumber,
        answers: ordered,
      });
      setResult(res as LessonQuizResult);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  const overall = hub?.overall;
  const overallPct = overall && overall.totalLessons > 0
    ? overall.lessonsCompleted / overall.totalLessons
    : 0;

  const lessonSections = lesson?.lesson
    ? [
        { key: "what", label: "What is it?", text: lesson.lesson.what },
        { key: "why", label: "Why does it matter?", text: lesson.lesson.why },
        { key: "how", label: "How does it work?", text: lesson.lesson.how },
        { key: "example", label: "Example", text: lesson.lesson.example },
        { key: "important", label: "Important", text: lesson.lesson.important },
        { key: "mistake", label: "Common misunderstanding", text: lesson.lesson.commonMistake },
      ].filter((s) => s.text) : [];

  return (
    <div className="pi-page pi-learn">
      {view.name === "hub" ? (
        <>
          {/* Hero */}
          <div className="pi-hero">
            <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
            <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
            <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
            <p className="pi-hero-hi">Pi Pioneer Knowledge Center 🎓</p>
            <p className="pi-balance-label">Official-source Pi learning</p>
            <p className="pi-balance-value">
              {overall === undefined ? "—" : `${overall.lessonsCompleted}/${overall.totalLessons}`}
            </p>
            <div className="pi-hero-actions">
              <span className="pi-chip">Lessons completed</span>
              <span className="pi-hero-date">
                {overallPct === 0 ? "Pick a course below" : `${Math.round(overallPct * 100)}% complete`}
              </span>
            </div>
            <div className="pi-progress-track pi-hero-progress">
              <div className="pi-progress-fill" style={{ width: `${overallPct * 100}%` }} />
            </div>
          </div>

          {hub === undefined ? (
            <div className="pi-centered"><div className="pi-spinner" /></div>
          ) : hub.courses.length === 0 ? (
            <div className="pi-card pi-card-glass">
              <p className="pi-muted">No courses published yet.</p>
            </div>
          ) : (
            <>
              <p className="pi-section-title">Courses</p>
              <div className="pi-knowledge-grid">
                {hub.courses.map((c, i) => (
                  <button
                    key={c.key}
                    className="pi-knowledge-card"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => openCourse(c.key)}>
                    <div className="pi-knowledge-card-top">
                      <span className="pi-knowledge-num">{String(c.sortOrder).padStart(2, "0")}</span>
                      <span className="pi-knowledge-meta">
                        {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
                        {c.quizBest != null ? ` · best ${c.quizBest}` : ""}
                      </span>
                    </div>
                    <span className="pi-knowledge-title">{c.shortTitle}</span>
                    <span className="pi-knowledge-desc">{c.description}</span>
                    <div className="pi-progress-track pi-mt">
                      <div className="pi-progress-fill" style={{ width: `${c.progressPct * 100}%` }} />
                    </div>
                    <span className="pi-knowledge-link">
                      {c.progressPct === 1 ? "Review course →" : c.progressPct > 0 ? "Continue →" : "Start course →"}
                    </span>
                  </button>
                ))}
              </div>

              <section className="pi-card pi-card-glass pi-learn-tip">
                <span className="pi-tip-icon">💡</span>
                <div className="pi-grow">
                  <p className="pi-card-title-sm">Official sources only</p>
                  <p className="pi-muted">
                    Every lesson links back to official Pi Network material (whitepaper, roadmap, announcements).
                    Community posts and rumors are never used as facts here.
                  </p>
                </div>
              </section>
            </>
          )}
        </>
      ) : view.name === "course" && course ? (
        <>
          <div className="pi-lesson-head">
            <button className="pi-link-text pi-learn-back" onClick={goHub}>← All courses</button>
            <span className="pi-level-badge">
              {course.progress.lessonsCompleted}/{course.progress.totalLessons} done
            </span>
          </div>
          <h2 className="pi-lesson-title">{course.course.title}</h2>
          <p className="pi-muted">{course.course.description}</p>

          <div className="pi-progress-track pi-mt">
            <div className="pi-progress-fill" style={{ width: `${(course.progress.lessonsCompleted / Math.max(1, course.progress.totalLessons)) * 100}%` }} />
          </div>

          <p className="pi-section-title">Lessons</p>
          <div className="pi-levels">
            {course.lessons.map((l) => (
              <button
                key={l._id}
                className={`pi-level-card ${l.completed ? "pi-level-card-pass" : ""}`}
                onClick={() => openLesson(course.course.key, l.lessonNumber)}>
                <span className={`pi-level-num ${l.completed ? "pi-level-num-pass" : ""}`}>
                  {l.completed ? "✓" : l.lessonNumber}
                </span>
                <span className="pi-level-info">
                  <span className="pi-level-title">{l.title}</span>
                  <span className="pi-level-meta">
                    {l.completed ? "Completed · review anytime" : "Read, then take the knowledge check"}
                  </span>
                </span>
                <span className={`pi-level-chev ${l.completed ? "pi-level-chev-pass" : ""}`}>
                  {l.completed ? "✓" : "→"}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : view.name === "lesson" && lesson ? (
        <div className="pi-lesson">
          <div className="pi-lesson-head">
            <button className="pi-link-text pi-learn-back" onClick={() => openCourse(view.key)}>
              ← {lesson.course.shortTitle}
            </button>
            <span className="pi-level-badge">Lesson {lesson.lesson.lessonNumber}</span>
          </div>
          <h2 className="pi-lesson-title">{lesson.lesson.title}</h2>
          {lesson.completed ? <span className="pi-chip pi-chip-pass">✓ Completed</span> : null}

          <div className="pi-lesson-sections">
            {lessonSections.map((s) => (
              <section key={s.key} className={`pi-lesson-sec ${s.key === "important" ? "pi-lesson-sec-important" : ""} ${s.key === "mistake" ? "pi-lesson-sec-mistake" : ""}`}>
                <p className="pi-lesson-sec-label">{s.label}</p>
                <p className="pi-lesson-sec-text">{s.text}</p>
              </section>
            ))}
          </div>

          {lesson.lesson.officialSource ? (
            <p className="pi-muted pi-source-note">
              📚 Official source: {lesson.lesson.officialSource}
            </p>
          ) : null}

          <p className="pi-section-title">Knowledge check</p>
          {lesson.quiz.map((q, qi) => {
            const rev = result?.review[qi];
            return (
              <div key={q._id} className="pi-qblock">
                <p className="pi-question">
                  {qi + 1}. {q.question}
                  {q.difficultyLabel ? (
                    <span className="pi-diff"> · {q.difficultyLabel}</span>
                  ) : null}
                </p>
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
                {result.passed ? "Lesson completed!" : "Review the explanation above"}
              </p>
              <p className="pi-result-score">{result.score} of {result.total} correct</p>
              <button
                className="btn btn-primary pi-result-btn"
                onClick={() => openCourse(view.key)}>
                Back to lessons
              </button>
            </div>
          ) : (
            <button className="btn btn-primary pi-full pi-submit-btn" onClick={submit} disabled={busy}>
              {busy ? "Checking…" : "Submit knowledge check"}
            </button>
          )}
        </div>
      ) : (
        <div className="pi-centered"><div className="pi-spinner" /></div>
      )}
    </div>
  );
}

// Pi Pioneer Knowledge Center (learn-pi.md) — 15 official-source-backed Pi
// courses. Single page with hub → course → lesson views (mirrors /learn).
export default function KnowledgePage() {
  return (
    <Suspense fallback={<div className="pi-centered"><div className="pi-spinner" /></div>}>
      <KnowledgeInner />
    </Suspense>
  );
}