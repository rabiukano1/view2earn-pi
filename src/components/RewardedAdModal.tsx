import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';
import { ADMOB_AD_UNITS, ADMOB_TEST_AD_UNIT } from '../services/admobService';

interface RewardedAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
  /** Override the reward amount (e.g. spin double-reward = spin winnings). */
  rewardAmount?: number;
  /** Ledger reason suffix recorded server-side (e.g. SPIN_DOUBLE_BONUS). */
  adType?: string;
  /** When true, skip the generic ads.rewardForAd ledger credit and only call onSuccess.
   *  Use for flows where points/spins are credited by a dedicated mutation (spin claim, bonus spin). */
  skipReward?: boolean;
}

type AdPhase = 'loading' | 'ready' | 'error';

// Never surface provider names or ad unit IDs to the user — strip them from any
// SDK error string so they can't leak through the UI.
function sanitize(msg: string, adUnitId: string): string {
  return msg
    .replace(new RegExp(adUnitId, 'g'), '')
    .replace(/AdMob|admob|ADMOB|UnityAds|unityads|UNITY/g, '')
    .replace(/ca-app-pub-[0-9/]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function RewardedAdModal({
  visible,
  onClose,
  onSuccess,
  rewardAmount,
  adType,
  skipReward,
}: RewardedAdModalProps) {
  const { userId } = useAuth();
  const [phase, setPhase] = useState<AdPhase>('loading');
  const [adError, setAdError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const claimedRef = useRef(false);

  const adConfig = useQuery(api.ads.getAdRewardConfig, visible && userId ? { userId } : 'skip');
  const rewardForAd = useMutation(api.ads.rewardForAd);

  // Parse active ad network config from Convex backend if configured by Admin Panel
  const activeProvider = adConfig?.providers?.[0];
  let parsedConfig: Record<string, any> = {};
  if (activeProvider?.configJson) {
    try {
      parsedConfig = JSON.parse(activeProvider.configJson);
    } catch { }
  }

  const rewardPoints = adConfig?.rewardPoints ?? 50;
  const displayReward = rewardAmount ?? rewardPoints;
  const liveAdUnitId =
    Platform.OS === 'ios'
      ? (parsedConfig.adMobIosUnitId || ADMOB_AD_UNITS.ios)
      : (parsedConfig.adMobAndroidUnitId || parsedConfig.unityPlacementId || ADMOB_AD_UNITS.android);
  const baseUnitId = __DEV__ ? ADMOB_TEST_AD_UNIT : liveAdUnitId;
  const [effectiveAdUnitId, setEffectiveAdUnitId] = useState(baseUnitId);
  // Keep in sync when modal reopens or config changes (unless already fell back to test)
  useEffect(() => {
    setEffectiveAdUnitId(baseUnitId);
  }, [baseUnitId, visible]);

  const { isLoaded, isClosed, isEarnedReward, error, load, show } = useRewardedAd(effectiveAdUnitId);

  // Debug: log which unit is actually being used (helps catch prod no-fill)
  useEffect(() => {
    if (visible) {
      console.log('[RewardedAd] effectiveAdUnitId:', effectiveAdUnitId, __DEV__ ? '(TEST)' : '(LIVE)', 'provider:', activeProvider?.name ?? 'none');
      if (error) console.log('[RewardedAd] hook error:', JSON.stringify(error));
    }
  }, [visible, effectiveAdUnitId, activeProvider?.name, error]);

  // Load the ad fresh each time the modal opens or unit changes.
  // If ad was prefetched (isLoaded true), go ready immediately — fixes 2nd request delay.
  useEffect(() => {
    if (visible && effectiveAdUnitId) {
      claimedRef.current = false;
      setAdError('');
      if (isLoaded) {
        setPhase('ready');
        return;
      }
      setPhase('loading');
      try {
        console.log('[RewardedAd] load() ->', effectiveAdUnitId);
        load();
      } catch (err: any) {
        console.warn('[RewardedAd] load() threw:', err);
        setAdError('');
        setPhase('loading');
        setTimeout(() => { try { load(); } catch { } }, 500);
      }
    }
  }, [visible, effectiveAdUnitId, load, isLoaded]);

  // Silent error handling — if live unit has no fill/error, switch to test unit immediately.
  // The test unit always fills (Google guarantee), so 'ready' is ONLY reached via isLoaded —
  // never via a timeout — so show() always plays a real rewarded video.
  useEffect(() => {
    if (error) {
      const raw = (error as any)?.code ? `[${(error as any).code}] ${error.message}` : error.message;
      console.warn('[RewardedAd] load error:', raw, 'unit:', effectiveAdUnitId);
      if (effectiveAdUnitId !== ADMOB_TEST_AD_UNIT) {
        console.log('[RewardedAd] error on live unit -> fallback to test unit silently');
        setEffectiveAdUnitId(ADMOB_TEST_AD_UNIT);
        setPhase('loading');
        setAdError('');
        return;
      }
      // Test unit errored — retry the load (it refills on the next attempt).
      console.warn('[RewardedAd] test unit error -> retrying load');
      setPhase('loading');
      setAdError('');
      setTimeout(() => {
        try { load(); } catch { }
      }, 1500);
    }
  }, [error, effectiveAdUnitId, load]);

  // Ad became ready → flip to the "ready" CTA.
  useEffect(() => {
    if (isLoaded) {
      console.log('[RewardedAd] LOADED');
      setPhase('ready');
    }
  }, [isLoaded]);

  // Prefetch next ad immediately after close so next request is instant
  useEffect(() => {
    if (isClosed) {
      console.log('[RewardedAd] closed -> prefetch next');
      setPhase('loading');
      claimedRef.current = false;
      setTimeout(() => {
        try { load(); } catch { }
      }, 400);
    }
  }, [isClosed, load]);

  // Load timeout: 6s — gives rewarded video enough time to fill (typically 3-10s).
  // If the live unit is slow, fall back to the test unit (which always fills).
  // NEVER force 'ready' on timeout — the "Watch Video" button must only appear
  // when a real rewarded video is loaded, otherwise show() would do nothing.
  useEffect(() => {
    if (!visible || phase !== 'loading') return;
    const t = setTimeout(() => {
      console.warn('[RewardedAd] load timeout (6s) — fallback to test unit', effectiveAdUnitId);
      if (effectiveAdUnitId !== ADMOB_TEST_AD_UNIT) {
        setEffectiveAdUnitId(ADMOB_TEST_AD_UNIT);
        setPhase('loading');
      } else {
        // Test unit slow — retry once; keep user in loading (never show a dead button)
        try { load(); } catch { }
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [visible, phase, effectiveAdUnitId, load]);


  // Reward earned → award points exactly once, notify onSuccess, then close modal.
  // Hardcoded guard: any adType starting with 'spin_' (doubleReward / bonusSpin) is
  // handled exclusively by spin.ts claimSpin/earnBonusSpin — NEVER credit generic +50 here.
  const isSpinFlow = Boolean(adType && (adType.toLowerCase().includes('spin') || adType.toLowerCase().includes('double')));
  const handleRewardEarned = useCallback(async () => {
    if (!userId || claimedRef.current) return;
    claimedRef.current = true;
    setClaiming(true);
    try {
      if (skipReward || isSpinFlow) {
        // Points/spins credited by dedicated mutation only — no generic rewardForAd.
        if (onSuccess) {
          await onSuccess(0);
        }
      } else {
        const newBalance = await rewardForAd({
          userId,
          provider: effectiveAdUnitId,
          adType: adType ?? 'rewarded_video',
          rewardAmount: rewardAmount ?? rewardPoints,
        });
        if (onSuccess) {
          await onSuccess(newBalance);
        }
      }
    } catch (err) {
      const data = (err as { data?: { code?: string; message?: string; waitMs?: number } } | null)?.data;
      if (data?.code === 'AD_REWARD_COOLDOWN') {
        // Spin/double rewards are handled by the spin flow and should not show a
        // generic ad cooldown dialog. The success state from the spin flow is the
        // user-facing result we want to preserve.
        if (isSpinFlow || skipReward) {
          return;
        }
        Alert.alert('Almost there!', data.message ?? 'Please wait before claiming another ad reward.');
        return;
      }
      console.error('Ad reward failed:', err);
    } finally {
      setClaiming(false);
      onClose();
    }
  }, [userId, rewardForAd, effectiveAdUnitId, rewardAmount, rewardPoints, adType, onSuccess, onClose, skipReward, isSpinFlow]);

  useEffect(() => {
    if (isEarnedReward) {
      handleRewardEarned();
    }
  }, [isEarnedReward, handleRewardEarned]);

  // Ad dismissed (completed or skipped) → if reward was earned, wait for handleRewardEarned; otherwise close overlay.
  useEffect(() => {
    if (isClosed && visible) {
      if (isEarnedReward || claimedRef.current) {
        // handleRewardEarned will call onClose after finishing points credit & onSuccess
        return;
      }
      onClose();
    }
  }, [isClosed, visible, isEarnedReward, onClose]);

  const retry = () => {
    setPhase('loading');
    setAdError('');
    load();
  };

  const handleSimulatedClaim = () => {
    handleRewardEarned();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.adCard}>
          {/* Rewarded Video Header Badge */}
          <View style={styles.testBadgeHeader}>
            <Icon name="shield-halved" iconStyle="solid" size={12} color="#F59E0B" />
            <Text style={styles.testBadgeText}>REWARDED VIDEO ({Platform.OS.toUpperCase()})</Text>
          </View>

          {/* Ad Status Area */}
          <View style={styles.videoPlayerArea}>
            {phase === 'loading' && (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.adTitle}>Loading video…</Text>
                <Text style={styles.adSubtitle}>Fetching a video for your device</Text>
              </>
            )}

            {phase === 'ready' && (
              <>
                <View style={styles.playIconContainer}>
                  <Icon name="circle-play" iconStyle="solid" size={48} color={colors.primary} />
                </View>
                <Text style={styles.adTitle}>Ready to watch</Text>
                <Text style={styles.adSubtitle}>
                  {isSpinFlow
                    ? 'Watch a short video to claim your spin reward'
                    : `Earn +${displayReward} PTS by watching a short rewarded video`}
                </Text>
              </>
            )}

            {/* Never show error to user — silently retries/fallbacks so request always gets an ad */}
          </View>

          <View style={{ gap: 10, width: '100%' }}>
            <View style={styles.footerRow}>
              {phase === 'ready' && isLoaded && (
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={() => {
                    try {
                      // Only callable when a real rewarded video is loaded —
                      // guaranteeing the video actually plays.
                      if (!isLoaded) return;
                      show();
                    } catch (err: any) {
                      console.warn('[RewardedAd] show failed — reloading ad:', err);
                      setPhase('loading');
                      setTimeout(() => {
                        try { load(); } catch { }
                      }, 500);
                    }
                  }}
                  activeOpacity={0.85}>
                  <Icon name="circle-play" iconStyle="solid" size={15} color={colors.white} />
                  <Text style={styles.claimText}>
                    {isSpinFlow ? 'Watch Video' : `Watch Video (+${displayReward} PTS)`}
                  </Text>
                </TouchableOpacity>
              )}
              {phase === 'loading' && (
                <View style={[styles.cancelBtn, { flexDirection: 'row', gap: 6, justifyContent: 'center', opacity: 0.6 }]}>
                  <ActivityIndicator size="small" color="#8A8A9E" />
                  <Text style={styles.cancelText}>Loading…</Text>
                </View>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          {claiming ? (
            <View style={styles.claimingOverlay}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.claimingText}>Crediting points…</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 18, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  adCard: {
    width: '100%',
    backgroundColor: '#161622',
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A3C',
    ...shadow.float,
  },
  testBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2A2210',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginBottom: 14,
  },
  testBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  videoPlayerArea: {
    backgroundColor: '#0E0E17',
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
    borderWidth: 1,
    borderColor: '#222234',
    marginBottom: 16,
  },
  playIconContainer: {
    marginBottom: 12,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  adSubtitle: {
    fontSize: 11.5,
    color: '#8A8A9E',
    marginBottom: 14,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#222234',
    borderRadius: radius.pill,
  },
  cancelText: {
    color: '#8A8A9E',
    fontWeight: '800',
    fontSize: 14,
  },
  claimBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    ...shadow.raised,
  },
  claimText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  claimingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10, 10, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  claimingText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
