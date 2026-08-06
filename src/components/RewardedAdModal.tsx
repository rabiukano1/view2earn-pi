import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ADMOB_AD_UNITS } from '../services/admobService';

interface RewardedAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
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

export default function RewardedAdModal({ visible, onClose, onSuccess }: RewardedAdModalProps) {
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
    } catch {}
  }

  const rewardPoints = adConfig?.rewardPoints ?? 50;
  const adUnitId =
    Platform.OS === 'ios'
      ? (parsedConfig.adMobIosUnitId || ADMOB_AD_UNITS.ios)
      : (parsedConfig.adMobAndroidUnitId || parsedConfig.unityPlacementId || ADMOB_AD_UNITS.android);

  const { isLoaded, isClosed, isEarnedReward, error, load, show } = useRewardedAd(
    visible ? adUnitId : null,
  );

  // Load the ad fresh each time the modal opens.
  useEffect(() => {
    if (visible && adUnitId) {
      claimedRef.current = false;
      setPhase('loading');
      setAdError('');
      try {
        load();
      } catch (err: any) {
        setAdError(sanitize(err?.message || 'Failed to load ad', adUnitId));
        setPhase('error');
      }
    }
  }, [visible, adUnitId, load]);

  // Surface load/show failures so the user can retry.
  useEffect(() => {
    if (error) {
      setAdError(sanitize(error.message, adUnitId));
      setPhase('error');
    }
  }, [error, adUnitId]);

  // Ad became ready → flip to the "Watch Ad" CTA.
  useEffect(() => {
    if (isLoaded) {
      setPhase('ready');
    }
  }, [isLoaded]);

  // Reward earned → award points exactly once, then close.
  const handleRewardEarned = useCallback(async () => {
    if (!userId || claimedRef.current) return;
    claimedRef.current = true;
    setClaiming(true);
    try {
      const newBalance = await rewardForAd({
        userId,
        provider: adUnitId,
        adType: 'rewarded_video',
        rewardAmount: rewardPoints,
      });
      if (onSuccess) {
        onSuccess(newBalance);
      }
    } catch (err) {
      console.error('Ad reward failed:', err);
    } finally {
      setClaiming(false);
    }
  }, [userId, rewardForAd, adUnitId, rewardPoints, onSuccess]);

  useEffect(() => {
    if (isEarnedReward) {
      handleRewardEarned();
    }
  }, [isEarnedReward, handleRewardEarned]);

  // Ad dismissed (completed or skipped) → close the modal overlay.
  useEffect(() => {
    if (isClosed && visible) {
      onClose();
    }
  }, [isClosed, visible, onClose]);

  const retry = () => {
    setPhase('loading');
    setAdError('');
    load();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.adCard}>
          {/* Rewarded Ad Header Badge */}
          <View style={styles.testBadgeHeader}>
            <Icon name="shield-halved" iconStyle="solid" size={12} color="#F59E0B" />
            <Text style={styles.testBadgeText}>REWARDED AD ({Platform.OS.toUpperCase()})</Text>
          </View>

          {/* Ad Status Area */}
          <View style={styles.videoPlayerArea}>
            {phase === 'loading' && (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.adTitle}>Loading ad…</Text>
                <Text style={styles.adSubtitle}>Fetching an ad for your device</Text>
              </>
            )}

            {phase === 'ready' && (
              <>
                <View style={styles.playIconContainer}>
                  <Icon name="circle-play" iconStyle="solid" size={48} color={colors.primary} />
                </View>
                <Text style={styles.adTitle}>Ready to watch</Text>
                <Text style={styles.adSubtitle}>
                  Earn +{rewardPoints} PTS by watching a short rewarded video
                </Text>
              </>
            )}

            {phase === 'error' && (
              <>
                <View style={styles.playIconContainer}>
                  <Icon name="circle-exclamation" iconStyle="solid" size={48} color="#F43F5E" />
                </View>
                <Text style={styles.adTitle}>Could not load ad</Text>
                <Text style={styles.adSubtitle} numberOfLines={3}>
                  {adError || 'No ads available right now'}
                </Text>
              </>
            )}
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            {phase === 'ready' ? (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={() => show()}
                activeOpacity={0.85}>
                <Icon name="gift" iconStyle="solid" size={14} color={colors.white} />
                <Text style={styles.claimText}>Watch Ad (+{rewardPoints} PTS)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            )}

            {phase === 'error' && (
              <TouchableOpacity style={styles.claimBtn} onPress={retry} activeOpacity={0.85}>
                <Icon name="rotate-right" iconStyle="solid" size={14} color={colors.white} />
                <Text style={styles.claimText}>Retry</Text>
              </TouchableOpacity>
            )}

            {phase === 'ready' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {claiming && (
            <View style={styles.claimingOverlay}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.claimingText}>Crediting points…</Text>
            </View>
          )}
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
