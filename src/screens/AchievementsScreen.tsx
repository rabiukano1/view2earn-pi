import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { achievements, levelInfo, formatPts, type SmartDashboard } from '../profile/smart';
import {
  ACTIVITY_CATEGORIES,
  activityEarnings,
  buildActivities,
  hubSummary,
  type ActivitiesHubData,
  type Activity,
  type ActivityCategory,
} from '../activities/hub';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'Achievements'>,
  BottomTabNavigationProp<RootTabParamList>
>;

const STATUS_META: Record<Activity['status'], { label: string; icon: string; color: string }> = {
  available: { label: 'Available', icon: 'circle-play', color: colors.primary },
  in_progress: { label: 'In progress', icon: 'person-running', color: colors.warn },
  completed: { label: 'Completed', icon: 'circle-check', color: colors.success },
  claimable: { label: 'Reward ready', icon: 'gift', color: colors.success },
  locked: { label: 'Locked', icon: 'lock', color: colors.textFaint },
  cooldown: { label: 'On cooldown', icon: 'clock', color: colors.textFaint },
};

export default function AchievementsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const nav = useNavigation<Nav>();
  const [category, setCategory] = useState<ActivityCategory | 'ALL'>('ALL');

  const hub = useQuery(api.activities.getActivitiesHub, userId ? { userId } : 'skip');
  const dashboard = useQuery(api.profile.smartDashboard, userId ? { userId } : 'skip');

  if (!hub) {
    return (
      <View style={[styles.container, dark && styles.containerDark]}>
        <PageHeader title="Achievements" subtitle="Complete activities and earn rewards" back />
        <View style={styles.center}>
          <Text style={styles.loading}>Loading…</Text>
        </View>
      </View>
    );
  }

  const d = hub as ActivitiesHubData;
  const acts = buildActivities(d);
  const summary = hubSummary(d, acts);
  const earnings = activityEarnings(d);
  const filtered =
    category === 'ALL' ? acts : acts.filter((a) => a.category === category);
  const pct = summary.totalToday > 0 ? Math.round((summary.doneToday / summary.totalToday) * 100) : 0;

  const go = (a: Activity) => {
    if (!userId) return;
    switch (a.route) {
      case 'Spin':
        nav.navigate('Spin', { userId });
        break;
      case 'Tasks':
        nav.navigate('MainTabs', { screen: 'Tasks' });
        break;
      case 'Academy':
        nav.navigate('Academy', { userId, ecosystem: 'PI' });
        break;
      case 'Surveys':
        nav.navigate('Surveys', { userId });
        break;
      case 'Quiz':
        nav.navigate('Quiz', { userId, ecosystem: 'SIDRA' });
        break;
      case 'Home':
        nav.navigate('MainTabs', { screen: 'Home' });
        break;
    }
  };

  const smart = (dashboard ?? null) as SmartDashboard | null;
  const lvl = smart ? levelInfo(smart.stats.totalEarned) : null;
  const all = smart ? achievements(smart) : [];
  const unlocked = all.filter((a) => a.unlocked).length;
  const next = all.find((a) => !a.unlocked);

  const header = (
    <>
      <View style={[styles.progressCard, dark && styles.cardDark]}>
        <View style={styles.progressTop}>
          <Text style={[styles.progressTitle, dark && styles.textLight]}>Today's Progress</Text>
          <Text style={styles.progressCount}>
            {summary.doneToday} / {summary.totalToday} completed
          </Text>
        </View>
        <View style={[styles.todayTrack, dark && styles.trackDark]}>
          <View style={[styles.todayFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.progressBottom}>
          <Text style={styles.progressEarned}>+{formatPts(summary.todayEarned)} PTS earned today</Text>
          <Text style={styles.progressRemaining}>
            {summary.remainingToday} remaining
          </Text>
        </View>
      </View>

      {Boolean(summary.availableCount > 0 || summary.claimableCount > 0) ? (
        <View style={styles.alertRow}>
          {Boolean(summary.availableCount > 0) ? (
            <View style={[styles.alertChip, { backgroundColor: colors.primarySoft }]}>
              <Text style={styles.alertEmoji}>🔥</Text>
              <Text style={styles.alertText}>
                {summary.availableCount} available now
              </Text>
            </View>
          ) : null}
          {Boolean(summary.claimableCount > 0) ? (
            <View style={[styles.alertChip, { backgroundColor: colors.successSoft }]}>
              <Text style={styles.alertEmoji}>🎁</Text>
              <Text style={styles.alertText}>
                {summary.claimableCount} reward{summary.claimableCount === 1 ? '' : 's'} ready
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {Boolean(earnings.length > 0) ? (
        <View style={[styles.earningsCard, dark && styles.cardDark]}>
          <Text style={[styles.sectionLabel, dark && styles.textLight]}>Today's Earnings</Text>
          {earnings.map((e) => (
            <View key={e.id} style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>{e.label}</Text>
              <Text style={[styles.earningsValue, { color: colors.success }]}>
                +{e.points} PTS
              </Text>
            </View>
          ))}
          <View style={styles.earningsDivider} />
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsTotalLabel, dark && styles.textLight]}>Total</Text>
            <Text style={[styles.earningsTotalValue, { color: colors.success }]}>
              +{formatPts(summary.todayEarned)} PTS
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, dark && styles.textLight]}>Activities</Text>
      <View style={styles.filterRow}>
        {ACTIVITY_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => setCategory(c.key)}
              activeOpacity={0.8}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const footer = smart ? (
    <>
      <Text style={[styles.sectionTitle, dark && styles.textLight]}>Level & Badges</Text>
      <View style={[styles.levelCard, dark && styles.cardDark]}>
        <View style={[styles.levelRing, { borderColor: colors.primary }]}>
          <Text style={[styles.levelNum, dark && styles.textLight]}>{lvl!.level}</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={[styles.levelTitle, dark && styles.textLight]}>
            Level {lvl!.level} · {lvl!.title}
          </Text>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${Math.round(lvl!.progress * 100)}%` }]} />
          </View>
          <Text style={styles.xpText}>
            {formatPts(smart.stats.totalEarned)} XP lifetime · {formatPts(lvl!.next - lvl!.xp)} to Level {lvl!.level + 1}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, dark && styles.cardDark]}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{unlocked}</Text>
          <Text style={styles.summaryLabel}>Unlocked</Text>
        </View>
        <View style={[styles.summaryBox, dark && styles.cardDark]}>
          <Text style={[styles.summaryValue, { color: colors.textFaint }]}>{all.length - unlocked}</Text>
          <Text style={styles.summaryLabel}>Locked</Text>
        </View>
      </View>

      {next ? (
        <View style={[styles.nextCard, dark && styles.cardDark]}>
          <View style={[styles.achvIcon, { backgroundColor: next.tint + '1F' }]}>
            <Icon name={next.icon} iconStyle="solid" size={18} color={next.tint} />
          </View>
          <View style={styles.nextContent}>
            <Text style={[styles.nextLabel, dark && styles.textLight]}>Next badge</Text>
            <Text style={styles.nextTitle}>{next.title}</Text>
            <Text style={styles.nextDesc}>{next.desc}</Text>
            <View style={styles.achvBar}>
              <View style={[styles.achvFill, { width: `${Math.round(next.progress * 100)}%`, backgroundColor: next.tint }]} />
            </View>
            <Text style={styles.achvCount}>
              {formatPts(next.current)} / {formatPts(next.target)}
            </Text>
          </View>
        </View>
      ) : null}

      {all.map((item) => {
        const locked = !item.unlocked;
        return (
          <View key={item.id} style={[styles.achvRow, dark && styles.cardDark, locked && styles.achvRowLocked]}>
            <View
              style={[
                styles.achvIcon,
                { backgroundColor: item.unlocked ? item.tint + '1F' : colors.surfaceAlt },
              ]}>
              <Icon
                name={item.icon}
                iconStyle="solid"
                size={18}
                color={item.unlocked ? item.tint : colors.textFaint}
              />
            </View>
            <View style={styles.achvContent}>
              <Text style={[styles.achvTitle, dark && styles.textLight, locked && styles.achvTitleLocked]}>
                {item.title}
              </Text>
              <Text style={styles.achvDesc}>{item.desc}</Text>
              <View style={styles.achvBar}>
                <View
                  style={[
                    styles.achvFill,
                    {
                      width: `${Math.round(item.progress * 100)}%`,
                      backgroundColor: item.unlocked ? item.tint : colors.textFaint,
                    },
                  ]}
                />
              </View>
              <Text style={styles.achvCount}>
                {formatPts(item.current)} / {formatPts(item.target)}
                {item.unlocked ? ' · Unlocked' : ''}
              </Text>
            </View>
            {Boolean(item.unlocked) ? (
              <Icon name="circle-check" iconStyle="solid" size={18} color={colors.success} />
            ) : null}
          </View>
        );
      })}
    </>
  ) : null;

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Achievements"
        subtitle="Complete activities and earn rewards"
        back
      />
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No activities in this category.</Text>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status];
          const done = item.status === 'completed';
          return (
            <TouchableOpacity
              style={[styles.card, dark && styles.cardDark]}
              onPress={() => go(item)}
              activeOpacity={0.88}>
              <View style={[styles.cardIconBox, { backgroundColor: item.tint + '22' }]}>
                <Icon name={item.icon} iconStyle="solid" size={20} color={item.tint} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, dark && styles.textLight]}>{item.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: meta.color + '1F' }]}>
                    <Icon name={meta.icon} iconStyle="solid" size={10} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                <Text style={styles.cardStatus}>{item.statusLabel}</Text>
                <View style={[styles.cardTrack, dark && styles.trackDark]}>
                  <View
                    style={[
                      styles.cardFill,
                      { width: `${Math.round(item.progress * 100)}%`, backgroundColor: item.tint },
                    ]}
                  />
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardReward}>{item.rewardLabel}</Text>
                  <View style={[styles.cardBtn, done && styles.cardBtnDone]}>
                    <Text style={[styles.cardBtnText, done && styles.cardBtnTextDone]}>
                      {item.buttonLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 14, color: colors.textMuted },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  emptyText: { textAlign: 'center', color: colors.textMuted, paddingVertical: 24, fontSize: 13 },

  // ---- Today's progress ----
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 12,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  progressCount: { fontSize: 12, fontWeight: '800', color: colors.primary },
  todayTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 12,
    overflow: 'hidden',
  },
  trackDark: { backgroundColor: colors.surfaceAltDark },
  todayFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  progressBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressEarned: { fontSize: 12, fontWeight: '700', color: colors.success },
  progressRemaining: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // ---- Status alert chips ----
  alertRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  alertEmoji: { fontSize: 13 },
  alertText: { fontSize: 12, fontWeight: '800', color: colors.text },

  // ---- Today's earnings ----
  earningsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  earningsLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  earningsValue: { fontSize: 13, fontWeight: '800' },
  earningsDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  earningsTotalLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  earningsTotalValue: { fontSize: 14, fontWeight: '900' },

  // ---- Category filter ----
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filterChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  filterTextActive: { color: colors.white },

  // ---- Activity cards ----
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    ...shadow.card,
  },
  cardIconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardStatus: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep, marginTop: 4 },
  cardTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 8,
    overflow: 'hidden',
  },
  cardFill: { height: '100%', borderRadius: radius.pill },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cardReward: { fontSize: 12, fontWeight: '800', color: colors.success, flex: 1 },
  cardBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...shadow.raised,
  },
  cardBtnDone: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  cardBtnText: { color: colors.white, fontWeight: '800', fontSize: 12.5 },
  cardBtnTextDone: { color: colors.textFaint },

  // ---- Badges / level footer ----
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 20,
    marginBottom: 14,
  },
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  levelRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  levelNum: { fontSize: 26, fontWeight: '900', color: colors.primaryDeep },
  levelInfo: { flex: 1 },
  levelTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  xpBar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginTop: 10, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  xpText: { fontSize: 11, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow.card,
  },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 3 },
  nextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    ...shadow.card,
  },
  achvIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  nextContent: { flex: 1 },
  nextLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nextTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  nextDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  achvBar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, marginTop: 10, overflow: 'hidden' },
  achvFill: { height: '100%', borderRadius: 3 },
  achvCount: { fontSize: 10, color: colors.textMuted, marginTop: 5, fontWeight: '600' },
  achvRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    ...shadow.card,
  },
  achvRowLocked: { opacity: 0.75 },
  achvContent: { flex: 1 },
  achvTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  achvTitleLocked: { color: colors.textMuted },
  achvDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
