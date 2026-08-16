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
import { levelInfo, formatPts, type SmartDashboard } from '../profile/smart';import {
  buildActivities,
  hubSummary,
  type ActivitiesHubData,
} from '../activities/hub';

type TabNav = BottomTabNavigationProp<RootTabParamList, 'Home'>;
type StackNav = NativeStackNavigationProp<RootStackParamList>;

function HomeScreenActivityHubCard({ userId, onPress }: { userId: string; onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  const hub = useQuery(api.activities.getActivitiesHub, { userId: userId as any });
  const dash = useQuery(api.profile.smartDashboard, { userId: userId as any });

  if (!hub) return null;

  const d = hub as ActivitiesHubData;
  const s = hubSummary(d, buildActivities(d));

  let headline: string;
  if (s.claimableCount > 0) {
    headline = `${s.claimableCount} reward${s.claimableCount === 1 ? '' : 's'} ready to claim`;
  } else if (s.availableCount > 0) {
    headline = `${s.availableCount} activities available today`;
  } else if (s.remainingToday > 0) {
    headline = `Complete ${s.remainingToday} more to earn ${formatPts(s.potentialRemaining)} PTS`;
  } else {
    headline = `All ${s.totalToday} activities done today`;
  }

  return (
    <TouchableOpacity
      style={[styles.hubCard, dark && styles.cardDark]}
      onPress={onPress}
      activeOpacity={0.88}>
      <View style={styles.hubTop}>
        <View style={styles.hubTitleWrap}>
          <Icon name="trophy" iconStyle="solid" size={17} color="#F59E0B" />
          <Text style={[styles.hubTitle, dark && styles.textLight]}>Achievements</Text>
        </View>
        <Text style={styles.hubHeadline}>{headline}</Text>
      </View>
      <View style={styles.hubChips}>
        {Boolean(s.availableCount > 0) ? (
          <View style={[styles.hubChip, { backgroundColor: colors.primarySoft }]}>
            <Text style={styles.hubChipText}>🔥 {s.availableCount} available now</Text>
          </View>
        ) : null}
        {Boolean(s.claimableCount > 0) ? (
          <View style={[styles.hubChip, { backgroundColor: colors.successSoft }]}>
            <Text style={styles.hubChipText}>
              🎁 {s.claimableCount} reward{s.claimableCount === 1 ? '' : 's'} ready
            </Text>
          </View>
        ) : null}
        <View style={[styles.hubChip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.hubChipText}>
            {s.doneToday}/{s.totalToday} done today
          </Text>
        </View>
      </View>
      <View style={styles.hubBtn}>
        <Text style={styles.hubBtnText}>View achievements</Text>
        <Icon name="arrow-right" iconStyle="solid" size={12} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

function HomeScreenLevelCard({ onPress }: { onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  const progress = useQuery(api.xp.myLevelProgress);

  if (!progress) return null;

  return (
    <TouchableOpacity
      style={[styles.hubCard, dark && styles.cardDark]}
      onPress={onPress}
      activeOpacity={0.88}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>✨ LEVEL {progress.currentLevel.level}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: dark ? '#94A3B8' : '#64748B' }}>{progress.xp.toLocaleString()} XP</Text>
      </View>
      <Text style={{ fontSize: 26, fontWeight: '900', color: dark ? colors.white : colors.text, marginBottom: 12 }}>{progress.currentLevel.name}</Text>
      
      {progress.nextLevel ? (
        <>
          <Text style={{ fontSize: 13, fontWeight: '700', color: dark ? '#E2E8F0' : '#334155', marginBottom: 8 }}>Progress to Level {progress.nextLevel.level}</Text>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${progress.progressPercentage}%` }]} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: '500', color: dark ? '#94A3B8' : '#64748B', marginTop: 8 }}>{progress.xpToNextLevel.toLocaleString()} XP remaining</Text>
        </>
      ) : (
        <Text style={{ fontSize: 13, fontWeight: '600', color: dark ? colors.white : colors.text, marginBottom: 8 }}>Maximum Level Reached</Text>
      )}
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
  const flags = useQuery(api.features.getFlags) || {};

  useEffect(() => {
    if (!userId) return;
    recordSignals({ userId, ...collectDeviceSignals() }).catch(() => {});
  }, [userId, recordSignals]);

  const exploreCategories = [
    {
      title: '🔥 Earn Points',
      subtitle: 'Quick ways to boost your balance',
      items: [
        ...(flags['feature:tasks'] !== false ? [{ icon: 'list-check', label: 'Tasks', desc: 'Social media tasks', tint: colors.primary, go: () => tabNav.navigate('Tasks') }] : []),
        ...(flags['feature:quiz'] !== false ? [{ icon: 'brain', label: 'Daily Quiz', desc: 'Answer & score bonus', tint: '#6366F1', go: () => stackNav.navigate('Quiz', userId ? { userId, ecosystem: 'SIDRA' } : undefined) }] : []),
        ...(flags['feature:spin'] !== false ? [{ icon: 'arrows-spin', label: 'Spin & Win', desc: 'Daily lucky wheel', tint: '#EC4899', go: () => stackNav.navigate('Spin', userId ? { userId } : undefined) }] : []),
        ...(flags['feature:surveys'] !== false ? [{ icon: 'clipboard-list', label: 'Surveys', desc: 'Share your feedback', tint: '#F97316', go: () => stackNav.navigate('Surveys', userId ? { userId } : undefined) }] : []),
      ],
    },
    {
      title: '💳 Rewards & Growth',
      subtitle: 'Cash out and share your profile',
      items: [
        ...(flags['feature:rewards'] !== false ? [{ icon: 'gift', label: 'Rewards', desc: 'Redeem gift cards & Pi', tint: '#10B981', go: () => tabNav.navigate('Rewards') }] : []),
        ...(flags['feature:promote'] !== false ? [{ icon: 'rocket', label: 'Promote Hub', desc: 'Promote your links', tint: '#8B5CF6', go: () => stackNav.navigate('Marketplace') }] : []),
      ],
    },
    {
      title: '🎓 Learn & Support',
      subtitle: 'Guides and ways to help',
      items: [
        ...(flags['feature:academy'] !== false ? [{ icon: 'graduation-cap', label: 'Learn', desc: 'How to earn guide', tint: '#F59E0B', go: () => stackNav.navigate('Academy', userId ? { userId, ecosystem: 'PI' } : undefined) }] : []),
        ...(flags['feature:donate'] !== false ? [{ icon: 'heart', label: 'Donate π', desc: 'Support the pool', tint: '#EC4899', go: () => stackNav.navigate('Donate') }] : []),
      ],
    },
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
          {userId ? (
            <>
              <HomeScreenLevelCard onPress={() => stackNav.navigate('Level')} />
              <HomeScreenActivityHubCard userId={userId} onPress={() => stackNav.navigate('Achievements')} />
              <ProgressToReward userId={userId} onPress={() => tabNav.navigate('Rewards')} />
              <StreakCard userId={userId} />
              <DailyBox userId={userId} />
            </>
          ) : null}

          {/* Categorized Explore Sections */}
          <Text style={[styles.sectionTitle, dark && styles.textLight, { marginTop: spacing.md }]}>Explore Platform</Text>
          {exploreCategories.map((cat) => (
            <View key={cat.title} style={{ marginBottom: spacing.md }}>
              <View style={styles.catHeader}>
                <Text style={[styles.catTitle, dark && styles.textLight]}>{cat.title}</Text>
                <Text style={styles.catSub}>{cat.subtitle}</Text>
              </View>              <View style={styles.grid}>
                {cat.items.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.tile, dark && styles.cardDark]}
                    activeOpacity={0.85}
                    onPress={item.go}>
                    <View style={[styles.tileIcon, { backgroundColor: item.tint + '22' }]}>
                      <Icon name={item.icon} iconStyle="solid" size={22} color={item.tint} />
                    </View>
                    <Text style={[styles.tileLabel, dark && styles.textLight]}>{item.label}</Text>
                    <Text style={styles.tileDesc} numberOfLines={1}>{item.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

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
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
  },
  xpTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginVertical: 2,
  },
  xpFill: {
    height: '100%',
    borderRadius: 3.5,
    backgroundColor: '#F59E0B',
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
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  tileDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  catTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  catSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  catHeader: { marginBottom: spacing.sm },
  textLight: { color: colors.textDark },
  // ---- Achievements hub entry card ----
  hubCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  hubTop: { gap: 4 },
  hubTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hubTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  hubHeadline: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  hubChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hubChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hubChipText: { fontSize: 11.5, fontWeight: '800', color: colors.text },
  hubLevelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: -2,
  },
  hubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    ...shadow.raised,
  },
  hubBtnText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
