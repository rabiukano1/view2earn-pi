import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { CONVEX_SITE_URL } from '../config';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, spacing, shadow } from '../theme';

const WebViewPlayer = WebView as any;

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

// Full-bleed looping player for the vertical feed. `object-fit: cover` fills
// the screen the way TikTok does — the feed is 9:16 throughout (see the
// thumbnail aspectRatio below), so nothing meaningful gets cropped.
const playerHtml = (url: string) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}
video{width:100%;height:100%;object-fit:cover;display:block}</style>
</head><body><video autoplay loop playsinline src="${url.replace(/"/g, '&quot;')}"></video></body></html>`;

export default function CommunityVideosScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = useWindowDimensions();
  // Index into `feed` that the full-screen pager opens at; null = grid only.
  const [openAt, setOpenAt] = useState<number | null>(null);
  // Which page is on screen right now — only that one mounts a player.
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const i = viewableItems[0]?.index;
      if (typeof i === 'number') setActiveIndex(i);
    },
  ).current;

  const feed = useQuery(api.videos.getActiveVideos, {}) as Video[] | undefined;

  // Client-side search. The feed is small and already in memory, so filtering
  // here avoids a round trip and keeps results instant as you type.
  // `shown` drives BOTH the grid and the pager, so tapping a result opens the
  // right video and swiping stays within the search results.
  const [search, setSearch] = useState('');

  // UGC reporting: every viewer must be able to flag a video (Play/AdMob
  // policy). Three distinct reports auto-hide it pending admin review.
  const reportVideo = useMutation(api.videos.reportVideo);
  const [reportFor, setReportFor] = useState<Video | null>(null);
  const [reporting, setReporting] = useState(false);
  const REASONS: Array<[string, string]> = [
    ['sexual', 'Sexual or adult content'],
    ['violence', 'Violence or dangerous acts'],
    ['hate', 'Hate speech or symbols'],
    ['harassment', 'Harassment or bullying'],
    ['misleading', 'Misleading or scam'],
    ['copyright', 'Copyright violation'],
    ['spam', 'Spam'],
    ['other', 'Something else'],
  ];

  const sendReport = async (reason: string) => {
    if (!reportFor || reporting) return;
    setReporting(true);
    try {
      const res = await reportVideo({ videoId: reportFor._id, reason });
      setReportFor(null);
      Alert.alert(
        res.alreadyReported ? 'Already reported' : 'Report sent',
        res.alreadyReported
          ? 'You have already reported this video. Our team is reviewing it.'
          : 'Thanks — our team will review this video.',
      );
    } catch (e) {
      Alert.alert('Could not send report', String(e).replace('[CONVEX] ', ''));
    } finally {
      setReporting(false);
    }
  };
  const shown = useMemo(() => {
    const list = feed ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.username ?? '').toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q),
    );
  }, [feed, search]);

  const openPager = useCallback((index: number) => {
    setActiveIndex(index);
    setOpenAt(index);
  }, []);
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Videos" subtitle="Short videos from View2Earn" back />

      <View style={[styles.searchWrap, dark && styles.searchWrapDark]}>
        <Icon name="magnifying-glass" iconStyle="solid" size={14} color={colors.textFaint} />
        <TextInput
          style={[styles.searchInput, dark && styles.textLight]}
          placeholder="Search videos, creators…"
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Icon name="xmark" iconStyle="solid" size={14} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!feed ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(v) => v._id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20, gap: spacing.sm }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search.trim() ? `No videos match "${search.trim()}".` : 'No videos yet.'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openPager(index)}>
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

      {/* Full-screen vertical feed: one video per page, swipe up/down. */}
      <Modal visible={openAt !== null} animationType="fade" onRequestClose={() => setOpenAt(null)}>
        <View style={styles.pagerRoot}>
          <FlatList
            data={shown}
            keyExtractor={(v) => v._id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialScrollIndex={openAt ?? 0}
            getItemLayout={(_, index) => ({ length: screenH, offset: screenH * index, index })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            // Only a couple of pages stay mounted; each player is a WebView.
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            removeClippedSubviews
            renderItem={({ item, index }) => (
              <View style={{ width: screenW, height: screenH, backgroundColor: '#000' }}>
                {index === activeIndex ? (
                  <WebViewPlayer
                    key={item._id}
                    source={{ html: playerHtml(videoUrl(item._id)), baseUrl: 'https://localhost' }}
                    style={styles.playerWeb}
                    originWhitelist={['*']}
                    mediaPlaybackRequiresUserAction={false}
                    allowsInlineMediaPlayback
                    allowsFullscreenVideo
                    javaScriptEnabled
                    scrollEnabled={false}
                  />
                ) : (
                  // Off-screen pages show the still, so only one video decodes.
                  <Image source={{ uri: thumbUrl(item._id) }} style={styles.playerWeb} resizeMode="cover" />
                )}

                <View style={[styles.pagerOverlay, { paddingBottom: insets.bottom + spacing.xl }]}>
                  <Text style={styles.pagerTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.pagerMeta} numberOfLines={1}>
                    @{item.username} · {item.viewsCount} view{item.viewsCount === 1 ? '' : 's'}
                  </Text>
                  {item.description ? (
                    <Text style={styles.pagerDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.reportBtn}
                    activeOpacity={0.8}
                    onPress={() => setReportFor(item)}>
                    <Icon name="flag" iconStyle="solid" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.reportBtnText}>Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.pagerClose, { top: insets.top + spacing.md }]}
            onPress={() => setOpenAt(null)}
            hitSlop={16}>
            <Icon name="xmark" iconStyle="solid" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Report reasons */}
      <Modal
        visible={reportFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReportFor(null)}>
        <Pressable style={styles.playerBackdropDim} onPress={() => setReportFor(null)}>
          <Pressable style={[styles.reasonSheet, dark && styles.reasonSheetDark]} onPress={() => {}}>
            <Text style={[styles.reasonTitle, dark && styles.textLight]}>Report this video</Text>
            <Text style={styles.reasonSub} numberOfLines={1}>
              {reportFor?.title}
            </Text>
            {REASONS.map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={styles.reasonRow}
                disabled={reporting}
                onPress={() => sendReport(key)}>
                <Text style={[styles.reasonText, dark && styles.textLight]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.reasonCancel} onPress={() => setReportFor(null)}>
              <Text style={styles.reasonCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: '#FFF',
    ...shadow.card,
  },
  searchWrapDark: { backgroundColor: '#1C1C27' },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  playerWeb: { flex: 1, backgroundColor: '#000' },
  pagerRoot: { flex: 1, backgroundColor: '#000' },
  pagerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingRight: spacing.xl * 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pagerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pagerMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  pagerDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  reportBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  playerBackdropDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  reasonSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  reasonSheetDark: { backgroundColor: '#17171F' },
  reasonTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  reasonSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  reasonRow: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,140,0.2)',
  },
  reasonText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  reasonCancel: { paddingVertical: 14, alignItems: 'center' },
  reasonCancelText: { color: colors.textMuted, fontWeight: '700' },
  pagerClose: {
    position: 'absolute',
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
