import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';

export default function PayoutSettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const me = useQuery(api.users.me);
  const setPayoutWallet = useMutation(api.wallets.setPayoutWallet);
  const [evmAddr, setEvmAddr] = useState('');
  const [solAddr, setSolAddr] = useState('');
  const [walletSeeded, setWalletSeeded] = useState(false);
  const [walletMsg, setWalletMsg] = useState('');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await setPayoutWallet({ userId, evm: evmAddr, solana: solAddr });
      setWalletMsg('Wallet addresses saved!');
    } catch (e) {
      setWalletMsg(String((e as { message?: string })?.message ?? e).replace('[CONVEX] ', ''));
    } finally {
      setSaving(false);
    }
  };

  const ok = walletMsg.includes('saved');

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Payout Wallets" subtitle="Where your earned tokens are sent" back />
      <View style={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
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
            <View style={[styles.msgBadge, ok ? styles.msgOk : styles.msgErr]}>
              <Icon
                name={ok ? 'circle-check' : 'triangle-exclamation'}
                iconStyle="solid"
                size={12}
                color={ok ? colors.success : colors.danger}
              />
              <Text style={[styles.msgText, ok ? styles.msgTextOk : styles.msgTextErr]}>{walletMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryActionBtn, saving && styles.primaryActionBtnBusy]}
            onPress={saveWallets}
            disabled={saving}
            activeOpacity={0.85}>
            <Icon name="floppy-disk" iconStyle="solid" size={14} color={colors.white} />
            <Text style={styles.primaryActionText}>{saving ? 'Saving…' : 'Save Wallet Addresses'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, ...shadow.card },
  cardDark: { backgroundColor: colors.surfaceDark },
  cardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 14 },
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
  primaryActionBtnBusy: { opacity: 0.6 },
  primaryActionText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  msgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginBottom: 10,
  },
  msgOk: { backgroundColor: colors.successSoft },
  msgErr: { backgroundColor: colors.dangerSoft },
  msgText: { fontSize: 12, fontWeight: '700' },
  msgTextOk: { color: colors.success },
  msgTextErr: { color: colors.danger },
});
