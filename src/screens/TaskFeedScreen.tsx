import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

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
  _id: string;
  type: string;
  platform: string;
  targetUrl: string;
  points: number;
  verifier: string;
};

function targetName(url: string): string {
  if (!url) {
    return '';
  }
  const last = url.replace(/\/+$/, '').split('/').pop() ?? '';
  return last.startsWith('@') ? last : `@${last}`;
}

async function openTask(task: Task) {
  if (!task.targetUrl) {
    Alert.alert('Coming soon', 'Quizzes are on the way — check back soon!');
    return;
  }
  try {
    await Linking.openURL(task.targetUrl);
  } catch {
    Alert.alert('Could not open link', 'Copy the link and open it manually.');
  }
}

function TaskCard({ task, dark }: { task: Task; dark: boolean }) {
  const meta = PLATFORM_META[task.platform] ?? {
    label: task.platform,
    color: '#6B7280',
  };
  return (
    <TouchableOpacity
      style={[styles.card, dark && styles.cardDark]}
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
  );
}

export default function TaskFeedScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tasks = useQuery(api.tasks.list);

  return (
    <View
      style={[
        styles.container,
        dark && styles.containerDark,
        { paddingTop: insets.top },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>
          Tasks
        </Text>
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
          renderItem={({ item }) => <TaskCard task={item} dark={dark} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardDark: {
    backgroundColor: '#27272A',
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
});
