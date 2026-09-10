import React from 'react';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { formatPts } from '../profile/smart';

const KIND_META: Record<string, { label: string; icon: string; tint: string }> = {
  task: { label: 'Tasks', icon: 'list-check', tint: '#3B82F6' },
  quiz: { label: 'Quiz', icon: 'brain', tint: '#06B6D4' },
  bonus: { label: 'Bonuses', icon: 'gift', tint: '#10B981' },
  redeem: { label: 'Campaigns & Boosts', icon: 'bullhorn', tint: '#8B5CF6' },
  other: { label: 'Other', icon: 'circle', tint: '#71717A' },
};

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StatsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const activity = useQuery(api.reports.myActivity, userId ? { userId } : 'skip');

  if (!activity) {
    return (
      <View style={[styles.container, dark && styles.containerDark]}>
        <PageHeader title="Stats & Analytics" subtitle="Your earning dashboard" back />
        <View style={styles.center}>
          <Text style={styles.loading}>Loading…</Text>
        </View>
      </View>
    );
  }

  const { stats, rows } = activity;

  const byKind = rows.reduce<Record<string, { earned: number; spent: number; count: number }>>(
    (acc, r) => {
      const k = acc[r.kind] ?? { earned: 0, spent: 0, count: 0 };
      if (r.delta > 0) k.earned += r.delta;
      else k.spent += -r.delta;
      k.count += 1;
      acc[r.kind] = k;
      return acc;
    },
    {},
  );
  const kinds = (Object.keys(byKind) as string[]).sort(
    (a, b) => byKind[b].earned + byKind[b].spent - (byKind[a].earned + byKind[a].spent),
  );

  // Last 7 days of earnings (from most recent ~200 ledger rows).
  const days: { label: string; earned: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const start = day.getTime();
    const end = start + 86400000;
    const earned = rows
      .filter((r) => r.time >= start && r.time < end && r.delta > 0)
      .reduce((s, r) => s + r.delta, 0);
    days.push({ label: fmtDate(start), earned });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.earned));

  const kpis = [
    { label: 'Balance', value: stats.balance, icon: 'coins', tint: colors.primary },
    { label: 'Total Earned', value: stats.totalEarned, icon: 'trending-up', tint: colors.success },
    { label: 'Total Spent', value: stats.totalSpent, icon: 'arrow-right-from-bracket', tint: colors.danger },
    { label: 'Tasks Done', value: stats.tasksCompleted, icon: 'list-check', tint: '#3B82F6' },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Stats & Analytics" subtitle="Your earning dashboard" back />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.kpiRow}>
          {kpis.slice(0, 2).map((k) => (
            <View key={k.label} style={[styles.kpiBox, dark && styles.cardDark]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.tint + '1F' }]}>
                <Icon name={k.icon} iconStyle="solid" size={16} color={k.tint} />
              </View>
              <Text style={[styles.kpiValue, { color: k.tint }]}>{formatPts(k.value)}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.kpiRow}>
          {kpis.slice(2).map((k) => (
            <View key={k.label} style={[styles.kpiBox, dark && styles.cardDark]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.tint + '1F' }]}>
                <Icon name={k.icon} iconStyle="solid" size={16} color={k.tint} />
              </View>
              <Text style={[styles.kpiValue, { color: k.tint }]}>{formatPts(k.value)}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, dark && styles.textLight]}>Earnings · last 7 days</Text>
        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.barChart}>
            {days.map((d, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${Math.max(4, Math.round((d.earned / maxDay) * 100))}%` },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{d.earned}</Text>
                <Text style={styles.barDay}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, dark && styles.textLight]}>Breakdown by activity</Text>
        <View style={[styles.card, dark && styles.cardDark]}>
          {kinds.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet — complete tasks to earn points.</Text>
          ) : (
            kinds.map((k) => {
              const meta = KIND_META[k] ?? KIND_META.other;
              const { earned, count } = byKind[k];
              return (
                <View key={k} style={styles.kindRow}>
                  <View style={[styles.kindIcon, { backgroundColor: meta.tint + '1F' }]}>
                    <Icon name={meta.icon} iconStyle="solid" size={14} color={meta.tint} />
                  </View>
                  <View style={styles.kindInfo}>
                    <Text style={[styles.kindLabel, dark && styles.textLight]}>{meta.label}</Text>
                    <Text style={styles.kindCount}>
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                  <Text style={[styles.kindEarned, { color: colors.success }]}>+{formatPts(earned)}</Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionTitle, dark && styles.textLight]}>Recent activity</Text>
        <View style={[styles.card, dark && styles.cardDark]}>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet.</Text>
          ) : (
            rows.slice(0, 6).map((r, i) => {
              const meta = KIND_META[r.kind] ?? KIND_META.other;
              return (
                <View key={i} style={[styles.activityRow, i > 0 && styles.activityRowBorder]}>
                  <View style={[styles.kindIcon, { backgroundColor: meta.tint + '1F' }]}>
                    <Icon name={meta.icon} iconStyle="solid" size={12} color={meta.tint} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, dark && styles.textLight]}>{r.label}</Text>
                    <Text style={styles.activityDetail} numberOfLines={1}>
                      {r.detail || fmtDate(r.time)}
                    </Text>
                  </View>
                  <Text style={[styles.activityDelta, { color: r.delta >= 0 ? colors.success : colors.danger }]}>
                    {r.delta >= 0 ? '+' : ''}
                    {r.delta}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 14, color: colors.textMuted },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 16, ...shadow.card },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 70, backgroundColor: colors.surfaceAlt, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: colors.primary, borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  barDay: { fontSize: 8, color: colors.textFaint, marginTop: 1 },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  kindIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kindInfo: { flex: 1 },
  kindLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  kindCount: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  kindEarned: { fontSize: 14, fontWeight: '800' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  activityDetail: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  activityDelta: { fontSize: 13, fontWeight: '800' },
});
