import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
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
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { smartOpenUrl } from '../lib/openUrl';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import PlatformIcon from '../components/PlatformIcon';
import Icon from '../components/Icon';
import { colors, radius, shadow, spacing } from '../theme';

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
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  const listings = useQuery(api.marketplace.listListings);
  const myListings = useQuery(api.marketplace.myListings, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const me = useQuery(api.users.me);
  const cancelListing = useMutation(api.marketplace.cancelListing);
  const submitContact = useMutation(api.inquiries.submitContact);

  // "Need points?" — a user with too few points cannot promote anything, and
  // previously had no way forward from this screen. Below this threshold we
  // surface a direct line to the team instead of a dead end.
  // Support line. wa.me needs the number in full international form with no
  // "+" or spaces: 0806… -> 234806…
  const SUPPORT_WHATSAPP = '2348062526132';
  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi View2Earn team, I need help with Promote Hub (balance ${balance ?? 0} pts).`,
    );
    // smartOpenUrl opens the WhatsApp app when installed and falls back to the
    // browser otherwise.
    void smartOpenUrl(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`, 'whatsapp');
  };

  const LOW_BALANCE_POINTS = 100;
  const lowBalance = balance !== undefined && balance < LOW_BALANCE_POINTS;

  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [contactSending, setContactSending] = useState(false);

  const sendContact = async () => {
    const message = contactMsg.trim();
    if (message.length < 10) {
      Alert.alert('Message too short', 'Please describe what you need in a little more detail.');
      return;
    }
    setContactSending(true);
    try {
      await submitContact({
        name: me?.username ?? 'View2Earn user',
        email: me?.email ?? 'no-email@view2earn.org',
        message: `[Promote Hub — balance ${balance ?? 0} pts] ${message}`,
      });
      setContactOpen(false);
      setContactMsg('');
      Alert.alert('Message sent', 'The team has your request and will get back to you.');
    } catch (e) {
      Alert.alert('Could not send', String(e).replace('[CONVEX] ', ''));
    } finally {
      setContactSending(false);
    }
  };

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
  const activeMeta = PLATFORM_COLORS[activePlatform] ?? { label: 'All Platforms', color: colors.primary };

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
        {Boolean(isOwner && item.status === 'active') ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item._id)}>
            <Icon name="rotate-left" iconStyle="solid" size={12} color="#DC2626" />
            <Text style={styles.cancelBtnText}>Cancel & Refund Points</Text>
          </TouchableOpacity>
        ) : null}
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
            {/* Not enough points to promote — offer a way forward. */}
            {lowBalance ? (
              <View style={[styles.lowBalCard, dark && styles.lowBalCardDark]}>
                <View style={styles.lowBalIcon}>
                  <Icon name="coins" iconStyle="solid" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lowBalTitle, dark && styles.textLight]}>
                    You have {balance ?? 0} points
                  </Text>
                  <Text style={styles.lowBalSub}>
                    Earn more from tasks, quiz and spin — or ask the team about a promotion package.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.lowBalBtn}
                  activeOpacity={0.85}
                  onPress={() => setContactOpen(true)}>
                  <Text style={styles.lowBalBtnText}>Get help</Text>
                </TouchableOpacity>
              </View>
            ) : null}

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

            {/* Platform Dropdown Selector */}
            <TouchableOpacity
              style={[styles.platformDropdownBtn, dark && styles.platformDropdownBtnDark]}
              onPress={() => setPlatformDropdownOpen(true)}
              activeOpacity={0.8}>
              <View style={styles.platformDropdownLeft}>
                <PlatformIcon platform={activePlatform === 'all' ? 'app' : activePlatform} size={18} color={activeMeta.color} />
                <Text style={[styles.platformDropdownLabel, dark && styles.textLight]}>
                  {activePlatform === 'all' ? 'All Platforms' : activeMeta.label}
                </Text>
              </View>
              <View style={styles.platformDropdownRight}>
                <Text style={styles.platformDropdownCount}>{filteredListings.length} items</Text>
                <Text style={styles.platformDropdownArrow}>▼</Text>
              </View>
            </TouchableOpacity>
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
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.contactRow, dark && styles.contactRowDark]}
            activeOpacity={0.85}
            onPress={() => setContactOpen(true)}>
            <Icon name="headset" iconStyle="solid" size={15} color={colors.primaryDeep} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactRowTitle, dark && styles.textLight]}>
                Need help or a custom package?
              </Text>
              <Text style={styles.contactRowSub}>Chat on WhatsApp or send us a message</Text>
            </View>
            <Icon name="chevron-right" iconStyle="solid" size={14} color={colors.textFaint} />
          </TouchableOpacity>
        }
      />

      {/* Platform Dropdown Modal */}
      <Modal
        visible={platformDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPlatformDropdownOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPlatformDropdownOpen(false)}>
          <View style={[styles.pickerCard, dark && styles.pickerCardDark]}>
            <Text style={[styles.pickerTitle, dark && styles.textLight]}>Filter by Platform</Text>
            {(['all', 'telegram', 'youtube', 'tiktok', 'facebook', 'x'] as PlatformFilter[]).map((p) => {
              const active = activePlatform === p;
              const meta = PLATFORM_COLORS[p] ?? { label: 'All Platforms', color: colors.primary };
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.pickerOption,
                    active && { backgroundColor: meta.color + '15', borderColor: meta.color },
                    dark && styles.pickerOptionDark,
                  ]}
                  onPress={() => {
                    setActivePlatform(p);
                    setPlatformDropdownOpen(false);
                  }}>
                  <PlatformIcon platform={p === 'all' ? 'app' : p} size={18} color={meta.color} />
                  <Text style={[styles.pickerLabel, dark && styles.textLight, active && { fontWeight: '800', color: meta.color }]}>
                    {p === 'all' ? 'All Platforms' : meta.label}
                  </Text>
                  {Boolean(active) ? <Text style={[styles.pickerCheck, { color: meta.color }]}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setPlatformDropdownOpen(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Contact the team — for users who cannot afford a promotion yet. */}
      <Modal
        visible={contactOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setContactOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setContactOpen(false)}>
          <Pressable style={[styles.contactSheet, dark && styles.contactSheetDark]} onPress={() => {}}>
            <View style={styles.sheetGrabber} />
            <Text style={[styles.contactTitle, dark && styles.textLight]}>Contact the team</Text>
            <Text style={styles.contactSub}>
              Tell us what you want to promote and we'll come back to you with options.
            </Text>

            {/* Fastest route first — most users prefer chat over a form. */}
            <TouchableOpacity style={styles.waCard} activeOpacity={0.85} onPress={openWhatsApp}>
              <View style={styles.waIcon}>
                <Icon name="whatsapp" iconStyle="brand" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.waTitle}>Chat on WhatsApp</Text>
                <Text style={styles.waSub}>Usually replies fastest</Text>
              </View>
              <Icon name="arrow-up-right-from-square" iconStyle="solid" size={13} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or send a message</Text>
              <View style={styles.orLine} />
            </View>
            <TextInput
              style={[styles.contactInput, dark && styles.contactInputDark]}
              placeholder="What do you need? e.g. 5,000 followers for my TikTok page…"
              placeholderTextColor={colors.textFaint}
              value={contactMsg}
              onChangeText={setContactMsg}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={800}
            />
            <Text style={styles.contactHint}>
              Replying to {me?.email ? me.email : 'your account'} · {contactMsg.trim().length}/800
            </Text>
            <TouchableOpacity
              style={[styles.contactSend, contactSending && { opacity: 0.6 }]}
              disabled={contactSending}
              activeOpacity={0.85}
              onPress={sendContact}>
              <Text style={styles.contactSendText}>
                {contactSending ? 'Sending…' : 'Send message'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setContactOpen(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lowBalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  lowBalCardDark: { backgroundColor: '#2A2411', borderColor: '#4D3F14' },
  lowBalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245,158,11,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowBalTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  lowBalSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  lowBalBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  lowBalBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFF',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  contactRowDark: { backgroundColor: '#17171F' },
  contactRowTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  contactRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sheetGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,140,0.35)',
    marginBottom: spacing.sm,
  },
  waCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#25D366',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  waIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  waSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(120,120,140,0.25)' },
  orText: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  contactSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  contactSheetDark: { backgroundColor: '#17171F' },
  contactTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  contactSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  contactInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FAFAFC',
  },
  contactInputDark: { backgroundColor: '#1F1F2A', borderColor: '#2E2E3C', color: '#FFF' },
  contactHint: { fontSize: 11, color: colors.textFaint, textAlign: 'right' },
  contactSend: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  contactSendText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
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
  platformDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: 8,
  },
  platformDropdownBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  platformDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformDropdownLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  platformDropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformDropdownCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  platformDropdownArrow: {
    fontSize: 10,
    color: colors.textMuted,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: 20,
    gap: 10,
    ...shadow.raised,
  },
  pickerCardDark: {
    backgroundColor: '#1E293B',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  pickerOptionDark: {
    backgroundColor: 'transparent',
  },
  pickerLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pickerCheck: {
    fontSize: 16,
    fontWeight: '800',
  },
  pickerCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
