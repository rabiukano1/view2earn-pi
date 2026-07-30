import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
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
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import RewardedAdModal from '../components/RewardedAdModal';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList, 'Spin'>;

const SCREEN_W = Dimensions.get('window').width;
const TILE_INNER = 76;
const TILE_MARGIN = 8;
const TILE_W = TILE_INNER + TILE_MARGIN * 2;
const LOOPS = 8;
const LEN = SPIN_PRIZES.length;
const STRIP = Array.from({ length: (LOOPS + 2) * LEN }, (_, i) => SPIN_PRIZES[i % LEN]);

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function SpinScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const { userId } = useAuth();

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : 'skip');
  const doSpin = useMutation(api.spin.spin);
  const earnBonusSpin = useMutation(api.spin.earnBonusSpin);

  const translateX = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  // Rewarded Ad & Refill Timer states
  const [adVisible, setAdVisible] = useState(false);
  const [adMode, setAdMode] = useState<'spin_ad' | 'bonus_spin'>('spin_ad');
  const [refillMs, setRefillMs] = useState(0);

  // Live countdown timer for 3-hour window refill
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

  const executeSpin = async () => {
    if (!userId || spinning || spinsRemaining <= 0 || result !== null) return;
    setSpinning(true);
    setResult(null);
    try {
      const { index, pts } = await doSpin({ userId });
      const target = LOOPS * LEN + index;
      const dest = SCREEN_W / 2 - (target * TILE_W + TILE_W / 2);
      translateX.setValue(0);
      Animated.timing(translateX, {
        toValue: dest,
        duration: 3400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setResult(pts);
        setSpinning(false);
      });
    } catch (e) {
      setSpinning(false);
    }
  };

  const handleSpinPress = () => {
    if (spinsRemaining <= 0) return;
    setAdMode('spin_ad');
    setAdVisible(true);
  };

  const handleGetBonusSpinPress = () => {
    setAdMode('bonus_spin');
    setAdVisible(true);
  };

  const handleAdSuccess = async () => {
    if (adMode === 'bonus_spin') {
      if (userId) {
        await earnBonusSpin({ userId, amount: 1 });
      }
    } else if (adMode === 'spin_ad') {
      await executeSpin();
    }
  };

  const disabled = spinning || spinsRemaining <= 0 || result !== null || !userId;

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>Spin & Win</Text>
        <View style={styles.backButton} />
      </View>

      {/* 3-Hour Refill & Spin Counter Status Bar */}
      <View style={styles.statusSection}>
        <View style={styles.refillBadge}>
          <Icon name="clock" iconStyle="solid" size={12} color="#7C3AED" />
          <Text style={styles.refillText}>Refill in {formatTimer(refillMs)}</Text>
        </View>

        <View style={styles.spinCounterRow}>
          <View style={styles.counterPill}>
            <Text style={styles.counterPillText}>
              ⚡ {baseSpinsRemaining}/3 Base Spins
            </Text>
          </View>

          {bonusSpins > 0 && (
            <View style={[styles.counterPill, styles.bonusCounterPill]}>
              <Text style={styles.bonusCounterPillText}>
                🎁 +{bonusSpins} Extra Spin{bonusSpins > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Wheel Area */}
      <View style={styles.stage}>
        <Text style={styles.stageEmoji}>🎡</Text>
        <Text style={[styles.stageHint, dark && styles.textMuted]}>
          3 Base Spins every 3 hours · Win up to 250 PTS!
        </Text>

        {/* Reel */}
        <View style={styles.reelWrap}>
          <Animated.View style={[styles.reel, { transform: [{ translateX }] }]}>
            {STRIP.map((p, i) => (
              <View key={i} style={[styles.tile, dark && styles.tileDark]}>
                <Text style={styles.tilePts}>{p.pts}</Text>
                <Text style={styles.tilePtsLabel}>pts</Text>
              </View>
            ))}
          </Animated.View>
          <View pointerEvents="none" style={styles.pointer} />
          <View pointerEvents="none" style={styles.pointerCap} />
        </View>

        {/* Result Callout or Spin Button */}
        {result !== null ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultIcon}>🎉</Text>
            <Text style={[styles.resultTitle, dark && styles.textLight]}>You Won!</Text>
            <Text style={styles.resultPts}>+{result} PTS</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setResult(null)}>
              <Text style={styles.primaryBtnText}>
                {spinsRemaining > 0 ? 'Spin Again' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
              onPress={handleSpinPress}
              disabled={disabled}>
              <Text style={styles.primaryBtnText}>
                {spinning
                  ? 'Spinning…'
                  : spinsRemaining > 0
                  ? `SPIN (${spinsRemaining} Left)`
                  : 'Out of Spins'}
              </Text>
            </TouchableOpacity>

            {/* Watch Ad for +1 Bonus Spin Card */}
            <TouchableOpacity
              style={styles.bonusAdCard}
              onPress={handleGetBonusSpinPress}
              activeOpacity={0.85}>
              <Icon name="circle-play" iconStyle="solid" size={18} color="#F59E0B" />
              <Text style={styles.bonusAdText}>Watch Ad for +1 Extra Spin</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },
  statusSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  refillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  refillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  spinCounterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  counterPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
  },
  bonusCounterPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  bonusCounterPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
  },
  stage: { flex: 1, alignItems: 'center', paddingTop: 16, gap: 8 },
  stageEmoji: { fontSize: 52 },
  stageHint: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginBottom: 8 },
  reelWrap: {
    width: '100%',
    height: 108,
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 14,
  },
  reel: { flexDirection: 'row' },
  tile: {
    width: TILE_INNER,
    marginHorizontal: TILE_MARGIN,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  tileDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tilePts: { fontSize: 26, fontWeight: '800', color: colors.primary },
  tilePtsLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  pointer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SCREEN_W / 2 - 1.5,
    width: 3,
    backgroundColor: colors.danger,
    borderRadius: 2,
  },
  pointerCap: {
    position: 'absolute',
    top: -2,
    left: SCREEN_W / 2 - 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.danger,
  },
  resultBox: { alignItems: 'center', gap: 6, marginTop: 12 },
  resultIcon: { fontSize: 44 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  resultPts: { fontSize: 34, fontWeight: '800', color: colors.success },
  actionColumn: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 48,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.raised,
  },
  primaryBtnDisabled: { backgroundColor: colors.textFaint, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  bonusAdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  bonusAdText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#D97706',
  },
});
