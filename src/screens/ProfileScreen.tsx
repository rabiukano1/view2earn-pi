import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { formatPts, levelInfo, type SmartDashboard } from '../profile/smart';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function ProfileScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const nav = useNavigation<Nav>();
  const account = useQuery(api.accountLinkDb.myAccount);
  const updateProfile = useMutation(api.accountLinkDb.updateProfile);
  const linkPassword = useAction(api.accountLink.linkPassword);

  // Profile editor. Telegram/Pi users arrive with no name, email or password,
  // so this is how they complete the account and gain a second way back in.
  const [editOpen, setEditOpen] = useState(false);
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fPassword2, setFPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    setFName(account.name);
    setFEmail(account.email);
    setFPhone(account.phone);
  }, [account]);

  const saveProfile = async () => {
    // Catch a typo here rather than after the password is already hashed and
    // stored — at that point the user would be locked out of their own login.
    if (fPassword.trim() && fPassword !== fPassword2) {
      Alert.alert('Passwords do not match', 'Please retype the same password in both fields.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: fName, email: fEmail, phone: fPhone });
      // Setting a password is a separate step: it creates a real sign-in
      // credential, so it only runs when a password was actually typed.
      if (fPassword.trim()) {
        await linkPassword({ email: fEmail.trim(), password: fPassword });
        setFPassword('');
        setFPassword2('');
      }
      setEditOpen(false);
      Alert.alert('Saved', fPassword.trim()
        ? 'Profile updated. You can now sign in with your email and password too.'
        : 'Profile updated.');
    } catch (e) {
      Alert.alert('Could not save', String(e).replace('[CONVEX] ', ''));
    } finally {
      setSaving(false);
    }
  };

  const data = useQuery(api.profile.smartDashboard, userId ? { userId } : 'skip');
  const referral = useQuery(api.rewards.myReferral, userId ? { userId } : 'skip');

  const d = (data ?? null) as SmartDashboard | null;
  const lvl = d ? levelInfo(d.stats.totalEarned) : null;

  const displayName = d?.user.name || d?.user.username || 'View2Earn Member';
  const displayContact = d?.user.telegramUserId ? `@${d.user.telegramUserId}` : '';
  const ecosystemTag = d?.user.ecosystem === 'PI' ? 'Pi Network' : 'Sidra Chain';

  const referralLink = referral?.code
    ? `https://play.google.com/store/apps/details?id=com.view2earn&referrer=${referral.code}`
    : '';

  const copyReferralLink = () => {
    if (!referralLink) return;
    Clipboard.setString(referralLink);
  };

  const shareReferralLink = () => {
    if (!referralLink) return;
    Share.share({
      message: `Join View2Earn and earn rewards! Use my referral code: ${referral?.code}\n\nDownload now: ${referralLink}`,
    });
  };

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
            {d?.user.ecosystem === 'PI' && (
              <View style={styles.tierBadge}>
                <Icon name="shield-halved" iconStyle="solid" size={10} color={colors.success} />
                <Text style={styles.tierBadgeText}>Verified Account</Text>
              </View>
            )}
          </View>

          {account ? (
            <View style={styles.signInRow}>
              {([
                ['password', 'Password', 'key'],
                ['email', 'Email code', 'envelope'],
                ['telegram', 'Telegram', 'paper-plane'],
                ['pi', 'Pi', 'circle-nodes'],
              ] as const).map(([k, label, icon]) => (
                <View
                  key={k}
                  style={[styles.methodChip, account.methods[k] && styles.methodChipOn]}>
                  <Icon
                    name={icon}
                    iconStyle="solid"
                    size={10}
                    color={account.methods[k] ? colors.success : colors.textFaint}
                  />
                  <Text
                    style={[styles.methodText, account.methods[k] && styles.methodTextOn]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.editProfileBtn}
            activeOpacity={0.85}
            onPress={() => setEditOpen(true)}>
            <Icon name="pen" iconStyle="solid" size={12} color={colors.primaryDeep} />
            <Text style={styles.editProfileText}>
              {account?.methods.password ? 'Edit profile' : 'Complete your profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Navigation to new Settings Tab */}
        <TouchableOpacity
          style={[styles.menuTile, dark && styles.cardDark]}
          onPress={() => nav.navigate('Settings')}
          activeOpacity={0.8}>
          <View style={[styles.menuIconBg, { backgroundColor: '#3B82F61E' }]}>
            <Icon name="gear" iconStyle="solid" size={18} color="#3B82F6" />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuLabel, dark && styles.textLight]}>Dashboard & Settings</Text>
            <Text style={styles.menuSub} numberOfLines={1}>
              Smart coach, achievements, leaderboard & options
            </Text>
          </View>
          <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
        </TouchableOpacity>
        
        {/* Navigation to Security Screen */}
        <TouchableOpacity
          style={[styles.menuTile, dark && styles.cardDark, { marginTop: 10 }]}
          onPress={() => nav.navigate('Security')}
          activeOpacity={0.8}>
          <View style={[styles.menuIconBg, { backgroundColor: '#EF44441E' }]}>
            <Icon name="shield-halved" iconStyle="solid" size={18} color="#EF4444" />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuLabel, dark && styles.textLight]}>Security</Text>
            <Text style={styles.menuSub} numberOfLines={1}>
              Biometric lock, sign out & account deletion
            </Text>
          </View>
          <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Referral card */}
        {referral?.code ? (
          <View style={[styles.referralCard, dark && styles.cardDark]}>
            <View style={styles.referralHeader}>
              <Icon name="user-plus" iconStyle="solid" size={16} color={colors.primaryDeep} />
              <Text style={[styles.referralTitle, dark && styles.textLight]}>Invite Friends</Text>
            </View>
            <Text style={styles.referralSub}>Share your link to earn rewards</Text>
            <View style={styles.referralLinkRow}>
              <Text style={styles.referralLinkText} numberOfLines={1}>{referralLink}</Text>
            </View>
            <View style={styles.referralActions}>
              <TouchableOpacity style={styles.refCopyBtn} onPress={copyReferralLink} activeOpacity={0.85}>
                <Icon name="copy" iconStyle="solid" size={14} color={colors.primaryDeep} />
                <Text style={styles.refCopyBtnText}>Copy Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refShareBtn} onPress={shareReferralLink} activeOpacity={0.85}>
                <Icon name="share-nodes" iconStyle="solid" size={14} color={colors.white} />
                <Text style={styles.refShareBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.refViewBtn, { borderColor: colors.primary + '44' }]} onPress={() => nav.navigate('Referral')} activeOpacity={0.85}>
                <Text style={[styles.refViewBtnText, { color: colors.primaryDeep }]}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

      </ScrollView>

      {/* Edit profile / link a password */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={[styles.editSheet, dark && styles.editSheetDark]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.editTitle, dark && styles.textLight]}>Edit profile</Text>

              <Text style={styles.editLabel}>Full name</Text>
              <TextInput
                style={[styles.editInput, dark && styles.editInputDark]}
                value={fName}
                onChangeText={setFName}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
              />

              <Text style={styles.editLabel}>Email</Text>
              <TextInput
                style={[styles.editInput, dark && styles.editInputDark]}
                value={fEmail}
                onChangeText={setFEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.editLabel}>Phone number</Text>
              <TextInput
                style={[styles.editInput, dark && styles.editInputDark]}
                value={fPhone}
                onChangeText={setFPhone}
                placeholder="+234 800 000 0000"
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
              />

              <Text style={styles.editLabel}>
                {account?.methods.password ? 'New password (optional)' : 'Create a password (optional)'}
              </Text>
              <View style={styles.pwRow}>
                <TextInput
                  style={[styles.editInput, styles.pwInput, dark && styles.editInputDark]}
                  value={fPassword}
                  onChangeText={setFPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.pwEye}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Icon
                    name={showPassword ? 'eye-slash' : 'eye'}
                    iconStyle="solid"
                    size={15}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {fPassword.length > 0 ? (
                <>
                  <Text style={styles.editLabel}>Confirm password</Text>
                  <TextInput
                    style={[styles.editInput, dark && styles.editInputDark]}
                    value={fPassword2}
                    onChangeText={setFPassword2}
                    placeholder="Retype the password"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  {fPassword2.length > 0 && fPassword !== fPassword2 ? (
                    <Text style={styles.pwMismatch}>Passwords do not match</Text>
                  ) : null}
                </>
              ) : null}

              <Text style={styles.editHelp}>
                {account?.methods.password
                  ? 'Leave blank to keep your current password.'
                  : 'Adding a password lets you sign in with your email as well as ' +
                    (account?.methods.telegram ? 'Telegram' : 'Pi') +
                    ' — useful if you ever lose access to it.'}
              </Text>

              <TouchableOpacity
                style={[styles.editSave, saving && { opacity: 0.6 }]}
                disabled={saving}
                activeOpacity={0.85}
                onPress={saveProfile}>
                <Text style={styles.editSaveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editCancel} onPress={() => setEditOpen(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  signInRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(120,120,140,0.12)',
  },
  methodChipOn: { backgroundColor: 'rgba(16,185,129,0.14)' },
  methodText: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  methodTextOn: { color: colors.success },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  editProfileText: { fontSize: 13, fontWeight: '800', color: colors.primaryDeep },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: {
    maxHeight: '88%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  editSheetDark: { backgroundColor: '#17171F' },
  editTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  editLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md, marginBottom: 6 },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FAFAFC',
  },
  editInputDark: { backgroundColor: '#1F1F2A', borderColor: '#2E2E3C', color: '#FFF' },
  editHelp: { fontSize: 11, color: colors.textFaint, marginTop: 6, lineHeight: 15 },
  pwRow: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 44 },
  pwEye: { position: 'absolute', right: 12, padding: 4 },
  pwMismatch: { fontSize: 11, color: colors.danger, marginTop: 6, fontWeight: '600' },
  editSave: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  editSaveText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  editCancel: { paddingVertical: 12, alignItems: 'center' },
  editCancelText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
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

  referralCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 14,
    ...shadow.card,
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  referralTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  referralSub: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  referralLinkRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  referralLinkText: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  referralActions: { flexDirection: 'row', gap: 10 },
  refCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  refCopyBtnText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 13 },
  refShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  refShareBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  refViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  refViewBtnText: { fontWeight: '800', fontSize: 13 },
});
