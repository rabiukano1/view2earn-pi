import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { smartOpenUrl } from '../lib/openUrl';
import { api } from '../../convex/_generated/api';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Method = 'password' | 'otp';
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LoginScreenProps {
  onShowSplash?: () => void;
}

export default function LoginScreen({ onShowSplash }: LoginScreenProps = {}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const [method, setMethod] = useState<Method>('password');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(false);
  const applyReferral = useMutation(api.referrals.applyReferralCode);
  const { isAuthenticated } = useConvexAuth();

  const handleTermsUnchecked = () => {
    setError('You must accept the Terms & Conditions and Privacy Policy to continue.');
  };

  // After signup, if a referral code was entered, apply it.
  useEffect(() => {
    if (isAuthenticated && referralCode.trim() && !referralApplied) {
      setReferralApplied(true);
      applyReferral({ code: referralCode.trim() }).catch(() => {
        // Best-effort — don't block the user from using the app.
        if (__DEV__) console.log('referral apply failed');
      });
    }
  }, [isAuthenticated, referralCode, referralApplied, applyReferral]);
  const [suggestSignup, setSuggestSignup] = useState(false);

  // "Sign in with Telegram": open the bot, poll the nonce, sign in when verified.
  const startTelegram = useMutation(api.telegramAuth.start);
  const [tgNonce, setTgNonce] = useState<string | null>(null);
  const tgStatus = useQuery(api.telegramAuth.status, tgNonce ? { nonce: tgNonce } : 'skip');

  useEffect(() => {
    if (tgNonce && tgStatus?.verified) {
      const nonce = tgNonce;
      setTgNonce(null);
      signIn('telegram', { nonce }).catch(() => setError('Telegram sign-in failed — try again.'));
    }
  }, [tgStatus, tgNonce, signIn]);

  const continueWithTelegram = async () => {
    if (!acceptedTerms) return handleTermsUnchecked();
    setError('');
    try {
      const { nonce, url } = await startTelegram({});
      setTgNonce(nonce);
      await smartOpenUrl(url);
    } catch {
      setTgNonce(null);
      setError('Could not open Telegram.');
    }
  };

  const run = async (fn: () => Promise<unknown>, onErr: string) => {
    if (!acceptedTerms) return handleTermsUnchecked();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(onErr);
      if (__DEV__) console.log('auth error', String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    if (!email || !password) return setError('Enter your email and password');
    // Explicit "create account" path.
    if (flow === 'signUp') {
      run(
        () => signIn('password', { email, password, flow: 'signUp' }),
        'Could not create account — the email may be in use, or the password is under 8 characters.',
      );
      return;
    }
    // Sign-in: the error is intentionally generic (unknown email vs wrong
    // password look the same), so on failure we offer to create an account.
    setBusy(true);
    setError('');
    setSuggestSignup(false);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
    } catch (e) {
      if (__DEV__) console.log('signin error', String((e as { message?: string })?.message ?? e));
      setError("We couldn't sign you in with that email.");
      setSuggestSignup(true);
    } finally {
      setBusy(false);
    }
  };

  // Create an account with the email/password already entered.
  const createAccount = () => {
    setSuggestSignup(false);
    run(
      () => signIn('password', { email, password, flow: 'signUp' }),
      'Could not create account — the email may already be in use, or the password is under 8 characters.',
    );
  };

  const sendCode = () => {
    if (!email) return setError('Enter your email');
    run(async () => {
      await signIn('resend-otp', { email });
      setOtpStep('code');
    }, 'Could not send the code — try again.');
  };

  const verifyCode = () => {
    if (!code) return setError('Enter the code from your email');
    run(() => signIn('resend-otp', { email, code }), 'Invalid or expired code.');
  };

  const switchMethod = (m: Method) => {
    setMethod(m);
    setError('');
    setSuggestSignup(false);
    setOtpStep('email');
    setCode('');
  };

  const primaryLabel =
    method === 'password'
      ? flow === 'signUp'
        ? 'Create account'
        : 'Sign in'
      : otpStep === 'email'
        ? 'Email me a code'
        : 'Verify code';

  const onPrimary =
    method === 'password' ? submitPassword : otpStep === 'email' ? sendCode : verifyCode;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <TouchableOpacity activeOpacity={0.85} onPress={onShowSplash}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width: 112, height: 112, borderRadius: 24, marginBottom: 16 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.tagline}>Earn rewards for social engagement</Text>
      </View>

      <View style={styles.card}>
        {/* Method tabs */}
        <View style={styles.tabs}>
          {(['password', 'otp'] as Method[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, method === m && styles.tabActive]}
              onPress={() => switchMethod(m)}>
              <Text style={[styles.tabText, method === m && styles.tabTextActive]}>
                {m === 'password' ? 'Password' : 'Email code'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email */}
        <View style={styles.inputRow}>
          <Icon name="envelope" iconStyle="solid" size={15} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={method === 'password' || otpStep === 'email'}
          />
        </View>

        {method === 'password' && (
          <View style={styles.inputRow}>
            <Icon name="lock" iconStyle="solid" size={15} color={colors.textFaint} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        )}

        {/* Referral code — only visible in sign-up flow */}
        {(method === 'password' && flow === 'signUp') ? (
          <View style={styles.inputRow}>
            <Icon name="gift" iconStyle="solid" size={15} color={colors.textFaint} />
            <TextInput
              style={styles.input}
              placeholder="Referral code (optional)"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              value={referralCode}
              onChangeText={setReferralCode}
              maxLength={10}
            />
          </View>
        ) : null}

        {(method === 'otp' && otpStep === 'code') ? (
          <View style={styles.inputRow}>
            <Icon name="key" iconStyle="solid" size={15} color={colors.textFaint} />
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
            />
          </View>
        ) : null}

        {/* Terms & Privacy Agreement Checkbox */}
        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}
            onPress={() => {
              setAcceptedTerms(!acceptedTerms);
              if (error.includes('Terms')) setError('');
            }}
            activeOpacity={0.8}>
            {Boolean(acceptedTerms) ? (
              <Icon name="check" iconStyle="solid" size={12} color="#FFFFFF" />
            ) : null}
          </TouchableOpacity>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('Terms')}>
              Terms & Conditions
            </Text>
            ,{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('Policy', { policy: 'privacy' })}>
              Privacy Policy
            </Text>
            ,{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('Policy', { policy: 'anti-fraud' })}>
              Anti-Fraud Policy
            </Text>
            ,{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('Policy', { policy: 'cookies' })}>
              Cookie Policy
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('Policy', { policy: 'rewards' })}>
              Rewards &amp; Redemption Policy
            </Text>
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {(suggestSignup && method === 'password') ? (
          <TouchableOpacity style={styles.suggestBtn} onPress={createAccount} activeOpacity={0.85}>
            <Text style={styles.suggestText}>Create an account with this email</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, (busy || !acceptedTerms) && styles.btnDisabled]}
          onPress={onPrimary}
          disabled={busy}
          activeOpacity={0.85}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>

        {method === 'password' ? (
          <TouchableOpacity
            onPress={() => {
              setFlow(flow === 'signUp' ? 'signIn' : 'signUp');
              setError('');
              setSuggestSignup(false);
            }}
            style={styles.switchRow}>
            <Text style={styles.switchText}>
              {flow === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </TouchableOpacity>
        ) : otpStep === 'code' ? (
          <TouchableOpacity
            onPress={() => {
              setOtpStep('email');
              setCode('');
              setError('');
            }}
            style={styles.switchRow}>
            <Text style={styles.switchText}>Use a different email</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={[styles.social, styles.tgBtn, (!acceptedTerms || tgNonce) && styles.btnDisabled]}
        onPress={continueWithTelegram}
        disabled={!!tgNonce}
        activeOpacity={0.85}>
        <Icon name="telegram" iconStyle="brand" size={20} color={colors.white} />
        <Text style={styles.socialText}>
          {tgNonce ? 'Waiting for Telegram…' : 'Continue with Telegram'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.soon}>Sidra KYC sign-in coming soon</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  emblem: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow.raised,
  },
  logo: { fontSize: 40, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, ...shadow.card },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { fontWeight: '700', color: colors.textMuted, fontSize: 14 },
  tabTextActive: { color: colors.primaryDeep },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
    fontWeight: '500',
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12, fontWeight: '600' },
  suggestBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.raised,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  switchRow: { alignItems: 'center', marginTop: 14 },
  switchText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.pill,
    paddingVertical: 15,
    ...shadow.raised,
  },
  tgBtn: { backgroundColor: '#229ED9' },
  socialText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  soon: { textAlign: 'center', color: colors.textFaint, fontSize: 12, marginTop: 22 },
});
