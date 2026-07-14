import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { deviceFingerprint } from '../lib/device';
import { colors, radius, shadow } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORMS = ['facebook', 'tiktok', 'telegram', 'instagram', 'youtube', 'x'] as const;

export default function ProfileScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [step, setStep] = useState<'pick' | 'code' | 'verify'>('pick');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [bioCode, setBioCode] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [username, setUsername] = useState('');
  const [verifying, setVerifying] = useState(false);
  const stackNav = useNavigation<StackNav>();

  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const profiles = useQuery(api.linkedProfiles.listMyProfiles, userId ? { userId } : 'skip');
  const referral = useQuery(api.rewards.myReferral, userId ? { userId } : 'skip');
  const requestBioCode = useMutation(api.linkedProfiles.requestBioCode);
  const verifyBioCode = useAction(api.linkedProfiles.verifyBioCode);

  useEffect(() => {
    getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
      .then((id) => setUserId(id))
      .catch((e) => Alert.alert('Error', String(e)));
  }, [getOrCreateDevUser]);

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
        <View style={[styles.balanceCard, dark && styles.balanceCardDark]}>
          <Text style={styles.balanceLabel}>Points Balance</Text>
          <Text style={styles.balanceValue}>
            {balance === undefined ? '...' : balance}
          </Text>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => stackNav.navigate('PointsHistory')}>
            <Text style={styles.historyBtnText}>View History →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Linked Profiles</Text>
          {!profiles ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : profiles.length === 0 ? (
            <View style={[styles.emptyCard, dark && styles.cardDark]}>
              <Text style={[styles.emptyText, dark && styles.textMuted]}>
                No profiles linked yet
              </Text>
              <Text style={styles.emptySubtext}>
                Link your social profiles to start earning
              </Text>
            </View>
          ) : (
            profiles.map((p) => (
              <View key={p._id} style={[styles.profileCard, dark && styles.cardDark]}>
                <View style={[styles.platformDot, { backgroundColor: platformColor(p.platform) }]} />
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, dark && styles.textLight]}>
                    {p.usernameSnapshot}
                  </Text>
                  <Text style={styles.profilePlatform}>{p.platform}</Text>
                </View>
                <Text style={styles.lockedBadge}>
                  {Date.now() < p.lockedUntil ? 'Locked' : 'Expired'}
                </Text>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.linkButton} onPress={openLinkFlow}>
            <Text style={styles.linkButtonText}>+ Link New Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Referral</Text>
          <View style={[styles.referralCard, dark && styles.cardDark]}>
            <Text style={[styles.referralText, dark && styles.textMuted]}>
              Share your referral code to earn bonus points when friends join!
            </Text>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCode}>{referral?.code ?? '…'}</Text>
            </View>
            <Text style={styles.referralCount}>
              {referral ? `${referral.count} friend${referral.count === 1 ? '' : 's'} referred` : ' '}
            </Text>
          </View>
        </View>
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
                    <View style={[styles.platformDot, { backgroundColor: platformColor(p) }]} />
                    <Text style={[styles.platformOptionText, dark && styles.textLight]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                    {selectedPlatform === p && <Text style={styles.checkmark}>✓</Text>}
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
                  <TouchableOpacity
                    style={styles.modalConfirm}
                    onPress={handleVerify}
                    disabled={verifying}>
                    <Text style={styles.modalConfirmText}>
                      {verifying ? 'Verifying…' : 'Verify & Link'}
                    </Text>
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

function platformColor(platform: string): string {
  switch (platform) {
    case 'facebook': return '#1877F2';
    case 'tiktok': return '#010101';
    case 'telegram': return '#229ED9';
    case 'instagram': return '#E4405F';
    case 'youtube': return '#FF0000';
    case 'x': return '#000000';
    default: return '#6B7280';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textFaint },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 26, alignItems: 'center', marginBottom: 24, ...shadow.raised },
  balanceCardDark: { backgroundColor: colors.primaryDeep },
  balanceLabel: { fontSize: 13, color: '#DDD6FE', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  balanceValue: { fontSize: 46, fontWeight: '800', color: colors.white, marginTop: 6, letterSpacing: -1 },
  historyBtn: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  historyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '700' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  profileCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  platformDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.text },
  profilePlatform: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  lockedBadge: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
  linkButton: { marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center' },
  linkButtonText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 14 },
  referralCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 20, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  referralText: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
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
  checkmark: { color: colors.primary, fontWeight: '800', fontSize: 16 },
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
