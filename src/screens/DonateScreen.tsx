import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, shadow, spacing } from '../theme';
import { openInPiBrowser } from '../lib/openUrl';

const PI_APP_DONATE_URL = 'https://view2earn-pi.pages.dev/donate';

type PointPreset = {
  pts: number;
  label: string;
  badge: string;
  icon: string;
  color: string;
};

const PRESETS: PointPreset[] = [
  { pts: 50, label: 'Sprout', badge: 'Supporter', icon: 'seedling', color: '#10B981' },
  { pts: 100, label: 'Booster', badge: 'Popular', icon: 'bolt', color: '#3B82F6' },
  { pts: 250, label: 'Champion', badge: 'Hero', icon: 'rocket', color: '#8B5CF6' },
  { pts: 500, label: 'Legend', badge: 'VIP', icon: 'crown', color: '#F59E0B' },
  { pts: 1000, label: 'Patron', badge: 'Diamond', icon: 'gem', color: '#EC4899' },
];

export default function DonateScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  // Queries
  const userBalance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const poolStats = useQuery((api as any).pointDonations?.getCommunityPoolStats) ?? { totalPoints: 0, totalDonors: 0, totalCount: 0 };
  const topPointDonors = useQuery((api as any).pointDonations?.listTopDonors);
  const myPointDonations = useQuery(
    (api as any).pointDonations?.listMyDonations,
    userId ? { userId: userId as any } : 'skip'
  );

  // Pi queries
  const topPiDonors = useQuery(api.piDonations.listTopDonors);

  // Mutation
  const donatePointsMutation = useMutation((api as any).pointDonations?.donatePoints);

  // State
  const [activeTab, setActiveTab] = useState<'points' | 'pi'>('points');
  const [selectedPreset, setSelectedPreset] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const balance = userBalance ?? 0;
  const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedPreset;
  const hasEnough = balance >= effectiveAmount && effectiveAmount > 0;

  const handleSelectPreset = (pts: number) => {
    setSelectedPreset(pts);
    setCustomAmount('');
  };

  const handleCustomChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) {
      setSelectedPreset(0);
    }
  };

  const handleDonatePoints = async () => {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to donate points.');
      return;
    }
    if (effectiveAmount < 10) {
      Alert.alert('Minimum Donation', 'The minimum donation is 10 points.');
      return;
    }
    if (effectiveAmount > balance) {
      Alert.alert('Insufficient Balance', `You currently have ${balance.toLocaleString()} points.`);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    try {
      if (donatePointsMutation) {
        await donatePointsMutation({
          userId: userId as any,
          points: effectiveAmount,
          memo: memo.trim() || undefined,
        });
      }
      setSuccessMessage(`Thank you! You contributed ${effectiveAmount.toLocaleString()} points to the Community Pool.`);
      setMemo('');
      if (customAmount) setCustomAmount('');
    } catch (err: any) {
      Alert.alert('Donation Error', err?.message || 'Could not process point donation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPiBrowser = async () => {
    await openInPiBrowser(PI_APP_DONATE_URL);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader
        title="Community Pool"
        subtitle="Support creators & platform growth"
        back
        right={
          <View style={[styles.balancePill, dark && styles.balancePillDark]}>
            <Icon name="coins" iconStyle="solid" size={13} color="#F59E0B" />
            <Text style={[styles.balanceText, dark && styles.textLight]}>
              {userBalance === undefined ? '…' : balance.toLocaleString()} PTS
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Hero Pool Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBg}>
              <Icon name="hands-holding-circle" iconStyle="solid" size={24} color="#FFF" />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Community Growth Pool</Text>
              <Text style={styles.heroSub}>
                Empower creators, fund task rewards, and boost ecosystem activities.
              </Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {poolStats.totalPoints ? poolStats.totalPoints.toLocaleString() : '0'}
              </Text>
              <Text style={styles.statLabel}>Points Donated</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{poolStats.totalDonors || 0}</Text>
              <Text style={styles.statLabel}>Supporters</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{poolStats.totalCount || 0}</Text>
              <Text style={styles.statLabel}>Contributions</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, dark && styles.tabBarDark]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'points' && styles.tabBtnActive]}
            onPress={() => setActiveTab('points')}>
            <Icon
              name="star"
              iconStyle="solid"
              size={14}
              color={activeTab === 'points' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'points' && styles.tabBtnTextActive,
                dark && styles.textLight,
              ]}>
              Donate Points
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'pi' && styles.tabBtnActive]}
            onPress={() => setActiveTab('pi')}>
            <Icon
              name="globe"
              iconStyle="solid"
              size={14}
              color={activeTab === 'pi' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'pi' && styles.tabBtnTextActive,
                dark && styles.textLight,
              ]}>
              Pi Network SDK
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'points' ? (
          <>
            {/* Success Feedback Alert */}
            {successMessage && (
              <View style={styles.successBox}>
                <Icon name="circle-check" iconStyle="solid" size={18} color="#10B981" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Presets Selection */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Select Contribution</Text>
              <Text style={styles.sectionHint}>Instant in-app donation</Text>
            </View>

            <View style={styles.presetGrid}>
              {PRESETS.map((p) => {
                const isSelected = selectedPreset === p.pts && !customAmount;
                return (
                  <TouchableOpacity
                    key={p.pts}
                    style={[
                      styles.presetCard,
                      dark && styles.presetCardDark,
                      isSelected && { borderColor: p.color, backgroundColor: p.color + '18' },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectPreset(p.pts)}>
                    <View style={[styles.badgeTag, { backgroundColor: p.color + '25' }]}>
                      <Text style={[styles.badgeTagText, { color: p.color }]}>{p.badge}</Text>
                    </View>
                    <Icon name={p.icon} iconStyle="solid" size={20} color={p.color} />
                    <Text style={[styles.presetPts, dark && styles.textLight]}>
                      {p.pts.toLocaleString()}
                    </Text>
                    <Text style={styles.presetLabel}>PTS</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Amount & Memo */}
            <View style={[styles.card, dark && styles.cardDark]}>
              <Text style={[styles.inputLabel, dark && styles.textLight]}>Or Enter Custom Points</Text>
              <View style={[styles.inputRow, dark && styles.inputRowDark]}>
                <Icon name="coins" iconStyle="solid" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, dark && styles.textInputDark]}
                  placeholder="e.g. 300"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={handleCustomChange}
                  maxLength={7}
                />
                <Text style={styles.inputSuffix}>PTS</Text>
              </View>

              <Text style={[styles.inputLabel, { marginTop: spacing.sm }, dark && styles.textLight]}>
                Add a Supporter Note (Optional)
              </Text>
              <TextInput
                style={[styles.noteInput, dark && styles.inputRowDark, dark && styles.textInputDark]}
                placeholder="Leave a short note for the community..."
                placeholderTextColor={colors.textFaint}
                value={memo}
                onChangeText={setMemo}
                maxLength={80}
              />

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.donateBtn,
                  (!hasEnough || isSubmitting) && styles.donateBtnDisabled,
                ]}
                activeOpacity={0.85}
                disabled={!hasEnough || isSubmitting}
                onPress={handleDonatePoints}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Icon name="heart" iconStyle="solid" size={16} color="#FFF" />
                    <Text style={styles.donateBtnText}>
                      Donate {effectiveAmount > 0 ? `${effectiveAmount.toLocaleString()} PTS` : 'Points'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Top Donors Leaderboard */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>🏆 Top Community Donors</Text>
            </View>
            <View style={[styles.card, dark && styles.cardDark]}>
              {topPointDonors === undefined ? (
                <Text style={styles.mutedText}>Loading contributors…</Text>
              ) : topPointDonors.length === 0 ? (
                <Text style={styles.mutedText}>No point donations yet. Be the first to contribute!</Text>
              ) : (
                topPointDonors.map((donor: any, idx: number) => (
                  <View key={donor.userId} style={styles.donorRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        {
                          backgroundColor:
                            idx === 0
                              ? '#F59E0B'
                              : idx === 1
                              ? '#94A3B8'
                              : idx === 2
                              ? '#D97706'
                              : 'rgba(150,150,150,0.15)',
                        },
                      ]}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.donorInfo}>
                      <Text style={[styles.donorName, dark && styles.textLight]}>
                        {donor.displayName}
                      </Text>
                      <Text style={styles.donorMeta}>
                        {donor.count} contribution{donor.count > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.donorPts}>{donor.totalPoints.toLocaleString()} PTS</Text>
                  </View>
                ))
              )}
            </View>

            {/* My Donation History */}
            {userId && myPointDonations && myPointDonations.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, dark && styles.textLight]}>My Contribution History</Text>
                </View>
                <View style={[styles.card, dark && styles.cardDark]}>
                  {myPointDonations.map((item: any) => (
                    <View key={item._id} style={styles.historyRow}>
                      <View style={styles.historyLeft}>
                        <Text style={[styles.historyMemo, dark && styles.textLight]}>
                          {item.memo}
                        </Text>
                        <Text style={styles.donorMeta}>
                          {new Date(item._creationTime).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.historyAmount}>-{item.points.toLocaleString()} PTS</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          /* Pi Network Section */
          <>
            <View style={[styles.card, dark && styles.cardDark]}>
              <View style={styles.piHeaderRow}>
                <View style={[styles.piIconBg, { backgroundColor: '#FBBF2420' }]}>
                  <Icon name="globe" iconStyle="solid" size={24} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.piTitle, dark && styles.textLight]}>Pi Browser U2A SDK</Text>
                  <Text style={styles.piSub}>Test live Pi Network payment flows inside Pi Browser</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.piActionBtn}
                activeOpacity={0.88}
                onPress={handleOpenPiBrowser}>
                <Icon name="compass" iconStyle="solid" size={18} color="#FFF" />
                <Text style={styles.piActionBtnText}>Launch in Pi Browser</Text>
              </TouchableOpacity>
            </View>

            {/* Top Pi Donors */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>π Donors Leaderboard</Text>
            </View>
            <View style={[styles.card, dark && styles.cardDark]}>
              {topPiDonors === undefined ? (
                <Text style={styles.mutedText}>Loading Pi donors…</Text>
              ) : topPiDonors.length === 0 ? (
                <Text style={styles.mutedText}>No Pi donations recorded yet.</Text>
              ) : (
                topPiDonors.map((donor, idx) => (
                  <View key={donor.userId} style={styles.donorRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        {
                          backgroundColor:
                            idx === 0
                              ? '#F59E0B'
                              : idx === 1
                              ? '#94A3B8'
                              : idx === 2
                              ? '#D97706'
                              : 'rgba(150,150,150,0.15)',
                        },
                      ]}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.donorInfo}>
                      <Text style={[styles.donorName, dark && styles.textLight]}>
                        {donor.displayName}
                      </Text>
                      <Text style={styles.donorMeta}>{donor.count} contributions</Text>
                    </View>
                    <Text style={styles.donorPi}>{donor.totalPi} π</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },

  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  balancePillDark: {
    backgroundColor: colors.surfaceAltDark,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },

  heroCard: {
    backgroundColor: '#7C3AED',
    borderRadius: radius.xl,
    padding: 18,
    gap: 16,
    overflow: 'hidden',
    ...shadow.raised,
  },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: { flex: 1, marginLeft: 14 },
  heroTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  heroSub: { fontSize: 12, color: '#EDE9FE', marginTop: 3, lineHeight: 17 },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#DDD6FE', marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.18)' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    ...shadow.card,
  },
  tabBarDark: { backgroundColor: colors.surfaceDark },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  tabBtnActive: {
    backgroundColor: colors.primarySoft,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    color: colors.primaryDeep,
    fontWeight: '800',
  },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    padding: 14,
    borderRadius: radius.md,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    gap: 4,
    ...shadow.card,
  },
  presetCardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  badgeTagText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  presetPts: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  inputRowDark: {
    backgroundColor: colors.surfaceAltDark,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  textInputDark: {
    color: colors.textDark,
  },
  inputSuffix: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  noteInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    minHeight: 44,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: 4,
    ...shadow.raised,
  },
  donateBtnDisabled: {
    opacity: 0.5,
  },
  donateBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
  },

  mutedText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  donorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 12, fontWeight: '900', color: '#FFF' },
  donorInfo: { flex: 1 },
  donorName: { fontSize: 14, fontWeight: '800', color: colors.text },
  donorMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  donorPts: { fontSize: 14, fontWeight: '900', color: colors.primary },
  donorPi: { fontSize: 14, fontWeight: '900', color: '#10B981' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyLeft: { flex: 1 },
  historyMemo: { fontSize: 13, fontWeight: '800', color: colors.text },
  historyAmount: { fontSize: 14, fontWeight: '900', color: colors.primary },

  piHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  piIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  piSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  piActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: radius.pill,
    ...shadow.raised,
  },
  piActionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  textLight: { color: colors.textDark },
});
