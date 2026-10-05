import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONVEX_SITE_URL } from '../config';
import Icon from '../components/Icon';
import { colors, radius, spacing, shadow } from '../theme';
import { navigateFromAnywhere } from '../navigation/navigationRef';

// Voice playback lives HERE, at the app root — not inside the screen that
// started it. The player used to be a hidden WebView inside VoiceNoteList, so
// navigating away unmounted it and the audio stopped mid-sentence. Mounted
// once above the navigator, playback survives moving between screens.
//
// ponytail: this keeps audio alive across navigation. Continuing while the app
// is fully backgrounded, plus lock-screen controls, needs a foreground service
// (react-native-track-player) — a native dependency and a bigger change.

const WebViewPlayer = WebView as any;

export type PlayableNote = {
  _id: string;
  title?: string;
  mentor?: string;
  [key: string]: any;
};

export const voiceFileUrl = (n: PlayableNote, dl = false) =>
  `${CONVEX_SITE_URL}/voice/file?id=${n._id}${dl ? '&dl=1' : ''}`;

const audioHtml = (url: string, rate: number, startAt: number) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#000">
<audio id="a" autoplay preload="auto" src="${url.replace(/"/g, '&quot;')}"></audio>
<script>
  var a = document.getElementById('a');
  a.playbackRate = ${rate};
  // Resume where the listener stopped. Done on loadedmetadata because
  // currentTime cannot be set before the duration is known.
  var START = ${Math.max(0, Math.floor(startAt))};
  var resumed = false;
  a.addEventListener('loadedmetadata', function(){
    if (!resumed && START > 0 && isFinite(a.duration) && START < a.duration - 5) {
      a.currentTime = START;
    }
    resumed = true;
  });
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

type VoicePlayer = {
  current: PlayableNote | null;
  playing: boolean;
  buffering: boolean;
  error: boolean;
  time: number;
  duration: number;
  rate: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** Start a note. `queue` enables next/previous within that list. */
  play: (note: PlayableNote, queue?: PlayableNote[]) => void;
  toggle: () => void;
  seek: (fraction: number) => void;
  skip: (seconds: number) => void;
  changeRate: (rate: number) => void;
  step: (delta: 1 | -1) => void;
  stop: () => void;
  /**
   * Screens that show their own full player call this so the floating mini
   * bar does not sit on top of their controls.
   */
  setFullPlayerVisible: (visible: boolean) => void;
};

// Resume positions live on the device: they are per-listener, worthless to
// anyone else, and must survive an app restart without a round trip.
const POS_KEY = (id: string) => `voice:pos:${id}`;
// Below this, resuming is more annoying than helpful.
const MIN_RESUME_SECONDS = 10;
const SAVE_EVERY_MS = 5000;

async function loadPosition(id: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(POS_KEY(id));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > MIN_RESUME_SECONDS ? n : 0;
  } catch {
    return 0;
  }
}

const Ctx = createContext<VoicePlayer | null>(null);

export function useVoicePlayer(): VoicePlayer {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoicePlayer must be used inside <VoicePlayerProvider>');
  return ctx;
}

export function VoicePlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PlayableNote | null>(null);
  const [queue, setQueue] = useState<PlayableNote[]>([]);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  const webRef = useRef<any>(null);
  const lastSaveRef = useRef(0);
  const insets = useSafeAreaInsets();

  const js = useCallback((code: string) => {
    webRef.current?.injectJavaScript(`${code}; true;`);
  }, []);

  const index = useMemo(
    () => (current ? queue.findIndex((n) => n._id === current._id) : -1),
    [queue, current],
  );

  const play = useCallback((note: PlayableNote, nextQueue?: PlayableNote[]) => {
    setError(false);
    setTime(0);
    setDuration(0);
    setBuffering(true);
    if (nextQueue) setQueue(nextQueue);
    lastSaveRef.current = 0;
    // Look up where this note was left, then mount the player with that
    // position baked in. Both state updates land in one render, so the
    // WebView is created already knowing where to start.
    void loadPosition(note._id).then((saved) => {
      setResumeAt(saved);
      setCurrent((prev) => (prev && prev._id === note._id ? prev : note));
    });
  }, []);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (index < 0) return;
      const target = queue[index + delta];
      if (target) play(target);
    },
    [index, queue, play],
  );

  const stop = useCallback(() => {
    // Saves are throttled, so capture the exact position before tearing the
    // player down — otherwise closing loses up to SAVE_EVERY_MS of progress.
    if (current && time > MIN_RESUME_SECONDS) {
      void AsyncStorage.setItem(POS_KEY(current._id), String(Math.floor(time))).catch(() => {});
    }
    setCurrent(null);
    setPlaying(false);
    setBuffering(false);
    setTime(0);
    setDuration(0);
  }, [current, time]);

  const onMessage = useCallback(
    (e: any) => {
      try {
        const d = JSON.parse(e.nativeEvent.data);
        if (d.error) {
          setError(true);
          setBuffering(false);
          return;
        }
        if (typeof d.t === 'number') {
          setTime(d.t);
          // Throttled so a per-second timeupdate does not hammer storage.
          const now = Date.now();
          if (current && d.t > MIN_RESUME_SECONDS && now - lastSaveRef.current > SAVE_EVERY_MS) {
            lastSaveRef.current = now;
            void AsyncStorage.setItem(POS_KEY(current._id), String(Math.floor(d.t))).catch(() => {});
          }
        }
        if (typeof d.d === 'number' && d.d > 0) setDuration(d.d);
        if (typeof d.playing === 'boolean') setPlaying(d.playing);
        if (typeof d.buffering === 'boolean') setBuffering(d.buffering);
        // Finished: drop the saved position so it starts from the beginning
        // next time, then roll into the next note like a podcast app.
        if (d.ended) {
          if (current) void AsyncStorage.removeItem(POS_KEY(current._id)).catch(() => {});
          step(1);
        }
      } catch {
        // malformed payload — ignore
      }
    },
    [step, current],
  );

  const value = useMemo<VoicePlayer>(
    () => ({
      current,
      playing,
      buffering,
      error,
      time,
      duration,
      rate,
      hasNext: index >= 0 && index < queue.length - 1,
      hasPrev: index > 0,
      play,
      toggle: () => js('toggle()'),
      seek: (f: number) => js(`seekTo(${f})`),
      skip: (s: number) => js(`skip(${s})`),
      changeRate: (r: number) => {
        setRate(r);
        js(`setRate(${r})`);
      },
      step,
      stop,
      setFullPlayerVisible,
    }),
    [current, playing, buffering, error, time, duration, rate, index, queue.length, play, step, stop, js],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Mini bar: the only pause/stop available once you leave the voice
          screen. Hidden while a screen is showing the full player. */}
      {current && !fullPlayerVisible ? (
        <View style={[styles.miniWrap, { top: insets.top + spacing.sm }]}>
          <View style={styles.mini}>
            <TouchableOpacity
              style={styles.miniOpen}
              activeOpacity={0.7}
              onPress={() => navigateFromAnywhere('VoiceNotes')}
              accessibilityLabel="Open voice notes">
              <View style={styles.miniIcon}>
                <Icon name="headphones" iconStyle="solid" size={14} color={colors.primaryDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniTitle} numberOfLines={1}>
                  {current.title || 'Voice note'}
                </Text>
                <Text style={styles.miniSub} numberOfLines={1}>
                  {buffering ? 'Buffering…' : error ? 'Playback error' : current.mentor || 'Mentor'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => value.toggle()} hitSlop={10} style={styles.miniBtn}>
              {buffering ? (
                <ActivityIndicator size="small" color={colors.primaryDeep} />
              ) : (
                <Icon
                  name={playing ? 'pause' : 'play'}
                  iconStyle="solid"
                  size={16}
                  color={colors.primaryDeep}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={stop} hitSlop={10} style={styles.miniBtn}>
              <Icon name="xmark" iconStyle="solid" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {current ? (
        <View style={styles.hidden} pointerEvents="none">
          <WebViewPlayer
            ref={webRef}
            key={current._id}
            source={{ html: audioHtml(voiceFileUrl(current), rate, resumeAt), baseUrl: 'https://localhost' }}
            style={styles.hidden}
            originWhitelist={['*']}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            onMessage={onMessage}
          />
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 0, height: 0, opacity: 0 },
  miniWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF',
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    ...shadow.float,
  },
  miniOpen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  miniIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  miniSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  miniBtn: { padding: 6 },
});
