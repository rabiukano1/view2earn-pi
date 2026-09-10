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

function HomeScreenLiveFootballCard({ onPress }: { onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  const channels = useQuery(api.iptv.list) ?? [];
  const football = channels.filter((c) => c.type === 'football');
  const youtube = channels.filter((c) => c.type === 'youtube');
  const other = channels.filter((c) => c.type === 'other');

  return (
    <TouchableOpacity
      style={[styles.footballBanner, dark && styles.footballBannerDark]}
      onPress={onPress}
      activeOpacity={0.88}>
      <View style={styles.footballBannerTop}>
        <View style={styles.liveBadgeRow}>
          <View style={styles.livePulseDot} />
          <Text style={styles.footballBannerBadge}>WATCH{channels.length ? ` · ${channels.length} STREAMS` : ''}</Text>
        </View>
        <View style={styles.hdChip}>
          <Text style={styles.hdChipText}>1080p HD</Text>
        </View>
      </View>

      <View style={styles.footballMainRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.footballBannerTitle}>⚽ Football · 🎬 YouTube · 📺 Live</Text>
          <Text style={styles.footballBannerSub}>
            Watch matches, videos and live streams free with strong signal
          </Text>
        </View>

        <View style={styles.playActionBtn}>
          <Icon name="play" iconStyle="solid" size={14} color="#FFFFFF" />
          <Text style={styles.playActionText}>Watch</Text>
        </View>
      </View>

      <View style={styles.footballFooterChips}>
        <View style={styles.footballChipItem}>
          <Text style={styles.footballChipText}>⚽ {football.length} Football</Text>
        </View>
        <View style={styles.footballChipItem}>
          <Text style={styles.footballChipText}>🎬 {youtube.length} YouTube</Text>
        </View>
        <View style={styles.footballChipItem}>
          <Text style={styles.footballChipText}>📺 {other.length} Live</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

import { useLanguage } from '../i18n/LanguageContext';

export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<TabNav>();
  const stackNav = useNavigation<StackNav>();
  const { userId } = useAuth();
  const { t } = useLanguage();

  const recordSignals = useMutation(api.deviceSignals.record);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const me = useQuery(api.users.me);
  const flags = useQuery(api.features.getFlags) || {};

  useEffect(() => {
    if (!userId) return;
    recordSignals({ userId, ...collectDeviceSignals() }).catch(() => {});
  }, [userId, recordSignals]);

  const exploreCategories = [
    {
      title: t('earnPoints'),
      subtitle: t('earnPointsSub'),
      items: [
        ...(flags['feature:tasks'] !== false ? [{ icon: 'list-check', label: t('tasks'), desc: 'Social media tasks', tint: colors.primary, go: () => tabNav.navigate('Tasks') }] : []),
        ...(flags['feature:quiz'] !== false ? [{ icon: 'brain', label: t('dailyQuiz'), desc: t('dailyQuizDesc'), tint: '#6366F1', go: () => stackNav.navigate('Quiz', userId ? { userId, ecosystem: 'SIDRA' } : undefined) }] : []),
        ...(flags['feature:spin'] !== false ? [{ icon: 'arrows-spin', label: t('spinAndWin'), desc: t('spinDesc'), tint: '#EC4899', go: () => stackNav.navigate('Spin', userId ? { userId } : undefined) }] : []),
        ...(flags['feature:surveys'] !== false ? [{ icon: 'clipboard-list', label: t('surveys'), desc: t('surveysDesc'), tint: '#F97316', go: () => stackNav.navigate('Surveys', userId ? { userId } : undefined) }] : []),
      ],
    },
    {
      title: t('growthHub'),
      subtitle: t('growthHubSub'),
      items: [
        ...(flags['feature:promote'] !== false ? [{ icon: 'rocket', label: t('promoteHub'), desc: t('promoteHubDesc'), tint: '#8B5CF6', go: () => stackNav.navigate('Marketplace') }] : []),
      ],
    },
    {
      title: t('learnAndSupport'),
      subtitle: t('learnSub'),
      items: [
        ...(flags['feature:academy'] !== false ? [{ icon: 'graduation-cap', label: t('learn'), desc: t('learnDesc'), tint: '#F59E0B', go: () => stackNav.navigate('Academy', userId ? { userId, ecosystem: 'PI' } : undefined) }] : []),
        ...(flags['feature:donate'] !== false ? [{ icon: 'heart', label: t('communityPool'), desc: t('communityPoolDesc'), tint: '#EC4899', go: () => stackNav.navigate('Donate') }] : []),
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
          <Text style={styles.heroHi}>
            {t('welcomeBack')}{me?.name ? `, ${me.name}` : (me?.username ? `, ${me.username}` : '')}
          </Text>
          <Text style={styles.heroLabel}>{t('pointsBalance')}</Text>
          <Text style={styles.heroBalance}>{balance === undefined ? '—' : balance}</Text>
        </View>

        <View style={styles.body}>
          {userId ? (
            <>
              <HomeScreenLevelCard onPress={() => stackNav.navigate('Level')} />
              <HomeScreenActivityHubCard userId={userId} onPress={() => stackNav.navigate('Achievements')} />
              <StreakCard userId={userId} />
              <DailyBox userId={userId} />
              <HomeScreenLiveFootballCard onPress={() => stackNav.navigate('WatchHub')} />
            </>
          ) : (
            <HomeScreenLiveFootballCard onPress={() => stackNav.navigate('WatchHub')} />
          )}

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
  footballBanner: {
    backgroundColor: '#1E1B4B',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#4338CA',
    marginVertical: spacing.xs,
    ...shadow.card,
  },
  footballBannerDark: {
    backgroundColor: '#0F172A',
    borderColor: '#312E81',
  },
  footballBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  footballBannerBadge: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hdChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hdChipText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '900',
  },
  footballMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footballBannerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  footballBannerSub: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  playActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    ...shadow.raised,
  },
  playActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  footballFooterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  footballChipItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  footballChipText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '700',
  },
});
