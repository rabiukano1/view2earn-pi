import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../../../convex/_generated/api';
import { colors, getPalette, shadow } from '../theme';
import Icon from '../components/Icon';

const WALLET_ICON = require('../assets/wallet_icon.png');
const MAIN_APP_LOGIN_URL = 'view2earn://login';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.view2earn';

type Phase = 'idle' | 'waiting' | 'completing' | 'not-installed' | 'expired' | 'error';

// Reads the nonce out of a view2earnwallet://auth/<nonce> bounce-back link.
function nonceFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/^view2earnwallet:\/\/auth\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export default function SignInScreen() {
  const dark = useColorScheme() === 'dark';
  const p = getPalette(dark);
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const start = useMutation(api.walletAuth.start);

  const [phase, setPhase] = useState<Phase>('idle');
  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState('');
  const status = useQuery(api.walletAuth.status, nonce ? { nonce } : 'skip');
  const completingRef = useRef(false);

  // Exchange an approved nonce for a session. Once this resolves the auth
  // provider flips isAuthenticated and the navigator swaps to the app.
  const complete = useCallback(
    async (n: string) => {
      if (completingRef.current) return;
      completingRef.current = true;
      setPhase('completing');
      try {
        await signIn('wallet-handoff', { nonce: n });
      } catch (e: any) {
        completingRef.current = false;
        setError(String(e?.message ?? e).replace('[CONVEX] ', ''));
        setPhase('error');
      }
    },
    [signIn],
  );

  // Path 1: polling. Completes even if the bounce-back link never fires.
  useEffect(() => {
    if (!nonce || !status) return;
    if (status.state === 'approved') complete(nonce);
    else if (status.state === 'expired') setPhase('expired');
  }, [status, nonce, complete]);

  // Path 2: the main app bounces back with the nonce in a deep link.
  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      const n = nonceFromUrl(url);
      if (n) {
        setNonce(n);
        complete(n);
      }
    };
    const sub = Linking.addEventListener('url', onUrl);
    Linking.getInitialURL().then((url) => {
      const n = nonceFromUrl(url);
      if (n) {
        setNonce(n);
        complete(n);
      }
    }).catch(() => {});
    return () => sub.remove();
  }, [complete]);

  const handleContinue = async () => {
    setError('');
    completingRef.current = false;
    try {
      const res = await start();
      setNonce(res.nonce);
      setPhase('waiting');
      await Linking.openURL(res.url);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/No Activity|not found|cannot open|Unable to open|ActivityNotFound/i.test(msg)) {
        setPhase('not-installed');
      } else {
        setError(msg.replace('[CONVEX] ', ''));
        setPhase('error');
      }
    }
  };

  const reset = () => {
    completingRef.current = false;
    setNonce(null);
    setError('');
    setPhase('idle');
  };

  const openMainAppLogin = () => {
    Linking.openURL(MAIN_APP_LOGIN_URL).catch(() => Linking.openURL(PLAY_STORE_URL).catch(() => {}));
  };

  const openPlayStore = () => {
    Linking.openURL('market://details?id=com.view2earn').catch(() => Linking.openURL(PLAY_STORE_URL).catch(() => {}));
  };

  const busy = phase === 'waiting' || phase === 'completing';

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Brand hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 44 }]}>
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />
        <Image source={WALLET_ICON} style={styles.logo} />
        <Text style={styles.heroTitle}>View2Earn Wallet</Text>
        <Text style={styles.heroSub}>Your points & tokens, in one place</Text>
      </View>

      {/* Sign-in card */}
      <View style={[styles.card, { backgroundColor: p.surface }, !dark && shadow.float]}>
        {phase === 'idle' || phase === 'error' ? (
          <>
            <Text style={[styles.cardTitle, { color: p.text }]}>Sign in</Text>
            <Text style={[styles.cardSub, { color: p.textMuted }]}>
              One tap. The wallet uses the account you're already signed in to on View2Earn — nothing to type.
            </Text>

            {phase === 'error' && error ? (
              <View style={styles.errorBox}>
                <Icon name="triangle-exclamation" iconStyle="solid" size={13} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.88}>
              <View style={styles.buttonIconWrap}>
                <Icon name="bolt" iconStyle="solid" size={13} color={colors.primary} />
              </View>
              <Text style={styles.buttonText}>Continue with View2Earn</Text>
              <Icon name="arrow-right" iconStyle="solid" size={14} color="#FFF" />
            </TouchableOpacity>
          </>
        ) : null}

        {busy ? (
          <>
            <View style={styles.waitRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.cardTitle, { color: p.text, fontSize: 18 }]}>
                {phase === 'completing' ? 'Signing you in…' : 'Waiting for View2Earn…'}
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: p.textMuted }]}>
              {phase === 'completing'
                ? 'Almost there.'
                : 'Approve in the View2Earn app. This screen will finish automatically when you come back.'}
            </Text>
            {phase === 'waiting' ? (
              <>
                <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: p.surfaceAlt }]} onPress={handleContinue} activeOpacity={0.85}>
                  <Icon name="arrow-up-right-from-square" iconStyle="solid" size={13} color={p.text} />
                  <Text style={[styles.secondaryBtnText, { color: p.text }]}>Open View2Earn again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={reset} hitSlop={8}>
                  <Text style={[styles.linkText, { color: p.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        ) : null}

        {phase === 'expired' ? (
          <>
            <Text style={[styles.cardTitle, { color: p.text }]}>Link expired</Text>
            <Text style={[styles.cardSub, { color: p.textMuted }]}>
              That sign-in link timed out. Tap below to start again — it only takes a moment.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.88}>
              <Text style={styles.buttonText}>Try again</Text>
              <Icon name="rotate-right" iconStyle="solid" size={14} color="#FFF" />
            </TouchableOpacity>
          </>
        ) : null}

        {phase === 'not-installed' ? (
          <>
            <Text style={[styles.cardTitle, { color: p.text }]}>Get View2Earn first</Text>
            <Text style={[styles.cardSub, { color: p.textMuted }]}>
              The wallet signs in through the View2Earn app. Install it, create your account there, then come back and tap Continue.
            </Text>
            <TouchableOpacity style={styles.button} onPress={openPlayStore} activeOpacity={0.88}>
              <Icon name="google-play" iconStyle="brand" size={15} color="#FFF" />
              <Text style={styles.buttonText}>Get it on Google Play</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={reset} hitSlop={8}>
              <Text style={[styles.linkText, { color: p.textMuted }]}>I've installed it</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {!busy && phase !== 'not-installed' ? (
          <TouchableOpacity style={styles.footer} onPress={openMainAppLogin} activeOpacity={0.7} hitSlop={6}>
            <Text style={[styles.footerText, { color: p.textMuted }]}>
              New here? <Text style={styles.footerLink}>Create your account in View2Earn</Text> — it works in both apps.
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    paddingBottom: 64,
    paddingHorizontal: 24,
    overflow: 'hidden',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroGlow1: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(139, 92, 246, 0.42)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  logo: { width: 92, height: 92, borderRadius: 24, marginBottom: 18 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13.5, fontWeight: '600', marginTop: 4 },

  card: {
    marginHorizontal: 18,
    marginTop: -36,
    borderRadius: 26,
    padding: 22,
  },
  cardTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  cardSub: { fontSize: 13.5, fontWeight: '600', lineHeight: 20, marginTop: 6, marginBottom: 18 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.danger, lineHeight: 18 },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  buttonIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 15.5, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { fontSize: 13.5, fontWeight: '700' },

  footer: { marginTop: 18 },
  footerText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  footerLink: { color: colors.primary, fontWeight: '800' },
});
