import React, { useEffect } from 'react';
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
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { collectDeviceSignals } from '../lib/device';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing, shadow } from '../theme';
import StreakCard from '../components/StreakCard';
import DailyBox from '../components/DailyBox';
import ProgressToReward from '../components/ProgressToReward';
import Icon from '../components/Icon';
import { achievements, levelInfo, formatPts, type SmartDashboard } from '../profile/smart';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Home'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

function HomeScreenAchievementsCard({ userId, onPress }: { userId: string; onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  const data = useQuery(api.profile.smartDashboard, { userId: userId as any });

  if (!data) return null;

  const d = data as SmartDashboard;
  const lvl = levelInfo(d.stats.totalEarned);
  const all = achievements(d);
  const unlocked = all.filter((a) => a.unlocked).length;

  return (
    <TouchableOpacity
      style={[styles.achievementsCard, dark && styles.cardDark]}
      onPress={onPress}
      activeOpacity={0.88}>
      <View style={styles.achievementsHeader}>
        <View style={styles.levelBadge}>
          <Icon name="medal" iconStyle="solid" size={15} color="#F59E0B" />
          <Text style={styles.levelBadgeText}>Level {lvl.level}</Text>
        </View>
        <View style={styles.unlockedBadge}>
          <Icon name="award" iconStyle="solid" size={12} color="#10B981" />
          <Text style={styles.unlockedCountText}>{unlocked}/{all.length} Unlocked</Text>
        </View>
      </View>

      <Text style={[styles.levelTitleText, dark && styles.textLight]}>{lvl.title}</Text>

      <View style={styles.xpTrack}>
        <View style={[styles.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} />
      </View>

      <View style={styles.achievementsFooter}>
        <Text style={styles.xpProgressText}>
          {formatPts(d.stats.totalEarned)} XP lifetime · {formatPts(lvl.next - lvl.xp)} to Lvl {lvl.level + 1}
        </Text>
        <Text style={styles.viewBadgesText}>View Badges →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();
  const { userId } = useAuth();

  const recordSignals = useMutation(api.deviceSignals.record);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');

  useEffect(() => {
    if (!userId) return;
    recordSignals({ userId, ...collectDeviceSignals() }).catch(() => {});
  }, [userId, recordSignals]);

  const shortcuts: { icon: string; label: string; tint: string; go: () => void }[] = [
    { icon: 'medal', label: 'Achievements', tint: '#F59E0B', go: () => stackNav.navigate('Achievements') },
    { icon: 'list-check', label: 'Tasks', tint: colors.primary, go: () => tabNav.navigate('Tasks') },
    { icon: 'rocket', label: 'Promote Hub', tint: '#8B5CF6', go: () => stackNav.navigate('Marketplace') },
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
    {
      icon: 'clipboard-list',
      label: 'Surveys',
      tint: '#F97316',
      go: () => stackNav.navigate('Surveys', userId ? { userId } : undefined),
    },
    { icon: 'heart', label: 'Donate π', tint: '#EC4899', go: () => stackNav.navigate('Donate') },
    { icon: 'gift', label: 'Rewards', tint: '#10B981', go: () => tabNav.navigate('Rewards') },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
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
              <HomeScreenAchievementsCard userId={userId} onPress={() => stackNav.navigate('Achievements')} />
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
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: spacing.xs,
  },
  historyChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  historyChipText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  body: {
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.lg,
    gap: spacing.md,
  },
  achievementsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    ...shadow.card,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D97706',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  unlockedCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  levelTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  xpTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginVertical: 4,
  },
  xpFill: {
    height: '100%',
    borderRadius: 3.5,
    backgroundColor: '#F59E0B',
  },
  achievementsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xpProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  viewBadgesText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: `calc(50% - ${CARD_GAP / 2}px)` as any,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  textLight: { color: colors.textDark },
});
