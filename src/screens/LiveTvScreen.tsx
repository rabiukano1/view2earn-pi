import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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
import { getCuratedChannels, fetchIPTVChannels, IPTVChannel } from '../services/iptvService';
import { fetchLiveEvents, LiveEvent } from '../services/liveEventsService';

type LiveTvNavProp = NativeStackNavigationProp<RootStackParamList, 'LiveTV'>;
type LiveTvRouteProp = RouteProp<RootStackParamList, 'LiveTV'>;

const FAVORITES_STORAGE_KEY = '@view2earn_iptv_favorites';
const FALLBACK_LOGO_URI = 'https://i.imgur.com/V9KzY0G.png';

type SignalStatus = 'Connecting' | 'Excellent' | 'Good' | 'Weak' | 'Offline';

const buildStreams = (channel: IPTVChannel): string[] =>
  [channel.streamUrl, ...(channel.backupStreamUrls || []).filter(Boolean)];

const SIGNAL_COLOR: Record<SignalStatus, string> = {
  Connecting: '#F59E0B',
  Excellent: '#10B981',
  Good: '#10B981',
  Weak: '#F59E0B',
  Offline: '#EF4444',
};

// Map a Convex iptvChannels doc (with `type`) to the screen channel shape.
function docToChannel(doc: any): IPTVChannel {
  return {
    id: doc._id,
    name: doc.name,
    logo: doc.logo || FALLBACK_LOGO_URI,
    country: doc.country || 'Global',
    category: doc.category,
    isLive: true,
    streamUrl: doc.streamUrl,
    backupStreamUrls: doc.backupStreamUrls ?? [],
    httpReferrer: doc.httpReferrer,
    userAgent: doc.userAgent,
    quality: (doc.quality as IPTVChannel['quality']) || '720p HD',
    currentMatch: doc.currentMatch,
    type: doc.type,
  };
}

export default function LiveTvScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<LiveTvNavProp>();
  const route = useRoute<LiveTvRouteProp>();

  const firstChannel = getCuratedChannels()[0];
  const [channels, setChannels] = useState<IPTVChannel[]>(getCuratedChannels());
  const [selectedChannel, setSelectedChannel] = useState<IPTVChannel>(firstChannel);
  const [streams, setStreams] = useState<string[]>(buildStreams(firstChannel));
  const [streamIndex, setStreamIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [signalStatus, setSignalStatus] = useState<SignalStatus>('Connecting');
  const [measuredBitrate, setMeasuredBitrate] = useState<number>(0);
  const [failoverAt, setFailoverAt] = useState<number>(0);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);

  const iptvDocs = useQuery(api.iptv.list);

  const activeStreamUrl = streams[streamIndex] ?? firstChannel.streamUrl;

  const liveQuality: string =
    measuredBitrate >= 4000000
      ? '1080p HD'
      : measuredBitrate >= 2000000
      ? '720p HD'
      : measuredBitrate >= 800000
      ? 'SD'
      : (selectedChannel.quality ?? '720p HD');

  const signalColor = (status: SignalStatus): string => SIGNAL_COLOR[status];

  useEffect(() => {
    loadFavorites();
    if (!iptvDocs || iptvDocs.length === 0) {
      fetchIPTVChannels().then((data) => {
        setChannels(data.filter((c) => (c.type ?? 'football') === 'football'));
        setLoading(false);
      });
    }
    // Free live events (no API key) — poll every 60s for good signal
    const loadEvents = () =>
      fetchLiveEvents()
        .then(setLiveEvents)
        .catch(() => {})
        .finally(() => setEventsLoading(false));
    loadEvents();
    const iv = setInterval(loadEvents, 60000);
    return () => clearInterval(iv);
  }, []);

  // Football-only channels from Convex (admin-managed), falling back to curated.
  useEffect(() => {
    if (!iptvDocs) return;
    const football = iptvDocs.filter((d) => d.type === 'football').map(docToChannel);
    if (football.length > 0) {
      setChannels(football);
    } else {
      setChannels(getCuratedChannels());
    }
    setLoading(false);
  }, [iptvDocs]);

  useEffect(() => {
    if (route.params?.channelId) {
      const found = channels.find((c) => c.id === route.params?.channelId);
      if (found) changeChannel(found);
    }
  }, [route.params?.channelId]);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load IPTV favorites', e);
    }
  };

  const toggleFavorite = async (id: string) => {
    const nextFavs = favorites.includes(id)
      ? favorites.filter((fav) => fav !== id)
      : [...favorites, id];
    setFavorites(nextFavs);
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
    } catch (e) {
      console.warn('Failed to save IPTV favorites', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (!iptvDocs || iptvDocs.length === 0) {
      const data = await fetchIPTVChannels();
      setChannels(data.filter((c) => (c.type ?? 'football') === 'football'));
    }
    setRefreshing(false);
  };

  const changeChannel = (channel: IPTVChannel) => {
    setSelectedChannel(channel);
    setStreams(buildStreams(channel));
    setStreamIndex(0);
    setMeasuredBitrate(0);
    setSignalStatus('Connecting');
  };

  const switchStream = () => {
    if (streams.length <= 1) return;
    setStreamIndex((i) => (i + 1) % streams.length);
    setSignalStatus('Connecting');
  };

  const handleFatal = () => {
    const now = Date.now();
    if (now - failoverAt < 2500) return;
    setFailoverAt(now);
    if (streamIndex + 1 < streams.length) {
      setStreamIndex(streamIndex + 1);
      setSignalStatus('Connecting');
    } else {
      setSignalStatus('Offline');
    }
  };

  const onPlayerSignal = (signal: { kind: string; bitrate?: number }) => {
    if (signal.kind === 'buffering') {
      setSignalStatus('Weak');
    } else if (signal.kind === 'bitrate' && signal.bitrate && signal.bitrate > 0) {
      setMeasuredBitrate(signal.bitrate);
      setSignalStatus(
        signal.bitrate >= 2500000
          ? 'Excellent'
          : signal.bitrate >= 1000000
          ? 'Good'
          : 'Weak',
      );
    } else {
      setSignalStatus('Good');
    }
  };

  const isYacineChannel = (ch: IPTVChannel) => ch.id.startsWith('yacin-') || ch.name.toLowerCase().includes('yacine');

  const filteredChannels = channels.filter((ch) => {
    const matchesSearch =
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.currentMatch && ch.currentMatch.toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedCategory === 'Favorites') {
      return favorites.includes(ch.id) && matchesSearch;
    }
    if (selectedCategory === 'Yacine TV') {
      return isYacineChannel(ch) && matchesSearch;
    }
    if (selectedCategory !== 'All' && ch.category !== selectedCategory) {
      return false;
    }
    return matchesSearch;
  });

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, dark && styles.headerDark]}>
        <TouchableOpacity
          style={[styles.backBtn, dark && styles.backBtnDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Icon name="arrow-left" iconStyle="solid" size={18} color={dark ? colors.textDark : colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, dark && styles.headerTitleDark]}>⚽ Live Football</Text>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>FREE HD STREAMS</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.favHeaderBtn}
          onPress={() => toggleFavorite(selectedChannel.id)}
          activeOpacity={0.8}>
          <Icon
            name="star"
            iconStyle={favorites.includes(selectedChannel.id) ? 'solid' : 'regular'}
            size={20}
            color={favorites.includes(selectedChannel.id) ? '#F59E0B' : (dark ? colors.textDark : colors.textMuted)}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.playerContainer}>
        <LiveStreamPlayer
          key={`${selectedChannel.id}-${streamIndex}`}
          streamUrl={activeStreamUrl}
          httpReferrer={selectedChannel.httpReferrer}
          userAgent={selectedChannel.userAgent}
          onSignal={onPlayerSignal}
          onFatal={handleFatal}
        />

        <View style={styles.streamInfoBar}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.streamChannelName} numberOfLines={1}>
                {selectedChannel.name}
              </Text>
              <Text style={styles.qualityBadge}>{liveQuality}</Text>
            </View>
            <Text style={styles.streamMatchText} numberOfLines={1}>
              {selectedChannel.currentMatch}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.signalBadge, { backgroundColor: `${signalColor(signalStatus)}26` }]}>
              <Icon name="signal" iconStyle="solid" size={11} color={signalColor(signalStatus)} />
              <Text style={[styles.signalText, { color: signalColor(signalStatus) }]}>
                {signalStatus}
              </Text>
            </View>
            <TouchableOpacity style={styles.fullscreenBtn} onPress={() => setFullscreen(true)} activeOpacity={0.8}>
              <Icon name="expand" iconStyle="solid" size={12} color="#FFFFFF" />
              <Text style={styles.backupBtnText}>Fullscreen</Text>
            </TouchableOpacity>
            {streams.length > 1 ? (
              <TouchableOpacity style={styles.backupBtn} onPress={switchStream} activeOpacity={0.8}>
                <Text style={styles.backupBtnText}>
                  {streamIndex === 0 ? 'Backup Server' : `Server ${streamIndex + 1}/${streams.length}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {fullscreen ? (
        <View style={styles.fullscreenOverlay}>
          <View style={styles.fullscreenTopBar}>
            <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullscreen(false)} activeOpacity={0.8}>
              <Icon name="compress" iconStyle="solid" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>{selectedChannel.name}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.fullscreenPlayer}>
            <LiveStreamPlayer
              key={`${selectedChannel.id}-${streamIndex}-fs`}
              streamUrl={activeStreamUrl}
              httpReferrer={selectedChannel.httpReferrer}
              userAgent={selectedChannel.userAgent}
              onSignal={onPlayerSignal}
              onFatal={handleFatal}
            />
          </View>
        </View>
      ) : null}

      {/* Free Live Events strip — beIN live scores, tap to filter channel search */}
      {liveEvents.length > 0 && (
        <View style={[styles.eventsStrip, dark && styles.eventsStripDark]}>
          <View style={styles.eventsHeader}>
            <View style={styles.liveDotSm} />
            <Text style={[styles.eventsTitle, dark && styles.textLight]}>LIVE NOW</Text>
            {eventsLoading && <ActivityIndicator size="small" color={colors.primary} />}
            <Text style={styles.eventsHint}>Free • auto from ESPN/TheSportsDB</Text>
          </View>
          <FlatList
            data={liveEvents}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.eventChip, dark && styles.eventChipDark]}
                activeOpacity={0.85}
                onPress={() => setSearchQuery(item.homeTeam)}>
                <Text style={[styles.eventLeague, dark && { color: '#A7F3D0' }]} numberOfLines={1}>
                  {item.league}
                </Text>
                <Text style={[styles.eventTeams, dark && styles.textLight]} numberOfLines={1}>
                  {item.homeTeam} vs {item.awayTeam}
                </Text>
                <Text style={styles.eventScore}>
                  {item.homeScore != null && item.awayScore != null
                    ? `${item.homeScore} - ${item.awayScore}`
                    : item.minute || item.status}
                  {item.status === 'LIVE' ? ' • LIVE' : ` • ${item.status}`}
                </Text>
                <View style={styles.watchOnBeIN}>
                  <Text style={styles.watchOnText}>Watch on beIN ▶</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.body}>
        <View style={[styles.searchBox, dark && styles.searchBoxDark]}>
          <Icon name="magnifying-glass" iconStyle="solid" size={16} color={colors.textFaint} />
          <TextInput
            style={[styles.searchInput, dark && styles.textLight]}
            placeholder="Search teams, leagues, football channels..."
            placeholderTextColor={colors.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="xmark" iconStyle="solid" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.categoriesRow}>
          {['All', 'Football', 'Yacine TV', 'Sports', 'Favorites'].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catChip,
                  active && styles.catChipActive,
                  dark && !active && styles.catChipDark,
                  cat === 'Yacine TV' && active && { backgroundColor: '#10B981', borderColor: '#10B981' },
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.85}>
                <Text
                  style={[
                    styles.catChipText,
                    active && styles.catChipTextActive,
                    dark && !active && styles.textLight,
                  ]}>
                  {cat === 'Football' ? '⚽ Football' : cat === 'Yacine TV' ? '📺 Yacine TV' : cat === 'Favorites' ? '⭐ Saved' : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isYacineChannel(selectedChannel) ? (
          <View style={[styles.yacineNotice, dark && { backgroundColor: '#064E3B', borderColor: '#10B981' }]}>
            <Icon name="tv" iconStyle="solid" size={12} color="#10B981" />
            <Text style={[styles.yacineNoticeText, dark && { color: '#A7F3D0' }]}>Yacine TV • Embedded player — uses site's own HLS. Replace URL in Admin → Channels if stream rotates.</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, dark && styles.textLight]}>
              Loading Live Football Streams...
            </Text>
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="futbol" iconStyle="solid" size={40} color={colors.textFaint} />
            <Text style={[styles.emptyText, dark && styles.textLight]}>
              No channels found{searchQuery ? ` for "${searchQuery}"` : ''}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChannels}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedChannel.id === item.id;
              const isFav = favorites.includes(item.id);
              return (
                <TouchableOpacity
                  style={[
                    styles.channelCard,
                    dark && styles.cardDark,
                    isSelected && styles.channelCardSelected,
                    isSelected && dark && styles.channelCardSelectedDark,
                  ]}
                  onPress={() => changeChannel(item)}
                  activeOpacity={0.85}>
                  <View style={styles.channelLogoWrap}>
                    <Image
                      source={{ uri: item.logo }}
                      style={styles.channelLogo}
                      defaultSource={{ uri: FALLBACK_LOGO_URI }}
                    />
                    {item.isLive ? <View style={styles.cardLiveBadge} /> : null}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.channelName,
                          dark && styles.textLight,
                          isSelected && styles.channelNameSelected,
                        ]}
                        numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.countryBadge, dark && styles.countryBadgeDark]}>{item.country}</Text>
                    </View>
                    <Text style={styles.matchSubtitle} numberOfLines={1}>
                      {item.currentMatch}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.favBtn}
                    onPress={() => toggleFavorite(item.id)}
                    activeOpacity={0.8}>
                    <Icon
                      name="star"
                      iconStyle={isFav ? 'solid' : 'regular'}
                      size={18}
                      color={isFav ? '#F59E0B' : colors.textFaint}
                    />
                  </TouchableOpacity>
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
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  headerTitleDark: { color: colors.textDark },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveTagText: { color: '#EF4444', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  favHeaderBtn: { padding: 4 },
  playerContainer: {
    width: '100%',
    height: 230,
    backgroundColor: '#000',
    position: 'relative',
  },
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
  backupBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  backupBtnText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBoxDark: { backgroundColor: colors.surfaceAltDark, borderColor: colors.borderDark },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '500' },
  categoriesRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipDark: { backgroundColor: colors.surfaceAltDark, borderColor: colors.borderDark },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  catChipTextActive: { color: colors.white },
  textLight: { color: colors.textDark },
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
  channelLogoWrap: { position: 'relative' },
  channelLogo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  cardLiveBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: colors.surface,
  },
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
  favBtn: { padding: 6 },
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
  yacineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: spacing.sm,
  },
  yacineNoticeText: { flex: 1, fontSize: 11, color: '#065F46', fontWeight: '600', lineHeight: 14 },
  eventsStrip: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  eventsStripDark: { backgroundColor: colors.surfaceDark, borderBottomColor: colors.borderDark },
  eventsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, marginBottom: 8 },
  liveDotSm: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  eventsTitle: { fontSize: 12, fontWeight: '900', color: colors.text, letterSpacing: 0.5 },
  eventsHint: { marginLeft: 'auto', fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  eventChip: {
    minWidth: 160,
    maxWidth: 200,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  eventChipDark: { backgroundColor: colors.surfaceAltDark, borderColor: colors.borderDark },
  eventLeague: { fontSize: 10, fontWeight: '800', color: colors.primaryDeep },
  eventTeams: { fontSize: 12, fontWeight: '800', color: colors.text },
  eventScore: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  watchOnBeIN: {
    marginTop: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  watchOnText: { fontSize: 10, fontWeight: '800', color: colors.white },
});
