import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import Icon from '../components/Icon';
import LiveStreamPlayer from '../components/LiveStreamPlayer';
import { colors, radius, spacing, shadow } from '../theme';
import { IPTVChannel } from '../services/iptvService';
import { showInterstitial } from '../services/interstitialService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LiveStreams'>;
type Route = RouteProp<RootStackParamList, 'LiveStreams'>;

const FALLBACK_LOGO_URI = 'https://i.imgur.com/V9KzY0G.png';

const KIND_META = {
  football: { title: '⚽ Live Football', empty: 'No football streams yet' },
  youtube: { title: '🎬 YouTube Videos', empty: 'No YouTube videos yet' },
  other: { title: '📺 Live Streams', empty: 'No live streams yet' },
  movies: { title: '🎥 Movies', empty: 'No movies yet' },
} as const;

type SignalStatus = 'Connecting' | 'Excellent' | 'Good' | 'Weak' | 'Offline';
const SIGNAL_COLOR: Record<SignalStatus, string> = {
  Connecting: '#F59E0B',
  Excellent: '#10B981',
  Good: '#10B981',
  Weak: '#F59E0B',
  Offline: '#EF4444',
};

export default function LiveStreamsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const kind = route.params?.kind ?? 'other';
  const meta = KIND_META[kind];

  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [selected, setSelected] = useState<IPTVChannel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [signalStatus, setSignalStatus] = useState<SignalStatus>('Connecting');
  const [measuredBitrate, setMeasuredBitrate] = useState<number>(0);
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  const iptvDocs = useQuery(api.iptv.list);

  useEffect(() => {
    if (!iptvDocs) return;
    const list = iptvDocs
      .filter((d) => d.type === kind)
      .map((doc): IPTVChannel => ({
        id: doc._id,
        name: doc.name,
        logo: doc.logo || FALLBACK_LOGO_URI,
        country: doc.country || 'Global',
        category: doc.category,
        type: doc.type,
        isLive: true,
        streamUrl: doc.streamUrl,
        backupStreamUrls: doc.backupStreamUrls ?? [],
        quality: (doc.quality as IPTVChannel['quality']) || '720p HD',
        currentMatch: doc.currentMatch,
      }));
    setChannels(list);
    if (!selected && list.length > 0) {
      setSelected(list[0]);
    }
    setLoading(false);
  }, [iptvDocs, kind]);

  const pick = (channel: IPTVChannel) => {
    // Interstitial on channel pick — a natural transition point; the service
    // caps frequency (30s gap / 10 per session) and checks consent.
    // Never for YouTube: YouTube API policy III.E forbids interstitials
    // before/after embedded playback.
    if (kind !== 'youtube') showInterstitial().catch(() => {});
    setSelected(channel);
    setMeasuredBitrate(0);
    setSignalStatus('Connecting');
  };

  const onPlayerSignal = (signal: { kind: string; bitrate?: number }) => {
    if (signal.kind === 'buffering') setSignalStatus('Weak');
    else if (signal.kind === 'bitrate' && signal.bitrate && signal.bitrate > 0) {
      setMeasuredBitrate(signal.bitrate);
      setSignalStatus(signal.bitrate >= 2500000 ? 'Excellent' : signal.bitrate >= 1000000 ? 'Good' : 'Weak');
    } else setSignalStatus('Good');
  };

  const liveQuality =
    measuredBitrate >= 4000000
      ? '1080p HD'
      : measuredBitrate >= 2000000
      ? '720p HD'
      : measuredBitrate >= 800000
      ? 'SD'
      : (selected?.quality ?? '720p HD');

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, dark && styles.headerDark]}>
        <TouchableOpacity
          style={[styles.backBtn, dark && styles.backBtnDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Icon name="arrow-left" iconStyle="solid" size={18} color={dark ? colors.textDark : colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.headerTitleDark]}>{meta.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {selected ? (
        <View style={styles.playerContainer}>
          <LiveStreamPlayer
            key={selected.id}
            streamUrl={selected.streamUrl}
            onSignal={onPlayerSignal}
            onFatal={() => setSignalStatus('Offline')}
          />
          <View style={styles.streamInfoBar}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.streamChannelName} numberOfLines={1}>{selected.name}</Text>
                <Text style={styles.qualityBadge}>{liveQuality}</Text>
              </View>
              <Text style={styles.streamMatchText} numberOfLines={1}>{selected.currentMatch}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[styles.signalBadge, { backgroundColor: `${SIGNAL_COLOR[signalStatus]}26` }]}>
                <Icon name="signal" iconStyle="solid" size={11} color={SIGNAL_COLOR[signalStatus]} />
                <Text style={[styles.signalText, { color: SIGNAL_COLOR[signalStatus] }]}>{signalStatus}</Text>
              </View>
              <TouchableOpacity style={styles.fullscreenBtn} onPress={() => setFullscreen(true)} activeOpacity={0.8}>
                <Icon name="expand" iconStyle="solid" size={12} color="#FFFFFF" />
                <Text style={styles.fullscreenBtnText}>Fullscreen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {fullscreen && selected ? (
        <View style={styles.fullscreenOverlay}>
          <View style={styles.fullscreenTopBar}>
            <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullscreen(false)} activeOpacity={0.8}>
              <Icon name="compress" iconStyle="solid" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>{selected.name}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.fullscreenPlayer}>
            <LiveStreamPlayer
              key={`${selected.id}-fs`}
              streamUrl={selected.streamUrl}
              onSignal={onPlayerSignal}
              onFatal={() => setSignalStatus('Offline')}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, dark && styles.textLight]}>Loading…</Text>
          </View>
        ) : channels.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="tv" iconStyle="solid" size={40} color={colors.textFaint} />
            <Text style={[styles.emptyText, dark && styles.textLight]}>{meta.empty}</Text>
          </View>
        ) : (
          <FlatList
            data={channels}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={colors.primary} />
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.channelCard,
                    dark && styles.cardDark,
                    isSelected && styles.channelCardSelected,
                    isSelected && dark && styles.channelCardSelectedDark,
                  ]}
                  onPress={() => pick(item)}
                  activeOpacity={0.85}>
                  <Image
                    source={{ uri: item.logo }}
                    style={styles.channelLogo}
                    defaultSource={{ uri: FALLBACK_LOGO_URI }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[styles.channelName, dark && styles.textLight, isSelected && styles.channelNameSelected]}
                        numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.countryBadge, dark && styles.countryBadgeDark]}>{item.country}</Text>
                    </View>
                    <Text style={styles.matchSubtitle} numberOfLines={1}>{item.currentMatch}</Text>
                  </View>
                  <Icon
                    name={isSelected ? 'circle-check' : 'play'}
                    iconStyle="solid"
                    size={18}
                    color={isSelected ? colors.primary : colors.textFaint}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.card,
  },
  headerDark: { backgroundColor: colors.surfaceDark, borderBottomColor: colors.borderDark },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnDark: { backgroundColor: colors.surfaceAltDark },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  headerTitleDark: { color: colors.textDark },
  playerContainer: { width: '100%', height: 230, backgroundColor: '#000', position: 'relative' },
  streamInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streamChannelName: { color: colors.white, fontSize: 13, fontWeight: '800' },
  streamMatchText: { color: '#CBD5E1', fontSize: 11, fontWeight: '500' },
  qualityBadge: {
    backgroundColor: '#3B82F6',
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  signalText: { fontSize: 10, fontWeight: '800' },
  body: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  channelCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  channelCardSelectedDark: { backgroundColor: colors.primarySoftDark, borderColor: colors.primary },
  channelLogo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  channelName: { fontSize: 14, fontWeight: '800', color: colors.text },
  channelNameSelected: { color: colors.primaryDeep },
  countryBadge: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  countryBadgeDark: { backgroundColor: colors.surfaceAltDark, color: '#C7D2FE' },
  matchSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  textLight: { color: colors.textDark },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fullscreenBtnText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullscreenTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fullscreenClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitle: { color: colors.white, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  fullscreenPlayer: { width: '100%', height: '100%' },
});
