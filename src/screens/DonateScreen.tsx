import React, { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';
import { smartOpenUrl } from '../lib/openUrl';

// ponytail: Pi Browser web app donation portal URL default fallback
const PI_APP_DONATE_URL = 'https://view2earn-pi.pages.dev/donate';

type Tier = {
  id: string;
  name: string;
  amount: number;
  bonusPts: number;
  icon: string;
  color: string;
};

const TIERS: Tier[] = [
  { id: 'supporter', name: 'Supporter', amount: 0.1, bonusPts: 50, icon: 'star', color: '#3B82F6' },
  { id: 'champion', name: 'Champion', amount: 1.0, bonusPts: 500, icon: 'rocket', color: '#8B5CF6' },
  { id: 'legend', name: 'Legend', amount: 5.0, bonusPts: 2500, icon: 'crown', color: '#EC4899' },
];

export default function DonateScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const topDonors = useQuery(api.piDonations.listTopDonors);
  const myDonations = useQuery(
    api.piDonations.listMyDonations,
    userId ? { userId: userId as any } : 'skip'
  );

  const [selectedTier, setSelectedTier] = useState<string>('champion');

  const handleOpenPiBrowser = async () => {
    await smartOpenUrl(PI_APP_DONATE_URL);
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Donate π" subtitle="Support View2Earn & Test Pi Payments" back />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBg}>
              <Icon name="heart" iconStyle="solid" size={24} color="#FFF" />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Support View2Earn Platform</Text>
              <Text style={styles.heroSub}>
                Test Pi Network U2A SDK payments directly inside the Pi Browser
              </Text>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <Icon name="bolt" iconStyle="solid" size={12} color="#FBBF24" />
            <Text style={styles.heroBadgeText}>Earn +500 Bonus Points per 1 π</Text>
          </View>
        </View>

        {/* Tier Cards */}
        <Text style={[styles.sectionTitle, dark && styles.textLight]}>Select Donation Tier</Text>
        <View style={styles.tierGrid}>
          {TIERS.map((tier) => {
            const isSelected = selectedTier === tier.id;
            return (
              <TouchableOpacity
                key={tier.id}
                style={[
                  styles.tierCard,
                  dark && styles.tierCardDark,
                  isSelected && { borderColor: tier.color, backgroundColor: tier.color + '15' },
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedTier(tier.id)}>
                <View style={styles.tierTop}>
                  <View style={[styles.tierIconBg, { backgroundColor: tier.color + '25' }]}>
                    <Icon name={tier.icon} iconStyle="solid" size={18} color={tier.color} />
                  </View>
                  <Text style={[styles.tierName, dark && styles.textLight]}>{tier.name}</Text>
                </View>
                <Text style={styles.tierAmount}>{tier.amount} π</Text>
                <Text style={styles.tierBonus}>+{tier.bonusPts} pts bonus</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.88}
          onPress={handleOpenPiBrowser}>
          <Icon name="compass" iconStyle="solid" size={18} color="#FFF" />
          <Text style={styles.actionBtnText}>Open in Pi Browser to Donate π</Text>
        </TouchableOpacity>

        {/* Top Donors Leaderboard */}
        <Text style={[styles.sectionTitle, dark && styles.textLight]}>🏆 Top Donors Leaderboard</Text>
        <View style={[styles.card, dark && styles.cardDark]}>
          {topDonors === undefined ? (
            <Text style={styles.mutedText}>Loading leaderboard…</Text>
          ) : topDonors.length === 0 ? (
            <Text style={styles.mutedText}>No donations yet! Be the first pioneer to donate.</Text>
          ) : (
            topDonors.map((donor, idx) => (
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
                    {donor.count} donation{donor.count > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.donorPi}>{donor.totalPi} π</Text>
              </View>
            ))
          )}
        </View>

        {/* My Donations */}
        {userId && (
          <>
            <Text style={[styles.sectionTitle, dark && styles.textLight]}>My Donation History</Text>
            <View style={[styles.card, dark && styles.cardDark]}>
              {myDonations === undefined ? (
                <Text style={styles.mutedText}>Loading history…</Text>
              ) : myDonations.length === 0 ? (
                <Text style={styles.mutedText}>You haven't made any donations yet.</Text>
              ) : (
                myDonations.map((item) => (
                  <View key={item._id} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={[styles.historyMemo, dark && styles.textLight]}>
                        {item.memo}
                      </Text>
                      <Text style={styles.donorMeta}>
                        {new Date(item._creationTime).toLocaleDateString()} · {item.status}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>{item.amount} π</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  heroCard: {
    backgroundColor: '#7C3AED',
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow.raised,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: { flex: 1, marginLeft: 12 },
  heroTitle: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  heroSub: { fontSize: 12, color: '#DDD6FE', marginTop: 2 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  tierGrid: { flexDirection: 'row', gap: 10 },
  tierCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 6,
    ...shadow.card,
  },
  tierCardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tierTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierIconBg: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontSize: 13, fontWeight: '800', color: colors.text },
  tierAmount: { fontSize: 18, fontWeight: '900', color: colors.primary, marginTop: 4 },
  tierBonus: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    ...shadow.raised,
    marginVertical: 4,
  },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  mutedText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  donorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankBadgeText: { fontSize: 12, fontWeight: '900', color: '#FFF' },
  donorInfo: { flex: 1 },
  donorName: { fontSize: 14, fontWeight: '800', color: colors.text },
  donorMeta: { fontSize: 11, color: colors.textMuted },
  donorPi: { fontSize: 15, fontWeight: '900', color: '#10B981' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyLeft: { flex: 1 },
  historyMemo: { fontSize: 13, fontWeight: '800', color: colors.text },
  historyAmount: { fontSize: 14, fontWeight: '900', color: colors.primary },
  textLight: { color: colors.textDark },
});
