import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { insertNote } from "./voiceNotes";

// Telegram DM wizard for admins (http.ts relays messages/button taps here).
// Say "hi" → A) add / edit mentor, B) post a voice note for a mentor.
// This mutation only decides what to reply; http.ts does the sending.

type Btn = { text: string; callback_data: string };
// `voice` asks http.ts to also copy the audio into the private channel.
export type Reply = { text: string; keyboard?: Btn[][]; edit?: boolean; voice?: { fileId: string; caption: string } };

const TYPES = ["episode", "update", "announcement"] as const;
type NoteType = (typeof TYPES)[number];
const LABEL: Record<NoteType, string> = { episode: "🎧 Episode", update: "📢 Update", announcement: "📣 Announcement" };
const isType = (s: string): s is NoteType => (TYPES as readonly string[]).includes(s);

const MENU: Reply = {
  text: "What do you want to do?",
  keyboard: [[{ text: "A · Add / edit mentor", callback_data: "a" }, { text: "B · Post", callback_data: "b" }]],
};
const CANCEL: Btn = { text: "✖ Cancel", callback_data: "cancel" };
const rows = (btns: Btn[], per = 2) => {
  const out: Btn[][] = [];
  for (let i = 0; i < btns.length; i += per) out.push(btns.slice(i, i + per));
  return out;
};
const when = (ms: number) => new Date(ms).toLocaleDateString("en-GB");

export const handle = internalMutation({
  args: {
    userId: v.string(),
    chatId: v.string(),
    messageId: v.number(),
    text: v.optional(v.string()),
    data: v.optional(v.string()),
    voice: v.optional(
      v.object({ fileId: v.string(), fileUniqueId: v.string(), duration: v.number(), mimeType: v.string() }),
    ),
    photoFileId: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<Reply[]> => {
    const sess = await ctx.db
      .query("botSessions")
      .withIndex("by_user", (q) => q.eq("telegramUserId", a.userId))
      .first();
    const state = sess?.state ?? "idle";
    const d = (sess?.draft ?? {}) as any;
    const set = async (state: string, draft: any) => {
      const row = { telegramUserId: a.userId, state, draft, updatedAt: Date.now() };
      if (sess) await ctx.db.patch(sess._id, row);
      else await ctx.db.insert("botSessions", row);
    };
    const text = a.text?.trim();
    const data = a.data;
    const mentor = async (): Promise<Doc<"mentors"> | null> => (d.mentorId ? ctx.db.get(d.mentorId as Id<"mentors">) : null);
    const allMentors = async () => (await ctx.db.query("mentors").collect()).sort((x, y) => x.name.localeCompare(y.name));

    // ---- global ----------------------------------------------------------
    if (data === "cancel" || text === "/cancel") {
      await set("idle", {});
      return [{ text: "Cancelled.", edit: !!data }, MENU];
    }
    if (data === "menu" || (!data && !a.voice && state === "idle")) {
      await set("idle", {});
      return [MENU];
    }

    // ---- A: mentors -------------------------------------------------------
    const typesReply = (m: Doc<"mentors">): Reply => {
      const on = m.types ?? [...TYPES];
      return {
        text: `${m.name} — which types does this mentor publish? Tap to toggle.`,
        keyboard: [
          ...TYPES.map((t) => [{ text: `${on.includes(t) ? "✅" : "☐"} ${LABEL[t]}`, callback_data: `tt:${t}` }]),
          [{ text: "💾 Done", callback_data: "dn" }],
        ],
        edit: true,
      };
    };
    if (data === "a") {
      const ms = await allMentors();
      await set("a_pick", {});
      return [
        {
          text: "Pick a mentor to edit, or add a new one:",
          keyboard: [[{ text: "➕ New mentor", callback_data: "nm" }], ...rows(ms.map((m) => ({ text: m.name, callback_data: `em:${m._id}` }))), [CANCEL]],
          edit: true,
        },
      ];
    }
    if (data === "nm") {
      await set("a_name", {});
      return [{ text: "Send the mentor's full name:", keyboard: [[CANCEL]], edit: true }];
    }
    // Profile fields collected one by one. `wizard` = creating a new mentor, so
    // each answer moves to the next field; otherwise a single field is edited.
    const FIELDS = ["role", "bio", "photo", "telegram"] as const;
    type Field = (typeof FIELDS)[number];
    const PROMPT: Record<Field, string> = {
      role: "Role / title (e.g. Pi Network Ambassador):",
      bio: "Short bio (2–3 sentences):",
      photo: "Send a profile photo 🖼:",
      telegram: "Telegram username (e.g. @aisha):",
    };
    const askField = (f: Field, edit: boolean): Reply => ({
      text: PROMPT[f],
      keyboard: [[{ text: "Skip", callback_data: "skip" }, CANCEL]],
      edit,
    });
    const nextField = async (after: Field | null, edit: boolean): Promise<Reply> => {
      const idx = after ? FIELDS.indexOf(after) + 1 : 0;
      if (idx < FIELDS.length) {
        await set("a_field", { ...d, field: FIELDS[idx], wizard: true });
        return askField(FIELDS[idx], edit);
      }
      await set("a_types", { mentorId: d.mentorId });
      return { ...typesReply((await mentor())!), edit };
    };
    const profileCard = (m: Doc<"mentors">) =>
      [
        `👤 ${m.name}`,
        m.role ? `💼 ${m.role}` : "💼 (no role)",
        m.bio ? `📝 ${m.bio}` : "📝 (no bio)",
        `🖼 ${m.photoFileId ? "photo set" : "no photo"}`,
        m.telegram ? `🔗 @${m.telegram}` : "🔗 (no Telegram)",
        `🏷 ${(m.types ?? [...TYPES]).map((t) => LABEL[t as NoteType]).join(", ")}`,
      ].join("\n");

    const editMenu = [
      [{ text: "✏️ Name", callback_data: "rn" }, { text: "💼 Role", callback_data: "ef:role" }],
      [{ text: "📝 Bio", callback_data: "ef:bio" }, { text: "🖼 Photo", callback_data: "ef:photo" }],
      [{ text: "🔗 Telegram", callback_data: "ef:telegram" }, { text: "🏷 Types", callback_data: "st" }],
      [{ text: "« Menu", callback_data: "menu" }],
    ];

    if (state === "a_name" && text) {
      const mentorId = await ctx.db.insert("mentors", { name: text, types: [...TYPES], createdAt: Date.now() });
      d.mentorId = mentorId;
      return [await nextField(null, false)];
    }
    if (state === "a_field") {
      const m = await mentor();
      const f = d.field as Field;
      if (!m) return [MENU];
      const skip = data === "skip" || text === "/skip";
      let ok = skip;
      if (!skip) {
        if (f === "photo" && a.photoFileId) { await ctx.db.patch(m._id, { photoFileId: a.photoFileId }); ok = true; }
        else if (f === "telegram" && text) { await ctx.db.patch(m._id, { telegram: text.replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "") }); ok = true; }
        else if (f !== "photo" && text) { await ctx.db.patch(m._id, { [f]: text }); ok = true; }
      }
      if (!ok) return [{ text: f === "photo" ? "Please send a photo, or tap Skip." : "Please send text, or tap Skip." }];
      if (d.wizard) return [await nextField(f, skip && !!data)];
      await set("a_menu", { mentorId: m._id });
      return [{ text: `✅ Saved.\n\n${profileCard((await ctx.db.get(m._id))!)}`, keyboard: editMenu, edit: skip && !!data }];
    }
    if (data?.startsWith("em:")) {
      const m = await ctx.db.get(data.slice(3) as Id<"mentors">);
      if (!m) return [MENU];
      await set("a_menu", { mentorId: m._id });
      return [{ text: profileCard(m), keyboard: editMenu, edit: true }];
    }
    if (data?.startsWith("ef:")) {
      const f = data.slice(3) as Field;
      if (!FIELDS.includes(f) || !d.mentorId) return [MENU];
      await set("a_field", { mentorId: d.mentorId, field: f, wizard: false });
      return [askField(f, true)];
    }
    if (data === "rn") {
      await set("a_rename", d);
      return [{ text: "Send the new name:", keyboard: [[CANCEL]], edit: true }];
    }
    if (state === "a_rename" && text) {
      const m = await mentor();
      if (m) {
        await ctx.db.patch(m._id, { name: text });
        for (const n of await ctx.db.query("voiceNotes").collect()) {
          if (n.mentor === m.name) await ctx.db.patch(n._id, { mentor: text, searchText: n.searchText.replace(m.name, text) });
        }
      }
      await set("idle", {});
      return [{ text: `✅ Renamed to ${text}` }, MENU];
    }
    if (data === "st") {
      const m = await mentor();
      if (!m) return [MENU];
      await set("a_types", d);
      return [typesReply(m)];
    }
    if (data?.startsWith("tt:")) {
      const m = await mentor();
      const t = data.slice(3);
      if (!m || !isType(t)) return [MENU];
      const on = new Set(m.types ?? TYPES);
      on.has(t) ? on.delete(t) : on.add(t);
      await ctx.db.patch(m._id, { types: TYPES.filter((x) => on.has(x)) });
      return [typesReply((await ctx.db.get(m._id))!)];
    }
    if (data === "dn") {
      const m = await mentor();
      await set("idle", {});
      return [{ text: `✅ Saved ${m?.name ?? "mentor"}.`, edit: true }, MENU];
    }

    // ---- B: post ----------------------------------------------------------
    const mentorPicker = async (filter: string, edit: boolean): Promise<Reply> => {
      const ms = (await allMentors()).filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()));
      const shown = ms.slice(0, 10);
      return {
        text: ms.length
          ? `Pick a mentor${ms.length > 10 ? ` (showing 10 of ${ms.length} — type part of a name to search)` : " (or type part of a name to search)"}:`
          : `No mentor matches "${filter}". Type another name, or /cancel.`,
        keyboard: [...rows(shown.map((m) => ({ text: m.name, callback_data: `m:${m._id}` }))), [CANCEL]],
        edit,
      };
    };
    if (data === "b") {
      await set("b_mentor", {});
      return [await mentorPicker("", true)];
    }
    if (state === "b_mentor" && text) return [await mentorPicker(text, false)];
    if (data?.startsWith("m:")) {
      const m = await ctx.db.get(data.slice(2) as Id<"mentors">);
      if (!m) return [MENU];
      const types = (m.types ?? [...TYPES]).filter(isType);
      await set("b_type", { mentorId: m._id });
      return [{ text: `${m.name} — what are you posting?`, keyboard: [types.map((t) => ({ text: LABEL[t], callback_data: `ty:${t}` })), [CANCEL]], edit: true }];
    }
    if (data?.startsWith("ty:")) {
      const t = data.slice(3);
      const m = await mentor();
      if (!m || !isType(t)) return [MENU];
      if (t !== "episode") {
        await set("b_title", { ...d, type: t });
        return [{ text: `${LABEL[t]} for ${m.name} — send the title:`, keyboard: [[CANCEL]], edit: true }];
      }
      const notes = await ctx.db.query("voiceNotes").withIndex("by_created").order("desc").collect();
      const series = [...new Set(notes.filter((n) => n.mentor === m.name && n.type === "episode" && n.series).map((n) => n.series!))];
      await set("b_series", { ...d, type: t, series });
      return [
        {
          text: series.length ? `${m.name} — which episode series?` : `${m.name} has no episode series yet.`,
          keyboard: [...series.map((s, i) => [{ text: `📚 ${s}`, callback_data: `sr:${i}` }]), [{ text: "➕ New series", callback_data: "ns" }], [CANCEL]],
          edit: true,
        },
      ];
    }
    if (data === "ns") {
      await set("b_series_name", d);
      return [{ text: "Send the series name (e.g. Pi Basics):", keyboard: [[CANCEL]], edit: true }];
    }
    if (state === "b_series_name" && text) {
      await set("b_title", { ...d, series: text, number: 1 });
      return [{ text: `📚 ${text} — Episode 1. Send the title:`, keyboard: [[CANCEL]] }];
    }
    if (data?.startsWith("sr:")) {
      const m = await mentor();
      const s = d.series?.[Number(data.slice(3))];
      if (!m || !s) return [MENU];
      const last = (await ctx.db.query("voiceNotes").withIndex("by_created").order("desc").collect()).find(
        (n) => n.mentor === m.name && n.series === s,
      );
      const number = (last?.episodeNumber ?? 0) + 1;
      await set("b_next", { ...d, series: s, number });
      const info = last
        ? `Last post: Episode ${last.episodeNumber ?? "?"} — ${last.title}\n${last.note ? `📝 ${last.note}\n` : ""}📅 ${when(last.createdAt)}`
        : "No episodes posted yet.";
      return [
        {
          text: `📚 ${s} · ${m.name}\n\n${info}\n\nPost Episode ${number} now?`,
          keyboard: [[{ text: `▶️ Yes, post Episode ${number}`, callback_data: "nx" }], [{ text: "« Back", callback_data: "b" }, CANCEL]],
          edit: true,
        },
      ];
    }
    if (data === "nx") {
      await set("b_title", d);
      return [{ text: `📚 ${d.series} — Episode ${d.number}. Send the title:`, keyboard: [[CANCEL]], edit: true }];
    }
    if (state === "b_title" && text) {
      await set("b_note", { ...d, title: text });
      return [{ text: "Send a short note about it (or /skip):", keyboard: [[{ text: "Skip", callback_data: "skip" }, CANCEL]] }];
    }
    if (state === "b_note" && (text || data === "skip") && !a.voice) {
      const note = data === "skip" || text === "/skip" ? undefined : text;
      await set("b_voice", { ...d, note });
      return [{ text: "Now send the voice message 🎤", keyboard: [[CANCEL]], edit: data === "skip" }];
    }
    if ((state === "b_voice" || state === "b_note") && a.voice) {
      const m = await mentor();
      const title: string = d.title ?? "Voice note";
      const result = await insertNote(
        ctx,
        {
          chatId: a.chatId,
          messageId: a.messageId,
          ...a.voice,
          title,
          mentor: m?.name,
          type: d.type,
          series: d.series,
          episodeNumber: d.number,
          note: d.note,
          date: Math.floor(Date.now() / 1000),
        },
        { upsert: true },
      );
      await set("idle", {});
      const what = d.type === "episode" ? `📚 ${d.series} · Episode ${d.number}` : LABEL[d.type as NoteType] ?? "Voice note";
      const caption = [title, m ? `Mentor: ${m.name}` : "", d.type ? `Type: ${d.type}` : "", d.series ? `${d.series} · Episode ${d.number}` : "", d.note ?? ""]
        .filter(Boolean)
        .join("\n");
      return [
        {
          text: `${result === "updated" ? "♻️ Updated existing post in the app" : "✅ Posted to the app"}\n${what}\n${title}\n👤 ${m?.name ?? "—"}`,
          voice: result === "inserted" ? { fileId: a.voice.fileId, caption } : undefined,
        },
        MENU,
      ];
    }
    if (state === "b_voice") return [{ text: "Please send a voice message 🎤 (or /cancel)" }];
    if (state.startsWith("a_") || state.startsWith("b_")) return [{ text: "Please use the buttons above, or /cancel." }];
    return [MENU];
  },
});
