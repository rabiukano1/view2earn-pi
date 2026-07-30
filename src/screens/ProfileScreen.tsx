import React, { useEffect, useState } from 'react';
import { POINTS, REFERRAL_QUALIFICATION_TASKS } from '@view2earn/core';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { biometricAvailable, isLockEnabled, setLockEnabled, promptBiometric } from '../auth/biometric';
import { colors, radius, shadow } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import PlatformIcon, { platformColor } from '../components/PlatformIcon';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORMS = ['facebook', 'tiktok', 'telegram', 'instagram', 'youtube', 'x'] as const;

function QuickActionTile({
  icon,
  label,
  subtitle,
  tint,
  dark,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle: string;
  tint: string;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tileCard, dark && styles.cardDark]}
      onPress={onPress}
      activeOpacity={0.8}>
      <View style={[styles.tileIconBg, { backgroundColor: tint + '1E' }]}>
        <Icon name={icon} iconStyle="solid" size={18} color={tint} />
      </View>
      <View style={styles.tileContent}>
        <Text style={[styles.tileLabel, dark && styles.textLight]}>{label}</Text>
        <Text style={styles.tileSub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [linkModal, setLinkModal] = useState(false);
  const [step, setStep] = useState<'pick' | 'code' | 'verify'>('pick');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [bioCode, setBioCode] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [username, setUsername] = useState('');
  const [verifying, setVerifying] = useState(false);
  const stackNav = useNavigation<StackNav>();
  const { signOut } = useAuthActions();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [evmAddr, setEvmAddr] = useState('');
  const [solAddr, setSolAddr] = useState('');
  const [walletSeeded, setWalletSeeded] = useState(false);
  const [walletMsg, setWalletMsg] = useState('');

  useEffect(() => {
    biometricAvailable().then(setBioAvailable);
    isLockEnabled().then(setLockOn);
  }, []);


  const toggleLock = async (on: boolean) => {
    if (on && !(await promptBiometric('Confirm to enable fingerprint lock'))) return;
    await setLockEnabled(on);
    setLockOn(on);
  };

  const me = useQuery(api.users.me);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const profiles = useQuery(api.linkedProfiles.listMyProfiles, userId ? { userId } : 'skip');
  const referral = useQuery(api.rewards.myReferral, userId ? { userId } : 'skip');
  const requestBioCode = useMutation(api.linkedProfiles.requestBioCode);
  const verifyBioCode = useAction(api.linkedProfiles.verifyBioCode);
  const setPayoutWallet = useMutation(api.wallets.setPayoutWallet);

  const displayName = me?.name || me?.username || 'View2Earn Member';
  const displayContact = me?.email ?? (me?.telegramUserId ? `@${me.telegramUserId}` : '');
  const ecosystemTag = me?.ecosystem === 'PI' ? 'Pi Network' : 'Sidra Chain';

  useEffect(() => {
    if (me && !walletSeeded) {
      setEvmAddr(me.payoutEvm ?? '');
      setSolAddr(me.payoutSolana ?? '');
      setWalletSeeded(true);
    }
  }, [me, walletSeeded]);

  const saveWallets = async () => {
    if (!userId) return;
    setWalletMsg('');
    try {
      await setPayoutWallet({ userId, evm: evmAddr, solana: solAddr });
      setWalletMsg('Wallet addresses saved!');
    } catch (e) {
      setWalletMsg(String((e as { message?: string })?.message ?? e).replace('[CONVEX] ', ''));
    }
  };

  const openLinkFlow = () => {
    setLinkModal(true);
    setStep('pick');
    setSelectedPlatform('');
    setBioCode('');
    setProfileUrl('');
    setUsername('');
  };

  const handleRequestCode = async () => {
    if (!userId || !selectedPlatform) return;
    try {
      const code = await requestBioCode({ userId, platform: selectedPlatform });
      setBioCode(code);
      setStep('verify');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const handleVerify = async () => {
    if (!userId || !bioCode || !profileUrl || !username) {
      Alert.alert('Missing fields', 'Fill in all fields to verify');
      return;
    }
    setVerifying(true);
    try {
      await verifyBioCode({
        userId,
        code: bioCode,
        url: profileUrl,
        platform: selectedPlatform,
        usernameSnapshot: username,
      });
      Alert.alert('Linked!', `${selectedPlatform} profile verified and locked for 30 days.`);
      setLinkModal(false);
    } catch (e) {
      Alert.alert('Verification failed', String(e).replace('[CONVEX] ', ''));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Profile & Settings" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}>
        
        {/* Modern Profile Header */}
        <View style={[styles.profileHeaderCard, dark && styles.cardDark]}>
          <View style={styles.avatarGlowOuter}>
            <View style={styles.avatarInner}>
              <Icon name="user" iconStyle="solid" size={28} color={colors.white} />
            </View>
          </View>
          <Text style={[styles.nameText, dark && styles.textLight]}>{displayName}</Text>
          {displayContact ? <Text style={styles.contactText}>{displayContact}</Text> : null}

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

        {/* Hero Balance Showcase */}
        <View style={[styles.heroCard, dark && styles.heroCardDark]}>
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroLabelGroup}>
              <Icon name="coins" iconStyle="solid" size={14} color="#DDD6FE" />
              <Text style={styles.heroLabel}>Total Balance</Text>
            </View>
            <TouchableOpacity
              style={styles.historyPill}
              onPress={() => stackNav.navigate('PointsHistory')}>
              <Icon name="clock-rotate-left" iconStyle="solid" size={11} color={colors.white} />
              <Text style={styles.historyPillText}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{balance === undefined ? '…' : balance}</Text>
            <Text style={styles.heroUnit}>PTS</Text>
          </View>

          <View style={styles.heroFooterRow}>
            <Text style={styles.heroFooterHint}>Redeem points for Data & Airtime</Text>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.gridSection}>
          <QuickActionTile
            icon="graduation-cap"
            tint="#F59E0B"
            label="Learn Academy"
            subtitle="Pi & Sidra Guides"
            dark={dark}
            onPress={() =>
              stackNav.navigate('Academy', userId ? { userId, ecosystem: me?.ecosystem ?? 'SIDRA' } : undefined)
            }
          />
          <QuickActionTile
            icon="receipt"
            tint={colors.primary}
            label="Points History"
            subtitle="Ledger records"
            dark={dark}
            onPress={() => stackNav.navigate('PointsHistory')}
          />
        </View>

        {/* Payout Wallets */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Icon name="wallet" iconStyle="solid" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, dark && styles.textLight]}>Payout Wallets</Text>
          </View>
          <View style={[styles.card, dark && styles.cardDark]}>
            <Text style={styles.cardHint}>
              Tokens earned are sent to your specified public wallet addresses. No private keys are stored.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EVM Network (Ethereum / Polygon / SDA)</Text>
              <View style={[styles.inputBox, dark && styles.inputBoxDark]}>
                <Icon name="ethereum" iconStyle="brand" size={16} color="#627EEA" />
                <TextInput
                  style={[styles.textInput, dark && styles.textInputDark]}
                  value={evmAddr}
                  onChangeText={setEvmAddr}
                  placeholder="0x..."
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Solana Network</Text>
              <View style={[styles.inputBox, dark && styles.inputBoxDark]}>
                <Icon name="atom" iconStyle="solid" size={15} color="#14F195" />
                <TextInput
                  style={[styles.textInput, dark && styles.textInputDark]}
                  value={solAddr}
                  onChangeText={setSolAddr}
                  placeholder="Solana wallet address"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {walletMsg ? (
              <View style={[styles.msgBadge, walletMsg.includes('saved') ? styles.msgOk : styles.msgErr]}>
                <Icon
                  name={walletMsg.includes('saved') ? 'circle-check' : 'triangle-exclamation'}
                  iconStyle="solid"
                  size={12}
                  color={walletMsg.includes('saved') ? colors.success : colors.danger}
                />
                <Text style={[styles.msgText, walletMsg.includes('saved') ? styles.msgTextOk : styles.msgTextErr]}>
                  {walletMsg}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryActionBtn} onPress={saveWallets} activeOpacity={0.85}>
              <Icon name="floppy-disk" iconStyle="solid" size={14} color={colors.white} />
              <Text style={styles.primaryActionText}>Save Wallet Addresses</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Linked Social Profiles */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Icon name="link" iconStyle="solid" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Linked Profiles</Text>
            </View>
            <TouchableOpacity style={styles.addLinkBtn} onPress={openLinkFlow}>
              <Icon name="plus" iconStyle="solid" size={12} color={colors.primaryDeep} />
              <Text style={styles.addLinkText}>Link Social</Text>
            </TouchableOpacity>
          </View>

          {!profiles ? (
            <View style={[styles.card, styles.centerCard, dark && styles.cardDark]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : profiles.length === 0 ? (
            <View style={[styles.emptyCard, dark && styles.cardDark]}>
              <View style={styles.emptyIconBg}>
                <Icon name="user-plus" iconStyle="solid" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, dark && styles.textLight]}>No Social Profiles Linked</Text>
              <Text style={styles.emptySubtitle}>
                Link your Facebook, TikTok or Telegram profile to enable automatic verification for tasks.
              </Text>
            </View>
          ) : (
            profiles.map((p) => (
              <View key={p._id} style={[styles.socialProfileItem, dark && styles.cardDark]}>
                <View style={[styles.socialIconCircle, { backgroundColor: platformColor(p.platform) }]}>
                  <PlatformIcon platform={p.platform} size={15} color="#fff" />
                </View>
                <View style={styles.socialInfo}>
                  <Text style={[styles.socialUsername, dark && styles.textLight]}>{p.usernameSnapshot}</Text>
                  <Text style={styles.socialPlatform}>{p.platform.toUpperCase()}</Text>
                </View>
                <View style={styles.lockStatusBadge}>
                  <Icon name="lock" iconStyle="solid" size={10} color={colors.textFaint} />
                  <Text style={styles.lockStatusText}>
                    {Date.now() < p.lockedUntil ? 'Locked 30d' : 'Ready'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Referral Card */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Icon name="gift" iconStyle="solid" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, dark && styles.textLight]}>Referral Program</Text>
          </View>
          <View style={[styles.card, dark && styles.cardDark]}>
            <View style={styles.referralBanner}>
              <Text style={styles.referralBannerTitle}>Invite & Earn Together</Text>
              <Text style={styles.referralBannerSub}>
                Earn {POINTS.REFERRAL_QUALIFIED} pts when friends complete {REFERRAL_QUALIFICATION_TASKS} tasks. Your friend gets {POINTS.REFERRAL_REFEREE_BONUS} pts bonus!
              </Text>
            </View>

            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{referral?.code ?? '…'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => {
                if (!referral?.code) return;
                Share.share({
                  message: `Join View2Earn and earn rewards! Use my referral code: ${referral.code}\n\nDownload now and start earning.`,
                });
              }}
              activeOpacity={0.85}>
              <Icon name="paper-plane" iconStyle="solid" size={14} color={colors.white} />
              <Text style={styles.shareBtnText}>Share Code</Text>
            </TouchableOpacity>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, dark && styles.textLight]}>{referral?.count ?? 0}</Text>
                <Text style={styles.statLabel}>Invited</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {referral?.qualifiedCount ?? 0}
                </Text>
                <Text style={styles.statLabel}>Qualified</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {referral?.totalEarned ?? 0}
                </Text>
                <Text style={styles.statLabel}>Pts Earned</Text>
              </View>
            </View>

            {referral?.referredBy && (
              <View style={styles.referredByBox}>
                <Icon name="user-check" iconStyle="solid" size={12} color={colors.success} />
                <Text style={styles.referredByText}>Referred by {referral.referredBy}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Security & Settings */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Icon name="shield-halved" iconStyle="solid" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, dark && styles.textLight]}>App Security</Text>
          </View>
          
          {bioAvailable && (
            <View style={[styles.settingRowCard, dark && styles.cardDark]}>
              <View style={[styles.settingIconBg, { backgroundColor: colors.primary + '1F' }]}>
                <Icon name="fingerprint" iconStyle="solid" size={18} color={colors.primary} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={[styles.settingTitle, dark && styles.textLight]}>Biometric Unlock</Text>
                <Text style={styles.settingSubtitle}>Require fingerprint on app launch</Text>
              </View>
              <Switch
                value={lockOn}
                onValueChange={toggleLock}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          )}

          <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()} activeOpacity={0.85}>
            <Icon name="right-from-bracket" iconStyle="solid" size={15} color={colors.danger} />
            <Text style={styles.signOutText}>Sign Out of Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Profile Verification Modal */}
      <Modal visible={linkModal} transparent animationType="fade" onRequestClose={() => setLinkModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, dark && styles.cardDark]}>
            {step === 'pick' && (
              <>
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Link Social Profile</Text>
                <Text style={styles.modalSub}>Choose a platform to verify ownership via bio code</Text>
                {PLATFORMS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.platformOption, selectedPlatform === p && styles.platformOptionSelected]}
                    onPress={() => setSelectedPlatform(p)}>
                    <View style={[styles.platformIconWrap, { backgroundColor: platformColor(p) }]}>
                      <PlatformIcon platform={p} size={14} color="#fff" />
                    </View>
                    <Text style={[styles.platformOptionText, dark && styles.textLight]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                    {selectedPlatform === p && (
                      <Icon name="check" iconStyle="solid" size={15} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setLinkModal(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirm, !selectedPlatform && styles.modalConfirmDisabled]}
                    disabled={!selectedPlatform}
                    onPress={handleRequestCode}>
                    <Text style={styles.modalConfirmText}>Generate Code</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {step === 'verify' && (
              <>
                <Text style={[styles.modalTitle, dark && styles.textLight]}>
                  Verify {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
                </Text>
                <Text style={styles.modalSub}>
                  Paste this unique code into your bio/profile description, then enter details below:
                </Text>
                <View style={styles.codeDisplay}>
                  <Text style={styles.codeDisplayValue}>{bioCode}</Text>
                </View>
                <Text style={styles.codeHint}>Code expires in 15 minutes</Text>

                <TextInput
                  style={[styles.input, dark && styles.inputDark]}
                  value={profileUrl}
                  onChangeText={setProfileUrl}
                  placeholder={`Your ${selectedPlatform} profile URL`}
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, dark && styles.inputDark]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Your username/handle"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setLinkModal(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleVerify} disabled={verifying}>
                    <Text style={styles.modalConfirmText}>{verifying ? 'Verifying…' : 'Verify & Link'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  
  // Profile Header Card
  profileHeaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...shadow.card,
  },
  avatarGlowOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  nameText: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  contactText: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
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

  // Hero Card
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    ...shadow.raised,
  },
  heroCardDark: { backgroundColor: colors.primaryDeep },
  heroGlowAccent: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#DDD6FE', textTransform: 'uppercase', letterSpacing: 0.5 },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  historyPillText: { fontSize: 11, fontWeight: '700', color: colors.white },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 8 },
  heroValue: { fontSize: 42, fontWeight: '900', color: colors.white, letterSpacing: -1 },
  heroUnit: { fontSize: 16, fontWeight: '800', color: '#DDD6FE' },
  heroFooterRow: { marginTop: 4 },
  heroFooterHint: { fontSize: 12, color: '#E9D5FF', fontWeight: '500' },

  // Quick Action Grid
  gridSection: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tileCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadow.card,
  },
  tileIconBg: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileContent: { flex: 1 },
  tileLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

  // Section Layouts
  sectionContainer: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionHeaderBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, ...shadow.card },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  cardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 14 },
  centerCard: { alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Wallet Inputs
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputBoxDark: { backgroundColor: colors.surfaceAltDark, borderColor: colors.borderDark },
  textInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  textInputDark: { color: colors.textDark },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    marginTop: 6,
    ...shadow.raised,
  },
  primaryActionText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  msgBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, marginBottom: 10 },
  msgOk: { backgroundColor: colors.successSoft },
  msgErr: { backgroundColor: colors.dangerSoft },
  msgText: { fontSize: 12, fontWeight: '700' },
  msgTextOk: { color: colors.success },
  msgTextErr: { color: colors.danger },

  // Social Links
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addLinkText: { fontSize: 12, fontWeight: '800', color: colors.primaryDeep },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, alignItems: 'center', ...shadow.card },
  emptyIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  socialProfileItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    ...shadow.card,
  },
  socialIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  socialInfo: { flex: 1 },
  socialUsername: { fontSize: 14, fontWeight: '800', color: colors.text },
  socialPlatform: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 1 },
  lockStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  lockStatusText: { fontSize: 10, fontWeight: '700', color: colors.textFaint },

  // Referral Component
  referralBanner: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  referralBannerTitle: { fontSize: 14, fontWeight: '800', color: colors.primaryDeep, marginBottom: 4 },
  referralBannerSub: { fontSize: 12, color: colors.text, lineHeight: 16 },
  codeContainer: { alignItems: 'center', marginVertical: 4 },
  codeLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  codeBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  codeText: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: 3 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    marginTop: 14,
    ...shadow.raised,
  },
  shareBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  referredByBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  referredByText: { fontSize: 12, fontWeight: '700', color: colors.success },

  // Settings Cards
  settingRowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    ...shadow.card,
  },
  settingIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTextGroup: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  settingSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },

  // Modal Styling
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,18,0.6)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, maxHeight: '90%', ...shadow.float },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 17 },
  platformOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8 },
  platformOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  platformIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  platformOptionText: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surfaceAlt },
  modalCancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  modalConfirm: { flex: 1, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.primary, ...shadow.raised },
  modalConfirmDisabled: { backgroundColor: colors.textFaint, shadowOpacity: 0, elevation: 0 },
  modalConfirmText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  codeDisplay: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginBottom: 4 },
  codeDisplayValue: { fontSize: 24, fontWeight: '900', color: colors.primaryDeep, letterSpacing: 4 },
  codeHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text, marginBottom: 10, backgroundColor: colors.surfaceAlt },
  inputDark: { borderColor: colors.borderDark, color: colors.textDark, backgroundColor: colors.surfaceAltDark },
});

