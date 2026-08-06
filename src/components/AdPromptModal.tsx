import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';

interface AdPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  skipLabel?: string;
  rewardPoints?: number;
}

export default function AdPromptModal({
  visible,
  onClose,
  onConfirm,
  title = 'Support us',
  subtitle,
  confirmLabel = 'Watch ad',
  skipLabel = 'Skip',
  rewardPoints,
}: AdPromptModalProps) {
  const dark = useColorScheme() === 'dark';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.glowTop} pointerEvents="none" />
          <View style={styles.header}>
            <View style={styles.badgeWrap}>
              <Icon name="circle-play" iconStyle="solid" size={16} color="#F59E0B" />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          <Text style={[styles.subtitle, dark && styles.subtitleDark]}>
            {subtitle ?? 'Would you like to watch a short ad to support the app?'}
          </Text>

          {typeof rewardPoints === 'number' && rewardPoints > 0 && (
            <View style={styles.rewardPill}>
              <Icon name="gift" iconStyle="solid" size={12} color="#F59E0B" />
              <Text style={styles.rewardPillText}>+{rewardPoints} PTS bonus</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.skipText}>{skipLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Icon name="circle-play" iconStyle="solid" size={14} color={colors.white} />
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161622',
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A3C',
    overflow: 'hidden',
    ...shadow.float,
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badgeWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: '#2A2210',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#A1A1B5',
    marginBottom: 16,
  },
  subtitleDark: { color: '#A1A1B5' },
  rewardPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2A2210',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
  },
  rewardPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#222234',
    borderRadius: radius.pill,
  },
  skipText: {
    color: '#8A8A9E',
    fontWeight: '800',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    ...shadow.raised,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
