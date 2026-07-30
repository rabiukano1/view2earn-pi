import React, { useEffect, useState } from 'react';
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
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';

// Fallback Default Google AdMob Rewarded Video Test Ad Unit IDs
export const ADMOB_TEST_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
} as const;

interface RewardedAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

export default function RewardedAdModal({ visible, onClose, onSuccess }: RewardedAdModalProps) {
  const { userId } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [isCompleted, setIsCompleted] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const adConfig = useQuery(api.ads.getAdRewardConfig, userId ? { userId } : 'skip');
  const rewardForAd = useMutation(api.ads.rewardForAd);

  // Parse active ad network config from Convex backend if configured by Admin Panel
  const enabledProviders = adConfig?.providers;
  const activeProvider = enabledProviders?.[0];
  let parsedConfig: Record<string, any> = {};
  if (activeProvider?.configJson) {
    try {
      parsedConfig = JSON.parse(activeProvider.configJson);
    } catch {}
  }

  const networkName = activeProvider?.name ?? 'Google AdMob';
  const rewardPoints = adConfig?.rewardPoints ?? 50;
  const adUnitId =
    Platform.OS === 'ios'
      ? (parsedConfig.adMobIosUnitId || ADMOB_TEST_UNIT_IDS.ios)
      : (parsedConfig.adMobAndroidUnitId || parsedConfig.unityPlacementId || ADMOB_TEST_UNIT_IDS.android);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (visible) {
      setCountdown(5);
      setIsCompleted(false);
      setClaiming(false);

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCompleted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [visible]);

  const handleClaimReward = async () => {
    if (!userId || claiming) return;
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
      onClose();
    } catch (err) {
      console.error('Ad reward failed:', err);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.adCard}>
          {/* Test Ad Header Badge */}
          <View style={styles.testBadgeHeader}>
            <Icon name="shield-halved" iconStyle="solid" size={12} color="#F59E0B" />
            <Text style={styles.testBadgeText}>
              {networkName.toUpperCase()} REWARDED AD ({Platform.OS.toUpperCase()})
            </Text>
          </View>

          {/* Ad Screen Simulation Player */}
          <View style={styles.videoPlayerArea}>
            <View style={styles.playIconContainer}>
              <Icon name="circle-play" iconStyle="solid" size={48} color={colors.primary} />
            </View>

            <Text style={styles.adTitle}>{networkName} Partner Video</Text>
            <Text style={styles.adSubtitle}>
              Active Placement: {adUnitId.length > 24 ? adUnitId.substring(0, 24) + '...' : adUnitId}
            </Text>

            {/* Countdown / Completion Indicator */}
            <View style={styles.timerBadge}>
              {!isCompleted ? (
                <>
                  <Icon name="clock" iconStyle="solid" size={12} color={colors.white} />
                  <Text style={styles.timerText}>Reward in {countdown}s</Text>
                </>
              ) : (
                <>
                  <Icon name="circle-check" iconStyle="solid" size={12} color={colors.success} />
                  <Text style={[styles.timerText, { color: colors.success }]}>Ad Complete!</Text>
                </>
              )}
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((5 - countdown) / 5) * 100}%` }]} />
            </View>
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            {!isCompleted ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={handleClaimReward}
                disabled={claiming}
                activeOpacity={0.85}>
                {claiming ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Icon name="gift" iconStyle="solid" size={14} color={colors.white} />
                    <Text style={styles.claimText}>Claim +{rewardPoints} Points</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
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
  },
  adSubtitle: {
    fontSize: 11,
    color: '#8A8A9E',
    marginBottom: 14,
    textAlign: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#222234',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#222234',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
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
});
