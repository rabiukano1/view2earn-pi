import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import StreakCard from '../components/StreakCard';
import ProgressToReward from '../components/ProgressToReward';
import DailyBox from '../components/DailyBox';
import ComboTracker from '../components/ComboTracker';
import PageHeader from '../components/PageHeader';
import PlatformIcon from '../components/PlatformIcon';
import Icon from '../components/Icon';
import UploadScreenshotModal from '../components/UploadScreenshotModal';
import { openTaskLink } from '../services/TaskLinkService';

// ponytail: default active platform filter set to 'all'; fallback logic for dynamic filter state.
type PlatformFilter = 'all' | 'telegram' | 'youtube' | 'tiktok' | 'facebook' | 'x';
type StatusFilter = 'all' | 'available' | 'in_progress' | 'completed';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Tasks'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  all: { label: 'All Tasks', color: colors.primary, icon: 'layer-group' },
  telegram: { label: 'Telegram', color: '#229ED9', icon: 'telegram' },
  youtube: { label: 'YouTube', color: '#FF0000', icon: 'youtube' },
  tiktok: { label: 'TikTok', color: '#000000', icon: 'tiktok' },
  facebook: { label: 'Facebook', color: '#1877F2', icon: 'facebook' },
  x: { label: 'X (Twitter)', color: '#14171A', icon: 'x-twitter' },
  app: { label: 'View2Earn', color: '#7C3AED', icon: 'shield-halved' },
};

const TYPE_LABELS: Record<string, string> = {
  FOLLOW_PAGE: 'Follow page',
  JOIN_CHANNEL: 'Join channel',
  MULTI_TASK: 'Multi-task',
  QUIZ: 'Answer quiz',
  SURVEY: 'Complete survey',
};

const ACTION_LABELS: Record<string, string> = {
  FOLLOW: 'Follow',
  JOIN: 'Join',
  SUBSCRIBE: 'Subscribe',
  LIKE: 'Like',
  COMMENT: 'Comment',
};

type TaskStep = {
  action: string;
  label?: string;
  name?: string;
  targetUrl: string;
};

type Task = {
  _id: Id<'tasks'>;
  type: string;
  platform: string;
  targetUrl: string;
  name?: string;
  pageId?: string;
  points: number;
  verifier: string;
  steps?: TaskStep[];
};

type Verification = {
  _id: Id<'verifications'>;
  taskId: Id<'tasks'>;
  state: string;
  holdUntil?: number;
};

function targetName(url: string): string {
  if (!url) return '';
  const last = url.replace(/\/+$/, '').split('/').pop() ?? '';
  return last.startsWith('@') ? last : `@${last}`;
}

// Delegates to smartOpenUrl which tries the native app deep-link scheme
// first (tg://, vnd.youtube://, fb://, twitter://, etc.) and falls back to
// the HTTPS URL — same WhatsApp-like behavior across all platforms.
async function openUrl(platform: string, url: string, pageId?: string) {
  if (!url) return;
  await openTaskLink(url, platform, pageId);
}

async function openTask(task: Task, onQuizNav: () => void) {
  if (task.type === 'QUIZ') {
    onQuizNav();
    return;
  }
  if (task.type === 'MULTI_TASK') {
    const first = task.steps?.[0];
    if (!first?.targetUrl) {
      Alert.alert('Coming soon', 'This task type is coming soon — check back!');
      return;
    }
    await openUrl(task.platform, first.targetUrl, task.pageId);
    return;
  }
  if (!task.targetUrl) {
    Alert.alert('Coming soon', 'This task type is coming soon — check back!');
    return;
  }
  await openUrl(task.platform, task.targetUrl, task.pageId);
}

type ActionState = {
  label: string;
  disabled: boolean;
  kind: 'claim' | 'upload' | 'verify' | 'done' | 'busy';
  iconName: string;
};

function actionFor(verification: Verification | undefined, verifier: string): ActionState {
  const telegram = verifier === 'telegram-bot';
  if (!verification) {
    return { label: 'Start Task', disabled: false, kind: 'claim', iconName: 'play' };
  }
  switch (verification.state) {
    case 'USER_CLAIMED_DONE':
      return telegram
        ? { label: 'Verify Join', disabled: false, kind: 'verify', iconName: 'shield-check' }
        : { label: 'Upload Proof', disabled: false, kind: 'upload', iconName: 'arrow-up-from-bracket' };
    case 'REJECTED':
      return telegram
        ? { label: 'Retry Verify', disabled: false, kind: 'verify', iconName: 'rotate-right' }
        : { label: 'Retry Proof', disabled: false, kind: 'upload', iconName: 'arrow-up-from-bracket' };
    case 'PROOF_SUBMITTED':
      return { label: 'Verifying…', disabled: true, kind: 'busy', iconName: 'spinner' };
    case 'ADMIN_REVIEW':
      return { label: 'In Review', disabled: true, kind: 'busy', iconName: 'clock' };
    case 'PENDING_HOLD':
      return { label: 'Holding', disabled: true, kind: 'busy', iconName: 'lock' };
    case 'RELEASED':
      return { label: 'Completed', disabled: true, kind: 'done', iconName: 'circle-check' };
    default:
      return { label: verification.state, disabled: true, kind: 'busy', iconName: 'clock' };
  }
}

function TaskCard({
  task,
  verification,
  dark,
  onClaim,
  onUpload,
  onVerify,
  onQuizNav,
}: {
  task: Task;
  verification: Verification | undefined;
  dark: boolean;
  onClaim: (task: Task) => void;
  onUpload: (verification: Verification) => void;
  onVerify: (verification: Verification) => void;
  onQuizNav: () => void;
}) {
  const meta = PLATFORM_META[task.platform] ?? {
    label: task.platform,
    color: '#6B7280',
    icon: 'share-nodes',
  };
  const action = actionFor(verification, task.verifier);
  const showAction = task.type !== 'QUIZ';
  const multiAction = task.type === 'MULTI_TASK';
  const steps = task.type === 'MULTI_TASK' ? task.steps ?? [] : [];

  const handleCopyLink = async () => {
    const urls =
      task.type === 'MULTI_TASK'
        ? (task.steps ?? []).map((s) => s.targetUrl).filter(Boolean)
        : task.targetUrl
        ? [task.targetUrl]
        : [];
    if (urls.length === 0) return;
    try {
      await Share.share({ message: urls.join('\n'), url: urls[0] });
    } catch {}
  };

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      {/* Top Header & Platform Badge */}
      <TouchableOpacity
        style={styles.cardHeader}
        activeOpacity={0.75}
        onPress={() => openTask(task, onQuizNav)}>
        <View style={[styles.platformBadge, { backgroundColor: meta.color }]}>
          <PlatformIcon platform={task.platform} size={20} color="#FFF" />
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.taskTitle, dark && styles.textLight]} numberOfLines={1}>
            {task.name || (task.targetUrl ? targetName(task.targetUrl) : TYPE_LABELS[task.type] ?? task.type)}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.platformName}>{meta.label}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.taskType}>{TYPE_LABELS[task.type] ?? task.type}</Text>
          </View>
        </View>

        <View style={styles.rewardPill}>
          <Icon name="coins" iconStyle="solid" size={13} color="#D97706" />
          <Text style={styles.rewardValue}>+{task.points}</Text>
        </View>
      </TouchableOpacity>

      {/* Multi-Task Steps Section */}
      {Boolean(steps.length > 0) ? (
        <View style={[styles.stepsBox, dark && styles.stepsBoxDark]}>
          <Text style={styles.stepsHeader}>Complete {steps.length} Steps to Claim:</Text>
          {steps.map((step, i) => {
            const actionLabel = step.label || ACTION_LABELS[step.action] || step.action;
            const stepName = step.name || (step.targetUrl ? targetName(step.targetUrl) : '');
            return (
              <TouchableOpacity
                key={i}
                style={[styles.stepItem, dark && styles.stepItemDark]}
                activeOpacity={0.8}
                onPress={() => openUrl(task.platform, step.targetUrl, task.pageId)}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepTitle, dark && styles.textLight]} numberOfLines={1}>
                  {actionLabel} {stepName ? `· ${stepName}` : ''}
                </Text>
                <Icon name="arrow-up-right-from-square" iconStyle="solid" size={12} color={colors.primary} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Action Footer */}
      {Boolean(showAction) ? (
        <View style={styles.actionFooter}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              action.kind === 'done' && styles.actionBtnDone,
              action.kind === 'upload' && styles.actionBtnUpload,
              action.kind === 'verify' && styles.actionBtnVerify,
              action.disabled && action.kind !== 'done' && styles.actionBtnBusy,
            ]}
            disabled={action.disabled}
            onPress={() => {
              if (action.kind === 'claim') onClaim(task);
              else if (action.kind === 'upload' && verification) onUpload(verification);
              else if (action.kind === 'verify' && verification) onVerify(verification);
            }}>
            <Icon
              name={action.iconName}
              iconStyle="solid"
              size={14}
              color={action.kind === 'done' ? '#15803D' : '#FFF'}
            />
            <Text style={[styles.actionBtnText, action.kind === 'done' && styles.actionBtnTextDone]}>
              {action.label}
            </Text>
          </TouchableOpacity>

          {Boolean(task.targetUrl || multiAction) && action.kind === 'claim' ? (
            <TouchableOpacity style={styles.shareBtn} onPress={handleCopyLink}>
              <Icon name="share-nodes" iconStyle="solid" size={14} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function TasksScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [showRewardsDrawer, setShowRewardsDrawer] = useState(true);

  const [uploadTarget, setUploadTarget] = useState<Verification | null>(null);

  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();
  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);
  const verifyTelegram = useMutation(api.verifications.verifyTelegram);

  const tasks = useQuery(api.tasks.list, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const limits = useQuery(api.tasks.myLimits, userId ? { userId } : 'skip');
  const verifications = useQuery(api.verifications.listMine, userId ? { userId } : 'skip');
  const flags = useQuery(api.features.getFlags) || {};

  const verificationByTask = new Map<string, Verification>(
    (verifications ?? []).map((v) => [v.taskId, v])
  );

  const handleQuizNav = () => {
    if (!userId) return;
    stackNav.navigate('Quiz', { userId, ecosystem: 'SIDRA' });
  };

  const executeClaim = async (task: Task) => {
    if (!userId) return;
    try {
      await claim({ taskId: task._id, userId });
      await openTask(task, handleQuizNav);
    } catch (e) {
      let msg = String(e).replace('[CONVEX] ', '').replace(/Uncaught Error:\s*/, '');
      Alert.alert('Could not claim', msg);
    }
  };

  const executeUpload = async (verification: Verification) => {
    if (uploading) return;
    try {
      const picked = await launchImageLibrary({
        mediaType: 'photo',
        maxWidth: 1280,
        maxHeight: 2560,
        quality: 0.7,
        selectionLimit: 1,
      });
      const asset = picked.assets?.[0];
      if (picked.didCancel || !asset?.uri) return;

      setUploading(true);
      const uploadUrl = await generateUploadUrl();
      const mimeType = asset.type ?? 'image/jpeg';

      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Could not read image file'));
        xhr.responseType = 'blob';
        xhr.open('GET', asset.uri!, true);
        xhr.send(null);
      });

      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!result.ok) throw new Error(`Upload server error (${result.status})`);
      const { storageId } = (await result.json()) as { storageId: Id<'_storage'> };
      await submitProof({ verificationId: verification._id, storageId });
      setUploadTarget(null);
    } catch (e) {
      Alert.alert('Upload failed', String(e).replace('[CONVEX] ', ''));
    } finally {
      setUploading(false);
    }
  };

  const executeVerify = async (verification: Verification) => {
    try {
      await verifyTelegram({ verificationId: verification._id });
    } catch (e: any) {
      const rawMsg = String(e?.message || e).replace('[CONVEX] ', '').replace(/Uncaught Error:\s*/, '');
      if (rawMsg.includes('Telegram account') || rawMsg.includes('Link Telegram')) {
        Alert.alert(
          'Telegram Account Required',
          'Link your Telegram account first to verify channel-join tasks automatically via the bot.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Link Telegram Now',
              onPress: () => stackNav.navigate('LinkedAccounts'),
            },
          ],
        );
      } else {
        Alert.alert('Could not verify', rawMsg);
      }
    }
  };

  const openUploadModal = (verification: Verification) => {
    setUploadTarget(verification);
  };

  // Filter tasks based on platform & completion status
  const filteredTasks = (tasks ?? []).filter((t) => {
    if (activePlatform !== 'all' && t.platform !== activePlatform) return false;
    const v = verificationByTask.get(t._id);
    if (activeStatus === 'completed') return v?.state === 'RELEASED';
    if (activeStatus === 'in_progress') return v && v.state !== 'RELEASED';
    if (activeStatus === 'available') return !v;
    return true;
  });

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Tasks"
        subtitle="Complete quick tasks & earn points"
        right={
          <View style={styles.headerRightRow}>
            <TouchableOpacity style={styles.marketPill} onPress={() => stackNav.navigate('Marketplace')}>
              <Icon name="rocket" iconStyle="solid" size={13} color="#FFF" />
              <Text style={styles.marketPillText}>Promote</Text>
            </TouchableOpacity>
            <View style={styles.ptsBadge}>
              <Icon name="coins" iconStyle="solid" size={13} color="#FBBF24" />
              <Text style={styles.ptsBadgeText}>{balance === undefined ? '…' : balance}</Text>
            </View>
          </View>
        }
      />

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            verification={verificationByTask.get(item._id)}
            dark={dark}
            onClaim={executeClaim}
            onUpload={openUploadModal}
            onVerify={executeVerify}
            onQuizNav={handleQuizNav}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Daily Limits Summary Bar */}
            {limits?.some((l) => l.used > 0 || l.remaining < l.limit) ? (
              <View style={styles.limitsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.limitsScroll}>
                  {limits.map((l) => {
                    const meta = PLATFORM_META[l.platform] ?? { label: l.platform, color: '#6B7280' };
                    const maxed = l.remaining === 0;
                    return (
                      <View key={l.platform} style={[styles.limitChip, maxed && styles.limitChipMaxed]}>
                        <View style={[styles.limitDot, { backgroundColor: meta.color }]} />
                        <Text style={[styles.limitText, maxed && styles.limitTextMaxed]}>
                          {meta.label}: {l.remaining}/{l.limit} left
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* Daily Rewards Expandable Card Header */}
            {userId ? (
              <View style={[styles.rewardsSection, dark && styles.rewardsSectionDark]}>
                <TouchableOpacity
                  style={styles.rewardsSectionHeader}
                  activeOpacity={0.8}
                  onPress={() => setShowRewardsDrawer(!showRewardsDrawer)}>
                  <View style={styles.rewardsHeaderLeft}>
                    <Icon name="fire" iconStyle="solid" size={16} color="#F59E0B" />
                    <Text style={[styles.rewardsTitle, dark && styles.textLight]}>Daily Rewards & Streaks</Text>
                  </View>
                  <Icon
                    name={showRewardsDrawer ? 'chevron-up' : 'chevron-down'}
                    iconStyle="solid"
                    size={14}
                    color={colors.textFaint}
                  />
                </TouchableOpacity>

                {showRewardsDrawer ? (
                  <View style={styles.cardsGrid}>
                    <StreakCard userId={userId} />
                    {flags['feature:rewards'] !== false && (
                      <ProgressToReward userId={userId} onPress={() => tabNav.navigate('Rewards')} />
                    )}
                    <DailyBox userId={userId} />
                    <ComboTracker userId={userId} />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Platform Dropdown Selector */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[styles.platformDropdownBtn, dark && styles.platformDropdownBtnDark]}
                onPress={() => setShowPlatformDropdown(true)}
                activeOpacity={0.8}>
                <View style={styles.platformDropdownLeft}>
                  <PlatformIcon
                    platform={activePlatform === 'all' ? 'app' : activePlatform}
                    size={18}
                    color={PLATFORM_META[activePlatform]?.color ?? colors.primary}
                  />
                  <Text style={[styles.platformDropdownLabel, dark && styles.textLight]}>
                    {PLATFORM_META[activePlatform]?.label ?? 'All Platforms'}
                  </Text>
                </View>
                <View style={styles.platformDropdownRight}>
                  <Text style={styles.platformDropdownCount}>
                    {activePlatform === 'all'
                      ? (tasks?.length ?? 0)
                      : (tasks?.filter((t) => t.platform === activePlatform).length ?? 0)}{' '}
                    tasks
                  </Text>
                  <Icon name="chevron-down" iconStyle="solid" size={13} color={dark ? '#C4B5FD' : colors.textMuted} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Platform Dropdown Modal */}
            <Modal
              visible={showPlatformDropdown}
              transparent
              animationType="fade"
              onRequestClose={() => setShowPlatformDropdown(false)}>
              <TouchableOpacity
                style={styles.dropdownModalOverlay}
                activeOpacity={1}
                onPress={() => setShowPlatformDropdown(false)}>
                <View style={[styles.dropdownCard, dark && styles.dropdownCardDark]}>
                  <Text style={[styles.dropdownTitle, dark && styles.textLight]}>Select Platform</Text>
                  <View style={styles.dropdownDivider} />
                  {(['all', 'telegram', 'youtube', 'tiktok', 'facebook', 'x'] as PlatformFilter[]).map((p) => {
                    const meta = PLATFORM_META[p];
                    const isSelected = activePlatform === p;
                    const count =
                      p === 'all'
                        ? tasks?.length ?? 0
                        : tasks?.filter((t) => t.platform === p).length ?? 0;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.dropdownOptionRow,
                          dark && styles.dropdownOptionRowDark,
                          isSelected && styles.dropdownOptionSelected,
                        ]}
                        onPress={() => {
                          setActivePlatform(p);
                          setShowPlatformDropdown(false);
                        }}>
                        <View style={styles.dropdownOptionLeft}>
                          <PlatformIcon platform={p === 'all' ? 'app' : p} size={18} color={meta.color} />
                          <Text style={[styles.dropdownOptionLabel, dark && styles.textLight, isSelected && { color: meta.color, fontWeight: '800' }]}>
                            {meta.label}
                          </Text>
                        </View>
                        <View style={styles.dropdownOptionRight}>
                          <Text style={styles.dropdownOptionCount}>{count}</Text>
                          {Boolean(isSelected) ? (
                            <Icon name="check" iconStyle="solid" size={14} color={meta.color} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Status Filter Chips */}
            <View style={styles.statusRow}>
              {(['all', 'available', 'in_progress', 'completed'] as StatusFilter[]).map((s) => {
                const isActive = activeStatus === s;
                const label = s === 'all' ? 'All Status' : s === 'available' ? 'Available' : s === 'in_progress' ? 'In Progress' : 'Completed';
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, isActive && styles.statusChipActive]}
                    onPress={() => setActiveStatus(s)}>
                    <Text style={[styles.statusChipText, isActive && styles.statusChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          tasks === undefined ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>Loading available tasks…</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="clipboard-check" iconStyle="solid" size={40} color={colors.textFaint} />
              <Text style={[styles.emptyTitle, dark && styles.textLight]}>No tasks found</Text>
              <Text style={styles.emptyText}>
                {activePlatform !== 'all' || activeStatus !== 'all'
                  ? 'Try selecting a different filter above.'
                  : 'Check back soon — new tasks are added daily.'}
              </Text>
            </View>
          )
        }
      />

      <UploadScreenshotModal
        visible={!!uploadTarget}
        uploading={uploading}
        onUpload={() => {
          if (uploadTarget) executeUpload(uploadTarget);
        }}
        onClose={() => {
          if (!uploading) setUploadTarget(null);
        }}
      />
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  marketPillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  ptsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  ptsBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBlock: {
    marginBottom: 16,
    gap: 14,
  },
  limitsContainer: {
    marginBottom: 4,
  },
  limitsScroll: {
    gap: 8,
  },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  limitChipMaxed: {
    backgroundColor: '#FEE2E2',
  },
  limitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  limitText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  limitTextMaxed: {
    color: '#B91C1C',
  },
  rewardsSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  rewardsSectionDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  rewardsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardsGrid: {
    marginTop: 12,
    gap: 10,
  },
  filterSection: {},
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  statusChipActive: {
    backgroundColor: colors.primarySoft,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textFaint,
  },
  statusChipTextActive: {
    color: colors.primaryDeep,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  platformName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metaDot: {
    fontSize: 10,
    color: colors.textFaint,
  },
  taskType: {
    fontSize: 12,
    color: colors.textFaint,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  rewardValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D97706',
  },
  stepsBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 6,
  },
  stepsBoxDark: {
    backgroundColor: colors.surfaceDark,
  },
  stepsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: 8,
  },
  stepItemDark: {
    backgroundColor: colors.surfaceAlt,
  },
  stepNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.raised,
  },
  actionBtnUpload: {
    backgroundColor: '#2563EB',
  },
  actionBtnVerify: {
    backgroundColor: '#059669',
  },
  actionBtnBusy: {
    backgroundColor: colors.textFaint,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnDone: {
    backgroundColor: colors.successSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextDone: {
    color: '#15803D',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  textLight: {
    color: colors.textDark,
  },
  platformDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow.card,
  },
  platformDropdownBtnDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  platformDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformDropdownLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  platformDropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformDropdownCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dropdownCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow.float,
  },
  dropdownCardDark: {
    backgroundColor: '#1E1B4B',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderWidth: 1,
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
    opacity: 0.5,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  dropdownOptionRowDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownOptionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
