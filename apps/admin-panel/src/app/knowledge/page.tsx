"use client";

import { useMemo, useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type Tab = "sources" | "courses" | "lessons" | "questions" | "quiz";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "sources", label: "Sources", icon: "📚" },
  { key: "courses", label: "Courses", icon: "🎓" },
  { key: "lessons", label: "Lessons", icon: "📖" },
  { key: "questions", label: "Questions", icon: "❓" },
  { key: "quiz", label: "Quiz Settings", icon: "🧠" },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "badge-green",
  PUBLISHED: "badge-green",
  DRAFT: "badge-gray",
  REVIEW: "badge-accent",
  NEEDS_REVIEW: "badge-yellow",
  OUTDATED: "badge-red",
  ARCHIVED: "badge-gray",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_BADGE[status] ?? "badge-gray"}`}>{status}</span>;
}

function fmtDate(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(ts?: number | null): string {
  if (!ts) return "—";
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("courses");
  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title="Pi Knowledge Center"
        sub="Official-source-backed courses, lessons, question bank, and Daily Quiz config (learn-pi.md)"
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t.key)}
            style={{ borderRadius: 20, paddingLeft: 16, paddingRight: 16 }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {tab === "sources" && <SourcesTab />}
      {tab === "courses" && <CoursesTab />}
      {tab === "lessons" && <LessonsTab />}
      {tab === "questions" && <QuestionsTab />}
      {tab === "quiz" && <QuizSettingsTab />}
    </div>
  );
}

// ─── Sources ────────────────────────────────────────────────────────────────

type SourceForm = {
  sourceId: string;
  title: string;
  officialUrl: string;
  publisher: string;
  version: string;
  relevantSection: string;
};

const EMPTY_SOURCE: SourceForm = {
  sourceId: "",
  title: "",
  officialUrl: "",
  publisher: "",
  version: "",
  relevantSection: "",
};

function SourcesTab() {
  const sources = useAdminQuery(api.knowledgeAdmin.listSources);
  const createSource = useAdminMutation(api.knowledgeAdmin.createSource);
  const updateSource = useAdminMutation(api.knowledgeAdmin.updateSource);
  const reviewSource = useAdminMutation(api.knowledgeAdmin.reviewSource);
  const deleteSource = useAdminMutation(api.knowledgeAdmin.deleteSource);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<SourceForm>(EMPTY_SOURCE);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<SourceForm>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SOURCE);
    setOpen(true);
  };
  const openEdit = (s: NonNullable<typeof sources>[number]) => {
    setEditing(s.sourceId);
    setForm({
      sourceId: s.sourceId,
      title: s.title,
      officialUrl: s.officialUrl,
      publisher: s.publisher,
      version: s.version ?? "",
      relevantSection: s.relevantSection ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        await updateSource({
          sourceId: editing,
          title: form.title,
          officialUrl: form.officialUrl,
          publisher: form.publisher,
          version: form.version || undefined,
          relevantSection: form.relevantSection || undefined,
        });
      } else {
        await createSource({
          sourceId: form.sourceId.trim(),
          title: form.title,
          officialUrl: form.officialUrl,
          publisher: form.publisher,
          version: form.version || undefined,
          relevantSection: form.relevantSection || undefined,
        });
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📚 Official Sources</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              Editing a URL or version flags linked questions NEEDS_REVIEW (§21) — no silent stale content
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Source</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source ID</th>
                <th>Title</th>
                <th>Publisher</th>
                <th>Version</th>
                <th>Status</th>
                <th>Last checked</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!sources ? (
                <EmptyRow colSpan={7} text="Loading…" />
              ) : sources.length === 0 ? (
                <EmptyRow colSpan={7} text="No sources yet" />
              ) : (
                sources.map((s) => (
                  <tr key={s._id}>
                    <td className="mono">{s.sourceId}</td>
                    <td>
                      <div className="task-name">{s.title}</div>
                      <div className="task-url">
                        <a href={s.officialUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{s.officialUrl}</a>
                      </div>
                    </td>
                    <td>{s.publisher}</td>
                    <td className="mono">{s.version ?? "—"}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td title={fmtDate(s.lastChecked)}>{timeAgo(s.lastChecked)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)}>Edit</button>
                        {s.status !== "ACTIVE" && (
                          <button className="btn btn-sm btn-ok" onClick={() => confirmThen("Mark this source reviewed (ACTIVE)?", async () => { await reviewSource({ sourceId: s.sourceId }); })}>Reviewed</button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => confirmThen(`Delete source "${s.sourceId}"?`, async () => { await deleteSource({ sourceId: s.sourceId }); })}>
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? "Edit Source" : "Add Source"} open={open} onClose={() => setOpen(false)}>
        <Field label="Source ID (stable slug)" hint="e.g. whitepaper, roadmap, docs-minepi">
          <input value={form.sourceId} disabled={!!editing} onChange={(e) => set({ sourceId: e.target.value })} placeholder="whitepaper" />
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Pi Network White Paper" />
        </Field>
        <Field label="Official URL">
          <input value={form.officialUrl} onChange={(e) => set({ officialUrl: e.target.value })} placeholder="https://minepi.com/white-paper/" />
        </Field>
        <div className="form-grid">
          <Field label="Publisher">
            <input value={form.publisher} onChange={(e) => set({ publisher: e.target.value })} placeholder="Pi Network Core Team" />
          </Field>
          <Field label="Version (optional)">
            <input value={form.version} onChange={(e) => set({ version: e.target.value })} placeholder="v1" />
          </Field>
        </div>
        <Field label="Relevant section (optional)">
          <input value={form.relevantSection} onChange={(e) => set({ relevantSection: e.target.value })} placeholder="§4 Token Supply" />
        </Field>
        <div className="modal-actions">
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.sourceId || !form.title || !form.officialUrl} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Courses ────────────────────────────────────────────────────────────────

type CourseForm = {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  sortOrder: number;
};

const EMPTY_COURSE: CourseForm = { key: "", title: "", shortTitle: "", description: "", sortOrder: 0 };

function CoursesTab() {
  const courses = useAdminQuery(api.knowledgeAdmin.listCourses);
  const createCourse = useAdminMutation(api.knowledgeAdmin.createCourse);
  const updateCourse = useAdminMutation(api.knowledgeAdmin.updateCourse);
  const setCourseStatus = useAdminMutation(api.knowledgeAdmin.setCourseStatus);
  const deleteCourse = useAdminMutation(api.knowledgeAdmin.deleteCourse);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"courses"> | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_COURSE);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<CourseForm>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_COURSE, sortOrder: courses?.length ?? 0 });
    setOpen(true);
  };
  const openEdit = (c: NonNullable<typeof courses>[number]) => {
    setEditing(c._id);
    setForm({ key: c.key, title: c.title, shortTitle: c.shortTitle, description: c.description, sortOrder: c.sortOrder });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        await updateCourse({
          courseId: editing,
          title: form.title,
          shortTitle: form.shortTitle,
          description: form.description,
          sortOrder: form.sortOrder,
        });
      } else {
        await createCourse({
          key: form.key.trim(),
          title: form.title,
          shortTitle: form.shortTitle,
          description: form.description,
          sortOrder: form.sortOrder,
        });
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: Id<"courses">, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") => {
    await setCourseStatus({ courseId: id, status });
  };

  return (
    <div>
      <div className="card">
        <div className="card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🎓 Courses</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              Publish/unpublish controls what appears in the Knowledge Center &amp; Daily Quiz pool
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Course</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Key</th>
                <th>Title</th>
                <th>Lessons</th>
                <th>Questions</th>
                <th>Version</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!courses ? (
                <EmptyRow colSpan={9} text="Loading…" />
              ) : courses.length === 0 ? (
                <EmptyRow colSpan={9} text="No courses yet" />
              ) : (
                courses.map((c) => (
                  <tr key={c._id}>
                    <td className="num">{c.sortOrder}</td>
                    <td className="mono">{c.key}</td>
                    <td>
                      <div className="task-name">{c.title}</div>
                      <div className="task-url">{c.shortTitle}</div>
                    </td>
                    <td className="num">{c.lessonCount}</td>
                    <td className="num">{c.questionCount}</td>
                    <td className="num">v{c.contentVersion}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td title={fmtDate(c.lastReviewedAt)}>{timeAgo(c.lastReviewedAt)}</td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "wrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(c)}>Edit</button>
                        {c.status === "PUBLISHED" ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => confirmThen(`Unpublish "${c.key}"?`, () => setStatus(c._id, "DRAFT"))}>Unpublish</button>
                        ) : (
                          <button className="btn btn-sm btn-ok" onClick={() => setStatus(c._id, "PUBLISHED")}>Publish</button>
                        )}
                        <button className="btn btn-sm btn-ghost" onClick={() => confirmThen(`Archive "${c.key}"?`, () => setStatus(c._id, "ARCHIVED"))}>Archive</button>
                        <button className="btn btn-sm btn-danger" onClick={() => confirmThen(`Delete course "${c.key}" and ALL its lessons/questions?`, () => deleteCourse({ courseId: c._id }))}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? "Edit Course" : "Add Course"} open={open} onClose={() => setOpen(false)}>
        <Field label="Key (stable slug)" hint="Cannot be changed after creation">
          <input value={form.key} disabled={!!editing} onChange={(e) => set({ key: e.target.value })} placeholder="pi-tokenomics" />
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="04. Pi Tokenomics" />
        </Field>
        <Field label="Short title (nav label)">
          <input value={form.shortTitle} onChange={(e) => set({ shortTitle: e.target.value })} placeholder="Pi Tokenomics" />
        </Field>
        <Field label="Description">
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Sort order">
          <input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
        </Field>
        <div className="modal-actions">
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.key || !form.title || !form.shortTitle || !form.description} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Lessons ────────────────────────────────────────────────────────────────

type LessonForm = {
  courseId: string;
  lessonNumber: number;
  title: string;
  what: string;
  why: string;
  how: string;
  example: string;
  important: string;
  commonMistake: string;
  officialSource: string;
};

const EMPTY_LESSON: LessonForm = {
  courseId: "",
  lessonNumber: 1,
  title: "",
  what: "",
  why: "",
  how: "",
  example: "",
  important: "",
  commonMistake: "",
  officialSource: "",
};

function LessonsTab() {
  const courses = useAdminQuery(api.knowledgeAdmin.listCourses);
  const [courseId, setCourseId] = useState<string>("");
  const lessons = useAdminQuery(
    api.knowledgeAdmin.listLessons,
    courseId ? { courseId: courseId as Id<"courses"> } : "skip",
  );
  const createLesson = useAdminMutation(api.knowledgeAdmin.createLesson);
  const updateLesson = useAdminMutation(api.knowledgeAdmin.updateLesson);
  const setLessonStatus = useAdminMutation(api.knowledgeAdmin.setLessonStatus);
  const deleteLesson = useAdminMutation(api.knowledgeAdmin.deleteLesson);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"lessons"> | null>(null);
  const [form, setForm] = useState<LessonForm>(EMPTY_LESSON);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<LessonForm>) => setForm((f) => ({ ...f, ...patch }));

  const courseName = (id: string) =>
    courses?.find((c) => c._id === id)?.shortTitle ?? id;

  const openCreate = () => {
    const cid = courseId || courses?.[0]?._id || "";
    setEditing(null);
    setForm({ ...EMPTY_LESSON, courseId: cid });
    setOpen(true);
  };
  const openEdit = (l: NonNullable<typeof lessons>[number]) => {
    setEditing(l._id);
    setForm({
      courseId: l.courseId,
      lessonNumber: l.lessonNumber,
      title: l.title,
      what: l.what,
      why: l.why,
      how: l.how,
      example: l.example ?? "",
      important: l.important ?? "",
      commonMistake: l.commonMistake ?? "",
      officialSource: l.officialSource ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const base = {
        lessonNumber: form.lessonNumber,
        title: form.title,
        what: form.what,
        why: form.why,
        how: form.how,
        example: form.example || undefined,
        important: form.important || undefined,
        commonMistake: form.commonMistake || undefined,
        officialSource: form.officialSource || undefined,
      };
      if (editing) {
        await updateLesson({ lessonId: editing, ...base });
      } else {
        await createLesson({ courseId: form.courseId as Id<"courses">, ...base });
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📖 Lessons</div>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}>
              <option value="">All courses</option>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>{c.shortTitle}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Lesson</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Course</th>
                <th>Title</th>
                <th>Version</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th style={{ width: 240 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!lessons ? (
                <EmptyRow colSpan={7} text="Loading…" />
              ) : lessons.length === 0 ? (
                <EmptyRow colSpan={7} text="No lessons for this filter" />
              ) : (
                lessons.map((l) => (
                  <tr key={l._id}>
                    <td className="num">{l.lessonNumber}</td>
                    <td>{courseName(l.courseId)}</td>
                    <td>
                      <div className="task-name">{l.title}</div>
                      <div className="task-url truncate">{l.what}</div>
                    </td>
                    <td className="num">v{l.contentVersion}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td title={fmtDate(l.lastReviewedAt)}>{timeAgo(l.lastReviewedAt)}</td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "wrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(l)}>Edit</button>
                        {l.status === "PUBLISHED" ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => confirmThen(`Unpublish lesson "${l.lessonNumber}"?`, () => setLessonStatus({ lessonId: l._id, status: "DRAFT" }))}>Unpublish</button>
                        ) : (
                          <button className="btn btn-sm btn-ok" onClick={() => setLessonStatus({ lessonId: l._id, status: "PUBLISHED" })}>Publish</button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => confirmThen(`Delete lesson "${l.lessonNumber}" and its questions?`, () => deleteLesson({ lessonId: l._id }))}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? "Edit Lesson" : "Add Lesson"} open={open} onClose={() => setOpen(false)}>
        <div className="form-grid">
          <Field label="Course">
            <select value={form.courseId} onChange={(e) => set({ courseId: e.target.value })}>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>{c.shortTitle}</option>
              ))}
            </select>
          </Field>
          <Field label="Lesson number">
            <input type="number" min={1} value={form.lessonNumber} onChange={(e) => set({ lessonNumber: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Title">
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="What (the fact)">
          <textarea rows={3} value={form.what} onChange={(e) => set({ what: e.target.value })} />
        </Field>
        <Field label="Why (importance)">
          <textarea rows={2} value={form.why} onChange={(e) => set({ why: e.target.value })} />
        </Field>
        <Field label="How (how it works)">
          <textarea rows={3} value={form.how} onChange={(e) => set({ how: e.target.value })} />
        </Field>
        <Field label="Example (optional)">
          <textarea rows={2} value={form.example} onChange={(e) => set({ example: e.target.value })} />
        </Field>
        <Field label="Important note (optional)">
          <textarea rows={2} value={form.important} onChange={(e) => set({ important: e.target.value })} />
        </Field>
        <Field label="Common mistake (optional)">
          <textarea rows={2} value={form.commonMistake} onChange={(e) => set({ commonMistake: e.target.value })} />
        </Field>
        <Field label="Official source URL (optional)">
          <input value={form.officialSource} onChange={(e) => set({ officialSource: e.target.value })} />
        </Field>
        <div className="modal-actions">
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.title || !form.what} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Questions ──────────────────────────────────────────────────────────────

type QuestionForm = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  difficultyLabel: "EASY" | "MEDIUM" | "HARD";
  courseId: string;
  lessonId: string;
  sourceUrl: string;
};

const EMPTY_QUESTION: QuestionForm = {
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  topic: "",
  difficultyLabel: "EASY",
  courseId: "",
  lessonId: "",
  sourceUrl: "",
};

const LESSON_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW", label: "Review" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "OUTDATED", label: "Outdated" },
  { value: "ARCHIVED", label: "Archived (disabled)" },
];

function QuestionsTab() {
  const courses = useAdminQuery(api.knowledgeAdmin.listCourses);
  const [courseId, setCourseId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const questions = useAdminQuery(
    api.knowledgeAdmin.listQuestions,
    {
      ...(courseId ? { courseId: courseId as Id<"courses"> } : {}),
      ...(status ? { status: status as any } : {}),
    },
  );
  const lessons = useAdminQuery(
    api.knowledgeAdmin.listLessons,
    courseId ? { courseId: courseId as Id<"courses"> } : "skip",
  );
  const createQuestion = useAdminMutation(api.knowledgeAdmin.createQuestion);
  const updateQuestion = useAdminMutation(api.knowledgeAdmin.updateQuestion);
  const setQuestionStatus = useAdminMutation(api.knowledgeAdmin.setQuestionStatus);
  const deleteQuestion = useAdminMutation(api.knowledgeAdmin.deleteQuestion);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"quizQuestions"> | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_QUESTION);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<QuestionForm>) => setForm((f) => ({ ...f, ...patch }));

  const setOption = (i: number, val: string) => {
    const options = [...form.options];
    options[i] = val;
    set({ options });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_QUESTION, courseId: courseId || courses?.[0]?._id || "" });
    setOpen(true);
  };
  const openEdit = (q: NonNullable<typeof questions>[number]) => {
    setEditing(q._id);
    setForm({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      topic: q.topic ?? "",
      difficultyLabel: q.difficultyLabel ?? "EASY",
      courseId: q.courseId ?? "",
      lessonId: q.lessonId ?? "",
      sourceUrl: q.sourceUrl ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const base = {
        question: form.question,
        options: form.options,
        correctIndex: form.correctIndex,
        explanation: form.explanation,
        difficulty: form.difficultyLabel === "EASY" ? 1 : form.difficultyLabel === "MEDIUM" ? 2 : 3,
        courseId: (form.courseId || undefined) as any,
        lessonId: (form.lessonId || undefined) as any,
        topic: form.topic || undefined,
        difficultyLabel: form.difficultyLabel,
        sourceUrl: form.sourceUrl || undefined,
      };
      if (editing) {
        await updateQuestion({ questionId: editing, ...base });
      } else {
        await createQuestion({
          ecosystem: "PI",
          category: "general",
          ...base,
        });
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  const statusBtn = (q: NonNullable<typeof questions>[number]) => {
    switch (q.status) {
      case "PUBLISHED":
        return (
          <button className="btn btn-sm btn-ghost" onClick={() => confirmThen("Disable this question (ARCHIVED)?", () => setQuestionStatus({ questionId: q._id, status: "ARCHIVED" }))}>Disable</button>
        );
      case "ARCHIVED":
        return (
          <button className="btn btn-sm btn-ok" onClick={() => setQuestionStatus({ questionId: q._id, status: "PUBLISHED" })}>Enable</button>
        );
      case "NEEDS_REVIEW":
      case "REVIEW":
        return (
          <button className="btn btn-sm btn-ok" onClick={() => setQuestionStatus({ questionId: q._id, status: "PUBLISHED" })}>Approve</button>
        );
      default:
        return (
          <button className="btn btn-sm btn-ok" onClick={() => setQuestionStatus({ questionId: q._id, status: "PUBLISHED" })}>Publish</button>
        );
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>❓ Question Bank</div>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}>
              <option value="">All courses</option>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>{c.shortTitle}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}>
              {LESSON_STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Add Question</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Course</th>
                <th>Lesson</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!questions ? (
                <EmptyRow colSpan={6} text="Loading…" />
              ) : questions.length === 0 ? (
                <EmptyRow colSpan={6} text="No questions for this filter" />
              ) : (
                questions.map((q) => (
                  <tr key={q._id}>
                    <td style={{ maxWidth: 360 }}>
                      <div className="task-name" style={{ whiteSpace: "normal" }}>{q.question}</div>
                      {q.sourceUrl && (
                        <div className="task-url">
                          <a href={q.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>source ↗</a>
                        </div>
                      )}
                    </td>
                    <td>{q.courseTitle ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td className="num">{q.lessonId ? "✓" : "—"}</td>
                    <td>{q.difficultyLabel ?? q.difficulty}</td>
                    <td><StatusBadge status={q.status ?? "DRAFT"} /></td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "wrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(q)}>Edit</button>
                        {statusBtn(q)}
                        {q.status === "ARCHIVED" && (
                          <button className="btn btn-sm btn-danger" onClick={() => confirmThen("Delete this question permanently?", () => deleteQuestion({ questionId: q._id }))}>Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? "Edit Question" : "Add Question"} open={open} onClose={() => setOpen(false)}>
        <Field label="Question text">
          <textarea rows={3} value={form.question} onChange={(e) => set({ question: e.target.value })} />
        </Field>
        <Field label="Options (mark the correct one)">
          {form.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => set({ correctIndex: i })}
                title="Mark as correct"
                style={{
                  width: 28, height: 28, borderRadius: 50, flexShrink: 0, cursor: "pointer", fontWeight: 800, fontSize: 13,
                  border: `2px solid ${form.correctIndex === i ? "var(--ok)" : "var(--border)"}`,
                  background: form.correctIndex === i ? "var(--ok)" : "var(--surface)",
                  color: form.correctIndex === i ? "#fff" : "var(--text-2)",
                }}>
                {String.fromCharCode(65 + i)}
              </button>
              <input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
            </div>
          ))}
        </Field>
        <Field label="Explanation (shown after answering)">
          <textarea rows={2} value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </Field>
        <div className="form-grid">
          <Field label="Difficulty">
            <select value={form.difficultyLabel} onChange={(e) => set({ difficultyLabel: e.target.value as any })}>
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </Field>
          <Field label="Topic (optional)">
            <input value={form.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="Token Supply" />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Course">
            <select value={form.courseId} onChange={(e) => { set({ courseId: e.target.value, lessonId: "" }); }}>
              <option value="">— none —</option>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>{c.shortTitle}</option>
              ))}
            </select>
          </Field>
          <Field label="Lesson">
            <select value={form.lessonId} onChange={(e) => set({ lessonId: e.target.value })}>
              <option value="">— none —</option>
              {lessons?.map((l) => (
                <option key={l._id} value={l._id}>#{l.lessonNumber} {l.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Source URL (official only — §25)">
          <input value={form.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} placeholder="https://minepi.com/white-paper/" />
        </Field>
        <div className="modal-actions">
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.question || form.options.some((o) => !o.trim()) || !form.explanation} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Quiz Settings ──────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function QuizSettingsTab() {
  const data = useAdminQuery(api.knowledgeAdmin.getQuizSettings);
  const updateQuizSettings = useAdminMutation(api.knowledgeAdmin.updateQuizSettings);

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");

  const courseOptions = useMemo(() => data?.courses ?? [], [data]);

  const [modeState, setModeState] = useState<"MIXED" | "COURSE_OF_THE_DAY">("MIXED");
  const [qCountState, setQCountState] = useState(5);
  const [distState, setDistState] = useState<{ courseKey: string; count: number }[]>([]);
  const [scheduleState, setScheduleState] = useState<{ day: number; courseKey: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Sync local state once when server data arrives.
  useMemo(() => {
    if (data && !loaded) {
      setModeState(data.settings?.mode ?? "MIXED");
      setQCountState(data.settings?.questionsPerQuiz ?? 5);
      setDistState(data.settings?.distribution?.length ? data.settings.distribution : [{ courseKey: courseOptions[0]?.key ?? "", count: 1 }]);
      setScheduleState(
        data.settings?.schedule?.length
          ? data.settings.schedule
          : DAY_NAMES.map((_, day) => ({ day, courseKey: "MIXED" })),
      );
      setLoaded(true);
    }
  }, [data, loaded, courseOptions]);

  const setDist = (i: number, patch: Partial<{ courseKey: string; count: number }>) => {
    setDistState((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const setSched = (i: number, courseKey: string) => {
    setScheduleState((s) => s.map((row, idx) => (idx === i ? { ...row, courseKey } : row)));
  };

  const save = async () => {
    setBusy(true);
    setOk("");
    try {
      const distribution = distState
        .filter((d) => d.courseKey && d.count > 0)
        .map((d) => ({ courseKey: d.courseKey, count: d.count }));
      if (distribution.length === 0) throw new Error("Add at least one course to the distribution");
      await updateQuizSettings({
        mode: modeState,
        questionsPerQuiz: qCountState,
        distribution,
        schedule: DAY_NAMES.map((_, i) => ({ day: i, courseKey: scheduleState[i]?.courseKey ?? "MIXED" })),
      });
      setOk("Quiz settings saved");
      setTimeout(() => setOk(""), 3000);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {ok && (
        <div style={{ marginBottom: 20, padding: "14px 20px", borderRadius: "var(--radius)", background: "var(--ok-weak)", color: "var(--ok)", fontWeight: 600 }}>
          ✅ {ok}
        </div>
      )}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>🧠 Daily Quiz Configuration</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 18 }}>
          learn-pi.md §8/§9 — MIXED pulls per-course from the distribution; COURSE_OF_THE_DAY follows the weekday schedule
        </div>

        <div className="form-grid">
          <Field label="Mode">
            <select value={modeState} onChange={(e) => setModeState(e.target.value as any)}>
              <option value="MIXED">MIXED (distribution mix)</option>
              <option value="COURSE_OF_THE_DAY">COURSE_OF_THE_DAY (weekday schedule)</option>
            </select>
          </Field>
          <Field label="Questions per quiz (1–20)">
            <input type="number" min={1} max={20} value={qCountState} onChange={(e) => setQCountState(Number(e.target.value))} />
          </Field>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, margin: "18px 0 10px" }}>Distribution (used in MIXED mode)</div>
        {distState.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <select value={d.courseKey} onChange={(e) => setDist(i, { courseKey: e.target.value })} style={{ flex: 1, padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <option value="">— course —</option>
              {courseOptions.map((c) => (
                <option key={c.key} value={c.key}>{c.title}</option>
              ))}
            </select>
            <input type="number" min={0} max={10} value={d.count} onChange={(e) => setDist(i, { count: Number(e.target.value) })} style={{ width: 80, padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)" }} />
            <button className="btn btn-sm btn-danger" onClick={() => setDistState((x) => x.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={() => setDistState((d) => [...d, { courseKey: courseOptions[0]?.key ?? "", count: 1 }])}>＋ Add row</button>

        <div style={{ fontSize: 13, fontWeight: 700, margin: "18px 0 10px" }}>Weekday schedule (used in COURSE_OF_THE_DAY mode)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {DAY_NAMES.map((day, i) => (
            <div key={day} style={{ background: "var(--surface-2)", padding: 10, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", marginBottom: 6 }}>{day}</div>
              <select value={scheduleState[i]?.courseKey ?? "MIXED"} onChange={(e) => setSched(i, e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12 }}>
                <option value="MIXED">MIXED</option>
                {courseOptions.map((c) => (
                  <option key={c.key} value={c.key}>{c.title}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "💾 Save Quiz Settings"}
          </button>
        </div>
      </div>
      <div className="card card-pad" style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 16 }}>
        <strong>Tip:</strong> questions only appear in the quiz when PUBLISHED. Use the Questions tab to review (NEEDS_REVIEW) and approve questions after a source change.
      </div>
    </div>
  );
}