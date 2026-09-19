import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, getPalette, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { PI_APP_URL } from '../config';
import { openInPiBrowser } from '../lib/openUrl';

type Surface = 'android' | 'telegram' | 'pi-browser';

const SURFACES: { key: Surface; label: string; icon: string; color: string }[] = [
  { key: 'android', label: 'Android app', icon: 'android', color: '#34D399' },
  { key: 'telegram', label: 'Telegram', icon: 'telegram', color: '#3B82F6' },
  { key: 'pi-browser', label: 'Pi Browser', icon: 'pi', color: '#8B5CF6' },
];

// Every platform's own ledger balance and level, and a Claim action per
// platform that moves points into the wallet pool — allowed the moment THAT
// platform reaches the withdraw level, regardless of the others.
export default function PlatformsScreen() {
  const dark = useColorScheme() === 'dark';
  const p = getPalette(dark);
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const overview = useQuery(api.identity.overview, userId ? { userId } : 'skip');
  const claim = useMutation(api.identity.claimToWallet);
  const createLinkToken = useMutation(api.piLink.createLinkToken);

  const [claiming, setClaiming] = useState<Surface | null>(null);
  const [amounts, setAmounts] = useState<Record<Surface, string>>({ android: '', telegram: '', 'pi-browser': '' });
  const [busy, setBusy] = useState(false);

  // Pi identity may only be proven by Pi.authenticate() inside the Pi Browser,
  // so linking hands off to pi.view2earn.org with a one-time token and the
  // username shown here is whatever the server verified — never typed by hand.
  const verifyPi = async () => {
    try {
      const token = await createLinkToken();
      await openInPiBrowser(`${PI_APP_URL}/link?token=${encodeURIComponent(token)}`);
    } catch (e: any) {
      Alert.alert("Couldn't start verification", String(e?.message ?? e).replace('[CONVEX] ', ''));
    }
  };

  const doClaim = async (surface: Surface) => {
    if (!userId) return;
    const amount = parseInt(amounts[surface], 10);
    if (!amount || amount <= 0) {
      Alert.alert('Enter an amount', 'How many points do you want to claim?');
      return;
    }
    setBusy(true);
    try {
      const res = await claim({ userId, surface, amount });
      Alert.alert('Claimed', `${amount.toLocaleString()} PTS moved to your wallet. Wallet balance: ${res.walletAfter.toLocaleString()} PTS.`);
      setAmounts((a) => ({ ...a, [surface]: '' }));
      setClaiming(null);
    } catch (e: any) {
      Alert.alert("Couldn't claim", String(e?.message ?? e).replace('[CONVEX] ', ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <PageHeader title="Platforms" subtitle="Balances & levels on each app" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>WALLET · CLAIMED POINTS</Text>
          <Text style={styles.heroValue}>
            {overview ? overview.wallet.toLocaleString() : '…'} <Text style={styles.heroUnit}>PTS</Text>
          </Text>
          <Text style={styles.heroHint}>
            {overview ? `Claim from any platform at level ${overview.minLevel}. This is what you can swap or withdraw.` : ' '}
          </Text>
        </View>

        {!overview ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : (
          SURFACES.map((s) => {
            const balance = overview.balances[s.key];
            const level = overview.levels[s.key];
            const linked = overview.linked[s.key];
            const eligible = overview.eligible[s.key];
            const reason = overview.reasons[s.key];
            const open = claiming === s.key;
            const progress = Math.min(1, level / overview.minLevel);
            return (
              <View key={s.key} style={[styles.card, { backgroundColor: p.surface }, !dark && shadow.card]}>
                <View style={styles.cardHead}>
                  <View style={[styles.badge, { backgroundColor: s.color + '22' }]}>
                    <Icon name={s.icon} iconStyle="brand" size={18} color={s.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: p.text }]}>{s.label}</Text>
                    <Text style={[styles.sub, { color: linked ? p.textMuted : colors.warn }]}>
                      {linked ? `Level ${level} of ${overview.minLevel}` : s.key === 'pi-browser' ? 'Not verified' : 'Not linked'}
                    </Text>
                    {s.key === 'pi-browser' && linked ? (
                      <View style={styles.verifiedRow}>
                        <Icon name="circle-check" iconStyle="solid" size={11} color={colors.success} />
                        <Text style={styles.verifiedText}>
                          {overview.piUsername ? `@${overview.piUsername}` : 'Pi account'} · Verified
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.balance, { color: p.text }]}>{balance.toLocaleString()}</Text>
                    <Text style={[styles.unit, { color: p.textFaint }]}>PTS</Text>
                  </View>
                </View>

                <View style={[styles.track, { backgroundColor: p.surfaceAlt }]}>
                  <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: eligible ? colors.success : s.color }]} />
                </View>

                {eligible ? (
                  open ? (
                    <View style={styles.claimRow}>
                      <View style={[styles.amountBox, { backgroundColor: p.surfaceAlt }]}>
                        <TextInput
                          style={[styles.amountInput, { color: p.text }]}
                          value={amounts[s.key]}
                          onChangeText={(t) => setAmounts((a) => ({ ...a, [s.key]: t.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={p.textFaint}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => setAmounts((a) => ({ ...a, [s.key]: String(balance) }))} hitSlop={8}>
                          <Text style={styles.max}>MAX</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} onPress={() => doClaim(s.key)} disabled={busy} activeOpacity={0.85}>
                        {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnText}>Claim</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btn, styles.btnWide, balance <= 0 && { opacity: 0.5 }]}
                      onPress={() => setClaiming(s.key)}
                      disabled={balance <= 0}
                      activeOpacity={0.85}>
                      <Icon name="arrow-right-to-bracket" iconStyle="solid" size={13} color="#FFF" />
                      <Text style={styles.btnText}>Claim to wallet</Text>
                    </TouchableOpacity>
                  )
                ) : s.key === 'pi-browser' && !linked ? (
                  <TouchableOpacity style={[styles.btn, styles.btnWide, { backgroundColor: s.color }]} onPress={verifyPi} activeOpacity={0.85}>
                    <Icon name="pi" iconStyle="brand" size={13} color="#FFF" />
                    <Text style={styles.btnText}>Verify in Pi Browser</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.lock, { backgroundColor: p.surfaceAlt }]}>
                    <Icon name="lock" iconStyle="solid" size={12} color={p.textMuted} />
                    <Text style={[styles.lockText, { color: p.textMuted }]}>{reason}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { backgroundColor: '#1E1B4B', borderRadius: 24, padding: 22, marginBottom: 16, ...shadow.float },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroValue: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  heroUnit: { fontSize: 16, color: '#FBBF24' },
  heroHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: '600', marginTop: 6, lineHeight: 18 },
  card: { borderRadius: 20, padding: 16, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  balance: { fontSize: 17, fontWeight: '900' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  verifiedText: { fontSize: 12, fontWeight: '800', color: colors.success },
  unit: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  track: { height: 6, borderRadius: 3, marginTop: 14, marginBottom: 12, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  claimRow: { flexDirection: 'row', gap: 8 },
  amountBox: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, paddingHorizontal: 14 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '800', padding: 0 },
  max: { color: colors.primary, fontWeight: '900', fontSize: 12 },
  btn: { height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnWide: { alignSelf: 'stretch' },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  lockText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
});
