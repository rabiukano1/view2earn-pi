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
import { useQuery } from 'convex/react';
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

const playerHtml = (url: string) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center}video{width:100%;max-height:100%}</style>
</head><body><video controls autoplay playsinline src="${url.replace(/"/g, '&quot;')}"></video></body></html>`;

export default function CommunityVideosScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState<Video | null>(null);

  const feed = useQuery(api.videos.getActiveVideos, {}) as Video[] | undefined;
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Videos" subtitle="Short videos from View2Earn" back />

      {!feed ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(v) => v._id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20, gap: spacing.sm }}
          ListEmptyComponent={<Text style={styles.empty}>No videos yet.</Text>}
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
  playerBackdrop: { flex: 1, backgroundColor: '#000' },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl },
  playerTitle: { flex: 1, color: '#fff', fontWeight: '700' },
  playerWeb: { flex: 1, backgroundColor: '#000' },
});
