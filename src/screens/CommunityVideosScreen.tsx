import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { CONVEX_SITE_URL } from '../config';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, spacing, shadow } from '../theme';

const WebViewPlayer = WebView as any;

// Telegram bots can only serve files up to 20 MB, so that is the upload ceiling.
const MAX_BYTES = 20 * 1024 * 1024;

type Video = {
  _id: Id<'videos'>;
  title: string;
  description?: string;
  durationSeconds: number;
  viewsCount: number;
  status: string;
  createdAt: number;
  username?: string;
  thumbnailUrl?: string;
};

const videoUrl = (id: string) => `${CONVEX_SITE_URL}/video/file?id=${id}`;
const thumbUrl = (id: string) => `${CONVEX_SITE_URL}/video/file?id=${id}&thumb=1`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const playerHtml = (url: string) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center}video{width:100%;max-height:100%}</style>
</head><body><video controls autoplay playsinline src="${url.replace(/"/g, '&quot;')}"></video></body></html>`;

export default function CommunityVideosScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState<Video | null>(null);
  const [draft, setDraft] = useState<{ uri: string; size: number; duration: number; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Admin kill switch (Admin → Features). The server enforces it too.
  const flags = useQuery(api.features.getFlags);
  const uploadsOn = flags?.['feature:videoUpload'] !== false;

  const feed = useQuery(api.videos.getActiveVideos, {}) as Video[] | undefined;
  const mine = useQuery(api.videos.myVideos) as Video[] | undefined;
  const generateUploadUrl = useMutation(api.videos.generateUploadUrl);
  const submitUpload = useAction(api.videos.submitUpload);

  const pending = mine?.filter((v) => v.status !== 'ACTIVE') ?? [];

  const pick = async () => {
    try {
      const picked = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
      const asset = picked.assets?.[0];
      if (!asset?.uri) return;
      if ((asset.fileSize ?? 0) > MAX_BYTES) {
        Alert.alert(
          'Video too large',
          `That video is ${((asset.fileSize ?? 0) / 1024 / 1024).toFixed(1)} MB. Please pick one under 20 MB (about a minute of video).`,
        );
        return;
      }
      setDraft({ uri: asset.uri, size: asset.fileSize ?? 0, duration: Math.round(asset.duration ?? 0), title: '' });
    } catch {
      Alert.alert('Gallery', 'Could not open your gallery.');
    }
  };

  const upload = async () => {
    if (!draft || busy) return;
    if (!draft.title.trim()) {
      Alert.alert('Title needed', 'Give your video a short title first.');
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = await (await fetch(draft.uri)).blob();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: blob });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await submitUpload({ storageId, title: draft.title.trim(), durationSeconds: draft.duration });
      setDraft(null);
      Alert.alert('Sent for review', 'Your video was uploaded. It appears in the feed once an admin approves it.');
    } catch (e) {
      Alert.alert('Upload failed', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Community Videos" subtitle="Watch and share short clips" back />

      {!feed ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(v) => v._id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 90, gap: spacing.sm }}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={[styles.pendingBox, dark && styles.pendingBoxDark]}>
                <Icon name="clock" iconStyle="solid" size={13} color="#F59E0B" />
                <Text style={styles.pendingText}>
                  {pending.length} of your video{pending.length === 1 ? '' : 's'} awaiting review
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No videos yet — be the first to share one.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setPlaying(item)}>
              <View style={styles.thumbWrap}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: thumbUrl(item._id) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbBlank]}>
                    <Icon name="film" iconStyle="solid" size={22} color={colors.textFaint} />
                  </View>
                )}
                <View style={styles.playOverlay}>
                  <Icon name="play" iconStyle="solid" size={14} color="#fff" />
                </View>
                {item.durationSeconds > 0 ? (
                  <Text style={styles.durationTag}>{fmt(item.durationSeconds)}</Text>
                ) : null}
              </View>
              <Text style={[styles.title, dark && styles.textLight]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.username} · {item.viewsCount} view{item.viewsCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {uploadsOn ? (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + spacing.lg }]} onPress={pick} activeOpacity={0.85}>
          <Icon name="plus" iconStyle="solid" size={16} color="#fff" />
          <Text style={styles.fabText}>Upload video</Text>
        </TouchableOpacity>
      ) : null}

      {/* Title + confirm before uploading */}
      <Modal visible={draft !== null} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, dark && styles.sheetDark, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={[styles.sheetTitle, dark && styles.textLight]}>Upload video</Text>
            <TextInput
              style={[styles.input, dark && styles.inputDark]}
              placeholder="Title (e.g. My Pi mining setup)"
              placeholderTextColor={colors.textMuted}
              value={draft?.title ?? ''}
              onChangeText={(t) => setDraft((d) => (d ? { ...d, title: t } : d))}
              maxLength={80}
            />
            <Text style={styles.sheetMeta}>
              {draft ? `${(draft.size / 1024 / 1024).toFixed(1)} MB` : ''}
              {draft && draft.duration ? ` · ${fmt(draft.duration)}` : ''} · reviewed before it goes live
            </Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setDraft(null)} disabled={busy}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={upload} disabled={busy} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>{busy ? 'Uploading…' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Player */}
      <Modal visible={playing !== null} transparent animationType="fade" onRequestClose={() => setPlaying(null)}>
        <View style={styles.playerBackdrop}>
          <View style={styles.playerHead}>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {playing?.title}
            </Text>
            <TouchableOpacity onPress={() => setPlaying(null)} hitSlop={12}>
              <Icon name="xmark" iconStyle="solid" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {playing ? (
            <WebViewPlayer
              key={playing._id}
              source={{ html: playerHtml(videoUrl(playing._id)), baseUrl: 'https://localhost' }}
              style={styles.playerWeb}
              originWhitelist={['*']}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              javaScriptEnabled
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  card: { flex: 1 },
  thumbWrap: { position: 'relative', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  thumb: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#111' },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTag: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  title: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  textLight: { color: colors.textDark },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#FEF3C7',
  },
  pendingBoxDark: { backgroundColor: '#78350F' },
  pendingText: { fontSize: 12, fontWeight: '600', color: '#92400E' },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    ...shadow,
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetDark: { backgroundColor: colors.surfaceDark },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  inputDark: { borderColor: colors.borderDark, color: colors.textDark },
  sheetMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  btnGhost: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.lg },
  btnGhostText: { color: colors.textMuted, fontWeight: '700' },
  btnPrimary: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },

  playerBackdrop: { flex: 1, backgroundColor: '#000' },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl },
  playerTitle: { flex: 1, color: '#fff', fontWeight: '700' },
  playerWeb: { flex: 1, backgroundColor: '#000' },
});
