import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';

interface UploadScreenshotModalProps {
  visible: boolean;
  uploading: boolean;
  onUpload: () => void;
  onClose: () => void;
}

export default function UploadScreenshotModal({
  visible,
  uploading,
  onUpload,
  onClose,
}: UploadScreenshotModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Icon name="shield-check" iconStyle="solid" size={12} color="#10B981" />
            <Text style={styles.badgeText}>VERIFY YOUR TASK</Text>
          </View>

          <View style={styles.heroWrap}>
            <View style={styles.heroGlow} />
            <View style={styles.heroIconBg}>
              <Icon name="camera" iconStyle="solid" size={32} color={colors.white} />
            </View>
          </View>

          <Text style={styles.title}>Upload screenshot</Text>
          <Text style={styles.subtitle}>
            Show us you followed or joined to earn your points. Proof is checked by
            AI and a human reviewer before points are released.
          </Text>

          <View style={styles.tipRow}>
            <Icon name="circle-exclamation" iconStyle="solid" size={13} color="#F59E0B" />
            <Text style={styles.tipText}>
              Make sure your profile page and the account name are clearly visible.
            </Text>
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={uploading}
              activeOpacity={0.85}>
              <Text style={styles.cancelText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={onUpload}
              disabled={uploading}
              activeOpacity={0.85}>
              <Icon
                name="arrow-up-from-bracket"
                iconStyle="solid"
                size={14}
                color={colors.white}
              />
              <Text style={styles.uploadText}>
                {uploading ? 'Uploading…' : 'Upload screenshot'}
              </Text>
            </TouchableOpacity>
          </View>

          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.uploadingText}>Uploading screenshot…</Text>
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
  card: {
    width: '100%',
    backgroundColor: '#161622',
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A3C',
    ...shadow.float,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E2B22',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: 18,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: 6,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(124, 58, 237, 0.22)',
  },
  heroIconBg: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A8A9E',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#2A2210',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 11.5,
    color: '#D97706',
    lineHeight: 16,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#222234',
    borderRadius: radius.pill,
  },
  cancelText: {
    color: '#8A8A9E',
    fontWeight: '800',
    fontSize: 14,
  },
  uploadBtn: {
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
  uploadText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  uploadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10, 10, 18, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadingText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
