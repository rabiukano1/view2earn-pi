import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { radius, shadow } from '../theme';
import SvgSpinWheel, { TEN_WHEEL_PRIZES } from '../components/SvgSpinWheel';
import RewardedAdModal from '../components/RewardedAdModal';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList, 'Spin'>;

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(WINDOW_WIDTH * 0.85, 330);
const NUM_SECTORS = TEN_WHEEL_PRIZES.length; // Exactly 10 sectors
const SECTOR_ANGLE = 360 / NUM_SECTORS; // 36°

const CONFETTI_COLORS = ['#8B5CF6', '#5B21B6', '#C4B5FD', '#DDD6FE', '#A855F7'];
const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Map server returned points to the nearest 10-sector prize
function indexForPts(pts: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < NUM_SECTORS; i++) {
    const d = Math.abs(TEN_WHEEL_PRIZES[i].pts - pts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export default function SpinScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const { userId } = useAuth();

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const doSpin = useMutation(api.spin.spin);
  const earnBonusSpin = useMutation(api.spin.earnBonusSpin);

  const wheelAnimatedValue = useRef(new Animated.Value(0)).current;
  const currentRotationRef = useRef(0);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const [adVisible, setAdVisible] = useState(false);
  const [refillMs, setRefillMs] = useState(0);
  const pendingAdAction = useRef<'spin' | 'bonusSpin' | 'doubleReward' | null>(null);
  const pendingResultAction = useRef<'spinAgain' | 'claimReward' | null>(null);
  const [doubleClaimed, setDoubleClaimed] = useState(false);

  const popScale = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(-1)).current;
  const [confetti] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      r: new Animated.Value(0),
      o: new Animated.Value(0),
    })),
  );

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
  const adBonusEarned = status?.adBonusEarned ?? 0;
  const adBonusLimit = status?.adBonusLimit ?? 2;
  const adBonusRemaining = status?.adBonusRemaining ?? Math.max(0, adBonusLimit - adBonusEarned);

  const disabled = spinning || spinsRemaining <= 0 || result !== null || !userId;
  const bonusAdDisabled = spinning || result !== null || !userId || adBonusRemaining <= 0;

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

  // Execute Exact Mathematical Rotation around center
  const executeSpin = async (force = false) => {
    if (!userId || spinning || spinsRemaining <= 0 || (!force && result !== null)) return;
    setSpinning(true);
    setResult(null);
    setDoubleClaimed(false);
    try {
      const { pts } = await doSpin({ userId });
      const targetIndex = indexForPts(pts);

      // ponytail: exact mathematical target angle calculates bisector of target 36° sector aligned at top 12 o'clock pointer + 6 full 360° revolutions.
      const targetSectorCenterAngle = targetIndex * SECTOR_ANGLE + SECTOR_ANGLE / 2;
      const targetAlignmentAngle = (360 - targetSectorCenterAngle) % 360;
      
      const fullRotations = 6 * 360;
      const currentMod = currentRotationRef.current % 360;
      const deltaAngle = (targetAlignmentAngle - currentMod + 360) % 360;
      const finalRotation = currentRotationRef.current + fullRotations + deltaAngle;

      Animated.timing(wheelAnimatedValue, {
        toValue: finalRotation,
        duration: 4200,
        easing: Easing.bezier(0.15, 0.85, 0.35, 1.0),
        useNativeDriver: true,
      }).start(() => {
        currentRotationRef.current = finalRotation;
        setResult(pts);
        setSpinning(false);
        startCelebration();
      });
    } catch {
      setSpinning(false);
    }
  };

  const handleSpinPress = () => {
    if (spinning || result !== null) return;
    if (spinsRemaining > 0) {
      executeSpin();
    } else if (adBonusRemaining > 0) {
      pendingAdAction.current = 'bonusSpin';
      setAdVisible(true);
    }
  };

  const handleGetBonusSpinPress = () => {
    if (adBonusRemaining <= 0) return;
    pendingAdAction.current = 'bonusSpin';
    setAdVisible(true);
  };

  const handleDirectClaim = () => {
    setResult(null);
  };

  const handleResultPress = () => {
    if (result === null) return;
    if (result > 0 && !doubleClaimed) {
      pendingAdAction.current = 'doubleReward';
      pendingResultAction.current = spinsRemaining > 0 ? 'spinAgain' : 'claimReward';
      setAdVisible(true);
      return;
    }
    if (spinsRemaining > 0) {
      setResult(null);
      executeSpin();
    } else {
      setResult(null);
    }
  };

  const handleAdSuccess = async () => {
    if (!userId) return;
    try {
      const action = pendingAdAction.current;
      if (action === 'bonusSpin') {
        await earnBonusSpin({ userId, amount: 1 });
      } else if (action === 'doubleReward') {
        setDoubleClaimed(true);
        const next = pendingResultAction.current;
        pendingResultAction.current = null;
        if (next === 'spinAgain') {
          await executeSpin(true);
        } else {
          setResult(null);
        }
      } else {
        await executeSpin();
      }
    } catch {
    } finally {
      pendingAdAction.current = null;
    }
  };

  const spinInterpolation = wheelAnimatedValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Icon name="chevron-left" iconStyle="solid" size={16} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.headerChallenge}>Daily Challenge</Text>

        <View style={styles.totalWinPill}>
          <Text style={styles.totalWinLabel}>Total win:</Text>
          <Icon name="coins" iconStyle="solid" size={13} color="#DDD6FE" />
          <Text style={styles.totalWinValue}>{balance === undefined ? '70' : balance}</Text>
        </View>
      </View>

      {/* Step Indicators Bar (1 2 3 4 5 6 7) */}
      <View style={styles.stepsBarContainer}>
        {[1, 2, 3, 4, 5, 6, 7].map((stepNum) => {
          const isDone = stepNum <= 2;
          const isCurrent = stepNum === 3;
          return (
            <View
              key={stepNum}
              style={[
                styles.stepCircle,
                isDone && styles.stepCircleDone,
                isCurrent && styles.stepCircleCurrent,
              ]}>
              {isDone ? (
                <Icon name="check" iconStyle="solid" size={11} color="#FFF" />
              ) : (
                <Text style={[styles.stepNumText, isCurrent && styles.stepNumTextCurrent]}>
                  {stepNum}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>
        
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>SPIN THE WHEEL</Text>
          <Text style={styles.mainSub}>Tap on wheel to earn points</Text>
        </View>

        {/* MATHEMATICALLY EXACT 10-SECTOR SVG SPIN WHEEL */}
        <SvgSpinWheel
          size={WHEEL_SIZE}
          spinning={spinning}
          disabled={disabled}
          spinInterpolation={spinInterpolation}
          onSpinPress={handleSpinPress}
        />

        {/* Refill Timer & Spins Count Footer */}
        <View style={styles.statusFooterRow}>
          <View style={styles.spinCounterBadge}>
            <Icon name="bolt" iconStyle="solid" size={14} color="#C4B5FD" />
            <Text style={styles.spinCounterText}>{spinsRemaining} Spins Available</Text>
          </View>

          {refillMs > 0 && (
            <View style={styles.timerBadge}>
              <Icon name="clock" iconStyle="solid" size={13} color="#C4B5FD" />
              <Text style={styles.timerBadgeText}>Refill: {formatTimer(refillMs)}</Text>
            </View>
          )}
        </View>

        {/* Action Controls & Result Card */}
        {result !== null ? (
          <View style={styles.resultCard}>
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
              <Icon name="trophy" iconStyle="solid" size={30} color="#8B5CF6" />
            </View>
            <Text style={styles.resultTitle}>
              {result > 0 || result < 0 ? 'YOU WON!' : 'NO BONUS'}
            </Text>
            <Animated.Text style={[styles.resultPts, { transform: [{ scale: popScale }] }]}>
              {result > 0 ? `+${result} PTS` : result < 0 ? `+${Math.abs(result)} SPINS` : 'TRY AGAIN'}
            </Animated.Text>

            {Boolean(result && result > 0 && !doubleClaimed) ? (
              <View style={styles.resultButtonGroup}>
                <TouchableOpacity style={styles.doubleBtn} onPress={handleResultPress} activeOpacity={0.88}>
                  <Icon name="circle-play" iconStyle="solid" size={15} color="#FFF" />
                  <Text style={styles.doubleBtnText}>WATCH VIDEO TO DOUBLE (2X)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.directClaimBtn} onPress={handleDirectClaim} activeOpacity={0.85}>
                  <Icon name="check" iconStyle="solid" size={13} color="#C4B5FD" />
                  <Text style={styles.directClaimText}>Claim +{result} PTS (Skip Ad)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultButtonGroup}>
                <TouchableOpacity style={styles.doubleBtn} onPress={handleDirectClaim} activeOpacity={0.88}>
                  {Boolean(doubleClaimed) ? (
                    <Icon name="check-double" iconStyle="solid" size={15} color="#FFF" />
                  ) : null}
                  <Text style={styles.doubleBtnText}>
                    {result && result > 0 && doubleClaimed
                      ? 'CLAIMED (2X REWARD)'
                      : spinsRemaining > 0
                      ? 'SPIN AGAIN'
                      : 'CONTINUE'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.actionColumn}>
            {/* Primary Spin Button */}
            <TouchableOpacity
              style={[styles.spinBtn, disabled && styles.spinBtnDisabled]}
              onPress={handleSpinPress}
              disabled={disabled}
              activeOpacity={0.88}>
              {spinning ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="hand-pointer" iconStyle="solid" size={16} color="#FFF" />
                  <Text style={styles.spinBtnText}>
                    {spinsRemaining > 0 ? 'TAP WHEEL TO SPIN' : 'OUT OF SPINS'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Bonus Ad Button */}
            <TouchableOpacity
              style={[styles.bonusAdCard, bonusAdDisabled && styles.bonusAdDisabled]}
              onPress={handleGetBonusSpinPress}
              disabled={bonusAdDisabled}
              activeOpacity={0.85}>
              <Icon
                name={adBonusRemaining > 0 ? 'circle-play' : 'circle-check'}
                iconStyle="solid"
                size={16}
                color={adBonusRemaining > 0 ? '#C4B5FD' : '#64748B'}
              />
              <Text style={[styles.bonusAdText, adBonusRemaining <= 0 && { color: '#64748B' }]}>
                {adBonusRemaining > 0
                  ? `Watch Video for Bonus Spin (${adBonusRemaining}/${adBonusLimit} left)`
                  : 'Daily bonus spin limit reached'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
        rewardAmount={pendingAdAction.current === 'doubleReward' ? result ?? undefined : undefined}
        adType={pendingAdAction.current === 'doubleReward' ? 'spin_double_bonus' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E0B36',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerChallenge: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '700',
  },
  totalWinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  totalWinLabel: {
    color: '#DDD6FE',
    fontSize: 12,
    fontWeight: '600',
  },
  totalWinValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepsBarContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#8B5CF6',
  },
  stepCircleCurrent: {
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  stepNumText: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  stepNumTextCurrent: {
    color: '#FFF',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#FFF',
    textAlign: 'center',
  },
  mainSub: {
    fontSize: 13,
    color: '#C4B5FD',
    marginTop: 4,
  },
  statusFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  spinCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  spinCounterText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  timerBadgeText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800',
  },
  actionColumn: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  spinBtn: {
    width: '100%',
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.float,
  },
  spinBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  spinBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bonusAdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  bonusAdDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bonusAdText: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  resultCard: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: '#5B21B6',
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    ...shadow.float,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#8B5CF6',
  },
  resultPts: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFF',
  },
  resultButtonGroup: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  doubleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: '#8B5CF6',
    ...shadow.raised,
  },
  doubleBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.8,
  },
  directClaimBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  directClaimText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DDD6FE',
  },
});
