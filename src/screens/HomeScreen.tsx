import React, { useEffect, useState } from 'react';
import {
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
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { collectDeviceSignals } from '../lib/device';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing, shadow } from '../theme';
import StreakCard from '../components/StreakCard';
import DailyBox from '../components/DailyBox';
import ProgressToReward from '../components/ProgressToReward';
import Icon from '../components/Icon';
import RewardedAdModal from '../components/RewardedAdModal';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Home'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();
  const { userId } = useAuth();

  const recordSignals = useMutation(api.deviceSignals.record);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');

  // Layer 2 fingerprint: record device signals once the user is known (no-op on
  // repeat opens — the server dedups by fingerprint).
  useEffect(() => {
    if (!userId) return;
    recordSignals({ userId, ...collectDeviceSignals() }).catch(() => {});
  }, [userId, recordSignals]);

  // Entry rewarded ad for HomeScreen
  const [adVisible, setAdVisible] = useState(false);
  const handleAdSuccess = () => {
    setAdVisible(false);
  };
  useEffect(() => {
    setAdVisible(true);
  }, []);

  // Each shortcut carries its own navigation so tabs and pushed screens mix freely.
  const shortcuts: { icon: string; label: string; tint: string; go: () => void }[] = [
    { icon: 'list-check', label: 'Tasks', tint: colors.primary, go: () => tabNav.navigate('Tasks') },
    { icon: 'store', label: 'Market', tint: '#0EA5E9', go: () => stackNav.navigate('Marketplace') },
    {
      icon: 'graduation-cap',
      label: 'Learn',
      tint: '#F59E0B',
      go: () => stackNav.navigate('Academy', userId ? { userId, ecosystem: 'PI' } : undefined),
    },
    {
      icon: 'brain',
      label: 'Daily Quiz',
      tint: '#8B5CF6',
      go: () => stackNav.navigate('Quiz', userId ? { userId, ecosystem: 'SIDRA' } : undefined),
    },
    {
      icon: 'arrows-spin',
      label: 'Spin',
      tint: '#EC4899',
      go: () => stackNav.navigate('Spin', userId ? { userId } : undefined),
    },
    { icon: 'gift', label: 'Rewards', tint: '#10B981', go: () => tabNav.navigate('Rewards') },
    { icon: 'trophy', label: 'Leaderboard', tint: '#EF4444', go: () => tabNav.navigate('Leaderboard') },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <Text style={styles.heroHi}>Welcome back 👋</Text>
          <Text style={styles.heroLabel}>Points Balance</Text>
          <Text style={styles.heroBalance}>{balance === undefined ? '—' : balance}</Text>
          <TouchableOpacity
            style={styles.historyChip}
            onPress={() => stackNav.navigate('PointsHistory')}>
            <Text style={styles.historyChipText}>View history →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {userId && (
            <>
              <StreakCard userId={userId} />
              <ProgressToReward userId={userId} onPress={() => tabNav.navigate('Rewards')} />
              <DailyBox userId={userId} />
            </>
          )}

          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Explore</Text>
          <View style={styles.grid}>
            {shortcuts.map((s) => (
              <TouchableOpacity
                key={s.label}
                style={[styles.card, dark && styles.cardDark]}
                activeOpacity={0.85}
                onPress={s.go}>
                <View style={[styles.cardIcon, { backgroundColor: s.tint + '22' }]}>
                  <Icon name={s.icon} iconStyle="solid" size={22} color={s.tint} />
                </View>
                <Text style={[styles.cardLabel, dark && styles.textLight]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_GAP = spacing.md;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.raised,
  },
  heroHi: { color: '#EDE9FE', fontSize: 15, fontWeight: '700', marginBottom: spacing.lg },
  heroLabel: { color: '#EDE9FE', fontSize: 13, fontWeight: '600', opacity: 0.9 },
  heroBalance: {
    color: colors.white,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  historyChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: '#FFFFFF22',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  historyChipText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  textLight: { color: colors.textDark },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: CARD_GAP,
  },
  card: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 24 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
});
