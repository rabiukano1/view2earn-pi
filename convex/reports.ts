import { v } from "convex/values";
import { query, internalQuery, action, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, deriveEconomy } from "./lib/guards";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type ReportData = {
  user: {
    username: string;
    name: string;
    ecosystem: "PI" | "SIDRA";
    tier: number;
    country: string;
    joinedAt: number;
    payoutEvm: string;
    payoutSolana: string;
    telegramUserId: string;
  };
  stats: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    tasksCompleted: number;
  };
  rows: ActivityRow[];
};

// User activity report. Generates a modern PDF (server-side, via pdf-lib)
// describing a user's points balance, earnings/spend, task completions, and
// points ledger. The same stored file is downloadable from the mobile profile
// (self) and from the admin panel (any user, via admin token).

type ActivityRow = {
  time: number;
  label: string;
  kind: string; // "task" | "quiz" | "redeem" | "bonus" | "other"
  detail: string;
  delta: number;
  balanceAfter: number;
};

const REASON_LABELS: Record<string, { label: string; kind: string }> = {
  TASK_COMPLETED: { label: "Task completed", kind: "task" },
  QUIZ_CORRECT: { label: "Quiz correct", kind: "quiz" },
  SURVEY_COMPLETED: { label: "Survey completed", kind: "task" },
  MARKETPLACE_LISTING: { label: "Marketplace listing", kind: "bonus" },
  MARKETPLACE_REFUND: { label: "Listing refund", kind: "bonus" },
  REDEEM: { label: "Redeemed reward", kind: "redeem" },
  REFERRAL_BONUS: { label: "Referral bonus", kind: "bonus" },
  REFERRAL_REFEREE: { label: "Referral referee bonus", kind: "bonus" },
  ADMIN_BONUS: { label: "Admin bonus", kind: "bonus" },
};

function reasonMeta(reason: string): { label: string; kind: string } {
  if (reason.startsWith("AD_REWARD_")) {
    return { label: "Ad reward", kind: "bonus" };
  }
  return REASON_LABELS[reason] ?? { label: reason, kind: "other" };
}

// Helper function to fetch report data without circular query type dependency
async function getActivityDataHelper(ctx: QueryCtx, userId: Id<"users">): Promise<ReportData> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  // Only report the caller's own economy — the two economies never mix.
  const economy = deriveEconomy(user);

  const ledger = await ctx.db
    .query("pointsLedger")
    .withIndex("by_user_economy", (q) => q.eq("userId", userId).eq("economy", economy))
    .order("desc")
    .take(200);

  const verifications = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  // Map task ids -> names for a friendlier report.
  const taskIds = new Set(verifications.map((v) => v.taskId));
  const taskNames = new Map<string, string>();
  for (const id of taskIds) {
    const t = await ctx.db.get(id);
    taskNames.set(id, t?.name || t?.targetUrl || "");
  }

  const balances = ledger.map((l) => l.balanceAfter);
  const balance = balances[0] ?? 0; // newest first
  const totalEarned = ledger.reduce((s, l) => (l.delta > 0 ? s + l.delta : s), 0);
  const totalSpent = ledger.reduce((s, l) => (l.delta < 0 ? s - l.delta : s), 0);

  const released = verifications.filter((v) => v.state === "RELEASED").length;

  const rows: ActivityRow[] = ledger.map((l) => {
    const meta = reasonMeta(l.reason);
    const detail =
      meta.kind === "task"
        ? taskNames.get(l.refId ?? "") ?? ""
        : l.refId ?? "";
    return {
      time: l._creationTime,
      label: meta.label,
      kind: meta.kind,
      detail,
      delta: l.delta,
      balanceAfter: l.balanceAfter,
    };
  });

  return {
    user: {
      username: user.username,
      name: user.name ?? "",
      ecosystem: user.ecosystem,
      tier: user.tier,
      country: user.country,
      joinedAt: user._creationTime,
      payoutEvm: user.payoutEvm ?? "",
      payoutSolana: user.payoutSolana ?? "",
      telegramUserId: user.telegramUserId ?? "",
    },
    stats: { balance, totalEarned, totalSpent, tasksCompleted: released },
    rows,
  };
}

// Gather everything an activity report needs for one user.
export const getActivityData = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<ReportData> => {
    return getActivityDataHelper(ctx, userId);
  },
});

// Public query for the mobile in-app report screen (self only).
export const myActivity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<ReportData> => {
    await requireUser(ctx, args.userId);
    return getActivityDataHelper(ctx, args.userId);
  },
});

// Admin query for any user's report data (token-guarded).
export const adminActivity = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }): Promise<ReportData> => {
    const expected = process.env.ADMIN_PASSWORD ?? "admin";
    if (token !== expected) throw new Error("Unauthorized");
    return getActivityDataHelper(ctx, userId);
  },
});

function rowKindColor(kind: string): [number, number, number] {
  switch (kind) {
    case "task":
      return [0.13, 0.55, 0.95]; // blue
    case "quiz":
      return [0.96, 0.62, 0.05]; // amber
    case "bonus":
      return [0.13, 0.69, 0.47]; // green
    case "redeem":
      return [0.86, 0.27, 0.27]; // red
    default:
      return [0.42, 0.46, 0.55]; // slate
  }
}

// Builds the PDF bytes for a report. Pure function so it's easy to reason about.
async function buildActivityPdf(data: ReportData) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const brand = [0.42, 0.24, 0.93]; // View2Earn purple
  const slate = [0.42, 0.46, 0.55];
  const ink = [0.09, 0.1, 0.16];
  const light = [0.95, 0.95, 0.98];

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function hLine(color: number[]) {
    page.drawRectangle({
      x: margin,
      y: y - 1,
      width: contentWidth,
      height: 1.5,
      color: rgb(color[0], color[1], color[2]),
    });
  }

  function text(txt: string, size: number, x: number, yy: number, opts: { bold?: boolean; color?: number[] } = {}) {
    const f = opts.bold ? bold : font;
    const c = opts.color ?? ink;
    page.drawText(txt, {
      x,
      y: yy,
      size,
      font: f,
      color: rgb(c[0], c[1], c[2]),
    });
  }

  function truncate(txt: string, max: number): string {
    return txt.length > max ? txt.slice(0, max - 1) + "…" : txt;
  }

  // ---- Brand header bar ----
  page.drawRectangle({ x: 0, y: pageHeight - 92, width: pageWidth, height: 92, color: rgb(brand[0], brand[1], brand[2]) });
  text("View2Earn", 22, margin, pageHeight - 42, { bold: true, color: [1, 1, 1] });
  text("USER ACTIVITY REPORT", 10, margin, pageHeight - 62, { color: [0.88, 0.84, 1] });
  const generated = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  text(`Generated ${generated}`, 9, pageWidth - margin - 140, pageHeight - 44, { color: [0.9, 0.89, 1] });

  y = pageHeight - 120;

  // ---- Identity card ----
  text("Member profile", 11, margin, y, { bold: true, color: brand });
  y -= 6;
  y -= 18;
  const { user, stats } = data;
  const ecosystemLabel = user.ecosystem === "PI" ? "Pi Network" : "Sidra Chain";
  text(truncate(user.name || user.username, 34), 16, margin, y, { bold: true });
  text(`@${user.username}`, 11, margin + 170, y + 3, { color: slate });
  y -= 16;
  text(`${ecosystemLabel}  ·  Tier ${user.tier}`, 9.5, margin, y, { color: slate });
  text(`Country: ${user.country || "—"}  ·  Joined ${new Date(user.joinedAt).toLocaleDateString()}`, 9.5, margin + 170, y, { color: slate });
  y -= 8;

  // ---- KPI cards ----
  const cardCount = 4;
  const gap = 10;
  const cardWidth = (contentWidth - gap * (cardCount - 1)) / cardCount;
  const kpi = [
    { label: "Balance", value: stats.balance, color: brand },
    { label: "Earned", value: stats.totalEarned, color: [0.13, 0.69, 0.47] },
    { label: "Spent", value: stats.totalSpent, color: [0.86, 0.27, 0.27] },
    { label: "Tasks done", value: stats.tasksCompleted, color: [0.13, 0.55, 0.95] },
  ];
  const kpiY = y - 14;
  let cardX = margin;
  for (const c of kpi) {
    page.drawRectangle({ x: cardX, y: kpiY - 56, width: cardWidth, height: 56, color: rgb(light[0], light[1], light[2]) });
    page.drawRectangle({ x: cardX, y: kpiY - 5, width: cardWidth, height: 3, color: rgb(c.color[0], c.color[1], c.color[2]) });
    text(c.label.toUpperCase(), 7.5, cardX + 8, kpiY - 18, { bold: true, color: slate });
    text(String(c.value), 17, cardX + 8, kpiY - 38, { bold: true, color: c.color });
    cardX += cardWidth + gap;
  }
  y = kpiY - 74;

  // ---- Ledger table ----
  y -= 10;
  text("Activity log", 12, margin, y, { bold: true, color: brand });
  y -= 8;
  hLine(light);
  y -= 22;

  // Table header
  const colDate = margin;
  const colLabel = margin + 96;
  const colDetail = margin + 220;
  const colDelta = pageWidth - margin - 120;
  const colBal = pageWidth - margin - 44;
  text("DATE", 8, colDate, y, { bold: true, color: slate });
  text("ACTIVITY", 8, colLabel, y, { bold: true, color: slate });
  text("REFERENCE", 8, colDetail, y, { bold: true, color: slate });
  text("POINTS", 8, colDelta, y, { bold: true, color: slate });
  text("BALANCE", 8, colBal, y, { bold: true, color: slate });
  y -= 12;
  hLine(ink);
  y -= 22;

  if (data.rows.length === 0) {
    text("No activity yet — complete tasks to earn points.", 10, margin, y, { color: slate });
  } else {
    for (const row of data.rows) {
      ensureSpace(24);
      const dotColor = rowKindColor(row.kind);
      page.drawCircle({
        x: margin + 3,
        y: y + 4,
        size: 3,
        color: rgb(dotColor[0], dotColor[1], dotColor[2]),
      });
      text(new Date(row.time).toLocaleDateString("en-US", { month: "short", day: "2-digit" }), 8.5, colDate, y, { color: slate });
      text(truncate(row.label, 20), 9.5, colLabel, y, { bold: row.delta > 0 });
      text(truncate(row.detail, 26), 8.5, colDetail, y, { color: slate });
      const deltaColor = row.delta >= 0 ? [0.13, 0.69, 0.47] : [0.86, 0.27, 0.27];
      text(`${row.delta >= 0 ? "+" : ""}${row.delta}`, 9.5, colDelta, y, { bold: true, color: deltaColor });
      text(String(row.balanceAfter), 9.5, colBal, y, { bold: true });
      y -= 20;
      if (row !== data.rows[data.rows.length - 1]) {
        page.drawRectangle({
          x: margin,
          y: y - 4,
          width: contentWidth,
          height: 0.5,
          color: rgb(0.92, 0.93, 0.95),
        });
      }
    }
  }

  // ---- Footer ----
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 34, color: rgb(light[0], light[1], light[2]) });
  text("View2Earn · Confidential account activity", 8, margin, 12, { color: slate });
  text(`Page ${pdf.getPageCount()}`, 8, pageWidth - margin - 40, 12, { color: slate });

  return await pdf.save();
}

// Generate + store a PDF report. Callable by the user themself (auth session)
// or by an admin (token). Returns a storage id + signed URL for download.
export const generatePdf = action({
  args: {
    userId: v.id("users"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { userId, token }) => {
    // Allow admin (shared secret) to generate for any user, or self via session.
    const expected = process.env.ADMIN_PASSWORD ?? "admin";
    const isAdmin = !!token && token === expected;
    if (!isAdmin) {
      const authUserId = await getAuthUserId(ctx);
      if (!authUserId) throw new Error("Not authenticated");
      if (authUserId !== userId) throw new Error("Unauthorized");
    }

    const data = await ctx.runQuery(internal.reports.getActivityData, { userId });
    const bytes = await buildActivityPdf(data);
    const blob = new Blob([bytes as any], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    return { storageId, url };
  },
});