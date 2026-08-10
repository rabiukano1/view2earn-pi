import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { smartOpenUrl } from '../lib/openUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import PlatformIcon, { platformColor } from '../components/PlatformIcon';
import Icon from '../components/Icon';

const PLATFORMS = ['facebook', 'tiktok', 'telegram', 'instagram', 'youtube', 'x'] as const;

export default function LinkedAccountsScreen() {
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

  const me = useQuery(api.users.me);
  const profiles = useQuery(api.linkedProfiles.listMyProfiles, userId ? { userId } : 'skip');
  const requestBioCode = useMutation(api.linkedProfiles.requestBioCode);
  const verifyBioCode = useAction(api.linkedProfiles.verifyBioCode);
  const linkStart = useMutation(api.telegramAuth.linkStart);
  const linkComplete = useMutation(api.telegramAuth.linkComplete);
  const [tgNonce, setTgNonce] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgMsg, setTgMsg] = useState('');
  const tgStatus = useQuery(api.telegramAuth.status, tgNonce ? { nonce: tgNonce } : 'skip');

  useEffect(() => {
    if (tgNonce && tgStatus?.verified) {
      const nonce = tgNonce;
      setTgNonce(null);
      setTgBusy(true);
      linkComplete({ userId: userId!, nonce })
        .then(() => setTgMsg('Telegram linked! Channel-join tasks now verify instantly via the bot.'))
        .catch((e: unknown) =>
          setTgMsg(
            'Could not link Telegram: ' +
              String((e as Error)?.message ?? e).replace('[CONVEX] ', ''),
          ),
        )
        .finally(() => setTgBusy(false));
    }
  }, [tgNonce, tgStatus, linkComplete, userId]);

  const handleLinkTelegram = async () => {
    if (tgBusy || !userId) return;
    setTgMsg('');
    setTgBusy(true);
    try {
      const { nonce, url } = await linkStart({ userId });
      setTgNonce(nonce);
      await smartOpenUrl(url);
      setTgMsg('Tap Start in the Telegram bot, then come back — it verifies automatically.');
    } catch {
      setTgNonce(null);
      setTgMsg('Could not open Telegram. Try again.');
    } finally {
      setTgBusy(false);
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
      <PageHeader
        title="Linked Accounts"
        subtitle="Verify your profiles for automatic task verification"
        back
      />
      <View style={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.sectionHeaderBetween}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Social Profiles</Text>
          <TouchableOpacity style={styles.addLinkBtn} onPress={openLinkFlow} activeOpacity={0.85}>
            <Icon name="plus" iconStyle="solid" size={12} color={colors.primaryDeep} />
            <Text style={styles.addLinkText}>Link Social</Text>
          </TouchableOpacity>
        </View>

        {!profiles ? (
          <View style={[styles.centerCard, dark && styles.cardDark]}>
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

        <Text style={[styles.sectionTitle, dark && styles.textLight, styles.tgSectionTitle]}>
          Telegram Verification
        </Text>
        <View style={[styles.card, dark && styles.cardDark]}>
          {me?.telegramUserId ? (
            <View style={styles.socialProfileItem}>
              <View style={[styles.socialIconCircle, { backgroundColor: '#229ED9' }]}>
                <PlatformIcon platform="telegram" size={15} color="#fff" />
              </View>
              <View style={styles.socialInfo}>
                <Text style={[styles.socialUsername, dark && styles.textLight]}>
                  Telegram user {me.telegramUserId}
                </Text>
                <Text style={styles.socialPlatform}>LINKED · INSTANT JOIN VERIFY</Text>
              </View>
              <View style={[styles.lockStatusBadge, { backgroundColor: colors.successSoft }]}>
                <Icon name="check" iconStyle="solid" size={10} color={colors.success} />
                <Text style={[styles.lockStatusText, { color: '#15803D' }]}>Linked</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptySubtitle}>
              Link your Telegram to verify channel-join tasks instantly via the bot — no screenshot
              needed.
            </Text>
          )}
          <TouchableOpacity
            style={[styles.tgLinkBtn, tgBusy && styles.tgLinkBtnBusy]}
            onPress={handleLinkTelegram}
            disabled={tgBusy}
            activeOpacity={0.85}>
            <Icon name="telegram" iconStyle="brand" size={14} color={colors.white} />
            <Text style={styles.tgLinkBtnText}>
              {tgBusy
                ? 'Waiting for Telegram…'
                : me?.telegramUserId
                  ? 'Relink Telegram'
                  : 'Link Telegram'}
            </Text>
          </TouchableOpacity>
          {tgMsg ? (
            <Text style={[styles.tgMsg, tgMsg.includes('linked!') && styles.tgMsgOk]}>{tgMsg}</Text>
          ) : null}
        </View>
      </View>

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
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
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
  centerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
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
  socialIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  socialInfo: { flex: 1 },
  socialUsername: { fontSize: 14, fontWeight: '800', color: colors.text },
  socialPlatform: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 1 },
  lockStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  lockStatusText: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  tgSectionTitle: { marginTop: 22 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, ...shadow.card },
  tgLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#229ED9',
    borderRadius: radius.pill,
    paddingVertical: 13,
    marginTop: 12,
    ...shadow.raised,
  },
  tgLinkBtnBusy: { opacity: 0.6 },
  tgLinkBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  tgMsg: { fontSize: 11.5, color: colors.danger, marginTop: 10, textAlign: 'center', lineHeight: 16 },
  tgMsgOk: { color: colors.success },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,18,0.6)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, maxHeight: '90%', ...shadow.float },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 17 },
  platformOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 8,
  },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
    backgroundColor: colors.surfaceAlt,
  },
  inputDark: { borderColor: colors.borderDark, color: colors.textDark, backgroundColor: colors.surfaceAltDark },
});
