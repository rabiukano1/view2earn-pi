import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import PlatformIcon from '../components/PlatformIcon';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

// ponytail: DEFAULT_PLATFORM_FILTER fallback set to 'all'; calibrate with marketplace analytics metrics.
type PlatformFilter = 'all' | 'telegram' | 'youtube' | 'tiktok' | 'facebook' | 'x';
type ViewTab = 'all' | 'mine';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_COLORS: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  tiktok: { label: 'TikTok', color: '#010101' },
  telegram: { label: 'Telegram', color: '#229ED9' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  x: { label: 'X (Twitter)', color: '#14171A' },
};

function extractTargetName(url: string): string {
  if (!url) return '';
  const last = url.replace(/\/+$/, '').split('/').pop() ?? '';
  return last.startsWith('@') ? last : `@${last}`;
}

export default function MarketplaceScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const navigation = useNavigation<Nav>();

  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');

  const listings = useQuery(api.marketplace.listListings);
  const myListings = useQuery(api.marketplace.myListings, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const cancelListing = useMutation(api.marketplace.cancelListing);

  const handleCancel = (listingId: Id<'marketplaceListings'>) => {
    Alert.alert('Cancel Promotion', 'Unused points will be refunded to your balance instantly.', [
      { text: 'Keep Active', style: 'cancel' },
      {
        text: 'Cancel & Refund',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelListing({ userId: userId!, listingId });
          } catch (e) {
            Alert.alert('Error', String(e).replace('[CONVEX] ', ''));
          }
        },
      },
    ]);
  };

  const rawData = activeTab === 'mine' ? (myListings ?? []) : (listings ?? []);
  const filteredListings = rawData.filter((l) => {
    if (activePlatform !== 'all' && l.platform !== activePlatform) return false;
    return true;
  });

  const renderListingCard = ({ item }: { item: any }) => {
    const meta = PLATFORM_COLORS[item.platform] ?? { label: item.platform, color: colors.primary };
    const pct = Math.min(100, Math.round((item.completionsSoFar / item.maxCompletions) * 100));
    const isOwner = activeTab === 'mine' || item.userId === userId;

    return (
      <View style={[styles.card, dark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={[styles.platformBadge, { backgroundColor: meta.color }]}>
            <PlatformIcon platform={item.platform} size={20} color="#FFF" />
          </View>

          <View style={styles.cardInfo}>
            <Text style={[styles.targetName, dark && styles.textLight]} numberOfLines={1}>
              {extractTargetName(item.targetUrl)}
            </Text>
            <View style={styles.subRow}>
              <Text style={styles.platformLabel}>{meta.label}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.rewardText}>+{item.pointsReward} pts reward</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, item.status === 'active' ? styles.statusActive : styles.statusDone]}>
            <Text style={[styles.statusText, item.status === 'active' ? styles.statusActiveText : styles.statusDoneText]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Progress Bar & Percentage */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>Reach Progress</Text>
            <Text style={styles.progressPctText}>{pct}% ({item.completionsSoFar}/{item.maxCompletions})</Text>
          </View>
          <View style={styles.trackBar}>
            <View style={[styles.fillBar, { width: `${pct}%`, backgroundColor: meta.color }]} />
          </View>
        </View>

        {/* Action Button for Owner */}
        {isOwner && item.status === 'active' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item._id)}>
            <Icon name="rotate-left" iconStyle="solid" size={12} color="#DC2626" />
            <Text style={styles.cancelBtnText}>Cancel & Refund Points</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Promote Hub"
        subtitle="Boost your social channels & reach real active users"
        back
        right={
          <View style={styles.balanceBadge}>
            <Icon name="coins" iconStyle="solid" size={13} color="#FBBF24" />
            <Text style={styles.balanceText}>{balance === undefined ? '…' : balance} pts</Text>
          </View>
        }
      />

      <FlatList
        data={filteredListings}
        keyExtractor={(item) => item._id}
        renderItem={renderListingCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Create Promotion Hero Card */}
            <TouchableOpacity
              style={styles.heroCtaCard}
              activeOpacity={0.88}
              onPress={() => userId && navigation.navigate('CreateListing', { userId })}>
              <View style={styles.heroIconBg}>
                <Icon name="rocket" iconStyle="solid" size={22} color="#FFF" />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Launch New Promotion</Text>
                <Text style={styles.heroSub}>Spend points to get followers, likes & views</Text>
              </View>
              <View style={styles.heroActionBtn}>
                <Text style={styles.heroActionBtnText}>Boost Now</Text>
              </View>
            </TouchableOpacity>

            {/* Segmented View Tabs */}
            <View style={[styles.segmentedTabs, dark && styles.segmentedTabsDark]}>
              <TouchableOpacity
                style={[styles.segTab, activeTab === 'all' && styles.segTabActive]}
                onPress={() => setActiveTab('all')}>
                <Text style={[styles.segTabText, activeTab === 'all' && styles.segTabTextActive]}>
                  Explore ({listings?.length || 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segTab, activeTab === 'mine' && styles.segTabActive]}
                onPress={() => setActiveTab('mine')}>
                <Text style={[styles.segTabText, activeTab === 'mine' && styles.segTabTextActive]}>
                  My Boosts ({myListings?.length || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Platform Horizontal Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {(['all', 'telegram', 'youtube', 'tiktok', 'facebook', 'x'] as PlatformFilter[]).map((p) => {
                const isActive = activePlatform === p;
                const meta = PLATFORM_COLORS[p] ?? { label: 'All', color: colors.primary };
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.filterChip,
                      dark && styles.filterChipDark,
                      isActive && { backgroundColor: meta.color },
                    ]}
                    onPress={() => setActivePlatform(p)}>
                    <PlatformIcon platform={p === 'all' ? 'app' : p} size={14} color={isActive ? '#FFF' : dark ? '#A7F3D0' : colors.textMuted} />
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {p === 'all' ? 'All Platforms' : meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          listings === undefined ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>Loading promotions…</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="bullhorn" iconStyle="solid" size={38} color={colors.textFaint} />
              <Text style={[styles.emptyTitle, dark && styles.textLight]}>
                {activeTab === 'mine' ? 'No Active Boosts' : 'No Promotions Yet'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'mine'
                  ? 'Launch your first campaign above to boost your channels!'
                  : 'Be the first to promote your profile to the community!'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  containerDark: {
    backgroundColor: colors.bgDark,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  balanceText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBlock: {
    marginBottom: 16,
    gap: 14,
  },
  heroCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.float,
  },
  heroIconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  heroSub: {
    fontSize: 12,
    color: '#DDD6FE',
    marginTop: 2,
  },
  heroActionBtn: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  heroActionBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentedTabsDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  segTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  segTabActive: {
    backgroundColor: colors.primary,
  },
  segTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segTabTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  targetName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  platformLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dotSeparator: {
    fontSize: 10,
    color: colors.textFaint,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusActive: {
    backgroundColor: colors.primarySoft,
  },
  statusDone: {
    backgroundColor: colors.successSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusActiveText: {
    color: colors.primaryDeep,
  },
  statusDoneText: {
    color: '#15803D',
  },
  progressContainer: {
    marginTop: 14,
    gap: 6,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textFaint,
  },
  progressPctText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  trackBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    borderRadius: 4,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#FEE2E2',
  },
  cancelBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  textLight: {
    color: colors.textDark,
  },
});
