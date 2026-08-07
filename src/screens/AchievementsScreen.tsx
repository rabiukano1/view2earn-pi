import React from 'react';
import { FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { achievements, levelInfo, formatPts, type SmartDashboard } from '../profile/smart';

export default function AchievementsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const data = useQuery(api.profile.smartDashboard, userId ? { userId } : 'skip');

  if (!data) {
    return (
      <View style={[styles.container, dark && styles.containerDark]}>
        <PageHeader title="Achievements" subtitle="Your badges and level" back />
        <View style={styles.center}>
          <Text style={styles.loading}>Loading…</Text>
        </View>
      </View>
    );
  }

  const d = data as SmartDashboard;
  const lvl = levelInfo(d.stats.totalEarned);
  const unlocked = achievements(d).filter((a) => a.unlocked).length;
  const all = achievements(d);
  const next = all.find((a) => !a.unlocked);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Achievements" subtitle="Level up and unlock badges" back />
      <FlatList
        data={all}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <>
            <View style={[styles.levelCard, dark && styles.cardDark]}>
              <View style={[styles.levelRing, { borderColor: colors.primary }]}>
                <Text style={[styles.levelNum, dark && styles.textLight]}>{lvl.level}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={[styles.levelTitle, dark && styles.textLight]}>
                  Level {lvl.level} · {lvl.title}
                </Text>
                <View style={styles.xpBar}>
                  <View style={[styles.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} />
                </View>
                <Text style={styles.xpText}>
                  {formatPts(d.stats.totalEarned)} XP lifetime · {formatPts(lvl.next - lvl.xp)} to Level {lvl.level + 1}
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
          </>
        }
        renderItem={({ item }) => {
          const locked = !item.unlocked;
          return (
            <View style={[styles.achvRow, dark && styles.cardDark, locked && styles.achvRowLocked]}>
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
              {item.unlocked && <Icon name="circle-check" iconStyle="solid" size={18} color={colors.success} />}
            </View>
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
  cardDark: { backgroundColor: colors.surfaceDark },
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
    marginBottom: 20,
    ...shadow.card,
  },
  achvIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  nextContent: { flex: 1 },
  nextLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
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
