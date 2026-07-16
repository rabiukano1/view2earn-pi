import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  QUIZ: 'Answer quiz',
  SURVEY: 'Complete survey',
};

type Task = {
  _id: Id<'tasks'>;
  type: string;
  platform: string;
  targetUrl: string;
  pageId?: string;
  points: number;
  verifier: string;
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

function deepLinkCandidates(task: Task): string[] {
  const url = task.targetUrl;
  const handle = url.replace(/\/+$/, '').split('/').pop() ?? '';
  switch (task.platform) {
    case 'telegram':
      return [`tg://resolve?domain=${handle.replace(/^@/, '')}`, url];
    case 'facebook':
      // Numeric page IDs resolve reliably across the full app, Lite, and web
      // (plan §7.9d): fb://page/{id} → profile.php?id={id} → the raw URL.
      if (task.pageId) {
        return [
          `fb://page/${task.pageId}`,
          `https://facebook.com/profile.php?id=${task.pageId}`,
          url,
        ];
      }
      return [`fb://facewebmodal/f?href=${encodeURIComponent(url)}`, url];
    default:
      return [url];
  }
}

async function openTask(task: Task, onQuizNav: () => void) {
  if (task.type === 'QUIZ') {
    onQuizNav();
    return;
  }
  if (!task.targetUrl) {
    Alert.alert('Coming soon', 'This task type is coming soon — check back!');
    return;
  }
  for (const candidate of deepLinkCandidates(task)) {
    try {
      await Linking.openURL(candidate);
      return;
    } catch {
    }
  }
  Alert.alert('Could not open link', `Open it manually:\n${task.targetUrl}`);
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
    return { label: 'I did it — Claim', disabled: false, kind: 'claim' };
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

  const handleCopyLink = async () => {
    if (!task.targetUrl) return;
    try {
      await Share.share({ message: task.targetUrl, url: task.targetUrl });
    } catch {
      // user cancelled share
    }
  };

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
            {task.targetUrl ? ` · ${targetName(task.targetUrl)}` : ''}
          </Text>
          <Text style={styles.cardSubtitle}>{meta.label}</Text>
        </View>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsText}>+{task.points}</Text>
          <Text style={styles.pointsUnit}>pts</Text>
        </View>
      </TouchableOpacity>
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
              {action.label}
            </Text>
          </TouchableOpacity>
          {task.targetUrl && action.kind === 'claim' && (
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
  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();

  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);
  const verifyTelegram = useMutation(api.verifications.verifyTelegram);

  const tasks = useQuery(api.tasks.list, userId ? { userId } : "skip");
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

  const handleClaim = async (task: Task) => {
    if (!userId) return;
    try {
      await claim({ taskId: task._id, userId });
    } catch (e) {
      Alert.alert('Could not claim', String(e));
    }
  };

  const handleUpload = async (verification: Verification) => {
    if (uploading) return;
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
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = await (await fetch(asset.uri)).blob();
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.type ?? 'image/jpeg' },
        body: blob,
      });
      if (!result.ok) throw new Error(`Upload failed (${result.status})`);
      const { storageId } = await result.json() as { storageId: Id<'_storage'> };
      await submitProof({ verificationId: verification._id, storageId });
    } catch (e) {
      Alert.alert('Upload failed', String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (verification: Verification) => {
    try {
      await verifyTelegram({ verificationId: verification._id });
    } catch (e) {
      Alert.alert('Could not verify', String(e).replace('[CONVEX] ', ''));
    }
  };

  const handleQuizNav = () => {
    if (!userId) return;
    stackNav.navigate('Quiz', { userId, ecosystem: 'SIDRA' });
  };

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
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            verification={verificationByTask.get(item._id)}
            dark={dark}
            onClaim={handleClaim}
            onUpload={handleUpload}
            onVerify={handleVerify}
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
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      />
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.uploadText}>Uploading screenshot…</Text>
        </View>
      )}
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
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
