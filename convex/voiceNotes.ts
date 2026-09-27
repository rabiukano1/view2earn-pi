import { v } from "convex/values";
import { action, query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./admin";

// Mentor voice notes — metadata only. The audio itself stays in the private
// Telegram channel; http.ts /voice/file streams it from Telegram on demand
// using the bot token (server side), so nothing is stored in Convex.

const PAGE = 200;

export const NOTE_TYPES = ["episode", "update", "announcement"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];
const noteType = v.union(v.literal("episode"), v.literal("update"), v.literal("announcement"));

const pub = (r: any) => ({
  _id: r._id,
  title: r.title,
  mentor: r.mentor,
  type: r.type,
  series: r.series,
  episodeNumber: r.episodeNumber,
  note: r.note,
  caption: r.caption,
  duration: r.duration,
  mimeType: r.mimeType,
  createdAt: r.createdAt,
});

const searchTextOf = (r: { title: string; mentor?: string; caption?: string; type?: string; series?: string; note?: string }) =>
  [r.title, r.mentor, r.type, r.series, r.note, r.caption].filter(Boolean).join(" ");

export const insertArgs = {
  chatId: v.string(),
  messageId: v.number(),
  fileId: v.string(),
  fileUniqueId: v.string(),
  duration: v.number(),
  mimeType: v.string(),
  title: v.string(),
  mentor: v.optional(v.string()),
  type: v.optional(noteType),
  series: v.optional(v.string()),
  episodeNumber: v.optional(v.number()),
  note: v.optional(v.string()),
  caption: v.optional(v.string()),
  date: v.number(),
};
type InsertArgs = {
  chatId: string; messageId: number; fileId: string; fileUniqueId: string; duration: number; mimeType: string;
  title: string; mentor?: string; type?: NoteType; series?: string; episodeNumber?: number; note?: string; caption?: string; date: number;
};

// Shared by the channel webhook and the DM wizard (bot.ts).
// Returns "inserted", "updated" (same audio re-filed with new metadata, DM
// flow only) or "duplicate" (channel redelivery / bot's own channel copy).
export async function insertNote(
  ctx: any,
  a: InsertArgs,
  opts: { upsert?: boolean } = {},
): Promise<"inserted" | "updated" | "duplicate"> {
  const dup = await ctx.db
    .query("voiceNotes")
    .withIndex("by_file", (q: any) => q.eq("fileUniqueId", a.fileUniqueId))
    .first();
  if (dup && !opts.upsert) return "duplicate";
  await registerMentor(ctx, a.mentor);
  if (dup) {
    const next = { title: a.title, mentor: a.mentor, type: a.type, series: a.series, episodeNumber: a.episodeNumber, note: a.note, caption: a.caption };
    await ctx.db.patch(dup._id, { ...next, searchText: searchTextOf(next) });
    return "updated";
  }
  await ctx.db.insert("voiceNotes", {
    title: a.title,
    mentor: a.mentor,
    type: a.type,
    series: a.series,
    episodeNumber: a.episodeNumber,
    note: a.note,
    caption: a.caption,
    searchText: searchTextOf(a),
    duration: a.duration,
    mimeType: a.mimeType,
    telegramFileId: a.fileId,
    telegramChatId: a.chatId,
    telegramMessageId: a.messageId,
    fileUniqueId: a.fileUniqueId,
    createdAt: a.date * 1000,
  });
  return "inserted";
}

async function registerMentor(ctx: any, name: string | undefined) {
  const n = name?.trim();
  if (!n) return;
  const dup = await ctx.db.query("mentors").withIndex("by_name", (q: any) => q.eq("name", n)).first();
  if (!dup) await ctx.db.insert("mentors", { name: n, createdAt: Date.now() });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("voiceNotes").withIndex("by_created").order("desc").take(PAGE);
    return rows.map(pub);
  },
});

export const search = query({
  args: { q: v.string(), mentor: v.optional(v.string()), type: v.optional(noteType) },
  handler: async (ctx, { q, mentor, type }) => {
    const term = q.trim();
    if (!term) return [];
    const rows = await ctx.db
      .query("voiceNotes")
      .withSearchIndex("search_text", (s) => {
        let f = s.search("searchText", term);
        if (mentor) f = f.eq("mentor", mentor);
        if (type) f = f.eq("type", type);
        return f;
      })
      .take(PAGE);
    return rows.map(pub);
  },
});

export const mentors = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("mentors").collect()).map((m) => ({
      _id: m._id,
      name: m.name,
      role: m.role,
      bio: m.bio,
      telegram: m.telegram,
      photoUrl: m.photoUrl, // admin-set URL; otherwise hasPhoto → /mentor/photo?id=<_id>
      hasPhoto: !!m.photoFileId,
    })),
});

// ---- Admin panel CRUD -----------------------------------------------------
const mentorFields = {
  name: v.string(),
  role: v.optional(v.string()),
  bio: v.optional(v.string()),
  telegram: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
  types: v.optional(v.array(v.string())),
};
const cleanMentor = (a: { name: string; role?: string; bio?: string; telegram?: string; photoUrl?: string; types?: string[] }) => {
  const name = a.name.trim();
  if (!name) throw new Error("Name is required");
  const types = (a.types ?? [...NOTE_TYPES]).filter((t) => (NOTE_TYPES as readonly string[]).includes(t));
  return {
    name,
    role: a.role?.trim() || undefined,
    bio: a.bio?.trim() || undefined,
    telegram: a.telegram?.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "") || undefined,
    photoUrl: a.photoUrl?.trim() || undefined,
    types: types.length ? types : [...NOTE_TYPES],
  };
};

export const listMentorsAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const notes = await ctx.db.query("voiceNotes").collect();
    return (await ctx.db.query("mentors").collect())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ ...m, noteCount: notes.filter((n) => n.mentor === m.name).length }));
  },
});

export const createMentor = mutation({
  args: { token: v.string(), ...mentorFields },
  handler: async (ctx, { token, ...a }) => {
    requireAdmin(token);
    const data = cleanMentor(a);
    const dup = await ctx.db.query("mentors").withIndex("by_name", (q) => q.eq("name", data.name)).first();
    if (dup) throw new Error(`"${data.name}" already exists`);
    return await ctx.db.insert("mentors", { ...data, createdAt: Date.now() });
  },
});

export const updateMentor = mutation({
  args: { token: v.string(), id: v.id("mentors"), ...mentorFields },
  handler: async (ctx, { token, id, ...a }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Mentor not found");
    const data = cleanMentor(a);
    await ctx.db.patch(id, data);
    if (data.name !== existing.name) {
      // Keep notes attached to the renamed mentor.
      for (const n of await ctx.db.query("voiceNotes").collect()) {
        if (n.mentor === existing.name) {
          await ctx.db.patch(n._id, { mentor: data.name, searchText: n.searchText.replace(existing.name, data.name) });
        }
      }
    }
  },
});

export const removeMentor = mutation({
  args: { token: v.string(), id: v.id("mentors") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    await ctx.db.delete(id); // notes keep their mentor name; re-adding the same name re-links them
  },
});

export const getMentorPhoto = internalQuery({
  args: { id: v.id("mentors") },
  handler: async (ctx, { id }) => (await ctx.db.get(id))?.photoFileId ?? null,
});

// Called by the Telegram webhook for each voice/audio channel post.
export const insert = internalMutation({
  args: insertArgs,
  handler: (ctx, a) => insertNote(ctx, a),
});

// Bot button taps + caption edits land here. Any field left undefined is kept.
export const classify = internalMutation({
  args: {
    chatId: v.string(),
    messageId: v.number(),
    type: v.optional(noteType),
    mentor: v.optional(v.string()),
    mentorId: v.optional(v.id("mentors")),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const row = await ctx.db
      .query("voiceNotes")
      .withIndex("by_message", (q) => q.eq("telegramChatId", a.chatId).eq("telegramMessageId", a.messageId))
      .first();
    if (!row) return null;
    const mentor = a.mentorId ? (await ctx.db.get(a.mentorId))?.name : a.mentor;
    await registerMentor(ctx, mentor);
    const next = {
      title: a.title ?? row.title,
      mentor: mentor ?? row.mentor,
      type: a.type ?? row.type,
      caption: a.caption ?? row.caption,
    };
    await ctx.db.patch(row._id, { ...next, searchText: searchTextOf(next) });
    return next;
  },
});

export const listMentorsInternal = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("mentors").collect()).map((m) => ({ _id: m._id, name: m.name })),
});

export const getForStream = internalQuery({
  args: { id: v.id("voiceNotes") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    return row ? { fileId: row.telegramFileId, mimeType: row.mimeType, title: row.title } : null;
  },
});

// ---- Admin panel: create a voice note by uploading an audio file ----

// Telegram bots can only DOWNLOAD files up to 20 MB (getFile), and playback goes
// back through the bot, so that is the ceiling for an upload.
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Admin upload: the panel PUTs the audio to the URL above, then calls this.
 * Convex storage is only a staging buffer — the bytes are pushed into the
 * private Telegram channel and the staged blob is deleted, so no audio is
 * stored in Convex (same rule as the bot-posted notes).
 */
export const createFromUpload = action({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    title: v.string(),
    mentor: v.optional(v.string()),
    type: v.optional(noteType),
    series: v.optional(v.string()),
    episodeNumber: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<{ ok: true }> => {
    requireAdmin(a.token);
    const title = a.title.trim();
    if (!title) throw new Error("Title is required");

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channel = process.env.TELEGRAM_VOICE_CHANNEL_ID;
    if (!botToken || !channel) throw new Error("TELEGRAM_VOICE_CHANNEL_ID is not set");

    const blob = await ctx.storage.get(a.storageId);
    if (!blob) throw new Error("Upload not found — please try again");
    if (blob.size > MAX_AUDIO_BYTES) {
      await ctx.storage.delete(a.storageId);
      throw new Error(
        `That file is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`,
      );
    }

    // sendAudio (not sendVoice) so ordinary mp3/m4a files are accepted as-is.
    const caption = [title, a.mentor ? `Mentor: ${a.mentor}` : "", a.type ? `Type: ${a.type}` : "", a.note ?? ""]
      .filter(Boolean)
      .join("\n");
    const form = new FormData();
    form.append("chat_id", channel);
    form.append("caption", caption.slice(0, 1000));
    form.append("audio", blob, "voice-note.mp3");
    if (a.mentor) form.append("performer", a.mentor);
    form.append("title", title);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, { method: "POST", body: form });
    const payload = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: {
        message_id: number;
        audio?: { file_id: string; file_unique_id: string; duration?: number; mime_type?: string };
        voice?: { file_id: string; file_unique_id: string; duration?: number; mime_type?: string };
      };
    };
    await ctx.storage.delete(a.storageId);
    const media = payload.result?.audio ?? payload.result?.voice;
    if (!payload.ok || !media) {
      throw new Error(`Upload failed: ${payload.description ?? "Telegram rejected the file"}`);
    }

    await ctx.runMutation(internal.voiceNotes.insert, {
      chatId: channel,
      messageId: payload.result!.message_id,
      fileId: media.file_id,
      fileUniqueId: media.file_unique_id,
      duration: media.duration ?? 0,
      mimeType: media.mime_type ?? "audio/mpeg",
      title,
      mentor: a.mentor,
      type: a.type,
      series: a.series,
      episodeNumber: a.episodeNumber,
      note: a.note,
      caption,
      date: Math.floor(Date.now() / 1000),
    });
    return { ok: true };
  },
});

/** Next free episode number in a series, so the form can pre-fill it. */
export const nextEpisodeNumber = query({
  args: { token: v.string(), series: v.string(), mentor: v.optional(v.string()) },
  handler: async (ctx, { token, series, mentor }) => {
    requireAdmin(token);
    const rows = await ctx.db.query("voiceNotes").collect();
    const used = rows.filter((r) => r.series === series && (!mentor || r.mentor === mentor));
    return used.reduce((m, r) => Math.max(m, r.episodeNumber ?? 0), 0) + 1;
  },
});

// ---- Admin panel: edit notes and group them into series ----

export const listNotesAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("voiceNotes").withIndex("by_created").order("desc").take(500);
  },
});

/** All distinct series names, for the "move to group" picker. */
export const seriesList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const rows = await ctx.db.query("voiceNotes").collect();
    return [...new Set(rows.map((r) => r.series).filter((s): s is string => !!s))].sort();
  },
});

export const updateNote = mutation({
  args: {
    token: v.string(),
    id: v.id("voiceNotes"),
    title: v.optional(v.string()),
    mentor: v.optional(v.string()),
    type: v.optional(noteType),
    series: v.optional(v.string()),
    episodeNumber: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...a }) => {
    requireAdmin(token);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Voice note not found");
    if (a.title !== undefined && !a.title.trim()) throw new Error("Title cannot be empty");
    // An empty string clears an optional field; undefined leaves it untouched.
    const clear = (val: string | undefined, current: string | undefined) =>
      val === undefined ? current : val.trim() || undefined;
    const next = {
      title: a.title?.trim() ?? row.title,
      mentor: clear(a.mentor, row.mentor),
      type: a.type ?? row.type,
      series: clear(a.series, row.series),
      episodeNumber: a.episodeNumber ?? row.episodeNumber,
      note: clear(a.note, row.note),
    };
    await registerMentor(ctx, next.mentor);
    await ctx.db.patch(id, { ...next, searchText: searchTextOf({ ...next, caption: row.caption }) });
  },
});

/**
 * Move many notes into a group at once: set their series (and optionally
 * mentor/type). With `renumber`, episodes are numbered oldest → newest.
 */
export const bulkUpdateNotes = mutation({
  args: {
    token: v.string(),
    ids: v.array(v.id("voiceNotes")),
    series: v.optional(v.string()),
    mentor: v.optional(v.string()),
    type: v.optional(noteType),
    renumber: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, ids, series, mentor, type, renumber }) => {
    requireAdmin(token);
    const rows = (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter((r) => r !== null);
    rows.sort((a, b) => a!.createdAt - b!.createdAt); // oldest first = Episode 1
    await registerMentor(ctx, mentor);
    let n = 0;
    for (const row of rows) {
      n += 1;
      const next = {
        title: row!.title,
        mentor: mentor?.trim() || row!.mentor,
        type: type ?? row!.type,
        series: series === undefined ? row!.series : series.trim() || undefined,
        episodeNumber: renumber ? n : row!.episodeNumber,
        note: row!.note,
      };
      await ctx.db.patch(row!._id, { ...next, searchText: searchTextOf({ ...next, caption: row!.caption }) });
    }
    return { done: rows.length };
  },
});

// Admin: `npx convex run voiceNotes:remove '{"token":"<ADMIN_PASSWORD>","id":"<id>"}'`
export const remove = mutation({
  args: { token: v.string(), id: v.id("voiceNotes") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    await ctx.db.delete(id);
  },
});
