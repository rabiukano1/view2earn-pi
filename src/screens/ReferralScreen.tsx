import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { POINTS, REFERRAL_QUALIFICATION_TASKS } from '@view2earn/core';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';

export default function ReferralScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const referral = useQuery(api.rewards.myReferral, userId ? { userId } : 'skip');

  const share = () => {
    if (!referral?.code) return;
    Share.share({
      message: `Join View2Earn and earn rewards! Use my referral code: ${referral.code}\n\nDownload now and start earning.`,
    });
  };

  const steps = [
    { icon: 'share-nodes', title: 'Share your code', body: 'Send friends your unique referral code.' },
    {
      icon: 'list-check',
      title: 'They complete tasks',
      body: `Each friend must finish ${REFERRAL_QUALIFICATION_TASKS} tasks to qualify.`,
    },
    {
      icon: 'coins',
      title: 'You both earn',
      body: `You get ${POINTS.REFERRAL_QUALIFIED} pts, they get a ${POINTS.REFERRAL_REFEREE_BONUS} pts bonus.`,
    },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Referral Program" subtitle="Invite friends and earn points together" back />
      <View
        style={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={[styles.bannerCard, dark && styles.cardDark]}>
          <View style={styles.bannerGlow} />
          <Text style={styles.bannerTitle}>Invite & Earn Together</Text>
          <Text style={styles.bannerSub}>
            Earn {POINTS.REFERRAL_QUALIFIED} pts when friends complete {REFERRAL_QUALIFICATION_TASKS} tasks. Your
            friend gets {POINTS.REFERRAL_REFEREE_BONUS} pts bonus!
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <Text style={styles.codeText}>{referral?.code ?? '…'}</Text>
          <Text style={styles.codeHint}>
            {referral?.count ?? 0} invited · {referral?.qualifiedCount ?? 0} qualified
          </Text>
          <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
            <Icon name="paper-plane" iconStyle="solid" size={14} color={colors.white} />
            <Text style={styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, dark && styles.cardDark]}>
            <Text style={[styles.statValue, dark && styles.textLight]}>{referral?.count ?? 0}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={[styles.statBox, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {referral?.qualifiedCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Qualified</Text>
          </View>
          <View style={[styles.statBox, dark && styles.cardDark]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {referral?.totalEarned ?? 0}
            </Text>
            <Text style={styles.statLabel}>Pts Earned</Text>
          </View>
        </View>

        {referral?.referredBy ? (
          <View style={[styles.referredByBox, dark && styles.cardDark]}>
            <Icon name="user-check" iconStyle="solid" size={12} color={colors.success} />
            <Text style={styles.referredByText}>Referred by {referral.referredBy}</Text>
          </View>
        ) : null}

        <Text style={[styles.stepsTitle, dark && styles.textLight]}>How it works</Text>
        {steps.map((s, i) => (
          <View key={i} style={[styles.stepRow, dark && styles.cardDark]}>
            <View style={[styles.stepNum, { backgroundColor: colors.primary + '1F' }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.stepIconWrap}>
              <Icon name={s.icon} iconStyle="solid" size={16} color={colors.primary} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, dark && styles.textLight]}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  bannerCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    ...shadow.raised,
  },
  bannerGlow: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: colors.white, marginBottom: 6 },
  bannerSub: { fontSize: 13, color: '#DDD6FE', lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  codeText: { fontSize: 26, fontWeight: '900', color: colors.primary, letterSpacing: 4 },
  codeHint: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 14,
    alignSelf: 'stretch',
    ...shadow.raised,
  },
  shareBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 3 },
  referredByBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: 20,
    ...shadow.card,
  },
  referredByText: { fontSize: 12, fontWeight: '700', color: colors.success },
  stepsTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...shadow.card,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '900', color: colors.primary },
  stepIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  stepBody: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
});
