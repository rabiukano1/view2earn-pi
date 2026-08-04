import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
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
import RewardedAdModal from '../components/RewardedAdModal';
import UploadScreenshotModal from '../components/UploadScreenshotModal';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Tasks'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  tiktok: { label: 'TikTok', color: '#010101' },
  telegram: { label: 'Telegram', color: '#229ED9' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  x: { label: 'X (Twitter)', color: '#000000' },
  app: { label: 'View2Earn', color: '#7C3AED' },
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
  if (!url) {
    return '';
  }
  const last = url.replace(/\/+$/, '').split('/').pop() ?? '';
  return last.startsWith('@') ? last : `@${last}`;
}

function deepLinkCandidates(
  platform: string,
  url: string,
  pageId?: string,
): string[] {
  const handle = url.replace(/\/+$/, '').split('/').pop() ?? '';
  switch (platform) {
    case 'telegram':
      return [`tg://resolve?domain=${handle.replace(/^@/, '')}`, url];
    case 'facebook':
      // Numeric page IDs resolve reliably across the full app, Lite, and web
      // (plan §7.9d): fb://page/{id} → profile.php?id={id} → the raw URL.
      if (pageId) {
        return [
          `fb://page/${pageId}`,
          `https://facebook.com/profile.php?id=${pageId}`,
          url,
        ];
      }
      return [`fb://facewebmodal/f?href=${encodeURIComponent(url)}`, url];
    default:
      return [url];
  }
}

async function openUrl(platform: string, url: string, pageId?: string) {
  if (!url) {
    return;
  }
  for (const candidate of deepLinkCandidates(platform, url, pageId)) {
    try {
      await Linking.openURL(candidate);
      return;
    } catch {
    }
  }
  Alert.alert('Could not open link', `Open it manually:\n${url}`);
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
};

function actionFor(
  verification: Verification | undefined,
  verifier: string,
): ActionState {
  const telegram = verifier === 'telegram-bot';
  if (!verification) {
    return { label: 'Follow / Join', disabled: false, kind: 'claim' };
  }
  switch (verification.state) {
    case 'USER_CLAIMED_DONE':
      return telegram
        ? { label: 'Verify join', disabled: false, kind: 'verify' }
        : { label: 'Upload screenshot', disabled: false, kind: 'upload' };
    case 'REJECTED':
      return telegram
        ? { label: 'Retry verify', disabled: false, kind: 'verify' }
        : { label: 'Retry screenshot', disabled: false, kind: 'upload' };
    case 'PROOF_SUBMITTED':
      return { label: 'Verifying…', disabled: true, kind: 'busy' };
    case 'ADMIN_REVIEW':
      return { label: 'In review', disabled: true, kind: 'busy' };
    case 'PENDING_HOLD':
      return { label: 'Approved — on hold', disabled: true, kind: 'busy' };
    case 'RELEASED':
      return { label: '✓ Points earned', disabled: true, kind: 'done' };
    default:
      return { label: verification.state, disabled: true, kind: 'busy' };
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
  };
  const action = actionFor(verification, task.verifier);
  const showAction = task.type !== 'QUIZ';
  const multiAction = task.type === 'MULTI_TASK';
  const claimLabel = multiAction
    ? (action.label === 'Follow / Join' ? 'Start & complete steps' : action.label)
    : action.label;

  const handleCopyLink = async () => {
    const urls =
      task.type === 'MULTI_TASK'
        ? (task.steps ?? []).map((s) => s.targetUrl).filter(Boolean)
        : task.targetUrl
        ? [task.targetUrl]
        : [];
    if (urls.length === 0) return;
    try {
      const message = urls.join('\n');
      await Share.share({ message, url: urls[0] });
    } catch {
      // user cancelled share
    }
  };

  const steps = task.type === 'MULTI_TASK' ? task.steps ?? [] : [];

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <TouchableOpacity
        style={styles.cardTop}
        activeOpacity={0.7}
        onPress={() => openTask(task, onQuizNav)}>
        <View style={[styles.platformBadge, { backgroundColor: meta.color }]}>
          <PlatformIcon platform={task.platform} size={18} color="#fff" />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, dark && styles.textLight]}>
            {TYPE_LABELS[task.type] ?? task.type}
            {task.name || (task.targetUrl ? ` · ${targetName(task.targetUrl)}` : '')}
          </Text>
          <Text style={styles.cardSubtitle}>{meta.label}</Text>
        </View>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsText}>+{task.points}</Text>
          <Text style={styles.pointsUnit}>pts</Text>
        </View>
      </TouchableOpacity>

      {steps.length > 0 && (
        <View style={styles.stepsWrap}>
          <Text style={styles.stepsTitle}>Complete all {steps.length} steps</Text>
          {steps.map((step, i) => {
            const actionLabel =
              step.label || ACTION_LABELS[step.action] || step.action;
            const stepName =
              step.name || (step.targetUrl ? targetName(step.targetUrl) : '');
            return (
              <TouchableOpacity
                key={i}
                style={[styles.stepRow, dark && styles.stepRowDark]}
                activeOpacity={0.7}
                onPress={() => openUrl(task.platform, step.targetUrl, task.pageId)}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepAction, dark && styles.textLight]}>
                    {actionLabel}
                    {stepName ? ` · ${stepName}` : ''}
                  </Text>
                  {step.targetUrl ? (
                    <Text style={styles.stepUrl} numberOfLines={1}>
                      {step.targetUrl}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.stepOpen}>Open</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {showAction && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonPrimary,
              action.kind === 'done' && styles.actionDone,
              action.disabled && action.kind !== 'done' && styles.actionBusy,
            ]}
            disabled={action.disabled}
            onPress={() => {
              if (action.kind === 'claim') {
                onClaim(task);
              } else if (action.kind === 'upload' && verification) {
                onUpload(verification);
              } else if (action.kind === 'verify' && verification) {
                onVerify(verification);
              }
            }}>
            <Text
              style={[
                styles.actionText,
                action.kind === 'done' && styles.actionTextDone,
              ]}>
              {claimLabel}
            </Text>
          </TouchableOpacity>
          {((task.targetUrl && action.kind === 'claim') ||
            (multiAction && action.kind === 'claim')) && (
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
              <Text style={styles.copyButtonText}>Copy link</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function TasksScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedTaskForAd, setSelectedTaskForAd] = useState<Task | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Verification | null>(null);
  const [adAfterUpload, setAdAfterUpload] = useState(false);
  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();
  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);
  const verifyTelegram = useMutation(api.verifications.verifyTelegram);

  const tasks = useQuery(api.tasks.list, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const limits = useQuery(api.tasks.myLimits, userId ? { userId } : 'skip');
  const verifications = useQuery(
    api.verifications.listMine,
    userId ? { userId } : 'skip',
  );

  const verificationByTask = new Map<string, Verification>(
    (verifications ?? []).map((verification) => [
      verification.taskId,
      verification,
    ]),
  );

  const handleQuizNav = () => {
    if (!userId) return;
    stackNav.navigate('Quiz', { userId, ecosystem: 'SIDRA' });
  };

  const executeClaim = async (task: Task) => {
    if (!userId) return;
    try {
      await claim({ taskId: task._id, userId });
      
      if (task.type === 'QUIZ') {
        await openTask(task, handleQuizNav);
        return;
      }
      
      Alert.alert(
        'Support Us',
        'Would you like to watch a short ad before completing this task?',
        [
          {
            text: 'No, thanks',
            style: 'cancel',
            onPress: () => openTask(task, handleQuizNav),
          },
          {
            text: 'Yes, watch ad',
            onPress: () => setSelectedTaskForAd(task),
          },
        ]
      );
    } catch (e) {
      let msg = String(e).replace('[CONVEX] ', '');
      msg = msg.replace(/Uncaught Error:\s*/, '');
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
      setAdAfterUpload(true);
    } catch (e) {
      console.error('Upload failed:', e);
      Alert.alert('Upload failed', String(e).replace('[CONVEX] ', ''));
    } finally {
      setUploading(false);
    }
  };

  const executeVerify = async (verification: Verification) => {
    try {
      await verifyTelegram({ verificationId: verification._id });
    } catch (e) {
      Alert.alert('Could not verify', String(e).replace('[CONVEX] ', ''));
    }
  };

  // When the user comes back from the target link (follow/join), nudge them to
  // upload a screenshot of the completed task instead of waiting to find the
  // card in the feed. Only fires once per pending verification.
  const verificationsRef = useRef(verifications);
  verificationsRef.current = verifications;
  const taskByIdRef = useRef<Map<string, Task>>(new Map());
  taskByIdRef.current = new Map((tasks ?? []).map((t) => [t._id, t]));
  const promptedVerificationRef = useRef<string | null>(null);

  const openUploadModal = (verification: Verification) => {
    promptedVerificationRef.current = verification._id;
    setUploadTarget(verification);
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const pending = (verificationsRef.current ?? []).find(
        (v) =>
          (v.state === 'USER_CLAIMED_DONE' || v.state === 'REJECTED') &&
          taskByIdRef.current.get(v.taskId)?.verifier !== 'telegram-bot',
      );
      if (!pending) {
        promptedVerificationRef.current = null;
        return;
      }
      if (promptedVerificationRef.current === pending._id) return;
      openUploadModal(pending);
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Tasks"
        subtitle="Earn points — redeemable for rewards"
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.marketBtn}
              onPress={() => stackNav.navigate('Marketplace')}>
              <Text style={styles.marketBtnText}>Market</Text>
            </TouchableOpacity>
            <View style={styles.balancePill}>
              <Text style={styles.balanceText}>
                {balance === undefined ? '…' : balance} pts
              </Text>
            </View>
          </View>
        }
      />
      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
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
          <View>
            {limits && limits.some((l) => l.used > 0 || l.remaining < l.limit) && (
              <View style={styles.limitRow}>
                {limits.map((l) => {
                  const meta = PLATFORM_META[l.platform] ?? { label: l.platform, color: '#6B7280' };
                  const maxed = l.remaining === 0;
                  return (
                    <View key={l.platform} style={[styles.limitChip, maxed && styles.limitChipMaxed]}>
                      <View style={[styles.limitDot, { backgroundColor: meta.color }]} />
                      <Text style={[styles.limitText, maxed && styles.limitTextMaxed]}>
                        {meta.label} {l.remaining}/{l.limit}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            {limits?.some((l) => l.remaining === 0) && (
              <Text style={styles.limitNote}>
                Daily limit reached on some platforms — this protects your account from suspension. More tasks tomorrow.
              </Text>
            )}
            {userId && (
              <View style={styles.cardsWrap}>
                <StreakCard userId={userId} />
                <ProgressToReward
                  userId={userId}
                  onPress={() => tabNav.navigate('Rewards')}
                />
                <DailyBox userId={userId} />
                <ComboTracker userId={userId} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          tasks === undefined ? (
            <View style={styles.centerPad}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.headerSubtitle}>Loading tasks…</Text>
            </View>
          ) : (
            <View style={styles.centerPad}>
              <Text style={[styles.emptyTitle, dark && styles.textLight]}>
                No tasks right now
              </Text>
              <Text style={styles.headerSubtitle}>
                Check back soon — new tasks are added daily.
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
      <RewardedAdModal
        visible={!!selectedTaskForAd || adAfterUpload}
        onClose={() => {
          if (selectedTaskForAd) {
            const t = selectedTaskForAd;
            setSelectedTaskForAd(null);
            openTask(t, handleQuizNav);
          } else if (adAfterUpload) {
            setAdAfterUpload(false);
            Alert.alert(
              'Screenshot uploaded 🎉',
              'Your proof is in review — points are credited once approved.',
            );
          }
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  limitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 20,
  },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  limitChipMaxed: {
    backgroundColor: colors.dangerSoft,
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
  limitNote: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 10,
    marginHorizontal: 20,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  marketBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  balancePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  balanceText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cardsWrap: {
    paddingTop: 8,
  },
  centerPad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 8,
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  textLight: {
    color: colors.textDark,
  },
  platformBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
  },
  pointsPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  pointsText: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  pointsUnit: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  stepsWrap: {
    marginTop: 14,
    gap: 8,
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepRowDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  stepIndexText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  stepBody: {
    flex: 1,
    marginHorizontal: 10,
  },
  stepAction: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stepUrl: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  stepOpen: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  copyButton: {
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  actionBusy: {
    backgroundColor: colors.textFaint,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionDone: {
    backgroundColor: colors.successSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  actionTextDone: {
    color: '#15803D',
  },
  rewardedAdBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...shadow.card,
  },
  adBannerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBannerContent: {
    flex: 1,
  },
  adBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  adBannerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  adBannerBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  adBannerBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
});
