import React, { useState } from 'react';
import {
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
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, radius, shadow } from '../theme';
import Icon from '../components/Icon';

type RouteParams = {
  CreateListing: { userId: Id<'users'> };
};

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: 'facebook', iconStyle: 'brands', color: '#1877F2', bg: '#EFF6FF', placeholder: 'https://facebook.com/yourpage' },
  { value: 'tiktok', label: 'TikTok', icon: 'tiktok', iconStyle: 'brands', color: '#010101', bg: '#F4F4F5', placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'telegram', label: 'Telegram', icon: 'telegram', iconStyle: 'brands', color: '#229ED9', bg: '#F0F9FF', placeholder: 'https://t.me/yourhandle' },
  { value: 'youtube', label: 'YouTube', icon: 'youtube', iconStyle: 'brands', color: '#FF0000', bg: '#FEF2F2', placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'x', label: 'X (Twitter)', icon: 'x-twitter', iconStyle: 'brands', color: '#0F172A', bg: '#F8FAFC', placeholder: 'https://x.com/yourhandle' },
  { value: 'instagram', label: 'Instagram', icon: 'instagram', iconStyle: 'brands', color: '#E4405F', bg: '#FDF2F8', placeholder: 'https://instagram.com/yourhandle' },
];

const PTS_PRESETS = [10, 25, 50, 100];
const QTY_PRESETS = [10, 25, 50, 100];

export default function CreateListingScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CreateListing'>>();
  const userId = route.params.userId;

  const createListing = useMutation(api.marketplace.createListing);

  const [platform, setPlatform] = useState('facebook');
  const [targetUrl, setTargetUrl] = useState('');
  const [pointsReward, setPointsReward] = useState('10');
  const [maxCompletions, setMaxCompletions] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  const reward = parseInt(pointsReward, 10) || 0;
  const completions = parseInt(maxCompletions, 10) || 0;
  const totalCost = reward * completions;

  const selected = PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0];

  const canSubmit =
    platform && targetUrl.trim() && reward >= 10 && completions >= 1 && completions <= 100 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { balanceAfter } = await createListing({
        userId,
        platform,
        targetUrl: targetUrl.trim(),
        pointsReward: reward,
        maxCompletions: completions,
      });
      Alert.alert(
        'Submitted for Admin Review 🛡️',
        `Your social handle has been submitted for admin moderation. Once approved, it will go live for active users!\n\nPoints escrowed: ${totalCost.toLocaleString()} pts\nRemaining balance: ${balanceAfter.toLocaleString()} pts`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Error', String(e).replace('[CONVEX] ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, dark && styles.backBtnDark]}
            activeOpacity={0.8}>
            <Icon name="arrow-left" iconStyle="solid" size={16} color={dark ? colors.textDark : colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, dark && styles.textLight]}>Promote Social Handle</Text>
            <Text style={styles.headerSub}>List your channel to gain real active followers</Text>
          </View>
        </View>

        {/* Section 1: Platform Selection Grid */}
        <View style={[styles.sectionCard, dark && styles.sectionCardDark]}>
          <Text style={[styles.sectionHeading, dark && styles.textLight]}>1. Choose Platform</Text>
          <View style={styles.platformGrid}>
            {PLATFORMS.map((p) => {
              const active = platform === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.platformCard,
                    dark && styles.platformCardDark,
                    active && { borderColor: p.color, backgroundColor: dark ? '#1E293B' : p.bg, borderWidth: 2 },
                  ]}
                  onPress={() => setPlatform(p.value)}
                  activeOpacity={0.85}>
                  <View style={[styles.platformIconWrap, { backgroundColor: p.color + '15' }]}>
                    <Icon name={p.icon} iconStyle={p.iconStyle as any} size={20} color={p.color} />
                  </View>
                  <Text style={[styles.platformLabel, dark && styles.textLight, active && { fontWeight: '800', color: p.color }]}>
                    {p.label}
                  </Text>
                  {Boolean(active) ? (
                    <View style={[styles.activeCheck, { backgroundColor: p.color }]}>
                      <Icon name="check" iconStyle="solid" size={10} color="#FFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2: Target Link / Handle */}
        <View style={[styles.sectionCard, dark && styles.sectionCardDark]}>
          <Text style={[styles.sectionHeading, dark && styles.textLight]}>2. Target Profile URL</Text>
          <View style={[styles.inputWrapper, dark && styles.inputWrapperDark]}>
            <Icon name={selected.icon} iconStyle={selected.iconStyle as any} size={18} color={selected.color} />
            <TextInput
              style={[styles.input, dark && styles.inputDark]}
              placeholder={selected.placeholder}
              placeholderTextColor="#94A3B8"
              value={targetUrl}
              onChangeText={setTargetUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <Text style={[styles.hintText, dark && styles.textMuted]}>
            Direct URL of the page or channel you want users to follow
          </Text>
        </View>

        {/* Section 3: Reward & Followers Setup */}
        <View style={[styles.sectionCard, dark && styles.sectionCardDark]}>
          <Text style={[styles.sectionHeading, dark && styles.textLight]}>3. Reward & Quantity</Text>

          {/* Reward PTS */}
          <Text style={[styles.fieldLabel, dark && styles.textLight]}>Reward per follow (PTS)</Text>
          <View style={styles.presetRow}>
            {PTS_PRESETS.map((pts) => (
              <TouchableOpacity
                key={pts}
                style={[
                  styles.presetChip,
                  reward === pts && styles.presetChipActive,
                  dark && styles.presetChipDark,
                ]}
                onPress={() => setPointsReward(String(pts))}>
                <Text style={[styles.presetText, reward === pts && styles.presetTextActive]}>
                  {pts} PTS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.inputMarginTop, dark && styles.inputDark]}
            placeholder="Custom points reward (min 10)"
            placeholderTextColor="#94A3B8"
            value={pointsReward}
            onChangeText={setPointsReward}
            keyboardType="number-pad"
          />

          {/* Quantity */}
          <Text style={[styles.fieldLabel, styles.fieldLabelMargin, dark && styles.textLight]}>Target followers (Max 100)</Text>
          <View style={styles.presetRow}>
            {QTY_PRESETS.map((qty) => (
              <TouchableOpacity
                key={qty}
                style={[
                  styles.presetChip,
                  completions === qty && styles.presetChipActive,
                  dark && styles.presetChipDark,
                ]}
                onPress={() => setMaxCompletions(String(qty))}>
                <Text style={[styles.presetText, completions === qty && styles.presetTextActive]}>
                  {qty} Users
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.inputMarginTop, dark && styles.inputDark]}
            placeholder="Custom max users (1-100)"
            placeholderTextColor="#94A3B8"
            value={maxCompletions}
            onChangeText={setMaxCompletions}
            keyboardType="number-pad"
          />
        </View>

        {/* Live Marketplace Card Preview */}
        {Boolean(targetUrl.trim() || reward > 0) ? (
          <View style={[styles.previewCard, dark && styles.previewCardDark]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTag}>LIVE MARKETPLACE PREVIEW</Text>
              <Text style={styles.previewPts}>+{reward} PTS</Text>
            </View>
            <View style={styles.previewBody}>
              <View style={[styles.previewIcon, { backgroundColor: selected.color + '15' }]}>
                <Icon name={selected.icon} iconStyle={selected.iconStyle as any} size={22} color={selected.color} />
              </View>
              <View style={styles.previewMeta}>
                <Text style={[styles.previewTitle, dark && styles.textLight]} numberOfLines={1}>
                  Follow {selected.label} Profile
                </Text>
                <Text style={styles.previewLink} numberOfLines={1}>
                  {targetUrl.trim() || selected.placeholder}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Escrow & Cost Summary */}
        <View style={[styles.summaryCard, dark && styles.summaryCardDark]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Escrow Cost</Text>
            <Text style={styles.summaryCost}>{totalCost.toLocaleString()} PTS</Text>
          </View>

          <View style={styles.summaryBar}>
            <View style={[styles.summaryFill, { width: `${Math.min(100, (totalCost / 5000) * 100)}%` }]} />
          </View>

          <View style={styles.escrowNotice}>
            <Icon name="shield-halved" iconStyle="solid" size={14} color="#7C3AED" />
            <Text style={styles.escrowNoticeText}>
              Submitted for Admin Approval. Points auto-refunded if rejected.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}
            activeOpacity={0.88}>
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting for Review…' : `Spend ${totalCost.toLocaleString()} PTS — List Handle`}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnDark: { backgroundColor: '#1E293B' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    ...shadow.card,
  },
  sectionCardDark: { backgroundColor: colors.surfaceDark },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 14 },

  /* Platform Grid */
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  platformCard: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  platformCardDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  platformIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  platformLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  activeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Inputs & Presets */
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  inputWrapperDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  inputDark: { color: colors.textDark },
  inputMarginTop: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  hintText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  fieldLabelMargin: { marginTop: 14 },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  presetTextActive: { color: colors.white },

  /* Live Preview Card */
  previewCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: radius.xl,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  previewCardDark: { backgroundColor: '#1E1B4B', borderColor: '#4C1D95' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewTag: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5 },
  previewPts: { fontSize: 14, fontWeight: '800', color: '#16A34A' },
  previewBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewMeta: { flex: 1 },
  previewTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  previewLink: { fontSize: 12, color: '#6D28D9', marginTop: 2, fontWeight: '600' },

  /* Escrow Summary */
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    marginHorizontal: 18,
    ...shadow.card,
  },
  summaryCardDark: { backgroundColor: colors.surfaceDark },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  summaryCost: { fontSize: 26, fontWeight: '800', color: colors.primary },
  summaryBar: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginTop: 12, width: '100%', overflow: 'hidden' },
  summaryFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  escrowNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: '#F3E8FF', padding: 10, borderRadius: radius.md },
  escrowNoticeText: { fontSize: 12, color: '#6B21A8', fontWeight: '700', flex: 1 },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    ...shadow.raised,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
