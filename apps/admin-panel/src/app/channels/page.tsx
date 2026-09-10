"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/api";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { Modal, Field, PageHeader, EmptyRow, confirmThen, timeAgo } from "@/components/ui";
import { Tv, Plus, Edit2, Trash2, Play, Pause, Wand2 } from "lucide-react";
import type { Id } from "@convex/dataModel";

const CATEGORIES = ["Football", "Sports", "News", "Entertainment"];
const TYPES = [
  { value: "football", label: "Football / IPTV" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Other Live Stream" },
];

type Form = {
  id?: Id<"iptvChannels">;
  name: string;
  logo: string;
  country: string;
  category: string;
  type: "football" | "youtube" | "other";
  streamUrl: string;
  youtubeHandle: string;
  backupStreamUrls: string;
  quality: string;
  currentMatch: string;
};

const emptyForm: Form = {
  name: "",
  logo: "",
  country: "",
  category: "Football",
  type: "football",
  streamUrl: "",
  youtubeHandle: "",
  backupStreamUrls: "",
  quality: "720p HD",
  currentMatch: "",
};

// Normalize a YouTube handle/username/channel id/URL into a valid URL.
// Accepts: "@NASA", "NASA", "UC...", "youtube.com/@NASA", full watch/short URLs.
function normalizeYoutubeInput(raw: string): string {
  const input = raw.trim();
  if (!input) return "";
  if (/^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.be)/i.test(input)) {
    return /^https?:\/\//i.test(input) ? input : `https://${input}`;
  }
  const handle = input.replace(/^@/, "");
  return `https://www.youtube.com/@${handle}`;
}

export default function ChannelsPage() {
  const channels = useAdminQuery(api.iptv.listAll);
  const create = useAdminMutation(api.iptv.create);
  const update = useAdminMutation(api.iptv.update);
  const setStatus = useAdminMutation(api.iptv.setStatus);
  const remove = useAdminMutation(api.iptv.remove);

  const [editing, setEditing] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);
  const resolveUrl = useAction(api.iptv.resolve);

  const autoResolve = async () => {
    if (!editing) return;
    const isYoutube = editing.type === "youtube";
    const raw = isYoutube
      ? normalizeYoutubeInput(editing.youtubeHandle || editing.streamUrl)
      : editing.streamUrl.trim();
    if (!raw) {
      setResolveNote(isYoutube ? "Enter a YouTube handle or URL first" : "Paste a URL first");
      return;
    }
    setResolving(true);
    setResolveNote(null);
    try {
      const res = await resolveUrl({ url: raw });
      if (res.ok && res.m3u8Url) {
        setEditing({ ...editing, streamUrl: res.m3u8Url });
      }
      setResolveNote(res.note);
    } catch (e) {
      setResolveNote(String(e));
    } finally {
      setResolving(false);
    }
  };

  const openNew = () => setEditing({ ...emptyForm });
  const openEdit = (c: any) => {
    const isYoutube = (c.type ?? "football") === "youtube";
    setEditing({
      id: c._id,
      name: c.name,
      logo: c.logo ?? "",
      country: c.country ?? "",
      category: c.category,
      type: isYoutube ? "youtube" : (c.type ?? "football"),
      streamUrl: c.streamUrl,
      youtubeHandle: isYoutube
        ? c.streamUrl.replace(/^https?:\/\/www\.youtube\.com\//i, "").replace(/^@?/, "@")
        : "",
      backupStreamUrls: (c.backupStreamUrls ?? []).join("\n"),
      quality: c.quality ?? "720p HD",
      currentMatch: c.currentMatch ?? "",
    });
  };

  const save = async () => {
    if (!editing) return;
    const isYoutube = editing.type === "youtube";
    const streamUrl = isYoutube
      ? normalizeYoutubeInput(editing.youtubeHandle || editing.streamUrl)
      : editing.streamUrl.trim();
    if (!editing.name.trim() || !streamUrl) {
      alert(isYoutube ? "Name and a YouTube handle or URL are required" : "Name and Stream URL are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: editing.name.trim(),
        logo: editing.logo.trim() || undefined,
        country: editing.country.trim() || "Global",
        category: editing.category,
        type: editing.type,
        streamUrl,
        backupStreamUrls: editing.backupStreamUrls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean),
        quality: editing.quality.trim() || "720p HD",
        currentMatch: editing.currentMatch.trim() || undefined,
      };
      if (editing.id) {
        await update({ id: editing.id, ...payload });
      } else {
        await create(payload);
      }
      setEditing(null);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Live TV Channels"
        sub="Add, pause, or remove live football/sports streams — changes appear in the Android app instantly"
        icon={<Tv size={24} color="var(--primary)" />}
        action={
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Add Channel
          </button>
        }
      />

      <div className="card table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Type</th>
              <th>Category</th>
              <th>Quality</th>
              <th>Streams</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {channels?.length === 0 && (
              <EmptyRow colSpan={8} text="No channels yet — add your first live stream." />
            )}
            {channels?.map((c) => (
              <tr key={c._id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {c.logo ? (
                      <img src={c.logo} alt="" width={32} height={32} style={{ borderRadius: 8, objectFit: "contain", background: "#222" }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#333", display: "grid", placeItems: "center" }}>
                        <Tv size={16} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 800 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{c.country}</div>
                    </div>
                  </div>
                </td>
                <td>{c.category}</td>
                <td>
                  <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {TYPES.find((t) => t.value === c.type)?.label ?? "Football / IPTV"}
                  </span>
                </td>
                <td>{c.quality}</td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {(c.backupStreamUrls?.length ?? 0) + 1} ({c.backupStreamUrls?.length ?? 0} backup)
                </td>
                <td>
                  {c.status === "active" ? (
                    <span className="badge badge-green">Live</span>
                  ) : (
                    <span className="badge badge-gray">Paused</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>{timeAgo(c.updatedAt)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      title={c.status === "active" ? "Pause" : "Resume"}
                      onClick={() => setStatus({ id: c._id, status: c.status === "active" ? "paused" : "active" })}>
                      {c.status === "active" ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(c)}>
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete"
                      onClick={() => confirmThen(`Remove "${c.name}" permanently?`, () => remove({ id: c._id }))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?.id ? "Edit Channel" : "Add Channel"} open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="form-grid">
              <Field label="Channel name">
                <input
                  type="text"
                  value={editing.name}
                  placeholder="e.g. Esport3"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Country">
                <input
                  type="text"
                  value={editing.country}
                  placeholder="e.g. Spain"
                  onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Category">
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Quality">
                <select value={editing.quality} onChange={(e) => setEditing({ ...editing, quality: e.target.value })}>
                  <option value="1080p HD">1080p HD</option>
                  <option value="720p HD">720p HD</option>
                  <option value="SD">SD</option>
                </select>
              </Field>
            </div>
            <Field label="Screen" hint="Which screen in the app this stream appears on. Auto-detected from the URL unless changed.">
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as Form["type"] })}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            {editing.type === "youtube" ? (
              <Field
                label="YouTube handle, username or URL"
                hint="Use @handle, a bare username, a channel ID, or a full video/live URL.">
                <input
                  type="text"
                  value={editing.youtubeHandle}
                  placeholder="@NASA"
                  onChange={(e) => setEditing({ ...editing, youtubeHandle: e.target.value, streamUrl: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Stream URL" hint="Any URL — .m3u8, a redirect link, or a page that embeds an HLS stream. Use Auto-detect to convert.">
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={editing.streamUrl}
                    placeholder="https://…/master.m3u8"
                    onChange={(e) => setEditing({ ...editing, streamUrl: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={autoResolve}
                    disabled={resolving}
                    style={{ whiteSpace: "nowrap" }}>
                    <Wand2 size={16} /> {resolving ? "Resolving…" : "Auto-detect"}
                  </button>
                </div>
                {resolveNote && (
                  <div className="field-hint" style={{ marginTop: 6, color: "var(--primary)" }}>
                    {resolveNote}
                  </div>
                )}
              </Field>
            )}
            <Field label="Backup stream URLs (one per line)" hint="Auto-failover servers">
              <textarea
                rows={3}
                value={editing.backupStreamUrls}
                placeholder={"https://…/backup1.m3u8\nhttps://…/backup2.m3u8"}
                onChange={(e) => setEditing({ ...editing, backupStreamUrls: e.target.value })}
              />
            </Field>
            <Field label="Logo URL">
              <input
                type="text"
                value={editing.logo}
                placeholder="https://…/logo.png"
                onChange={(e) => setEditing({ ...editing, logo: e.target.value })}
              />
            </Field>
            <Field label="Match / subtitle text">
              <input
                type="text"
                value={editing.currentMatch}
                placeholder="⚽ Sunday League Live"
                onChange={(e) => setEditing({ ...editing, currentMatch: e.target.value })}
              />
            </Field>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : editing.id ? "Save Changes" : "Add Channel"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
