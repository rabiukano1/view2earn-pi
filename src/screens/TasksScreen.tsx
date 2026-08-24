import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { openTaskLink } from '../services/TaskLinkService';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import PlatformIcon from '../components/PlatformIcon';
import { colors, radius, shadow, spacing } from '../theme';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Tasks'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

type Task = {
  _id: Id<'tasks'>;
  name?: string;
  type: string;
  platform: string;
  points: number;
  targetUrl?: string;
  verifier: string;
  pageId?: string;
  steps?: { action: string; targetUrl: string; label?: string; name?: string }[];
};

type Verification = {
  _id: Id<'verifications'>;
  taskId: Id<'tasks'>;
  userId: Id<'users'>;
  state: string;
  claimedAt?: number;
  submittedAt?: number;
};

type PlatformFilter = 'all' | 'youtube' | 'telegram' | 'tiktok' | 'facebook' | 'twitter' | 'instagram';
type StatusFilter = 'all' | 'available' | 'completed';

const PLATFORMS: { key: PlatformFilter; label: string; color: string; icon: string }[] = [
  { key: 'all', label: 'All Tasks', color: colors.primary, icon: 'layer-group' },
  { key: 'youtube', label: 'YouTube', color: '#EF4444', icon: 'youtube' },
  { key: 'telegram', label: 'Telegram', color: '#0284C7', icon: 'telegram' },
  { key: 'tiktok', label: 'TikTok', color: '#111827', icon: 'tiktok' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', icon: 'facebook' },
  { key: 'twitter', label: 'X (Twitter)', color: '#0F172A', icon: 'x-twitter' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'instagram' },
];

function targetName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
    return last.replace(/^@/, '') || u.hostname;
  } catch (e) {
    // If it's not a valid URL (e.g. missing https://), just return it
    return url.replace(/^@/, '');
  }
}

export default function TasksScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { t } = useLanguage();
  const stackNav = useNavigation<StackNav>();

  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [uploadTarget, setUploadTarget] = useState<Verification | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);

  // Queries & Mutations
  const tasks = useQuery(api.tasks.list, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const verifications = useQuery(api.verifications.listMine, userId ? { userId } : 'skip');

  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);
  const verifyTelegram = useMutation(api.verifications.verifyTelegram);

  const verificationByTask = new Map<string, Verification>();
  if (Array.isArray(verifications)) {
    for (const v of verifications) {
      if (v && v.taskId) {
        verificationByTask.set(v.taskId, v as unknown as Verification);
      }
    }
  }

  const uploadTargetTask = Array.isArray(tasks) ? tasks.find(t => t._id === uploadTarget?.taskId) : null;
  const isXMultiTask = uploadTargetTask?.platform === "x" && uploadTargetTask?.type === "MULTI_TASK";

  // Directly open the task link & claim
  const handleOpenAndClaim = async (task: Task) => {
    if (!userId) return;

    if (task.type === 'QUIZ') {
      stackNav.navigate('Quiz', { userId, ecosystem: 'SIDRA' });
      return;
    }

    const isThisXMultiTask = task.platform === "x" && task.type === "MULTI_TASK";
    const targetUrl = isThisXMultiTask ? task.targetUrl : (task.steps?.[0]?.targetUrl || task.targetUrl);
    if (!targetUrl) {
      Alert.alert('Task Link', 'No destination link found for this task.');
      return;
    }

    const currentV = verificationByTask.get(task._id);

    // Auto-claim if not already claimed
    if (!currentV) {
      try {
        await claim({ taskId: task._id, userId });
      } catch (e) {
        // Silently continue to open the link if already claimed or allowed
      }
    }

    // Immediately open the exact destination page
    await openTaskLink(targetUrl, task.platform, task.pageId);
  };

  // Telegram bot verification
  const handleVerifyTelegram = async (verification: Verification) => {
    try {
      await verifyTelegram({ verificationId: verification._id });
      Alert.alert('Success', 'Telegram join verified successfully!');
    } catch (e: any) {
      const msg = String(e?.message || e).replace('[CONVEX] ', '');
      if (msg.includes('Telegram account') || msg.includes('Link Telegram')) {
        Alert.alert(
          'Telegram Not Linked',
          'Please link your Telegram account in Settings to verify tasks automatically.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Link Telegram', onPress: () => stackNav.navigate('LinkedAccounts') },
          ]
        );
      } else {
        Alert.alert('Verification', msg);
      }
    }
  };

  // Image upload picker
  const handlePickImage = async () => {
    try {
      const picked = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: isXMultiTask ? 3 : 1,
      });
      const uris = picked.assets?.map(a => a.uri).filter(Boolean) as string[];
      if (uris && uris.length > 0) {
        if (isXMultiTask) {
          setSelectedImageUris(prev => {
             const combined = [...prev, ...uris];
             return combined.slice(0, 3);
          });
        } else {
          setSelectedImageUris([uris[0]]);
        }
      }
    } catch (e) {
      Alert.alert('Image Picker', 'Could not access gallery.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImageUris(prev => prev.filter((_, i) => i !== index));
  };

  // Submit proof
  const handleUploadSubmit = async () => {
    if (!uploadTarget || selectedImageUris.length === 0 || uploading) return;
    if (isXMultiTask && selectedImageUris.length < 3) {
      Alert.alert('Missing Screenshots', 'Please select exactly 3 screenshots for this task (Follow, Comment, Like/Repost).');
      return;
    }

    setUploading(true);
    try {
      const uploadedIds: Id<'_storage'>[] = [];
      for (const uri of selectedImageUris) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uri);
        const blob = await response.blob();
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const { storageId } = (await uploadRes.json()) as { storageId: Id<'_storage'> };
        uploadedIds.push(storageId);
      }

      const mainStorageId = uploadedIds[0];
      const additionalStorageIds = uploadedIds.slice(1);

      await submitProof({ 
        verificationId: uploadTarget._id, 
        storageId: mainStorageId,
        additionalStorageIds: additionalStorageIds.length > 0 ? additionalStorageIds : undefined
      });
      
      Alert.alert('Proof Submitted', 'Your screenshots were submitted for review.');
      setUploadTarget(null);
      setSelectedImageUris([]);
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message || 'Could not upload proof.');
    } finally {
      setUploading(false);
    }
  };

  // Filter tasks
  const filteredTasks = (Array.isArray(tasks) ? tasks : []).filter((t) => {
    if (!t || !t._id) return false;
    if (activePlatform !== 'all' && t.platform !== activePlatform) return false;
    const v = verificationByTask.get(t._id);
    if (activeStatus === 'completed') return v?.state === 'RELEASED';
    if (activeStatus === 'available') return v?.state !== 'RELEASED';
    return true;
  });

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title={t('tasks')}
        subtitle="Tap any task to open exact page & earn"
        right={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.promoteBtn} onPress={() => stackNav.navigate('Marketplace')}>
              <Icon name="rocket" iconStyle="solid" size={12} color="#FFF" />
              <Text style={styles.promoteBtnText}>Promote</Text>
            </TouchableOpacity>
            <View style={styles.balancePill}>
              <Icon name="coins" iconStyle="solid" size={13} color="#F59E0B" />
              <Text style={styles.balanceText}>
                {balance === undefined ? '…' : balance.toLocaleString()} PTS
              </Text>
            </View>
          </View>
        }
      />

      {/* Platform Dropdown */}
      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm, zIndex: 10 }}>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            dark && styles.dropdownButtonDark,
          ]}
          activeOpacity={0.8}
          onPress={() => setShowPlatformDropdown(true)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PlatformIcon platform={activePlatform === 'all' ? 'website' : activePlatform} size={16} color={dark ? '#E2E8F0' : colors.text} />
            <Text style={[styles.dropdownButtonText, dark && styles.textLight, { marginLeft: 8 }]}>
              {PLATFORMS.find(p => p.key === activePlatform)?.label || 'All Tasks'}
            </Text>
          </View>
          <Icon name="chevron-down" iconStyle="solid" size={12} color={dark ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPlatformDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlatformDropdown(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1} 
          onPress={() => setShowPlatformDropdown(false)}>
          <View style={[styles.dropdownList, dark && styles.cardDark]}>
            <Text style={[styles.dropdownTitle, dark && styles.textLight]}>Select Platform</Text>
            {PLATFORMS.map((p) => {
              const isActive = activePlatform === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.dropdownItem, isActive && (dark ? styles.dropdownItemActiveDark : styles.dropdownItemActive)]}
                  onPress={() => {
                    setActivePlatform(p.key);
                    setShowPlatformDropdown(false);
                  }}>
                  <PlatformIcon platform={p.key === 'all' ? 'website' : p.key} size={16} color={isActive ? p.color : (dark ? '#94A3B8' : '#64748B')} />
                  <Text style={[styles.dropdownItemText, dark && styles.textLight, isActive && { color: p.color, fontWeight: '700' }]}>
                    {p.label}
                  </Text>
                  {isActive && <Icon name="check" iconStyle="solid" size={14} color={p.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Toggle (All vs Available vs Completed) */}
      <View style={styles.statusRow}>
        {(['all', 'available', 'completed'] as StatusFilter[]).map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.statusBtn, activeStatus === st && styles.statusBtnActive]}
            onPress={() => setActiveStatus(st)}>
            <Text
              style={[
                styles.statusBtnText,
                activeStatus === st && styles.statusBtnTextActive,
                dark && styles.textLight,
              ]}>
              {st === 'all' ? 'All' : st === 'available' ? 'Available' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item?._id ?? String(Math.random())}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Icon name="clipboard-check" iconStyle="solid" size={36} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No Tasks Found</Text>
            <Text style={styles.emptySub}>
              {activeStatus === 'completed'
                ? 'You have not completed any tasks in this category yet.'
                : 'All available tasks in this category are completed! Check back soon.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const v = verificationByTask.get(item._id);
          const isDone = v?.state === 'RELEASED';
          const isPendingProof = v?.state === 'USER_CLAIMED_DONE' || v?.state === 'REJECTED';
          const inReview = v?.state === 'PROOF_SUBMITTED' || v?.state === 'ADMIN_REVIEW' || v?.state === 'PENDING_HOLD';
          const isTelegramBot = item.verifier === 'telegram-bot';
          const title = item.name || (item.targetUrl ? targetName(item.targetUrl) : 'Social Engagement');
          const platformInfo = PLATFORMS.find((p) => p.key === item.platform) || PLATFORMS[0];

          return (
            <TouchableOpacity
              style={[styles.taskCard, dark && styles.cardDark, (isDone || inReview) && styles.taskCardDone]}
              activeOpacity={0.85}
              onPress={() => handleOpenAndClaim(item)}>
              {/* Top Row: Icon, Title & Reward */}
              <View style={styles.taskCardHeader}>
                <View style={[styles.platformCircle, { backgroundColor: platformInfo.color }]}>
                  <PlatformIcon platform={item.platform} size={18} color="#FFF" />
                </View>

                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, dark && styles.textLight]} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.taskSub} numberOfLines={1}>
                    {platformInfo.label} • {(item.type || '').replace('_', ' ')}
                  </Text>
                </View>

                <View style={styles.pointsPill}>
                  <Icon name="coins" iconStyle="solid" size={12} color="#F59E0B" />
                  <Text style={styles.pointsValue}>+{item.points}</Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.taskActionRow}>
                {isDone ? (
                  <View style={styles.doneBadge}>
                    <Icon name="circle-check" iconStyle="solid" size={14} color="#10B981" />
                    <Text style={styles.doneBadgeText}>Completed</Text>
                  </View>
                ) : inReview ? (
                  <View style={styles.doneBadge}>
                    <Icon name="clock" iconStyle="solid" size={14} color="#F59E0B" />
                    <Text style={[styles.doneBadgeText, { color: '#F59E0B' }]}>In Review</Text>
                  </View>
                ) : isPendingProof ? (
                  <View style={styles.pendingActionGroup}>
                    {isTelegramBot ? (
                      <TouchableOpacity
                        style={styles.verifyBtn}
                        activeOpacity={0.8}
                        onPress={() => handleVerifyTelegram(v)}>
                        <Icon name="shield-check" iconStyle="solid" size={13} color="#FFF" />
                        <Text style={styles.verifyBtnText}>Verify Join</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          setUploadTarget(v);
                          setSelectedImageUris([]);
                        }}>
                        <Icon name="arrow-up-from-bracket" iconStyle="solid" size={13} color="#FFF" />
                        <Text style={styles.uploadBtnText}>Upload Proof</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.reopenLinkBtn}
                      activeOpacity={0.8}
                      onPress={() => handleOpenAndClaim(item)}>
                      <Icon name="arrow-up-right-from-square" iconStyle="solid" size={12} color={colors.primary} />
                      <Text style={styles.reopenLinkText}>Open Page</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.openTaskBtn}
                    activeOpacity={0.8}
                    onPress={() => handleOpenAndClaim(item)}>
                    <Text style={styles.openTaskBtnText}>Open & Complete</Text>
                    <Icon name="arrow-up-right-from-square" iconStyle="solid" size={12} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Upload Proof Modal */}
      <Modal visible={Boolean(uploadTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dark && styles.cardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dark && styles.textLight]}>Submit Task Proof</Text>
              <TouchableOpacity onPress={() => setUploadTarget(null)}>
                <Icon name="xmark" iconStyle="solid" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              {isXMultiTask 
                ? "Upload 3 screenshots showing you completed the tasks (e.g. Follow, Comment, Like/Repost)." 
                : "Upload a screenshot showing you completed the task (follow, like, or subscribe)."}
            </Text>

            {selectedImageUris.length > 0 ? (
              <View style={styles.previewContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 5 }}>
                  {selectedImageUris.map((uri, index) => (
                    <View key={index} style={{ position: 'relative' }}>
                      <Image source={{ uri }} style={[styles.previewImage, { width: 120, height: 180 }]} resizeMode="cover" />
                      <TouchableOpacity 
                        style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 6 }} 
                        onPress={() => removeImage(index)}>
                        <Icon name="xmark" iconStyle="solid" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {selectedImageUris.length < (isXMultiTask ? 3 : 1) && (
                  <TouchableOpacity style={styles.changeImgBtn} onPress={handlePickImage}>
                    <Text style={styles.changeImgText}>Add Another Screenshot ({selectedImageUris.length}/{isXMultiTask ? 3 : 1})</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.pickerBox} activeOpacity={0.8} onPress={handlePickImage}>
                <Icon name="image" iconStyle="solid" size={32} color={colors.primary} />
                <Text style={styles.pickerText}>Select {isXMultiTask ? "3 Screenshots" : "Screenshot"}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setUploadTarget(null);
                  setSelectedImageUris([]);
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (selectedImageUris.length === 0 || uploading || (isXMultiTask && selectedImageUris.length < 3)) && styles.modalSubmitBtnDisabled,
                ]}
                disabled={selectedImageUris.length === 0 || uploading || (isXMultiTask && selectedImageUris.length < 3)}
                onPress={handleUploadSubmit}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit for Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  containerDark: {
    backgroundColor: colors.bgDark,
  },
  textLight: {
    color: colors.textDark,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 5,
  },
  promoteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 5,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },

  filterSection: {
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownButtonDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownList: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 4,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    gap: 12,
  },
  dropdownItemActive: {
    backgroundColor: colors.bg,
  },
  dropdownItemActiveDark: {
    backgroundColor: colors.bgDark,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  statusRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  statusBtnActive: {
    backgroundColor: colors.primarySoft,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statusBtnTextActive: {
    color: colors.primaryDeep,
    fontWeight: '800',
  },

  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  taskCardDone: {
    opacity: 0.7,
  },

  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  taskSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 4,
  },
  pointsValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D97706',
  },

  taskActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openTaskBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radius.lg,
    gap: 6,
  },
  openTaskBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  doneBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },

  pendingActionGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    borderRadius: radius.lg,
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  verifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: radius.lg,
    gap: 6,
  },
  verifyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  reopenLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    gap: 6,
  },
  reopenLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDeep,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    gap: 14,
    ...shadow.raised,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  pickerBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    gap: 8,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  previewContainer: {
    alignItems: 'center',
    gap: 10,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
  },
  changeImgBtn: {
    paddingVertical: 4,
  },
  changeImgText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  modalSubmitBtnDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
});
