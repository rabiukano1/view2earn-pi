import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
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

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  tiktok: { label: 'TikTok', color: '#010101' },
  telegram: { label: 'Telegram', color: '#229ED9' },
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

// Candidate URLs per platform, best first: native app scheme, then the
// plain https link (which Android app-links may still route to the app,
// and otherwise opens in the browser).
function deepLinkCandidates(task: Task): string[] {
  const url = task.targetUrl;
  const handle = url.replace(/\/+$/, '').split('/').pop() ?? '';
  switch (task.platform) {
    case 'telegram':
      return [`tg://resolve?domain=${handle.replace(/^@/, '')}`, url];
    case 'facebook':
      // Full fb deep-linking uses numeric page IDs (plan §7); until tasks
      // carry one, facewebmodal opens the page inside the Facebook app.
      return [`fb://facewebmodal/f?href=${encodeURIComponent(url)}`, url];
    default:
      return [url];
  }
}

async function openTask(task: Task) {
  if (!task.targetUrl) {
    Alert.alert('Coming soon', 'Quizzes are on the way — check back soon!');
    return;
  }
  for (const candidate of deepLinkCandidates(task)) {
    try {
      await Linking.openURL(candidate);
      return;
    } catch {
      // App not installed / scheme unsupported — try the next candidate.
    }
  }
  Alert.alert('Could not open link', `Open it manually:\n${task.targetUrl}`);
}

// Dev identity until Sidra auth: stable per device via the OS build
// fingerprint (good enough for a single dev phone).
function deviceFingerprint(): string {
  const c = Platform.constants as Record<string, unknown>;
  const raw = `${c.Fingerprint ?? c.Model ?? 'unknown'}`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

type ActionState = {
  label: string;
  disabled: boolean;
  kind: 'claim' | 'upload' | 'done' | 'busy';
};

function actionFor(verification: Verification | undefined): ActionState {
  if (!verification) {
    return { label: 'I did it — Claim', disabled: false, kind: 'claim' };
  }
  switch (verification.state) {
    case 'USER_CLAIMED_DONE':
      return { label: 'Upload screenshot', disabled: false, kind: 'upload' };
    case 'REJECTED':
      return { label: 'Retry screenshot', disabled: false, kind: 'upload' };
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
}: {
  task: Task;
  verification: Verification | undefined;
  dark: boolean;
  onClaim: (task: Task) => void;
  onUpload: (verification: Verification) => void;
}) {
  const meta = PLATFORM_META[task.platform] ?? {
    label: task.platform,
    color: '#6B7280',
  };
  const action = actionFor(verification);
  const showAction = task.type !== 'QUIZ';

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <TouchableOpacity
        style={styles.cardTop}
        activeOpacity={0.7}
        onPress={() => openTask(task)}>
        <View style={[styles.platformBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.platformBadgeText}>{meta.label[0]}</Text>
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
        <TouchableOpacity
          style={[
            styles.actionButton,
            action.kind === 'done' && styles.actionDone,
            action.disabled && action.kind !== 'done' && styles.actionBusy,
          ]}
          disabled={action.disabled}
          onPress={() => {
            if (action.kind === 'claim') {
              onClaim(task);
            } else if (action.kind === 'upload' && verification) {
              onUpload(verification);
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
      )}
    </View>
  );
}

export default function TaskFeedScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [uploading, setUploading] = useState(false);

  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);
  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);

  const tasks = useQuery(api.tasks.list, userId ? { userId } : "skip");
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const verifications = useQuery(
    api.verifications.listMine,
    userId ? { userId } : 'skip',
  );

  useEffect(() => {
    getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
      .then(setUserId)
      .catch((e) => Alert.alert('Sign-in failed', String(e)));
  }, [getOrCreateDevUser]);

  const verificationByTask = new Map<string, Verification>(
    (verifications ?? []).map((verification) => [
      verification.taskId,
      verification,
    ]),
  );

  const handleClaim = async (task: Task) => {
    if (!userId) {
      return;
    }
    try {
      await claim({ taskId: task._id, userId });
    } catch (e) {
      Alert.alert('Could not claim', String(e));
    }
  };

  const handleUpload = async (verification: Verification) => {
    if (uploading) {
      return;
    }
    // Client-side resize per plan §4 (cheaper upload + AI input).
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 1280,
      maxHeight: 2560,
      quality: 0.7,
      selectionLimit: 1,
    });
    const asset = picked.assets?.[0];
    if (picked.didCancel || !asset?.uri) {
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = await (await fetch(asset.uri)).blob();
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.type ?? 'image/jpeg' },
        body: blob,
      });
      if (!result.ok) {
        throw new Error(`Upload failed (${result.status})`);
      }
      const { storageId } = await result.json();
      await submitProof({ verificationId: verification._id, storageId });
    } catch (e) {
      Alert.alert('Upload failed', String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        dark && styles.containerDark,
        { paddingTop: insets.top },
      ]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, dark && styles.textLight]}>
            Tasks
          </Text>
          <View style={styles.balancePill}>
            <Text style={styles.balanceText}>
              {balance === undefined ? '…' : balance} pts
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Earn points — redeemable for rewards
        </Text>
      </View>
      {tasks === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.headerSubtitle}>Loading tasks…</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, dark && styles.textLight]}>
            No tasks right now
          </Text>
          <Text style={styles.headerSubtitle}>
            Check back soon — new tasks are added daily.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              verification={verificationByTask.get(item._id)}
              dark={dark}
              onClaim={handleClaim}
              onUpload={handleUpload}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
        />
      )}
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
    backgroundColor: '#F4F4F5',
  },
  containerDark: {
    backgroundColor: '#18181B',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18181B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
  },
  balancePill: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  balanceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181B',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardDark: {
    backgroundColor: '#27272A',
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
    fontWeight: '600',
    color: '#18181B',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  textLight: {
    color: '#FAFAFA',
  },
  platformBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  pointsPill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pointsText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '700',
  },
  pointsUnit: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  actionBusy: {
    backgroundColor: '#A1A1AA',
  },
  actionDone: {
    backgroundColor: '#DCFCE7',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
