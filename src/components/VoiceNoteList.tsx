import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { CONVEX_SITE_URL } from '../config';
import Icon from './Icon';
import { colors, radius, spacing, shadow } from '../theme';
import YandexBannerRow from './YandexBannerRow';
import { isAdRow, withAdRows, type AdRow } from './adRows';
import { useVoicePlayer } from '../audio/VoicePlayerContext';

const WebViewPlayer = WebView as any;

export type NoteType = 'episode' | 'update' | 'announcement';
export const TYPE_LABEL: Record<NoteType, string> = { episode: 'Episode', update: 'Update', announcement: 'Announcement' };
export const TYPE_ICON: Record<NoteType, string> = { episode: 'headphones', update: 'bullhorn', announcement: 'bell' };

export type Note = {
  _id: string;
  title: string;
  mentor?: string;
  type?: NoteType;
  series?: string;
  episodeNumber?: number;
  note?: string;
  caption?: string;
  duration: number;
  createdAt: number;
};

const fileUrl = (n: Note, dl = false) => `${CONVEX_SITE_URL}/voice/file?id=${n._id}${dl ? '&dl=1' : ''}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const initials = (name?: string) =>
  (name || 'M')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const SPEEDS = [1, 1.25, 1.5, 2] as const;

type SortKey = 'newest' | 'oldest' | 'episode' | 'longest' | 'shortest';
const SORTS: Array<[SortKey, string]> = [
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['episode', 'Episode'],
  ['longest', 'Longest'],
  ['shortest', 'Shortest'],
];
type TypeFilter = 'all' | NoteType;
const TYPE_FILTERS: Array<[TypeFilter, string]> = [
  ['all', 'All'],
  ['episode', 'Episodes'],
  ['update', 'Updates'],
  ['announcement', 'Announcements'],
];
const BAR_COUNT = 44;

// Deterministic bar heights from the note id, so a note's waveform is stable
// between renders. Real amplitudes would need decoding the audio client-side.
function waveform(id: string): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return Array.from({ length: BAR_COUNT }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return 0.3 + ((seed >> 9) % 71) / 100; // 0.30 – 1.00
  });
}

// Hidden <audio> in a WebView (same approach as the video player, no extra deps).
// RN drives it via injectJavaScript; it reports progress back with postMessage.
const audioHtml = (url: string, rate: number) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#000">
<audio id="a" autoplay preload="auto" src="${url.replace(/"/g, '&quot;')}"></audio>
<script>
  var a = document.getElementById('a');
  a.playbackRate = ${rate};
  function post(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
  function state(extra){
    var o = { t: a.currentTime || 0, d: isFinite(a.duration) ? a.duration : 0, playing: !a.paused && !a.ended };
    if (extra) for (var k in extra) o[k] = extra[k];
    post(o);
  }
  ['play','pause','timeupdate','durationchange','loadedmetadata'].forEach(function(ev){
    a.addEventListener(ev, function(){ state(); });
  });
  a.addEventListener('waiting', function(){ state({ buffering: true }); });
  a.addEventListener('playing', function(){ state({ buffering: false }); });
  a.addEventListener('canplay', function(){ state({ buffering: false }); });
  a.addEventListener('ended', function(){ state({ ended: true }); });
  a.addEventListener('error', function(){ post({ error: true }); });
  window.toggle = function(){ if (a.paused) { a.play().catch(function(){}); } else { a.pause(); } };
  window.seekTo = function(f){ if (isFinite(a.duration)) { a.currentTime = Math.max(0, Math.min(1, f)) * a.duration; } };
  window.skip = function(s){ a.currentTime = Math.max(0, a.currentTime + s); };
  window.setRate = function(r){ a.playbackRate = r; };
</script></body></html>`;

type Row = Note | AdRow;

type Props = {
  notes: Note[] | undefined;
  emptyText: string;
  /** Hide the mentor line on rows (already known on a mentor's own screen). */
  hideMentor?: boolean;
  /** Hide the built-in search bar (parent supplies its own). */
  hideSearch?: boolean;
  /** Hide the type filter chips (parent supplies its own). */
  hideTypeFilter?: boolean;
  /** Hide search + type chips + sort chips (parent supplies a full toolbar). */
  hideToolbar?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
};

export default function VoiceNoteList({
  notes,
  emptyText,
  hideMentor,
  hideSearch,
  hideTypeFilter,
  hideToolbar,
  ListHeaderComponent,
}: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  // Playback is owned by the app-root provider, so leaving this screen does
  // not stop the audio. This component only renders controls for it.
  const player = useVoicePlayer();
  const [scrub, setScrub] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const barWidth = useRef(1);

  const current = (player.current as Note | null) ?? null;

  // While this screen shows the full player, suppress the floating mini bar
  // (it would overlap these controls). Releasing it on unmount is what makes
  // the bar appear the moment the user navigates away.
  const panelOpen = !!current;
  const { setFullPlayerVisible } = player;
  useEffect(() => {
    setFullPlayerVisible(panelOpen);
    return () => setFullPlayerVisible(false);
  }, [panelOpen, setFullPlayerVisible]);
  // A note still playing from another screen may not be in this list.
  const isMine = current ? (notes ?? []).some((n) => n._id === current._id) : false;
  const playing = player.playing;
  const buffering = player.buffering;
  const error = player.error;
  const time = player.time;
  const duration = player.duration || current?.duration || 0;
  const rate = player.rate;
  const js = (code: string) => {
    if (code === 'toggle()') player.toggle();
    else if (code.startsWith('skip(')) player.skip(Number(code.slice(5, -1)));
    else if (code.startsWith('seekTo(')) player.seek(Number(code.slice(7, -1)));
  };

  const index = useMemo(
    () => (current && notes ? notes.findIndex((n) => n._id === current._id) : -1),
    [current, notes],
  );
  const hasPrev = isMine ? player.hasPrev : false;
  const hasNext = isMine ? player.hasNext : false;

  const open = (n: Note) => player.play(n, notes ?? [n]);
  const select = (n: Note) => (current?._id === n._id ? player.toggle() : open(n));
  const step = (delta: number) => player.step(delta >= 0 ? 1 : -1);

  const cycleRate = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate as any) + 1) % SPEEDS.length];
    player.changeRate(next);
  };

  const seekToX = (x: number) => {
    const f = Math.max(0, Math.min(1, x / barWidth.current));
    setScrub(f);
    return f;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => seekToX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekToX(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => {
        const f = seekToX(e.nativeEvent.locationX);
        js(`seekTo(${f})`);
        setScrub(null);
      },
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  // Search + sort over the notes this screen was given. Both are local: the
  // list is already loaded, so filtering here is instant and costs no queries.
  const visible = useMemo(() => {
    const list = notes ?? [];
    const q = search.trim().toLowerCase();
    const filtered = list.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (!q) return true;
      const ep = n.episodeNumber != null ? String(n.episodeNumber) : '';
      return (
        n.title.toLowerCase().includes(q) ||
        (n.mentor ?? '').toLowerCase().includes(q) ||
        (n.series ?? '').toLowerCase().includes(q) ||
        (n.note ?? '').toLowerCase().includes(q) ||
        (n.caption ?? '').toLowerCase().includes(q) ||
        (ep && ep.includes(q))
      );
    });

    const sorted = [...filtered];
    if (sortBy === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === 'longest') sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    else if (sortBy === 'shortest') sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    else if (sortBy === 'episode') {
      // Series first (A-Z), then by episode number inside each series, so a
      // multi-part series reads in order instead of newest-first.
      sorted.sort((a, b) => {
        const sa = (a.series ?? '').toLowerCase();
        const sb = (b.series ?? '').toLowerCase();
        if (sa !== sb) {
          if (!sa) return 1;
          if (!sb) return -1;
          return sa < sb ? -1 : 1;
        }
        return (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
      });
    }
    return sorted;
  }, [notes, search, sortBy, typeFilter]);

  const rows = useMemo<Row[]>(() => withAdRows(visible), [visible]);

  const download = (n: Note) => Linking.openURL(fileUrl(n, true)).catch(() => {});
  const progress = scrub ?? (duration > 0 ? Math.min(1, time / duration) : 0);
  const bars = useMemo(() => (current ? waveform(current._id) : []), [current]);
  const shownTime = scrub !== null ? scrub * duration : time;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r._id}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            {hideToolbar ? null : (
              <>
                {hideSearch ? null : (
                  <View style={[styles.searchWrap, dark && styles.searchWrapDark]}>
                    <Icon name="magnifying-glass" iconStyle="solid" size={14} color={colors.textFaint} />
                    <TextInput
                      style={[styles.searchInput, dark && styles.textLight]}
                      placeholder="Search voices, mentors, series…"
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
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortRow}>
                  {hideTypeFilter
                    ? null
                    : TYPE_FILTERS.map(([key, label]) => (
                        <TouchableOpacity
                          key={key}
                          style={[styles.sortChip, typeFilter === key && styles.sortChipOn]}
                          onPress={() => setTypeFilter(key)}>
                          <Text style={[styles.sortChipText, typeFilter === key && styles.sortChipTextOn]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  {hideTypeFilter ? null : <View style={styles.sortDivider} />}
                  {SORTS.map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.sortChip, sortBy === key && styles.sortChipOn]}
                      onPress={() => setSortBy(key)}>
                      <Text style={[styles.sortChipText, sortBy === key && styles.sortChipTextOn]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: (current ? 230 : 20) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          notes ? (
            <Text style={styles.empty}>
              {search.trim() || typeFilter !== 'all'
                ? `No voices match${search.trim() ? ` "${search.trim()}"` : ''}${typeFilter !== 'all' ? ` in ${TYPE_LABEL[typeFilter]}s` : ''}.`
                : emptyText}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          if (isAdRow(item)) return <YandexBannerRow />;
          const active = current?._id === item._id;
          return (
            <TouchableOpacity
              style={[styles.row, dark && styles.rowDark, active && styles.rowActive]}
              onPress={() => select(item)}
              activeOpacity={0.85}>
              <View style={[styles.avatar, active && { backgroundColor: colors.primary }]}>
                {item.type ? (
                  <Icon name={TYPE_ICON[item.type]} iconStyle="solid" size={16} color={active ? '#fff' : colors.primary} />
                ) : (
                  <Text style={[styles.avatarText, active && { color: '#fff' }]}>{initials(item.mentor)}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, dark && styles.textLight]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.mentorRow}>
                  {item.type ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.series ? `${item.series} · Ep ${item.episodeNumber ?? '?'}` : TYPE_LABEL[item.type]}
                      </Text>
                    </View>
                  ) : null}
                  {!hideMentor ? (
                    <Text style={styles.mentor} numberOfLines={1}>
                      {item.mentor || 'Mentor'}
                    </Text>
                  ) : null}
                </View>
                {item.note ? (
                  <Text style={styles.note} numberOfLines={2}>
                    {item.note}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {fmt(item.duration)} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Icon
                name={active && playing ? 'circle-pause' : 'circle-play'}
                iconStyle="solid"
                size={26}
                color={active ? colors.primary : colors.textFaint}
              />
            </TouchableOpacity>
          );
        }}
      />

      {current ? (
        <View style={[styles.player, dark && styles.playerDark, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.grabber} />

          <View style={styles.playerHead}>
            <View style={[styles.avatar, styles.avatarLg]}>
              <Text style={[styles.avatarText, { fontSize: 16 }]}>{initials(current.mentor)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.playerTitle, dark && styles.textLight]} numberOfLines={1}>
                {current.title}
              </Text>
              <Text style={styles.playerMentor} numberOfLines={1}>
                {current.series ? `${current.series} · Ep ${current.episodeNumber ?? '?'} · ` : ''}
                {current.mentor || 'Mentor'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => player.stop()} hitSlop={10} style={styles.iconBtn}>
              <Icon name="chevron-down" iconStyle="solid" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Draggable waveform scrubber */}
          <View
            style={styles.waveHit}
            onLayout={(e: LayoutChangeEvent) => (barWidth.current = e.nativeEvent.layout.width || 1)}
            {...pan.panHandlers}>
            <View style={styles.wave}>
              {bars.map((h, i) => {
                const played = i / BAR_COUNT <= progress;
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: Math.max(3, h * 34),
                        backgroundColor: played ? colors.primary : dark ? colors.borderDark : colors.border,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.times}>
            <Text style={styles.time}>{fmt(shownTime)}</Text>
            <Text style={[styles.time, error && { color: '#EF4444' }]}>
              {error ? 'Could not load audio' : `-${fmt(Math.max(0, duration - shownTime))}`}
            </Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={cycleRate} style={styles.ratePill} activeOpacity={0.8}>
              <Text style={styles.rateText}>{rate}x</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => step(-1)} disabled={!hasPrev} hitSlop={8} style={styles.iconBtn}>
              <Icon
                name="backward-step"
                iconStyle="solid"
                size={20}
                color={hasPrev ? (dark ? colors.textDark : colors.text) : colors.textFaint}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => js('skip(-10)')} hitSlop={8} style={styles.iconBtn}>
              <Icon name="rotate-left" iconStyle="solid" size={20} color={dark ? colors.textDark : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => js('toggle()')} style={styles.playBtn} activeOpacity={0.85}>
              {buffering && !playing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={playing ? undefined : { marginLeft: 3 }}>
                  <Icon name={playing ? 'pause' : 'play'} iconStyle="solid" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => js('skip(10)')} hitSlop={8} style={styles.iconBtn}>
              <Icon name="rotate-right" iconStyle="solid" size={20} color={dark ? colors.textDark : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => step(1)} disabled={!hasNext} hitSlop={8} style={styles.iconBtn}>
              <Icon
                name="forward-step"
                iconStyle="solid"
                size={20}
                color={hasNext ? (dark ? colors.textDark : colors.text) : colors.textFaint}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => download(current)} hitSlop={8} style={styles.iconBtn}>
              <Icon name="download" iconStyle="solid" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  rowActive: { borderColor: colors.primary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '22',
  },
  avatarLg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  mentorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  mentor: { fontSize: 12, fontWeight: '600', color: colors.primary, flexShrink: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + '18' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  textLight: { color: colors.textDark },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },

  player: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  playerDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  playerMentor: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 2 },
  iconBtn: { padding: 6 },

  waveHit: { paddingVertical: 10, marginTop: spacing.sm },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 34 },
  waveBar: { width: 3, borderRadius: 2 },

  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  ratePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primary + '18',
    minWidth: 40,
    alignItems: 'center',
  },
  rateText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenWebview: { height: 1, width: 1, opacity: 0.01, position: 'absolute', top: 0, left: 0 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchWrapDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  sortChipTextOn: { color: '#fff' },
  sortDivider: { width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: 2 },
});
