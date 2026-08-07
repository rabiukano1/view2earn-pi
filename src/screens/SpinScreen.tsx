import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SPIN_PRIZES } from '@view2earn/core';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import RewardedAdModal from '../components/RewardedAdModal';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList, 'Spin'>;

const REEL_WINDOW_H = 212;
const TILE_H = 60;
const TILE_MARGIN = 7;
const TILE_STEP = TILE_H + TILE_MARGIN * 2;
const LOOPS = 6;
const LEN = SPIN_PRIZES.length;
const STRIP = Array.from({ length: (LOOPS + 2) * LEN }, (_, i) => SPIN_PRIZES[i % LEN]);
const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

// Wheel palette — prize tiles cycle through these accent colours (the app's
// primary violet leads). White text sits on top, so both themes look sharp.
const PALETTE = [
  { a: colors.primary, b: colors.primaryDeep },
  { a: '#EC4899', b: '#BE185D' },
  { a: colors.warn, b: '#D97706' },
  { a: colors.success, b: '#059669' },
  { a: '#3B82F6', b: '#2563EB' },
  { a: '#F43F5E', b: '#E11D48' },
];

const CONFETTI_COLORS = [colors.primary, '#F472B6', colors.warn, colors.success, '#60A5FA', '#F87171'];

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Match a server-returned pts value to the nearest tile in the visible reel so
// the wheel always lands on the tile that was actually awarded (prizes are
// admin-configurable, so exact matches may not exist on the client).
function indexForPts(pts: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LEN; i++) {
    const d = Math.abs(SPIN_PRIZES[i].pts - pts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export default function SpinScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const { userId } = useAuth();

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : 'skip');
  const doSpin = useMutation(api.spin.spin);
  const earnBonusSpin = useMutation(api.spin.earnBonusSpin);

  const translateY = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  // Rewarded Ad & Refill Timer states
  const [adVisible, setAdVisible] = useState(false);
  const [refillMs, setRefillMs] = useState(0);

  // Win celebration + button shine animations
  const popScale = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(-1)).current;
  const [confetti] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      r: new Animated.Value(0),
      o: new Animated.Value(0),
    })),
  );

  // Live countdown timer for the spin-window refill
  useEffect(() => {
    if (status?.nextRefillMs) {
      setRefillMs(status.nextRefillMs);
    }
  }, [status?.nextRefillMs]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (refillMs > 0) {
      interval = setInterval(() => {
        setRefillMs((prev) => Math.max(0, prev - 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [refillMs > 0]);

  const spinsRemaining = status?.spinsRemaining ?? 0;
  const baseSpinsRemaining = status?.baseSpinsRemaining ?? 0;
  const bonusSpins = status?.bonusSpins ?? 0;
  const adBonusEarned = status?.adBonusEarned ?? 0;
  const adBonusLimit = status?.adBonusLimit ?? 2;
  const adBonusRemaining = status?.adBonusRemaining ?? Math.max(0, adBonusLimit - adBonusEarned);
  const windowTotalMs = status?.windowTotalMs ?? DEFAULT_WINDOW_MS;
  const refillProgress = Math.min(1, Math.max(0, 1 - refillMs / windowTotalMs));

  const disabled = spinning || spinsRemaining <= 0 || result !== null || !userId;
  // The ad button stays usable even when out of spins — that's its whole point:
  // watch a rewarded ad to earn one more spin. Only block it while spinning,
  // showing a result, or after the per-window ad quota is used up.
  const bonusAdDisabled =
    spinning || result !== null || !userId || adBonusRemaining <= 0;

  const startCelebration = () => {
    popScale.setValue(0.4);
    Animated.spring(popScale, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
    confetti.forEach((c) => {
      c.tx.setValue(0);
      c.ty.setValue(0);
      c.r.setValue(0);
      c.o.setValue(0);
      const drift = (Math.random() - 0.5) * 280;
      const fall = 120 + Math.random() * 160;
      const rot = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(c.o, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(c.ty, {
            toValue: -44,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(c.tx, {
            toValue: drift * 0.3,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(c.ty, {
            toValue: fall,
            duration: 840,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(c.tx, {
            toValue: drift,
            duration: 840,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(c.r, {
            toValue: rot,
            duration: 840,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(c.o, { toValue: 0, duration: 640, delay: 200, useNativeDriver: true }),
        ]),
      ]).start();
    });
  };

  // Looping shine sweep on the spin button (paused while disabled)
  useEffect(() => {
    if (disabled) {
      shine.setValue(-1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, shine]);

  const executeSpin = async () => {
    if (!userId || spinning || spinsRemaining <= 0 || result !== null) return;
    setSpinning(true);
    setResult(null);
    try {
      const { pts } = await doSpin({ userId });
      const target = indexForPts(pts);
      const destY = (REEL_WINDOW_H - TILE_H) / 2 - (LOOPS * LEN + target) * TILE_STEP;
      translateY.setValue((REEL_WINDOW_H - TILE_H) / 2);
      Animated.timing(translateY, {
        toValue: destY,
        duration: 3600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setResult(pts);
        setSpinning(false);
        startCelebration();
      });
    } catch {
      setSpinning(false);
    }
  };

  const handleSpinPress = () => {
    if (disabled || spinning) return;
    executeSpin();
  };

  const handleGetBonusSpinPress = () => {
    if (adBonusRemaining <= 0) return;
    setAdVisible(true);
  };

  const handleAdSuccess = async () => {
    if (!userId) return;
    try {
      await earnBonusSpin({ userId, amount: 1 });
    } catch {
      // quota reached — ignore
    }
  };

  const textMain = dark ? colors.textDark : colors.text;
  const muted = colors.textMuted;
  const statusCardStyle = [styles.statusCard, dark && styles.statusCardDark];
  const reelCardStyle = [styles.reelCard, dark && styles.reelCardDark];

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top + 6 }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* Ambient background glows */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>
        {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.iconBtn, dark && styles.iconBtnDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Icon name="arrow-left" iconStyle="solid" size={16} color={dark ? '#F5F5F7' : colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textMain }]}>SPIN &amp; WIN</Text>
          <Text style={styles.headerSub}>Lucky wheel · win up to 500 PTS</Text>
        </View>
        <View style={[styles.iconBtn, styles.iconBtnGhost]} />
      </View>

      {/* Status card + refill progress */}
      <View style={statusCardStyle}>
        <View style={styles.statCell}>
          <Icon name="bolt" iconStyle="solid" size={16} color={colors.primary} />
          <Text style={[styles.statValue, { color: textMain }]}>{baseSpinsRemaining}</Text>
          <Text style={styles.statLabel}>Base spins</Text>
        </View>

        <View style={[styles.statDivider, dark && styles.statDividerDark]} />

        <View style={styles.statCell}>
          <Icon name="gift" iconStyle="solid" size={16} color={bonusSpins > 0 ? colors.warn : muted} />
          <Text style={[styles.statValue, bonusSpins === 0 && { color: muted }, { color: textMain }]}>
            {bonusSpins}
          </Text>
          <Text style={styles.statLabel}>Extra spins</Text>
        </View>

        <View style={[styles.statDivider, dark && styles.statDividerDark]} />

        <View style={styles.statCell}>
          <Icon name="clock-rotate-left" iconStyle="solid" size={16} color={colors.success} />
          <Text style={[styles.statValue, { color: textMain }]}>{formatTimer(refillMs)}</Text>
          <Text style={styles.statLabel}>Next refill</Text>
        </View>
      </View>
      <View style={[styles.refillTrack, dark && styles.refillTrackDark]}>
        <View style={[styles.refillFill, { width: `${refillProgress * 100}%` }]} />
      </View>

      {/* Reel window */}
      <View style={reelCardStyle}>
        <View style={[styles.reelWindow, dark && styles.reelWindowDark]}>
          <Animated.View style={[styles.reel, { transform: [{ translateY }] }]}>
            {STRIP.map((p, i) => {
              const c = PALETTE[i % PALETTE.length];
              return (
                <View key={i} style={[styles.tile, { backgroundColor: c.b, borderColor: c.a }]}>
                  <View style={[styles.tileAccent, { backgroundColor: c.a }]} />
                  <Text style={styles.tilePts}>{p.pts}</Text>
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>PTS</Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>

          {/* Center win line + highlight */}
          <View pointerEvents="none" style={styles.centerLine} />
          <View pointerEvents="none" style={styles.winnerGlow} />
          {/* Edge fades */}
          <View pointerEvents="none" style={[styles.edgeFade, dark && styles.edgeFadeDark, { top: 0 }]} />
          <View pointerEvents="none" style={[styles.edgeFade, dark && styles.edgeFadeDark, { bottom: 0 }]} />
        </View>

        {/* Prize pool preview */}
        <View style={styles.prizeChips}>
          {SPIN_PRIZES.map((p, i) => (
            <View
              key={p.pts}
              style={[
                styles.prizeChip,
                dark && styles.prizeChipDark,
                { borderColor: PALETTE[i % PALETTE.length].a },
              ]}>
              <Text style={[styles.prizeChipText, { color: PALETTE[i % PALETTE.length].a }]}>
                {p.pts}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Result or actions */}
      {result !== null ? (
        <View style={[styles.resultCard, dark && styles.resultCardDark]}>
          <View pointerEvents="none" style={styles.confettiLayer}>
            {confetti.map((c, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.confettiDot,
                  {
                    backgroundColor: c.color,
                    opacity: c.o,
                    transform: [
                      { translateX: c.tx },
                      { translateY: c.ty },
                      { rotate: c.r.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                    ],
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.trophyWrap}>
            <Icon name="trophy" iconStyle="solid" size={30} color={colors.warn} />
          </View>
          <Text style={styles.resultTitle}>YOU WON</Text>
          <Animated.Text style={[styles.resultPts, { color: textMain, transform: [{ scale: popScale }] }]}>
            +{result} PTS
          </Animated.Text>
          <TouchableOpacity
            style={[styles.resultBtn, dark && styles.resultBtnDark]}
            onPress={() => setResult(null)}
            activeOpacity={0.9}>
            <Text style={[styles.resultBtnText, { color: textMain }]}>
              {spinsRemaining > 0 ? 'SPIN AGAIN' : 'DONE'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionColumn}>
          <View style={[styles.spinBtnWrap, disabled && styles.spinBtnShadowOff]}>
            <TouchableOpacity
              style={[styles.spinBtn, disabled && (dark ? styles.spinBtnDisabledDark : styles.spinBtnDisabled)]}
              onPress={handleSpinPress}
              disabled={disabled}
              activeOpacity={0.9}>
              {!disabled && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shineSweep,
                    {
                      transform: [
                        {
                          translateX: shine.interpolate({
                            inputRange: [-1, 1],
                            outputRange: [-220, 220],
                          }),
                        },
                        { rotate: '20deg' },
                      ],
                    },
                  ]}
                />
              )}
              {spinning ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Icon name="dice" iconStyle="solid" size={18} color={colors.white} />
                  <Text style={styles.spinBtnText}>
                    {spinsRemaining > 0
                      ? `SPIN — ${spinsRemaining} LEFT`
                      : 'OUT OF SPINS'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.bonusAdCard,
              dark && styles.bonusAdCardDark,
              bonusAdDisabled && (dark ? styles.bonusAdCardDisabledDark : styles.bonusAdCardDisabled),
            ]}
            onPress={handleGetBonusSpinPress}
            disabled={bonusAdDisabled}
            activeOpacity={0.85}>
            {adBonusRemaining > 0 ? (
              <Icon name="circle-play" iconStyle="solid" size={16} color={dark ? '#FBBF24' : '#D97706'} />
            ) : (
              <Icon name="circle-check" iconStyle="solid" size={16} color={muted} />
            )}
            <Text
              style={[
                styles.bonusAdText,
                dark ? styles.bonusAdTextDark : styles.bonusAdTextLight,
                adBonusRemaining <= 0 && { color: muted },
              ]}>
              {adBonusRemaining > 0
                ? `Watch ad for +1 spin (${adBonusRemaining}/${adBonusLimit})`
                : 'Bonus spin limit reached'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>

      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  containerDark: { backgroundColor: colors.bgDark },
  glowTop: {
    position: 'absolute',
    top: -90,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -70,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(236, 72, 153, 0.09)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  iconBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconBtnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    marginTop: 8,
    ...shadow.card,
  },
  statusCardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  statCell: { alignItems: 'center', gap: 3, flex: 1 },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  statDividerDark: { backgroundColor: colors.borderDark },
  refillTrack: {
    marginTop: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  refillTrackDark: { backgroundColor: colors.surfaceAltDark },
  refillFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  reelCard: {
    marginTop: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow.float,
  },
  reelCardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  reelWindow: {
    height: REEL_WINDOW_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reelWindowDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  reel: {},
  tile: {
    height: TILE_H,
    marginVertical: TILE_MARGIN,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  tilePts: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  tileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 1,
  },
  centerLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: REEL_WINDOW_H / 2 - 1.5,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.warn,
    shadowColor: colors.warn,
    shadowOpacity: 0.85,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  winnerGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: REEL_WINDOW_H / 2 - 26,
    height: 52,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  edgeFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: colors.surfaceAlt,
  },
  edgeFadeDark: { backgroundColor: colors.surfaceDark },
  prizeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  prizeChip: {
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  prizeChipDark: { backgroundColor: colors.surfaceAltDark },
  prizeChipText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  resultCard: {
    marginTop: 22,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 5,
    overflow: 'hidden',
    ...shadow.card,
  },
  resultCardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  confettiLayer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 220,
    alignItems: 'center',
  },
  confettiDot: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 14,
    borderRadius: 3,
  },
  trophyWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: colors.warn,
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: colors.warn,
  },
  resultPts: {
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  resultBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resultBtnDark: {
    backgroundColor: colors.primarySoftDark,
    borderColor: colors.primaryDeep,
  },
  resultBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  actionColumn: {
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
  },
  spinBtnWrap: {
    alignSelf: 'stretch',
    borderRadius: 24,
    ...shadow.raised,
  },
  spinBtnShadowOff: {
    shadowOpacity: 0,
    elevation: 0,
  },
  spinBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    overflow: 'hidden',
  },
  spinBtnDisabled: {
    backgroundColor: colors.textFaint,
    borderColor: 'transparent',
  },
  spinBtnDisabledDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'transparent',
  },
  shineSweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  spinBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  bonusAdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: colors.warn,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  bonusAdCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  bonusAdCardDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  bonusAdCardDisabledDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bonusAdText: {
    fontSize: 13,
    fontWeight: '800',
  },
  bonusAdTextLight: { color: '#D97706' },
  bonusAdTextDark: { color: '#FBBF24' },
});
