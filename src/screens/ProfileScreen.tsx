import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
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

function MenuRow({
  icon,
  label,
  tint,
  dark,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: tint + '22' }]}>
        <Icon name={icon} iconStyle="solid" size={16} color={tint} />
      </View>
      <Text style={[styles.menuLabel, dark && styles.textLight]}>{label}</Text>
      <Icon name="chevron-right" iconStyle="solid" size={14} color={colors.textFaint} />
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

  const displayName = me?.name || me?.username || 'View2Earn member';
  const displayContact = me?.email ?? '';

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
      <PageHeader title="Profile" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Icon name="user" iconStyle="solid" size={30} color="#fff" />
          </View>
          <Text style={[styles.name, dark && styles.textLight]}>{displayName}</Text>
          {displayContact ? <Text style={styles.contact}>{displayContact}</Text> : null}
        </View>

        {/* Balance */}
        <View style={[styles.balanceCard, dark && styles.balanceCardDark]}>
          <View style={styles.balanceTop}>
            <Icon name="coins" iconStyle="solid" size={15} color="#DDD6FE" />
            <Text style={styles.balanceLabel}>Points Balance</Text>
          </View>
          <Text style={styles.balanceValue}>{balance === undefined ? '…' : balance}</Text>
        </View>

        {/* Menu */}
        <View style={[styles.menuCard, dark && styles.cardDark]}>
          <MenuRow
            icon="graduation-cap"
            tint="#F59E0B"
            label="Learn Pi & Sidra"
            dark={dark}
            onPress={() =>
              stackNav.navigate('Academy', userId ? { userId, ecosystem: 'PI' } : undefined)
            }
          />
          <View style={[styles.rowDivider, dark && styles.rowDividerDark]} />
          <MenuRow
            icon="clock-rotate-left"
            tint={colors.primary}
            label="Points history"
            dark={dark}
            onPress={() => stackNav.navigate('PointsHistory')}
          />
        </View>

        {/* Linked profiles */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Linked Profiles</Text>
          {!profiles ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : profiles.length === 0 ? (
            <View style={[styles.emptyCard, dark && styles.cardDark]}>
              <Text style={[styles.emptyText, dark && styles.textLight]}>No profiles linked yet</Text>
              <Text style={styles.emptySubtext}>Link your socials to start earning</Text>
            </View>
          ) : (
            profiles.map((p) => (
              <View key={p._id} style={[styles.profileCard, dark && styles.cardDark]}>
                <View style={[styles.platformIconWrap, { backgroundColor: platformColor(p.platform) }]}>
                  <PlatformIcon platform={p.platform} size={14} color="#fff" />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, dark && styles.textLight]}>{p.usernameSnapshot}</Text>
                  <Text style={styles.profilePlatform}>{p.platform}</Text>
                </View>
                <Text style={styles.lockedBadge}>
                  {Date.now() < p.lockedUntil ? 'Locked' : 'Expired'}
                </Text>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.linkButton} onPress={openLinkFlow}>
            <Icon name="plus" iconStyle="solid" size={13} color={colors.primaryDeep} />
            <Text style={styles.linkButtonText}>Link new profile</Text>
          </TouchableOpacity>
        </View>

        {/* Referral */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Referral</Text>
          <View style={[styles.referralCard, dark && styles.cardDark]}>
            <View style={styles.referralHead}>
              <Icon name="share-nodes" iconStyle="solid" size={14} color={colors.primary} />
              <Text style={[styles.referralText, dark && styles.textMuted]}>
                Share your code — earn bonus points when friends join
              </Text>
            </View>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCode}>{referral?.code ?? '…'}</Text>
            </View>
            <Text style={styles.referralCount}>
              {referral ? `${referral.count} friend${referral.count === 1 ? '' : 's'} referred` : ' '}
            </Text>
          </View>
        </View>

        {/* Settings */}
        {bioAvailable && (
          <View style={[styles.lockRow, dark && styles.cardDark]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + '22' }]}>
              <Icon name="fingerprint" iconStyle="solid" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lockTitle, dark && styles.textLight]}>Fingerprint lock</Text>
              <Text style={styles.lockSub}>Require fingerprint to open the app</Text>
            </View>
            <Switch value={lockOn} onValueChange={toggleLock} trackColor={{ true: colors.primary }} />
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()} activeOpacity={0.85}>
          <Icon name="right-from-bracket" iconStyle="solid" size={15} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={linkModal} transparent animationType="fade" onRequestClose={() => setLinkModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, dark && styles.cardDark]}>
            {step === 'pick' && (
              <>
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Choose Platform</Text>
                <Text style={styles.modalSub}>Select the social platform to link</Text>
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
                  Put this code in your bio, then fill in the details below:
                </Text>
                <View style={styles.codeDisplay}>
                  <Text style={styles.codeText}>{bioCode}</Text>
                </View>
                <Text style={styles.codeHint}>Valid for 15 minutes</Text>
                <TextInput
                  style={[styles.input, dark && styles.inputDark]}
                  value={profileUrl}
                  onChangeText={setProfileUrl}
                  placeholder={`Your ${selectedPlatform} profile URL`}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, dark && styles.inputDark]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Your profile username"
                  placeholderTextColor="#9CA3AF"
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
  textMuted: { color: colors.textFaint },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  identity: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...shadow.raised,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  contact: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 22, alignItems: 'center', marginBottom: 16, ...shadow.raised },
  balanceCardDark: { backgroundColor: colors.primaryDeep },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  balanceLabel: { fontSize: 12, color: '#DDD6FE', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  balanceValue: { fontSize: 44, fontWeight: '800', color: colors.white, marginTop: 4, letterSpacing: -1 },
  menuCard: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 24, ...shadow.card },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  rowDividerDark: { backgroundColor: colors.borderDark },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 22, alignItems: 'center', ...shadow.card },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '700' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  profileCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, ...shadow.card },
  platformIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.text },
  profilePlatform: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  lockedBadge: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
  linkButton: { marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  linkButtonText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 14 },
  signOutBtn: { marginTop: 8, borderRadius: radius.sm, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1.5, borderColor: colors.danger },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  lockTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  lockSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  referralCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 18, ...shadow.card },
  referralHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  referralText: { flex: 1, fontSize: 13, color: colors.textMuted },
  referralCodeBox: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
  referralCode: { fontSize: 20, fontWeight: '800', color: colors.primaryDeep, letterSpacing: 3 },
  referralCount: { fontSize: 12, color: colors.textMuted, marginTop: 10, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,18,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, maxHeight: '90%', ...shadow.float },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  platformOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, marginBottom: 8 },
  platformOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  platformOptionText: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.surfaceAlt },
  modalCancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  modalConfirm: { flex: 1, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.primary, ...shadow.raised },
  modalConfirmDisabled: { backgroundColor: colors.textFaint, shadowOpacity: 0, elevation: 0 },
  modalConfirmText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  codeDisplay: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 16, alignItems: 'center', marginBottom: 4 },
  codeText: { fontSize: 26, fontWeight: '800', color: colors.primaryDeep, letterSpacing: 5 },
  codeHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: colors.text, marginBottom: 10, backgroundColor: colors.surfaceAlt },
  inputDark: { borderColor: colors.borderDark, color: colors.textDark, backgroundColor: colors.surfaceAltDark },
});
