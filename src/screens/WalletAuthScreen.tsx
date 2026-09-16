import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { setPendingWalletNonce } from '../auth/walletHandoff';
import { colors, radius, shadow } from '../theme';
import Icon from '../components/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletAuth'>;

type Phase = 'approving' | 'done' | 'error' | 'signed-out';

// Landing screen for view2earn://wallet-auth/<nonce>, opened by the wallet
// app's "Continue with View2Earn" button. Approves the nonce as the current
// user and bounces back to the wallet, which then completes its own sign-in.
export default function WalletAuthScreen({ navigation, route }: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const approve = useMutation(api.walletAuth.approve);
  const nonce = route.params?.nonce;

  const [phase, setPhase] = useState<Phase>(userId ? 'approving' : 'signed-out');
  const [error, setError] = useState('');
  const bounceUrlRef = useRef<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!userId || !nonce || ranRef.current) return;
    ranRef.current = true;
    approve({ userId, nonce })
      .then((res) => {
        bounceUrlRef.current = res.bounceUrl;
        setPhase('done');
        // Hand control straight back to the wallet. If that fails (wallet not
        // installed / no intent filter), the button below still offers it and
        // the wallet's own polling completes the sign-in regardless.
        Linking.openURL(res.bounceUrl).catch(() => {});
      })
      .catch((e) => {
        setError(String(e?.message ?? e).replace('[CONVEX] ', ''));
        setPhase('error');
      });
  }, [userId, nonce, approve]);

  const goHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const goSignIn = () => {
    if (nonce) setPendingWalletNonce(nonce);
    navigation.navigate('Login');
  };

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[styles.card, dark && styles.cardDark]}>
        <View style={[styles.badge, phase === 'error' && styles.badgeErr, phase === 'done' && styles.badgeOk]}>
          {phase === 'approving' ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <Icon
              name={phase === 'done' ? 'circle-check' : phase === 'error' ? 'triangle-exclamation' : 'wallet'}
              iconStyle="solid"
              size={34}
              color={phase === 'done' ? colors.success : phase === 'error' ? colors.danger : colors.primary}
            />
          )}
        </View>

        {phase === 'approving' && (
          <>
            <Text style={[styles.title, dark && styles.titleDark]}>Connecting your wallet…</Text>
            <Text style={styles.sub}>Signing the View2Earn Wallet in with your account.</Text>
          </>
        )}

        {phase === 'done' && (
          <>
            <Text style={[styles.title, dark && styles.titleDark]}>Wallet connected</Text>
            <Text style={styles.sub}>You're signed in to the wallet with this account. Returning you there now.</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => bounceUrlRef.current && Linking.openURL(bounceUrlRef.current).catch(() => {})}
              activeOpacity={0.85}>
              <Icon name="wallet" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.primaryBtnText}>Open Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goHome} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>Stay in View2Earn</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'error' && (
          <>
            <Text style={[styles.title, dark && styles.titleDark]}>Couldn't connect</Text>
            <Text style={styles.sub}>{error || 'This sign-in link is no longer valid.'}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goHome} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Back to View2Earn</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'signed-out' && (
          <>
            <Text style={[styles.title, dark && styles.titleDark]}>Sign in first</Text>
            <Text style={styles.sub}>
              Sign in to View2Earn (or create an account) and the wallet will connect to it automatically.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goSignIn} activeOpacity={0.85}>
              <Icon name="right-to-bracket" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.primaryBtnText}>Sign in / Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 20 },
  containerDark: { backgroundColor: colors.bgDark },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 26,
    alignItems: 'center',
    ...shadow.float,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badgeOk: { backgroundColor: colors.successSoft },
  badgeErr: { backgroundColor: colors.dangerSoft },
  title: { fontSize: 21, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.4 },
  titleDark: { color: colors.textDark },
  sub: { fontSize: 13.5, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  primaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  secondaryBtnText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '700' },
});
