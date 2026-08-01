import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

// Public submissions from the website (apps/website): contact form and
// advertiser/partner requests. No login is required, so these are the only
// place the app accepts writes from anonymous visitors. Validators + a
// minimal rate guard (inquiries are cheap, low-volume) keep them sane.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSubmission(args: {
  kind: "contact" | "partner";
  name: string;
  email: string;
  message: string;
}) {
  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  const message = args.message.trim();
  if (name.length < 2 || name.length > 100) throw new Error("Please enter your name.");
  if (!EMAIL_RE.test(email)) throw new Error("Please enter a valid email address.");
  if (message.length < 10 || message.length > 5000) {
    throw new Error("Message must be between 10 and 5000 characters.");
  }
  return { name, email, message };
}

/** Shared handler body used by both submit mutations. */
async function insertInquiry(
  ctx: MutationCtx,
  args: {
    kind: "contact" | "partner";
    name: string;
    email: string;
    company?: string;
    platform?: string;
    message: string;
    ip?: string;
  },
) {
  const cleaned = validateSubmission(args);
  const company = args.company?.trim();
  const platform = args.platform?.trim();
  await ctx.db.insert("inquiries", {
    kind: args.kind,
    name: cleaned.name,
    email: cleaned.email,
    company: company ? company.slice(0, 200) : undefined,
    platform: platform ? platform.slice(0, 100) : undefined,
    message: cleaned.message,
    status: "new",
    ip: args.ip?.slice(0, 45) || undefined,
  });
  return { ok: true };
}

/** Contact form: visitor reaching out with a question or support need. */
export const submitContact = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return insertInquiry(ctx, {
      kind: "contact",
      name: args.name,
      email: args.email,
      message: args.message,
      ip: args.ip,
    });
  },
});

/** Partner / advertiser request: someone wanting to list tasks or run ads. */
export const submitPartner = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    platform: v.optional(v.string()),
    message: v.string(),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return insertInquiry(ctx, {
      kind: "partner",
      name: args.name,
      email: args.email,
      company: args.company,
      platform: args.platform,
      message: args.message,
      ip: args.ip,
    });
  },
});

// ---------- Admin (token-gated, same pattern as convex/admin.ts) ----------

function requireAdmin(token: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "admin";
  if (token !== expected) throw new Error("Unauthorized");
}

export const listInquiries = query({
  args: {
    token: v.string(),
    kind: v.optional(v.union(v.literal("contact"), v.literal("partner"))),
    status: v.optional(
      v.union(v.literal("new"), v.literal("seen"), v.literal("done"), v.literal("archived")),
    ),
  },
  handler: async (ctx, { token, kind, status }) => {
    requireAdmin(token);
    const rows = await (kind
      ? ctx.db
          .query("inquiries")
          .withIndex("by_kind", (row) => row.eq("kind", kind))
      : status
        ? ctx.db
            .query("inquiries")
            .withIndex("by_status", (row) => row.eq("status", status))
        : ctx.db.query("inquiries"))
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      kind: row.kind,
      name: row.name,
      email: row.email,
      company: row.company ?? null,
      platform: row.platform ?? null,
      message: row.message,
      status: row.status,
      ip: row.ip ?? null,
    }));
  },
});

export const updateInquiryStatus = mutation({
  args: {
    token: v.string(),
    inquiryId: v.id("inquiries"),
    status: v.union(
      v.literal("new"),
      v.literal("seen"),
      v.literal("done"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, { token, inquiryId, status }) => {
    requireAdmin(token);
    await ctx.db.patch(inquiryId, { status });
  },
});

export const deleteInquiry = mutation({
  args: { token: v.string(), inquiryId: v.id("inquiries") },
  handler: async (ctx, { token, inquiryId }) => {
    requireAdmin(token);
    await ctx.db.delete(inquiryId);
  },
});
