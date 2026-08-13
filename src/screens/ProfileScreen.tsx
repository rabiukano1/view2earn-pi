import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { smartOpenUrl } from '../lib/openUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import {
  achievements,
  coachInsights,
  formatPts,
  levelInfo,
  smartScore,
  type CoachInsight,
  type SmartDashboard,
} from '../profile/smart';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function SectionHeader({ icon, tint, title }: { icon: string; tint: string; title: string }) {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionHeader}>
      <Icon name={icon} iconStyle="solid" size={15} color={tint} />
      <Text style={[styles.sectionTitle, dark && styles.textLight]}>{title}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const nav = useNavigation<Nav>();
  const data = useQuery(api.profile.smartDashboard, userId ? { userId } : 'skip');
  const generatePdf = useAction(api.reports.generatePdf);

  const handleDownloadReport = async () => {
    if (!userId) return;
    try {
      const result = await generatePdf({ userId });
      if (result?.url) await smartOpenUrl(result.url);
    } catch {
      // ignore — the report screen handles its own errors
    }
  };

  const d = (data ?? null) as SmartDashboard | null;
  const lvl = d ? levelInfo(d.stats.totalEarned) : null;
  const score = d ? smartScore(d) : null;
  const insights: CoachInsight[] = d ? coachInsights(d) : [];
  const achv = d ? achievements(d) : [];
  const unlocked = achv.filter((a) => a.unlocked);
  const locked = achv.filter((a) => !a.unlocked).slice(0, 3);

  const displayName = d?.user.name || d?.user.username || 'View2Earn Member';
  const displayContact = d?.user.telegramUserId ? `@${d.user.telegramUserId}` : '';
  const ecosystemTag = d?.user.ecosystem === 'PI' ? 'Pi Network' : 'Sidra Chain';

  const runCoachAction = (i: CoachInsight) => {
    if (!i.action) return;
    if (i.action === 'Home') nav.navigate('Home');
    else if (i.action === 'Tasks') nav.navigate('Tasks');
    else if (i.action === 'Spin') nav.navigate('Spin', { userId: userId! });
    else if (i.action === 'Quiz')
      nav.navigate('Quiz', { userId: userId!, ecosystem: d?.user.ecosystem ?? 'SIDRA' });
    else if (i.action === 'Rewards') nav.navigate('Rewards');
    else if (i.action === 'Referral') nav.navigate('Referral');
  };

  const menuTiles = [
    {
      icon: 'gift',
      tint: '#10B981',
      label: 'Referral Program',
      sub: `${d?.referral.count ?? 0} invited · ${d?.referral.qualifiedCount ?? 0} qualified`,
      onPress: () => nav.navigate('Referral'),
    },
    {
      icon: 'chart-simple',
      tint: '#3B82F6',
      label: 'Stats & Analytics',
      sub: 'Earnings, trends & breakdown',
      onPress: () => nav.navigate('Stats'),
    },
    {
      icon: 'medal',
      tint: '#F59E0B',
      label: 'Achievements',
      sub: lvl ? `Level ${lvl.level} · ${unlocked.length}/${achv.length} badges` : 'Levels & badges',
      onPress: () => nav.navigate('Achievements'),
    },
    {
      icon: 'link',
      tint: colors.primary,
      label: 'Linked Accounts',
      sub: 'Social profiles & Telegram',
      onPress: () => nav.navigate('LinkedAccounts'),
    },
    {
      icon: 'shield-halved',
      tint: '#EF4444',
      label: 'Security & Settings',
      sub: 'Biometric lock, policies & sign out',
      onPress: () => nav.navigate('Security'),
    },
    {
      icon: 'wallet',
      tint: '#627EEA',
      label: 'Payout Wallets',
      sub: 'EVM & Solana addresses',
      onPress: () => nav.navigate('PayoutSettings'),
    },
    {
      icon: 'clock-rotate-left',
      tint: colors.textMuted,
      label: 'Points History',
      sub: 'Full ledger records',
      onPress: () => nav.navigate('PointsHistory'),
    },
    {
      icon: 'heart',
      tint: '#EC4899',
      label: 'Donate π (Pi Browser)',
      sub: 'Support platform & test payments',
      onPress: () => nav.navigate('Donate'),
    },
    {
      icon: 'file-pdf',
      tint: '#EF4444',
      label: 'Download Report',
      sub: 'PDF activity report',
      onPress: handleDownloadReport,
    },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="My Profile" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}>
        {/* Smart bio header */}
        <View style={[styles.profileHeaderCard, dark && styles.cardDark]}>
          <View style={styles.headerRow}>
            <View style={styles.avatarGlowOuter}>
              <View style={styles.avatarInner}>
                <Icon name="user" iconStyle="solid" size={28} color={colors.white} />
              </View>
            </View>
            {lvl ? (
              <View style={[styles.levelBadge, { backgroundColor: colors.primarySoft }]}>
                <Icon name="bolt" iconStyle="solid" size={11} color={colors.primaryDeep} />
                <Text style={styles.levelBadgeText}>Lv {lvl.level} · {lvl.title}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.nameText, dark && styles.textLight]}>{displayName}</Text>
          {displayContact ? <Text style={styles.contactText}>{displayContact}</Text> : null}

          {lvl ? (
            <View style={styles.xpSection}>
              <View style={styles.xpBar}>
                <View style={[styles.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} />
              </View>
              <Text style={styles.xpText}>
                {formatPts(lvl.xp)} XP · {formatPts(lvl.next - lvl.xp)} to Level {lvl.level + 1}
              </Text>
            </View>
          ) : null}

          <View style={styles.badgesRow}>
            <View style={styles.ecoBadge}>
              <Icon name="cubes" iconStyle="solid" size={10} color={colors.primaryDeep} />
              <Text style={styles.ecoBadgeText}>{ecosystemTag}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Icon name="shield-halved" iconStyle="solid" size={10} color={colors.success} />
              <Text style={styles.tierBadgeText}>Verified Account</Text>
            </View>
          </View>
        </View>

        {/* Stats overview strip */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {d ? formatPts(d.stats.balance) : '…'}
            </Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
          <View style={[styles.statTile, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {d ? formatPts(d.stats.totalEarned) : '…'}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={[styles.statTile, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>
              {d ? formatPts(d.stats.tasksCompleted) : '…'}
            </Text>
            <Text style={styles.statLabel}>Tasks</Text>
          </View>
          <View style={[styles.statTile, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {d ? (d.rank.rank ? `#${d.rank.rank}` : '—') : '…'}
            </Text>
            <Text style={styles.statLabel}>Rank</Text>
          </View>
        </View>

        {/* Smart coach panel */}
        <View style={styles.sectionContainer}>
          <SectionHeader icon="wand-magic-sparkles" tint={colors.primary} title="Smart Coach" />
          <View style={[styles.coachCard, dark && styles.cardDark]}>
            {score ? (
              <View style={styles.scoreRow}>
                <View style={styles.scoreRing}>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>{score.score}</Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={[styles.scoreLabel, dark && styles.textLight]}>
                    Daily Smart Score · {score.label}
                  </Text>
                  <Text style={styles.scoreHint}>Based on today's activity so far</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.insightList}>
              {insights.map((i) => (
                <TouchableOpacity
                  key={i.id}
                  style={[styles.insightRow, i.action ? styles.insightRowActive : null]}
                  onPress={() => runCoachAction(i)}
                  disabled={!i.action}
                  activeOpacity={0.85}>
                  <View style={[styles.insightIcon, { backgroundColor: i.tint + '1F' }]}>
                    <Icon name={i.icon} iconStyle="solid" size={15} color={i.tint} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={[styles.insightTitle, dark && styles.textLight]}>{i.title}</Text>
                    <Text style={styles.insightBody}>{i.body}</Text>
                  </View>
                  {Boolean(i.action) ? (
                    <View style={[styles.insightArrow, { backgroundColor: i.tint + '1F' }]}>
                      <Icon name="arrow-right" iconStyle="solid" size={11} color={i.tint} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Achievements preview */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Icon name="medal" iconStyle="solid" size={15} color="#F59E0B" />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Achievements</Text>
            </View>
            <TouchableOpacity onPress={() => nav.navigate('Achievements')} activeOpacity={0.8}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.achvPreviewRow}>
            {unlocked.slice(0, 3).map((a) => (
              <View key={a.id} style={[styles.achvTile, dark && styles.cardDark]}>
                <View style={[styles.achvTileIcon, { backgroundColor: a.tint + '1F' }]}>
                  <Icon name={a.icon} iconStyle="solid" size={18} color={a.tint} />
                </View>
                <Text style={[styles.achvTileTitle, dark && styles.textLight]} numberOfLines={1}>
                  {a.title}
                </Text>
              </View>
            ))}
            {locked.map((a) => (
              <View key={a.id} style={[styles.achvTile, dark && styles.cardDark, styles.achvTileLocked]}>
                <View style={[styles.achvTileIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name="lock" iconStyle="solid" size={16} color={colors.textFaint} />
                </View>
                <Text style={styles.achvTileTitleLocked} numberOfLines={1}>
                  Locked
                </Text>
              </View>
            ))}
            {achv.length === 0 && (
              <Text style={styles.achvEmpty}>Complete tasks to unlock badges</Text>
            )}
          </View>
        </View>

        {/* Everything else lives in grouped screens */}
        <View style={styles.sectionContainer}>
          <SectionHeader icon="layer-group" tint={colors.textMuted} title="More" />
          <View style={styles.menuGrid}>
            {menuTiles.map((t) => (
              <TouchableOpacity
                key={t.label}
                style={[styles.menuTile, dark && styles.cardDark]}
                onPress={t.onPress}
                activeOpacity={0.8}>
                <View style={[styles.menuIconBg, { backgroundColor: t.tint + '1E' }]}>
                  <Icon name={t.icon} iconStyle="solid" size={18} color={t.tint} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuLabel, dark && styles.textLight]}>{t.label}</Text>
                  <Text style={styles.menuSub} numberOfLines={1}>
                    {t.sub}
                  </Text>
                </View>
                <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },

  profileHeaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarGlowOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  levelBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  levelBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primaryDeep },
  nameText: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  contactText: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
  xpSection: { width: '100%', marginTop: 12 },
  xpBar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  xpText: { fontSize: 11, color: colors.textMuted, marginTop: 5, fontWeight: '600', textAlign: 'center' },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  ecoBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryDeep },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    ...shadow.card,
  },
  statValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 2 },

  sectionContainer: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  seeAllText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  coachCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    ...shadow.card,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  scoreRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { fontSize: 20, fontWeight: '900' },
  scoreInfo: { flex: 1 },
  scoreLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  scoreHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  insightList: { gap: 10 },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  insightRowActive: { backgroundColor: colors.primarySoft },
  insightIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  insightBody: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  insightArrow: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  achvPreviewRow: { flexDirection: 'row', gap: 8 },
  achvTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    ...shadow.card,
  },
  achvTileLocked: { opacity: 0.7 },
  achvTileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  achvTileTitle: { fontSize: 11, fontWeight: '800', color: colors.text },
  achvTileTitleLocked: { fontSize: 11, fontWeight: '700', color: colors.textFaint },
  achvEmpty: { fontSize: 12, color: colors.textMuted, textAlign: 'center', flex: 1 },

  menuGrid: { gap: 10 },
  menuTile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow.card,
  },
  menuIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  menuSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
