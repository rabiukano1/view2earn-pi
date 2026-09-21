import React, { useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { CONVEX_SITE_URL } from '../config';
import Icon from './Icon';
import { colors, radius, spacing, shadow } from '../theme';

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

// Hidden <audio> in a WebView (same approach as the video player, no extra deps).
// RN drives it via injectJavaScript; it reports progress back with postMessage.
const audioHtml = (url: string) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#000">
<audio id="a" autoplay preload="auto" src="${url.replace(/"/g, '&quot;')}"></audio>
<script>
  var a = document.getElementById('a');
  function post(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
  function state(){ post({ t: a.currentTime || 0, d: isFinite(a.duration) ? a.duration : 0, playing: !a.paused && !a.ended }); }
  ['play','pause','ended','timeupdate','durationchange','loadedmetadata'].forEach(function(ev){ a.addEventListener(ev, state); });
  a.addEventListener('error', function(){ post({ error: true }); });
  window.toggle = function(){ if (a.paused) { a.play().catch(function(){}); } else { a.pause(); } };
  window.seekTo = function(f){ if (isFinite(a.duration)) { a.currentTime = Math.max(0, Math.min(1, f)) * a.duration; } };
  window.skip = function(s){ a.currentTime = Math.max(0, a.currentTime + s); };
</script></body></html>`;

type Props = {
  notes: Note[] | undefined;
  emptyText: string;
  /** Hide the mentor line on rows (already known on a mentor's own screen). */
  hideMentor?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
};

export default function VoiceNoteList({ notes, emptyText, hideMentor, ListHeaderComponent }: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Note | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const barWidth = useRef(1);
  const webRef = useRef<any>(null);

  const js = (code: string) => webRef.current?.injectJavaScript(`${code}; true;`);

  const select = (n: Note) => {
    if (current?._id === n._id) return js('toggle()');
    setCurrent(n);
    setPlaying(false);
    setTime(0);
    setDuration(n.duration);
    setError(false);
  };

  const onMessage = (e: any) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.error) return setError(true);
      setTime(m.t);
      if (m.d > 0) setDuration(m.d);
      setPlaying(!!m.playing);
    } catch {}
  };

  const download = (n: Note) => Linking.openURL(fileUrl(n, true)).catch(() => {});
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={notes ?? []}
        keyExtractor={(n) => n._id}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: (current ? 190 : 20) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={notes ? <Text style={styles.empty}>{emptyText}</Text> : null}
        renderItem={({ item }) => {
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
            <TouchableOpacity onPress={() => download(current)} hitSlop={10} style={styles.iconBtn}>
              <Icon name="download" iconStyle="solid" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrent(null)} hitSlop={10} style={styles.iconBtn}>
              <Icon name="xmark" iconStyle="solid" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Pressable
            onLayout={(e: LayoutChangeEvent) => (barWidth.current = e.nativeEvent.layout.width || 1)}
            onPress={(e) => js(`seekTo(${e.nativeEvent.locationX / barWidth.current})`)}
            style={styles.barHit}>
            <View style={[styles.bar, dark && styles.barDark]}>
              <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.knob, { left: `${progress * 100}%` }]} />
            </View>
          </Pressable>
          <View style={styles.times}>
            <Text style={styles.time}>{fmt(time)}</Text>
            <Text style={styles.time}>{error ? 'Could not load audio' : fmt(duration)}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={() => js('skip(-10)')} hitSlop={10} style={styles.iconBtn}>
              <Icon name="rotate-left" iconStyle="solid" size={22} color={dark ? colors.textDark : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => js('toggle()')} style={styles.playBtn} activeOpacity={0.85}>
              <View style={playing ? undefined : { marginLeft: 3 }}>
                <Icon name={playing ? 'pause' : 'play'} iconStyle="solid" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => js('skip(10)')} hitSlop={10} style={styles.iconBtn}>
              <Icon name="rotate-right" iconStyle="solid" size={22} color={dark ? colors.textDark : colors.text} />
            </TouchableOpacity>
          </View>

          <WebViewPlayer
            ref={webRef}
            key={current._id}
            source={{ html: audioHtml(fileUrl(current)), baseUrl: 'https://localhost' }}
            style={styles.hiddenWebview}
            originWhitelist={['*']}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            onMessage={onMessage}
          />
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  playerDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  playerMentor: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 2 },
  iconBtn: { padding: 8 },
  barHit: { paddingVertical: 12, marginTop: spacing.sm },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border, justifyContent: 'center' },
  barDark: { backgroundColor: colors.borderDark },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.primary },
  knob: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, backgroundColor: colors.primary },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.sm },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  hiddenWebview: { height: 1, width: 1, opacity: 0.01, position: 'absolute', top: 0, left: 0 },
});
